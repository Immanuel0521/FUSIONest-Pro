import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useFaceRecognition, FACE_CONFIDENCE_THRESHOLD, analyseFrameBrightness } from '@/hooks/useFaceRecognition';
import { useGeolocation, LocationData } from '@/hooks/useGeolocation';
import { useLivenessDetection } from '@/hooks/useLivenessDetection';
import { supabase } from '@/lib/supabase';
import { unifiedCheckIn, unifiedCheckOut } from '@/lib/attendanceService';
import { roundCoordinates, verifyGeofence, type SiteBoundary, type GeofenceResult } from '@/lib/geofence';
import { logFaceAttendance, logConsentAction, writeAuditLog } from '@/lib/auditLogger';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';
import { 
  Camera, 
  Loader2, 
  CheckCircle2, 
  MapPin, 
  LogIn, 
  LogOut,
  AlertTriangle,
  RefreshCw,
  X,
  Eye,
  Shield,
  ShieldAlert,
  Navigation,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Worker {
  id: string;
  full_name: string;
  photo_url: string | null;
}

interface FaceEmbedding {
  worker_id: string;
  worker_name: string;
  embedding_data: number[];
}

interface FaceScannerProps {
  onAttendanceMarked?: (workerId: string, type: 'in' | 'out') => void;
  publicMode?: boolean;
}

/** Debounce scan button (ms) to prevent hammering the detection pipeline */
const SCAN_COOLDOWN_MS = 3000;

export function FaceScanner({ onAttendanceMarked, publicMode = false }: FaceScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const {
    modelsLoaded,
    loading: modelsLoading,
    loadModels,
    startCamera,
    stopCamera,
    detectFace,
    matchFace,
  } = useFaceRecognition();

  const { 
    loading: locationLoading, 
    getLocation,
  } = useGeolocation();

  const liveness = useLivenessDetection();

  const { toast } = useToast();
  
  const [cameraActive, setCameraActive] = useState(false);
  const [scanStatus, setScanStatus] = useState<'idle' | 'scanning' | 'liveness' | 'success' | 'error'>('idle');
  const [matchedWorker, setMatchedWorker] = useState<Worker | null>(null);
  const [attendanceType, setAttendanceType] = useState<'in' | 'out' | null>(null);
  const [matchConfidence, setMatchConfidence] = useState(0);
  const [storedEmbeddings, setStoredEmbeddings] = useState<FaceEmbedding[]>([]);
  const [processing, setProcessing] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [locationAddress, setLocationAddress] = useState<string | null>(null);
  const [fetchingAddress, setFetchingAddress] = useState(false);
  const [scanCooldown, setScanCooldown] = useState(false);
  const [brightnessWarning, setBrightnessWarning] = useState<string | null>(null);
  const [geofenceResult, setGeofenceResult] = useState<GeofenceResult | null>(null);
  const [mockLocationWarning, setMockLocationWarning] = useState(false);

  // Load models and embeddings on mount
  useEffect(() => {
    loadModels();
    loadEmbeddings();
  }, []);

  const loadEmbeddings = async () => {
    if (publicMode) {
      try {
        const res = await supabase.functions.invoke('public-attendance', {
          body: { action: 'get_embeddings' },
        });
        if (res.data?.data) {
          setStoredEmbeddings(res.data.data.map((e: any) => ({
            worker_id: e.worker_id,
            worker_name: e.workers?.full_name || 'Unknown',
            embedding_data: e.embedding_data as number[],
          })));
        }
      } catch (err) {
        console.error('Failed to load embeddings in public mode:', err);
      }
      return;
    }

    const { data, error } = await supabase
      .from('face_embeddings')
      .select(`
        worker_id,
        embedding_data,
        workers (full_name)
      `);

    if (data && !error) {
      setStoredEmbeddings(data.map(e => ({
        worker_id: e.worker_id,
        worker_name: (e.workers as any)?.full_name || 'Unknown',
        embedding_data: e.embedding_data as number[],
      })));
    }
  };

  // Reverse geocode location to address
  const fetchAddress = useCallback(async (lat: number, lng: number) => {
    setFetchingAddress(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`);
      const data = await res.json();
      if (data?.display_name) {
        setLocationAddress(data.display_name);
      }
    } catch {
      setLocationAddress(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
    } finally {
      setFetchingAddress(false);
    }
  }, []);

  // Load geofence sites and verify location against the nearest one
  const checkGeofence = useCallback(async (loc: LocationData) => {
    try {
      const { data: sites } = await supabase
        .from('geofence_sites')
        .select('*')
        .eq('is_active', true);

      if (sites && sites.length > 0) {
        // Find nearest site and verify
        let bestResult: GeofenceResult | null = null;
        for (const site of sites) {
          const boundary: SiteBoundary = {
            latitude: site.latitude,
            longitude: site.longitude,
            radiusMeters: site.radius_meters,
            name: site.name,
          };
          const result = verifyGeofence(loc.latitude, loc.longitude, loc.accuracy, boundary);
          if (!bestResult || result.verdict === 'on_site') {
            bestResult = result;
            if (result.verdict === 'on_site') break;
          }
        }
        setGeofenceResult(bestResult);

        if (bestResult) {
          await writeAuditLog({
            action: bestResult.verdict === 'on_site' ? 'geofence_on_site' :
                    bestResult.verdict === 'outside_site' ? 'geofence_outside_site' :
                    'geofence_unverifiable',
            entityType: 'geofence',
            details: {
              distance: bestResult.distanceMeters,
              site_name: bestResult.siteName,
              accuracy: bestResult.accuracy,
            },
          });
        }
      }
    } catch (err) {
      console.warn('Geofence check failed:', err);
    }
  }, []);

  const handleStartCamera = async () => {
    if (!videoRef.current) return;

    // First get location (required)
    const loc = await getLocation();
    if (!loc) {
      toast({
        variant: 'destructive',
        title: 'Location Required',
        description: 'Please enable location access to mark attendance',
      });
      return;
    }

    // Mock-location detection
    if (loc.isMockLocationSuspected) {
      setMockLocationWarning(true);
      await writeAuditLog({
        action: 'mock_location_detected',
        entityType: 'geofence',
        details: {
          accuracy: loc.accuracy,
          speed: loc.speed,
          timestamp: new Date().toISOString(),
        },
      });
      toast({
        variant: 'destructive',
        title: 'Suspicious Location',
        description: 'Location data appears to be spoofed. This has been flagged for review.',
      });
    }

    setCurrentLocation(loc);
    fetchAddress(loc.latitude, loc.longitude);
    checkGeofence(loc);

    const success = await startCamera(videoRef.current, 'user');
    if (success) {
      setCameraActive(true);
      setScanStatus('idle');

      // Check brightness after camera stabilises
      setTimeout(() => {
        if (videoRef.current) {
          const brightness = analyseFrameBrightness(videoRef.current);
          if (brightness < 60) {
            setBrightnessWarning('Lighting is too dark. Move to a well-lit area for better recognition.');
          } else if (brightness > 220) {
            setBrightnessWarning('Too much glare. Avoid direct sunlight on your face.');
          } else {
            setBrightnessWarning(null);
          }
        }
      }, 1500);
    } else {
      toast({
        variant: 'destructive',
        title: 'Camera Error',
        description: 'Could not access camera. Please grant permission.',
      });
    }
  };

  const handleStopCamera = () => {
    stopCamera();
    liveness.reset();
    setCameraActive(false);
    setScanStatus('idle');
    setMatchedWorker(null);
    setAttendanceType(null);
    setBrightnessWarning(null);
    setGeofenceResult(null);
    setMockLocationWarning(false);
  };

  const handleRefreshLocation = async () => {
    const loc = await getLocation();
    if (loc) {
      setCurrentLocation(loc);
      fetchAddress(loc.latitude, loc.longitude);
      checkGeofence(loc);
      if (loc.isMockLocationSuspected) {
        setMockLocationWarning(true);
      }
    }
  };

  const handleScan = useCallback(async () => {
    if (!videoRef.current || !modelsLoaded || storedEmbeddings.length === 0) {
      if (storedEmbeddings.length === 0) {
        toast({
          variant: 'destructive',
          title: 'No Faces Registered',
          description: 'Please register worker faces in Admin panel first',
        });
      }
      return;
    }

    // Rate-limiting: prevent hammering
    if (scanCooldown) {
      toast({ title: 'Please wait', description: 'Scan is cooling down, try again in a moment.' });
      return;
    }

    setScanCooldown(true);
    setTimeout(() => setScanCooldown(false), SCAN_COOLDOWN_MS);

    setScanStatus('scanning');
    setProcessing(true);
    setMatchedWorker(null);
    setAttendanceType(null);

    try {
      const faceData = await detectFace(videoRef.current);

      if (!faceData) {
        setScanStatus('error');
        toast({
          variant: 'destructive',
          title: 'No Face Detected',
          description: 'Please position your face clearly in front of the camera',
        });
        return;
      }

      const result = matchFace(faceData.descriptor, storedEmbeddings);

      // Enforce configurable confidence threshold
      if (!result.matched || result.confidence < FACE_CONFIDENCE_THRESHOLD) {
        setScanStatus('error');
        await writeAuditLog({
          action: 'face_match_failure',
          entityType: 'biometric',
          details: {
            confidence: result.confidence,
            threshold: FACE_CONFIDENCE_THRESHOLD,
            matched: result.matched,
          },
        });

        if (result.matched && result.confidence < FACE_CONFIDENCE_THRESHOLD) {
          toast({
            variant: 'destructive',
            title: 'Low Confidence',
            description: `Match confidence (${result.confidence}%) is below the required ${FACE_CONFIDENCE_THRESHOLD}%. Try better lighting or re-register.`,
          });
        } else {
          toast({
            variant: 'destructive',
            title: 'Not Recognized',
            description: 'Face not registered. Please contact admin.',
          });
        }
        return;
      }

      // Face matched — now run liveness detection
      await writeAuditLog({
        action: 'face_match_success',
        entityType: 'biometric',
        details: { worker_id: result.workerId, confidence: result.confidence },
      });

      let worker: Worker | null = null;

      if (publicMode) {
        const res = await supabase.functions.invoke('public-attendance', {
          body: { action: 'get_worker', workerId: result.workerId },
        });
        worker = res.data?.data || null;
      } else {
        const { data } = await supabase
          .from('workers')
          .select('id, full_name, photo_url')
          .eq('id', result.workerId!)
          .single();
        worker = data;
      }

      if (worker) {
        setMatchedWorker(worker);
        setMatchConfidence(result.confidence);

        // Start liveness detection
        setScanStatus('liveness');
        if (videoRef.current) {
          liveness.startDetection(videoRef.current);
        }

        // Wait for liveness to complete (poll with timeout)
        const livenessTimeout = 15000; // 15 seconds
        const startTime = Date.now();
        
        await new Promise<void>((resolve) => {
          const checkInterval = setInterval(() => {
            if (liveness.state.verified || Date.now() - startTime > livenessTimeout) {
              clearInterval(checkInterval);
              resolve();
            }
          }, 200);
        });

        liveness.stopDetection();

        if (!liveness.state.verified) {
          await writeAuditLog({
            action: 'liveness_failed',
            entityType: 'biometric',
            details: { worker_id: worker.id, completed: liveness.state.completedCount },
          });
          toast({
            variant: 'destructive',
            title: 'Liveness Check Failed',
            description: 'Could not verify you are a live person. Please try again.',
          });
          setScanStatus('error');
          return;
        }

        await writeAuditLog({
          action: 'liveness_passed',
          entityType: 'biometric',
          details: { worker_id: worker.id },
        });

        // Determine check-in vs check-out
        let existingAttendance: any = null;
        if (publicMode) {
          const res = await supabase.functions.invoke('public-attendance', {
            body: { action: 'check_status', workerId: worker.id },
          });
          existingAttendance = res.data?.data;
        } else {
          const today = new Date().toISOString().split('T')[0];
          const { data } = await supabase
            .from('attendance_logs')
            .select('id, time_in, time_out')
            .eq('worker_id', worker.id)
            .eq('date', today)
            .maybeSingle();
          existingAttendance = data;
        }

        if (!existingAttendance) {
          setAttendanceType('in');
        } else if (!existingAttendance.time_out) {
          setAttendanceType('out');
        } else {
          toast({
            title: 'Already Complete',
            description: `${worker.full_name} has completed attendance for today`,
          });
        }

        setScanStatus('success');
        toast({
          title: 'Face Matched & Verified! ✓',
          description: `${worker.full_name} verified (${result.confidence}% confidence, liveness ✓)`,
        });
      }
    } catch (err: any) {
      setScanStatus('error');
      toast({
        variant: 'destructive',
        title: 'Scan Error',
        description: err.message || 'Failed to process face scan',
      });
    } finally {
      setProcessing(false);
    }
  }, [modelsLoaded, storedEmbeddings, detectFace, matchFace, toast, scanCooldown, liveness]);

  // Capture photo from video and upload to storage
  const captureAndSavePhoto = async (workerId: string, attendanceId: string | undefined, type: 'checkin' | 'checkout') => {
    if (!videoRef.current) return;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(videoRef.current, 0, 0);
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8));
      if (!blob) return;

      const today = new Date().toISOString().split('T')[0];
      const fileName = `${workerId}/${today}_${type}_${Date.now()}.jpg`;
      
      const { error: uploadError } = await supabase.storage
        .from('attendance-photos')
        .upload(fileName, blob, { contentType: 'image/jpeg' });

      if (uploadError) {
        console.error('Photo upload error:', uploadError);
        return;
      }

      // Bucket is private; store the storage path in photo_url so admins can later create signed URLs.
      const photoUrl = `attendance-photos/${fileName}`;

      await (supabase.from('attendance_photos') as any).insert({
        worker_id: workerId,
        attendance_id: attendanceId || null,
        photo_url: photoUrl,
        photo_type: type,
        date: today,
      });
    } catch (err) {
      console.error('Failed to save attendance photo:', err);
    }
  };

  const handleMarkAttendance = async () => {
    if (!matchedWorker || !attendanceType || !currentLocation) return;

    setProcessing(true);
    
    try {
      // Round GPS coordinates to 5 decimal places (~1.1m precision)
      const rounded = roundCoordinates(currentLocation.latitude, currentLocation.longitude);
      const locationJson = {
        lat: rounded.lat,
        lng: rounded.lng,
        accuracy: currentLocation.accuracy,
      };

      let resultAttendanceId: string | undefined;

      if (publicMode) {
        // Public mode: use edge function
        const action = attendanceType === 'in' ? 'check_in' : 'check_out';
        const res = await supabase.functions.invoke('public-attendance', {
          body: {
            action,
            workerId: matchedWorker.id,
            location: locationJson,
            faceConfidence: matchConfidence,
            source: 'face_recognition',
            livenessVerified: liveness.state.verified,
            geofenceVerdict: geofenceResult?.verdict ?? 'unknown',
            mockLocationFlag: mockLocationWarning,
          },
        });

        const result = res.data;
        if (!result) throw new Error('No response from server');

        if (result.status === 'already_checked_in' || result.status === 'already_checked_out') {
          toast({ title: attendanceType === 'in' ? 'Already Checked In' : 'Already Checked Out', description: result.message });
        } else if (result.status === 'error' || result.status === 'no_checkin') {
          throw new Error(result.message || result.error);
        } else {
          resultAttendanceId = result.attendance_id;
          toast({ title: attendanceType === 'in' ? 'Check-In Successful! ✓' : 'Check-Out Successful! ✓', description: result.message });
        }
      } else {
        // Authenticated mode: use direct Supabase calls
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user?.id) {
          toast({
            variant: 'destructive',
            title: 'Authentication Required',
            description: 'A supervisor must be logged in to mark attendance via face scanner',
          });
          setProcessing(false);
          return;
        }

        if (attendanceType === 'in') {
          const result = await unifiedCheckIn({
            workerId: matchedWorker.id,
            supervisorId: user.id,
            source: 'face_recognition',
            recordedBy: 'system',
            locationIn: locationJson,
            faceVerified: true,
            faceConfidence: matchConfidence,
          });

          if (result.status === 'already_checked_in') {
            toast({ title: 'Already Checked In', description: result.message });
          } else if (result.status === 'error') {
            throw new Error(result.message);
          } else {
            resultAttendanceId = result.attendance_id;
            toast({ title: 'Check-In Successful! ✓', description: result.message });
          }
        } else {
          const result = await unifiedCheckOut({
            workerId: matchedWorker.id,
            source: 'face_recognition',
            recordedBy: 'system',
            locationOut: locationJson,
            faceVerified: true,
            faceConfidence: matchConfidence,
          });

          if (result.status === 'already_checked_out') {
            toast({ title: 'Already Checked Out', description: result.message });
          } else if (result.status === 'no_checkin' || result.status === 'error') {
            throw new Error(result.message);
          } else {
            resultAttendanceId = result.attendance_id;
            toast({ title: 'Check-Out Successful! ✓', description: result.message });
          }
        }
      }

      // Save the face photo for admin review
      await captureAndSavePhoto(
        matchedWorker.id,
        resultAttendanceId,
        attendanceType === 'in' ? 'checkin' : 'checkout'
      );

      // Audit log
      await logFaceAttendance(
        matchedWorker.id,
        resultAttendanceId,
        attendanceType,
        matchConfidence,
        {
          lat: rounded.lat,
          lng: rounded.lng,
          accuracy: currentLocation.accuracy,
        },
        liveness.state.verified,
        geofenceResult?.verdict,
      );

      onAttendanceMarked?.(matchedWorker.id, attendanceType);

      setTimeout(() => {
        setScanStatus('idle');
        setMatchedWorker(null);
        setAttendanceType(null);
        liveness.reset();
      }, 3000);
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err.message,
      });
    } finally {
      setProcessing(false);
    }
  };

  // ══════════════════════════════════════════════════════════════
  // CONSENT DIALOG
  // ══════════════════════════════════════════════════════════════
  if (!consentGiven) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
        <div className="max-w-sm w-full space-y-6 text-center">
          <div className="w-20 h-20 mx-auto rounded-full bg-primary/20 flex items-center justify-center">
            <Camera className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-2xl font-bold">Face Recognition</h2>
          <p className="text-muted-foreground text-sm">
            This system uses face recognition, liveness detection, and GPS to mark attendance securely.
          </p>
          
          <div className="bg-muted/50 p-4 rounded-xl text-left space-y-2 text-sm">
            <p className="font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              By continuing, you consent to:
            </p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Camera access for face scanning</li>
              <li>Liveness detection (blink & head-turn)</li>
              <li>GPS location capture & geofence verification</li>
              <li>Face descriptor storage for identification</li>
              <li>Attendance photo capture for supervisor review</li>
            </ul>
          </div>

          <div className="text-xs text-muted-foreground">
            Your biometric data is processed locally in the browser. Read our{' '}
            <Link to="/privacy" className="text-primary underline hover:text-primary/80">
              Privacy Policy
            </Link>{' '}
            for details.
          </div>

          <Button 
            className="w-full" 
            size="lg"
            onClick={async () => {
              setConsentGiven(true);
              // Record consent in the database for audit
              await logConsentAction(null, 'biometric_consent_granted');
              try {
                await supabase.from('user_consents').insert({
                  consent_type: 'biometric_location',
                  granted: true,
                  granted_at: new Date().toISOString(),
                  user_agent: navigator.userAgent,
                });
              } catch {
                // Non-blocking: table may not exist yet
              }
            }}
          >
            <Shield className="w-4 h-4 mr-2" />
            I Agree & Continue
          </Button>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // FULL-SCREEN CAMERA LAYOUT
  // ══════════════════════════════════════════════════════════════
  return (
    <div className="relative flex flex-col" style={{ minHeight: 'calc(100vh - 200px)', maxHeight: '80vh' }}>
      {/* Camera view - takes up most of the screen */}
      <div className="relative flex-1 bg-black rounded-xl overflow-hidden">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          style={{ transform: 'scaleX(-1)' }}
          playsInline
          muted
          aria-label="Live camera feed for face verification"
        />

        {!cameraActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/90 text-center p-6">
            <Camera className="w-16 h-16 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">
              {modelsLoading ? 'Loading AI models...' : 'Tap below to start camera'}
            </p>
            <Button 
              onClick={handleStartCamera}
              disabled={modelsLoading || !modelsLoaded}
              size="lg"
            >
              {modelsLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Loading AI...
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4 mr-2" />
                  Start Camera
                </>
              )}
            </Button>
          </div>
        )}

        {/* Brightness warning overlay */}
        <AnimatePresence>
          {brightnessWarning && cameraActive && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-3 left-3 right-3 bg-amber-500/90 text-white text-sm px-4 py-2.5 rounded-xl flex items-center gap-2 z-10"
            >
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {brightnessWarning}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mock location warning */}
        <AnimatePresence>
          {mockLocationWarning && cameraActive && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-14 left-3 right-3 bg-red-500/90 text-white text-sm px-4 py-2.5 rounded-xl flex items-center gap-2 z-10"
            >
              <ShieldAlert className="w-4 h-4 shrink-0" />
              Possible mock location detected — flagged for review
            </motion.div>
          )}
        </AnimatePresence>

        {/* Face guide overlay */}
        {cameraActive && scanStatus !== 'success' && scanStatus !== 'liveness' && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <motion.div
              className={`w-48 h-60 border-4 rounded-[50%] ${
                scanStatus === 'scanning' ? 'border-primary animate-pulse' :
                scanStatus === 'error' ? 'border-red-500' :
                'border-white/40'
              }`}
              animate={scanStatus === 'scanning' ? { scale: [1, 1.03, 1] } : {}}
              transition={{ repeat: Infinity, duration: 1 }}
            />
          </div>
        )}

        {/* Liveness detection overlay */}
        <AnimatePresence>
          {scanStatus === 'liveness' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center text-white p-6 z-20"
            >
              <motion.div
                className="w-52 h-64 border-4 border-cyan-400 rounded-[50%]"
                animate={{ scale: [1, 1.02, 1], borderColor: ['#22d3ee', '#06b6d4', '#22d3ee'] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
              />
              <div className="mt-6 text-center">
                <div className="flex items-center gap-2 justify-center mb-2">
                  <Eye className="w-5 h-5 text-cyan-400" />
                  <h3 className="text-lg font-bold">Liveness Check</h3>
                </div>
                <p className="text-white/90 text-sm font-medium">
                  {liveness.state.instruction || 'Preparing...'}
                </p>
                <div className="flex gap-2 justify-center mt-3">
                  {Array.from({ length: liveness.state.totalChallenges }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-3 h-3 rounded-full transition-colors ${
                        i < liveness.state.completedCount ? 'bg-cyan-400' : 'bg-white/30'
                      }`}
                    />
                  ))}
                </div>
                <p className="text-white/50 text-xs mt-2">
                  Step {liveness.state.completedCount + 1} of {liveness.state.totalChallenges}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Matched worker overlay */}
        <AnimatePresence>
          {matchedWorker && scanStatus === 'success' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white p-6"
            >
              <CheckCircle2 className="w-16 h-16 text-green-400 mb-4" />
              <Avatar className="w-20 h-20 mb-3 border-2 border-green-400">
                <AvatarImage src={matchedWorker.photo_url || undefined} />
                <AvatarFallback className="bg-primary/20 text-primary text-2xl">
                  {matchedWorker.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <h3 className="text-xl font-bold">{matchedWorker.full_name}</h3>
              
              {/* Confidence badge with progress bar */}
              <Badge className="mt-2 bg-green-500/20 text-green-300 border-green-500/30">
                {matchConfidence}% match
              </Badge>
              <div className="w-40 mt-1.5">
                <div className="w-full bg-white/20 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all ${
                      matchConfidence >= 90 ? 'bg-green-400' :
                      matchConfidence >= 75 ? 'bg-yellow-400' : 'bg-red-400'
                    }`}
                    style={{ width: `${matchConfidence}%` }}
                  />
                </div>
              </div>

              {/* Verification badges */}
              <div className="flex gap-2 mt-3">
                <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/30 text-xs">
                  <Eye className="w-3 h-3 mr-1" /> Liveness ✓
                </Badge>
                {geofenceResult && (
                  <Badge className={`text-xs ${
                    geofenceResult.verdict === 'on_site' ? 'bg-green-500/20 text-green-300 border-green-500/30' :
                    geofenceResult.verdict === 'outside_site' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' :
                    'bg-gray-500/20 text-gray-300 border-gray-500/30'
                  }`}>
                    <Navigation className="w-3 h-3 mr-1" />
                    {geofenceResult.verdict === 'on_site' ? 'On Site' :
                     geofenceResult.verdict === 'outside_site' ? 'Off Site' : 'GPS Weak'}
                  </Badge>
                )}
              </div>

              {attendanceType && (
                <Button
                  size="lg"
                  onClick={handleMarkAttendance}
                  disabled={processing}
                  className="mt-6 w-full max-w-xs h-14 text-lg"
                >
                  {processing ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : attendanceType === 'in' ? (
                    <>
                      <LogIn className="w-5 h-5 mr-2" />
                      Mark Check-In
                    </>
                  ) : (
                    <>
                      <LogOut className="w-5 h-5 mr-2" />
                      Mark Check-Out
                    </>
                  )}
                </Button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom controls: location bar + geofence info + capture/cancel buttons */}
      {cameraActive && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 space-y-3"
        >
          {/* Location bar */}
          <div className="flex items-center gap-3 bg-card rounded-xl px-4 py-3 border border-border shadow-sm">
            <MapPin className="w-5 h-5 text-primary shrink-0" />
            <p className="text-sm text-muted-foreground truncate flex-1">
              {fetchingAddress || locationLoading ? 'Getting location...' : 
               locationAddress || 'Location captured'}
            </p>
            <button 
              onClick={handleRefreshLocation}
              className="shrink-0 text-primary hover:text-primary/80 transition-colors"
              disabled={locationLoading}
              aria-label="Refresh location"
            >
              <RefreshCw className={`w-5 h-5 ${locationLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Geofence status bar */}
          {geofenceResult && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className={`flex items-center gap-3 rounded-xl px-4 py-2.5 border text-sm ${
                geofenceResult.verdict === 'on_site'
                  ? 'bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-400'
                  : geofenceResult.verdict === 'outside_site'
                  ? 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400'
                  : 'bg-gray-500/10 border-gray-500/20 text-gray-600 dark:text-gray-400'
              }`}
            >
              <Navigation className="w-4 h-4 shrink-0" />
              <span className="truncate">{geofenceResult.message}</span>
            </motion.div>
          )}

          {/* Capture button + Cancel */}
          <div className="flex items-center justify-between px-4">
            <Button
              variant="ghost"
              onClick={handleStopCamera}
              className="text-destructive hover:text-destructive"
            >
              Cancel
            </Button>

            <button
              onClick={handleScan}
              disabled={processing || scanStatus === 'success' || scanStatus === 'liveness' || scanCooldown}
              className={`w-[72px] h-[72px] rounded-full border-[5px] flex items-center justify-center transition-colors disabled:opacity-50 ${
                scanCooldown ? 'border-gray-400 bg-gray-400/10' : 'border-primary bg-primary/10 hover:bg-primary/20'
              }`}
              aria-label="Scan face"
            >
              {processing ? (
                <Loader2 className="w-7 h-7 text-primary animate-spin" />
              ) : (
                <div className={`w-[56px] h-[56px] rounded-full ${scanCooldown ? 'bg-gray-400' : 'bg-primary'}`} />
              )}
            </button>

            <div className="w-[68px]" /> {/* spacer for centering */}
          </div>
        </motion.div>
      )}
    </div>
  );
}
