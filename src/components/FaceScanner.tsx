import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useFaceRecognition } from '@/hooks/useFaceRecognition';
import { useGeolocation, LocationData } from '@/hooks/useGeolocation';
import { supabase } from '@/lib/supabase';
import { unifiedCheckIn, unifiedCheckOut } from '@/lib/attendanceService';
import { useToast } from '@/hooks/use-toast';
import { 
  Camera, 
  Loader2, 
  CheckCircle2, 
  MapPin, 
  LogIn, 
  LogOut,
  AlertTriangle,
  RefreshCw,
  X
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

  const { toast } = useToast();
  
  const [cameraActive, setCameraActive] = useState(false);
  const [scanStatus, setScanStatus] = useState<'idle' | 'scanning' | 'success' | 'error'>('idle');
  const [matchedWorker, setMatchedWorker] = useState<Worker | null>(null);
  const [attendanceType, setAttendanceType] = useState<'in' | 'out' | null>(null);
  const [matchConfidence, setMatchConfidence] = useState(0);
  const [storedEmbeddings, setStoredEmbeddings] = useState<FaceEmbedding[]>([]);
  const [processing, setProcessing] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [locationAddress, setLocationAddress] = useState<string | null>(null);
  const [fetchingAddress, setFetchingAddress] = useState(false);

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
    setCurrentLocation(loc);
    fetchAddress(loc.latitude, loc.longitude);

    const success = await startCamera(videoRef.current, 'user');
    if (success) {
      setCameraActive(true);
      setScanStatus('idle');
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
    setCameraActive(false);
    setScanStatus('idle');
    setMatchedWorker(null);
    setAttendanceType(null);
  };

  const handleRefreshLocation = async () => {
    const loc = await getLocation();
    if (loc) {
      setCurrentLocation(loc);
      fetchAddress(loc.latitude, loc.longitude);
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

      if (result.matched && result.workerId) {
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
            .eq('id', result.workerId)
            .single();
          worker = data;
        }

        if (worker) {
          setMatchedWorker(worker);
          setMatchConfidence(result.confidence);

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
            title: 'Face Matched!',
            description: `${worker.full_name} verified (${result.confidence}% confidence)`,
          });
        }
      } else {
        setScanStatus('error');
        toast({
          variant: 'destructive',
          title: 'Not Recognized',
          description: 'Face not registered. Please contact admin.',
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
  }, [modelsLoaded, storedEmbeddings, detectFace, matchFace, toast]);

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
      const locationJson = {
        lat: currentLocation.latitude,
        lng: currentLocation.longitude,
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

      onAttendanceMarked?.(matchedWorker.id, attendanceType);

      setTimeout(() => {
        setScanStatus('idle');
        setMatchedWorker(null);
        setAttendanceType(null);
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

  // Consent dialog
  if (!consentGiven) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
        <div className="max-w-sm w-full space-y-6 text-center">
          <div className="w-20 h-20 mx-auto rounded-full bg-primary/20 flex items-center justify-center">
            <Camera className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-2xl font-bold">Face Recognition</h2>
          <p className="text-muted-foreground text-sm">
            This system uses face recognition and GPS to mark attendance.
          </p>
          
          <div className="bg-muted/50 p-4 rounded-xl text-left space-y-2 text-sm">
            <p className="font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              By continuing, you consent to:
            </p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Camera access for face scanning</li>
              <li>GPS location capture</li>
              <li>Face data storage for identification</li>
            </ul>
          </div>

          <Button 
            className="w-full" 
            size="lg"
            onClick={() => setConsentGiven(true)}
          >
            I Agree & Continue
          </Button>
        </div>
      </div>
    );
  }

  // Full-screen camera layout like the reference image
  return (
    <div className="relative flex flex-col" style={{ minHeight: 'calc(100vh - 200px)' }}>
      {/* Camera view - takes up most of the screen */}
      <div className="relative flex-1 bg-black rounded-xl overflow-hidden">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          style={{ transform: 'scaleX(-1)' }}
          playsInline
          muted
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

        {/* Face guide overlay */}
        {cameraActive && scanStatus !== 'success' && (
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
              <Badge className="mt-2 bg-green-500/20 text-green-300 border-green-500/30">
                {matchConfidence}% match
              </Badge>

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

      {/* Bottom controls: location bar + capture/cancel buttons */}
      {cameraActive && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 space-y-4"
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
            >
              <RefreshCw className={`w-5 h-5 ${locationLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

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
              disabled={processing || scanStatus === 'success'}
              className="w-[72px] h-[72px] rounded-full border-[5px] border-primary flex items-center justify-center bg-primary/10 hover:bg-primary/20 transition-colors disabled:opacity-50"
            >
              {processing ? (
                <Loader2 className="w-7 h-7 text-primary animate-spin" />
              ) : (
                <div className="w-[56px] h-[56px] rounded-full bg-primary" />
              )}
            </button>

            <div className="w-[68px]" /> {/* spacer for centering */}
          </div>
        </motion.div>
      )}
    </div>
  );
}
