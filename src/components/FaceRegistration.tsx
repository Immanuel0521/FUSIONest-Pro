import { useState, useRef, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { useFaceRecognition } from '@/hooks/useFaceRecognition';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { 
  Camera, 
  Loader2, 
  CheckCircle2, 
  Search, 
  Trash2, 
  User, 
  Scan,
  Upload,
  RefreshCw,
  RotateCcw,
  ArrowLeft,
  ArrowRight,
  X,
  Sparkles,
  Shield,
  Eye,
  Zap,
  CircleDot,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Worker {
  id: string;
  full_name: string;
  photo_url: string | null;
  designation: string | null;
}

interface FaceEmbedding {
  id: string;
  worker_id: string;
  quality_score: number | null;
  created_at: string;
  angle?: string;
}

type CaptureAngle = 'front' | 'left' | 'right';

const CAPTURE_STEPS: { angle: CaptureAngle; label: string; instruction: string; emoji: string }[] = [
  { angle: 'front', label: 'Front', instruction: 'Look straight ahead', emoji: '👤' },
  { angle: 'left', label: 'Left', instruction: 'Turn head slightly left', emoji: '👈' },
  { angle: 'right', label: 'Right', instruction: 'Turn head slightly right', emoji: '👉' },
];

export function FaceRegistration() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    modelsLoaded,
    loading: modelsLoading,
    loadModels,
    startCamera,
    stopCamera,
    detectFace,
    detectFaceFromImage,
    captureFrame,
  } = useFaceRecognition();

  const { toast } = useToast();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [embeddings, setEmbeddings] = useState<FaceEmbedding[]>([]);
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);

  // Multi-angle capture state
  const [currentStep, setCurrentStep] = useState(0);
  const [capturedAngles, setCapturedAngles] = useState<{ angle: CaptureAngle; descriptor: number[]; photoBase64: string | null; confidence: number }[]>([]);
  const [captureCooldown, setCaptureCooldown] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [capturedThumbnails, setCapturedThumbnails] = useState<(string | null)[]>([]);
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadModels();
    loadData();
  }, []);

  // Continuous face detection for real-time feedback
  useEffect(() => {
    if (cameraActive && modelsLoaded && videoRef.current && !captureCooldown && countdown === null) {
      detectionIntervalRef.current = setInterval(async () => {
        if (videoRef.current) {
          const face = await detectFace(videoRef.current);
          setFaceDetected(!!face);
        }
      }, 500);
    }
    return () => {
      if (detectionIntervalRef.current) clearInterval(detectionIntervalRef.current);
    };
  }, [cameraActive, modelsLoaded, captureCooldown, countdown, detectFace]);

  const loadData = async () => {
    setLoading(true);
    const [workersRes, embeddingsRes] = await Promise.all([
      supabase.from('workers').select('id, full_name, photo_url, designation').order('full_name'),
      supabase.from('face_embeddings').select('id, worker_id, quality_score, created_at, angle'),
    ]);
    if (workersRes.data) setWorkers(workersRes.data);
    if (embeddingsRes.data) setEmbeddings(embeddingsRes.data as FaceEmbedding[]);
    setLoading(false);
  };

  const openFullscreenCamera = async (worker: Worker) => {
    setSelectedWorker(worker);
    setFullscreenOpen(true);
    setCurrentStep(0);
    setCapturedAngles([]);
    setCapturedThumbnails([]);
    setShowSuccess(false);

    // Small delay to let the DOM render the video element
    setTimeout(async () => {
      if (videoRef.current) {
        const success = await startCamera(videoRef.current, 'user');
        if (success) {
          setCameraActive(true);
        } else {
          toast({ variant: 'destructive', title: 'Camera Error', description: 'Could not access camera' });
          setFullscreenOpen(false);
        }
      }
    }, 100);
  };

  const closeFullscreen = () => {
    stopCamera();
    setCameraActive(false);
    setFullscreenOpen(false);
    setCurrentStep(0);
    setCapturedAngles([]);
    setCapturedThumbnails([]);
    setCountdown(null);
    setFaceDetected(false);
    setShowSuccess(false);
  };

  const handleAutoCapture = useCallback(async () => {
    if (!videoRef.current || !modelsLoaded || captureCooldown || registering) return;

    // Start countdown
    setCountdown(3);
    for (let i = 2; i >= 0; i--) {
      await new Promise(r => setTimeout(r, 800));
      setCountdown(i);
    }
    setCountdown(null);

    setCaptureCooldown(true);
    setRegistering(true);

    try {
      const faceData = await detectFace(videoRef.current);
      if (!faceData) throw new Error('No face detected. Try again.');

      const photoBase64 = captureFrame(videoRef.current);
      const confidence = faceData.detection.score * 100;
      const step = CAPTURE_STEPS[currentStep];

      const newCapture = {
        angle: step.angle,
        descriptor: Array.from(faceData.descriptor),
        photoBase64,
        confidence,
      };

      const updatedCaptures = [...capturedAngles, newCapture];
      setCapturedAngles(updatedCaptures);
      setCapturedThumbnails(prev => {
        const next = [...prev];
        next[currentStep] = photoBase64;
        return next;
      });

      // Haptic feedback on mobile
      if (navigator.vibrate) navigator.vibrate(100);

      if (currentStep < CAPTURE_STEPS.length - 1) {
        setCurrentStep(currentStep + 1);
        setTimeout(() => setCaptureCooldown(false), 1200);
      } else {
        await saveAllEmbeddings(updatedCaptures);
        setShowSuccess(true);
        setTimeout(() => {
          closeFullscreen();
          loadData();
        }, 2500);
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Capture Failed', description: err.message });
      setCaptureCooldown(false);
    } finally {
      setRegistering(false);
    }
  }, [modelsLoaded, captureCooldown, registering, currentStep, capturedAngles, detectFace, captureFrame]);

  const saveAllEmbeddings = async (captures: typeof capturedAngles) => {
    if (!selectedWorker) return;
    setRegistering(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      await supabase.from('face_embeddings').delete().eq('worker_id', selectedWorker.id);

      for (const capture of captures) {
        let photoUrl = null;
        if (capture.photoBase64) {
          const fileName = `face_${selectedWorker.id}_${capture.angle}_${Date.now()}.jpg`;
          const base64Data = capture.photoBase64.split(',')[1];
          const { error: uploadError } = await supabase.storage
            .from('worker-photos')
            .upload(fileName, decode(base64Data), { contentType: 'image/jpeg' });
          if (!uploadError) {
            const { data: urlData } = supabase.storage.from('worker-photos').getPublicUrl(fileName);
            photoUrl = urlData.publicUrl;
          }
        }

        await supabase.from('face_embeddings').insert({
          worker_id: selectedWorker.id,
          embedding_data: capture.descriptor,
          photo_url: photoUrl,
          quality_score: Math.round(capture.confidence),
          created_by: user.id,
          angle: capture.angle,
        });
      }

      toast({
        title: '🎉 Face Registration Complete!',
        description: `${selectedWorker.full_name} registered with ${captures.length} angles`,
      });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Registration Failed', description: err.message });
    } finally {
      setRegistering(false);
    }
  };

  const handleUploadPhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedWorker || !modelsLoaded) return;

    setRegistering(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      await supabase.from('face_embeddings').delete().eq('worker_id', selectedWorker.id);

      const img = new Image();
      const imageUrl = URL.createObjectURL(file);
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = imageUrl;
      });

      const faceData = await detectFaceFromImage(img);
      URL.revokeObjectURL(imageUrl);
      if (!faceData) throw new Error('No face detected in image.');

      const fileName = `face_${selectedWorker.id}_upload_${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('worker-photos')
        .upload(fileName, file, { contentType: file.type });

      let photoUrl = null;
      if (!uploadError) {
        const { data: urlData } = supabase.storage.from('worker-photos').getPublicUrl(fileName);
        photoUrl = urlData.publicUrl;
      }

      await supabase.from('face_embeddings').insert({
        worker_id: selectedWorker.id,
        embedding_data: Array.from(faceData.descriptor),
        photo_url: photoUrl,
        quality_score: Math.round(faceData.detection.score * 100),
        created_by: user.id,
        angle: 'front',
      });

      toast({
        title: 'Face Registered from Photo!',
        description: `Camera registration recommended for better accuracy.`,
      });
      loadData();
      setSelectedWorker(null);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Registration Failed', description: err.message });
    } finally {
      setRegistering(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteEmbeddings = async (workerId: string) => {
    try {
      const { error } = await supabase.from('face_embeddings').delete().eq('worker_id', workerId);
      if (error) throw error;
      toast({ title: 'Face data deleted' });
      loadData();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Delete Failed', description: err.message });
    }
  };

  const getWorkerEmbeddings = (workerId: string) => embeddings.filter(e => e.worker_id === workerId);
  const filteredWorkers = workers.filter(w => w.full_name.toLowerCase().includes(searchTerm.toLowerCase()));
  const registeredWorkerIds = new Set(embeddings.map(e => e.worker_id));

  return (
    <div className="space-y-6">
      {/* AI Status Card */}
      <Card className="glass-card p-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-4">
            <motion.div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                modelsLoaded ? 'bg-green-500/20' : 'bg-muted'
              }`}
              animate={modelsLoaded ? { scale: [1, 1.05, 1] } : {}}
              transition={{ repeat: Infinity, duration: 3 }}
            >
              <Shield className={`w-7 h-7 ${modelsLoaded ? 'text-green-500' : 'text-muted-foreground'}`} />
            </motion.div>
            <div>
              <h3 className="font-bold text-lg">Face Recognition AI</h3>
              <p className="text-sm text-muted-foreground">
                {modelsLoading ? 'Loading neural networks...' : modelsLoaded ? '3-angle biometric capture • Real-time detection' : 'Initializing...'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {modelsLoaded && (
              <Badge className="bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30">
                <Zap className="w-3 h-3 mr-1" />
                Online
              </Badge>
            )}
          </div>
        </div>
        {modelsLoading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Downloading face detection models...</span>
            </div>
            <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-primary rounded-full"
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: 8, ease: 'easeInOut' }}
              />
            </div>
          </motion.div>
        )}
      </Card>

      {/* Quick Registration Cards */}
      {modelsLoaded && (
        <div className="grid grid-cols-2 gap-3">
          <Card
            className="glass-card p-5 cursor-pointer hover:border-primary/40 transition-all group"
            onClick={() => {
              if (workers.length > 0) {
                const unregistered = workers.find(w => !registeredWorkerIds.has(w.id));
                if (unregistered) openFullscreenCamera(unregistered);
              }
            }}
          >
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <Camera className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm">Quick Register</p>
                <p className="text-xs text-muted-foreground">Next unregistered worker</p>
              </div>
            </div>
          </Card>
          <Card className="glass-card p-5 relative overflow-hidden">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-accent" />
              </div>
              <div>
                <p className="font-semibold text-sm">{registeredWorkerIds.size}/{workers.length}</p>
                <p className="text-xs text-muted-foreground">Workers enrolled</p>
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1">
              <div
                className="h-full bg-gradient-to-r from-primary to-accent transition-all"
                style={{ width: `${workers.length > 0 ? (registeredWorkerIds.size / workers.length) * 100 : 0}%` }}
              />
            </div>
          </Card>
        </div>
      )}

      {/* Upload fallback */}
      {modelsLoaded && (
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleUploadPhoto} className="hidden" />
      )}

      {/* Workers List */}
      <Card className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold flex items-center gap-2">
            <Eye className="w-5 h-5 text-primary" />
            Workers
          </h3>
          <Button variant="ghost" size="sm" onClick={loadData}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search workers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
              Loading workers...
            </div>
          ) : filteredWorkers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No workers found</div>
          ) : (
            filteredWorkers.map((worker) => {
              const workerEmbeddings = getWorkerEmbeddings(worker.id);
              const hasEmbedding = workerEmbeddings.length > 0;
              const angleCount = workerEmbeddings.length;
              const avgQuality = hasEmbedding
                ? Math.round(workerEmbeddings.reduce((s, e) => s + (e.quality_score || 0), 0) / angleCount)
                : 0;

              return (
                <motion.div
                  key={worker.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all hover:shadow-md ${
                    hasEmbedding
                      ? angleCount >= 3
                        ? 'bg-green-500/5 border-green-500/20 hover:border-green-500/40'
                        : 'bg-amber-500/5 border-amber-500/20 hover:border-amber-500/40'
                      : 'bg-card border-border hover:border-primary/30'
                  }`}
                >
                  <Avatar className="w-11 h-11 ring-2 ring-offset-2 ring-offset-background ring-border">
                    <AvatarImage src={worker.photo_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">
                      {worker.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{worker.full_name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {hasEmbedding ? (
                        <span className={`text-xs flex items-center gap-1 ${
                          angleCount >= 3 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'
                        }`}>
                          <CheckCircle2 className="w-3 h-3" />
                          {angleCount >= 3 ? `3 angles · ${avgQuality}%` : `${angleCount} angle · ${avgQuality}%`}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Not registered</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {hasEmbedding && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Face Data?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Remove all {angleCount} face angle(s) for {worker.full_name}.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteEmbeddings(worker.id)}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}

                    {modelsLoaded && (
                      <Button
                        size="sm"
                        variant={hasEmbedding ? 'outline' : 'default'}
                        className="text-xs h-8 px-3"
                        onClick={() => openFullscreenCamera(worker)}
                      >
                        <Camera className="w-3.5 h-3.5 mr-1.5" />
                        {hasEmbedding ? 'Redo' : 'Register'}
                      </Button>
                    )}
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </Card>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* FULLSCREEN CAMERA OVERLAY */}
      {/* ═══════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {fullscreenOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black flex flex-col"
          >
            {/* Video fills entire screen */}
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover"
              style={{ transform: 'scaleX(-1)' }}
              playsInline
              muted
            />

            {/* Gradient overlays for readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/60 pointer-events-none" />

            {/* Top bar */}
            <div className="relative z-10 flex items-center justify-between p-4 pt-6">
              <Button
                variant="ghost"
                size="icon"
                onClick={closeFullscreen}
                className="text-white hover:bg-white/20 w-10 h-10 rounded-full"
              >
                <X className="w-6 h-6" />
              </Button>

              {selectedWorker && (
                <motion.div
                  initial={{ y: -20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="flex items-center gap-2 bg-white/10 backdrop-blur-xl px-4 py-2 rounded-full"
                >
                  <Avatar className="w-7 h-7">
                    <AvatarImage src={selectedWorker.photo_url || undefined} />
                    <AvatarFallback className="text-xs bg-white/20 text-white">
                      {selectedWorker.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-white font-medium text-sm">{selectedWorker.full_name}</span>
                </motion.div>
              )}

              <div className="w-10" /> {/* Spacer */}
            </div>

            {/* Center face guide */}
            <div className="flex-1 flex items-center justify-center relative z-10">
              {/* Pulsing face oval */}
              <motion.div
                className={`w-56 h-72 sm:w-64 sm:h-80 rounded-[50%] border-[3px] transition-colors duration-300 ${
                  faceDetected ? 'border-green-400 shadow-[0_0_40px_rgba(74,222,128,0.3)]' : 'border-white/40'
                }`}
                animate={faceDetected ? { scale: [1, 1.02, 1] } : { scale: 1 }}
                transition={{ repeat: Infinity, duration: 2 }}
              />

              {/* Corner scan lines */}
              <div className="absolute pointer-events-none" style={{ width: '17rem', height: '21rem' }}>
                {/* Top-left */}
                <div className={`absolute top-0 left-0 w-8 h-8 border-t-[3px] border-l-[3px] rounded-tl-2xl transition-colors ${faceDetected ? 'border-green-400' : 'border-white/60'}`} />
                {/* Top-right */}
                <div className={`absolute top-0 right-0 w-8 h-8 border-t-[3px] border-r-[3px] rounded-tr-2xl transition-colors ${faceDetected ? 'border-green-400' : 'border-white/60'}`} />
                {/* Bottom-left */}
                <div className={`absolute bottom-0 left-0 w-8 h-8 border-b-[3px] border-l-[3px] rounded-bl-2xl transition-colors ${faceDetected ? 'border-green-400' : 'border-white/60'}`} />
                {/* Bottom-right */}
                <div className={`absolute bottom-0 right-0 w-8 h-8 border-b-[3px] border-r-[3px] rounded-br-2xl transition-colors ${faceDetected ? 'border-green-400' : 'border-white/60'}`} />
              </div>

              {/* Scanning line animation */}
              {cameraActive && !faceDetected && (
                <motion.div
                  className="absolute w-52 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent"
                  animate={{ y: [-120, 120, -120] }}
                  transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
                />
              )}

              {/* Countdown overlay */}
              <AnimatePresence>
                {countdown !== null && (
                  <motion.div
                    initial={{ scale: 2, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.5, opacity: 0 }}
                    className="absolute"
                  >
                    <span className="text-8xl font-black text-white drop-shadow-2xl">
                      {countdown === 0 ? '📸' : countdown}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Direction arrows */}
              {cameraActive && countdown === null && (
                <>
                  {CAPTURE_STEPS[currentStep]?.angle === 'left' && (
                    <motion.div
                      className="absolute left-8 sm:left-16"
                      animate={{ x: [0, -15, 0] }}
                      transition={{ repeat: Infinity, duration: 1.2 }}
                    >
                      <ArrowLeft className="w-14 h-14 text-white/90 drop-shadow-lg" />
                    </motion.div>
                  )}
                  {CAPTURE_STEPS[currentStep]?.angle === 'right' && (
                    <motion.div
                      className="absolute right-8 sm:right-16"
                      animate={{ x: [0, 15, 0] }}
                      transition={{ repeat: Infinity, duration: 1.2 }}
                    >
                      <ArrowRight className="w-14 h-14 text-white/90 drop-shadow-lg" />
                    </motion.div>
                  )}
                </>
              )}
            </div>

            {/* Bottom section */}
            <div className="relative z-10 pb-8 px-4 space-y-4">
              {/* Step instruction */}
              <AnimatePresence mode="wait">
                {cameraActive && (
                  <motion.div
                    key={currentStep}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="text-center"
                  >
                    <p className="text-white/60 text-xs uppercase tracking-widest mb-1">
                      Step {currentStep + 1} of {CAPTURE_STEPS.length}
                    </p>
                    <p className="text-white text-xl font-bold">
                      {CAPTURE_STEPS[currentStep]?.emoji} {CAPTURE_STEPS[currentStep]?.instruction}
                    </p>
                    {!faceDetected && (
                      <p className="text-white/50 text-sm mt-1">Position your face in the oval</p>
                    )}
                    {faceDetected && countdown === null && (
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-green-400 text-sm mt-1 font-medium"
                      >
                        ✓ Face detected — Tap capture
                      </motion.p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Thumbnail previews of captured angles */}
              <div className="flex justify-center gap-3">
                {CAPTURE_STEPS.map((step, idx) => {
                  const thumb = capturedThumbnails[idx];
                  const isCurrent = idx === currentStep;
                  const isDone = idx < capturedAngles.length;

                  return (
                    <motion.div
                      key={step.angle}
                      className={`w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${
                        isDone
                          ? 'border-green-400'
                          : isCurrent
                          ? 'border-white'
                          : 'border-white/20'
                      }`}
                      animate={isCurrent && !isDone ? { scale: [1, 1.05, 1] } : {}}
                      transition={{ repeat: Infinity, duration: 2 }}
                    >
                      {thumb ? (
                        <img
                          src={thumb}
                          alt={step.label}
                          className="w-full h-full object-cover"
                          style={{ transform: 'scaleX(-1)' }}
                        />
                      ) : (
                        <div className="w-full h-full bg-white/10 backdrop-blur-sm flex flex-col items-center justify-center">
                          <span className="text-lg">{step.emoji}</span>
                          <span className="text-[10px] text-white/60 mt-0.5">{step.label}</span>
                        </div>
                      )}
                      {isDone && (
                        <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                          <CheckCircle2 className="w-5 h-5 text-green-400" />
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>

              {/* Capture button */}
              {cameraActive && !showSuccess && (
                <div className="flex justify-center">
                  <motion.button
                    onClick={handleAutoCapture}
                    disabled={registering || captureCooldown || countdown !== null}
                    className={`w-20 h-20 rounded-full border-4 flex items-center justify-center transition-all ${
                      faceDetected
                        ? 'border-green-400 bg-green-400/20 hover:bg-green-400/40'
                        : 'border-white/50 bg-white/10'
                    } disabled:opacity-40`}
                    whileTap={{ scale: 0.9 }}
                  >
                    {registering || captureCooldown ? (
                      <Loader2 className="w-8 h-8 text-white animate-spin" />
                    ) : (
                      <CircleDot className="w-10 h-10 text-white" />
                    )}
                  </motion.button>
                </div>
              )}

              {/* Progress bar */}
              <div className="max-w-xs mx-auto">
                <Progress
                  value={(capturedAngles.length / CAPTURE_STEPS.length) * 100}
                  className="h-1.5 bg-white/10"
                />
              </div>
            </div>

            {/* Success animation overlay */}
            <AnimatePresence>
              {showSuccess && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-20 bg-black/80 backdrop-blur-xl flex flex-col items-center justify-center gap-6"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200 }}
                  >
                    <div className="w-28 h-28 rounded-full bg-green-500/20 flex items-center justify-center">
                      <CheckCircle2 className="w-16 h-16 text-green-400" />
                    </div>
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="text-center"
                  >
                    <h2 className="text-white text-2xl font-bold mb-2">Registration Complete!</h2>
                    <p className="text-white/60">
                      {selectedWorker?.full_name} is now enrolled with 3 face angles
                    </p>
                  </motion.div>

                  {/* Show captured thumbnails */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="flex gap-4"
                  >
                    {capturedThumbnails.map((thumb, idx) => (
                      thumb && (
                        <div key={idx} className="w-20 h-20 rounded-xl overflow-hidden border-2 border-green-400/50">
                          <img
                            src={thumb}
                            alt={CAPTURE_STEPS[idx]?.label}
                            className="w-full h-full object-cover"
                            style={{ transform: 'scaleX(-1)' }}
                          />
                        </div>
                      )
                    ))}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}
