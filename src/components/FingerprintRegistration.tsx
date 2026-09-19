import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFingerprintScanner } from '@/hooks/useFingerprintScanner';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Fingerprint, Wifi, WifiOff, Loader2, CheckCircle2, Search, Trash2, User, Hand } from 'lucide-react';
import { motion } from 'framer-motion';
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

interface FingerprintTemplate {
  id: string;
  worker_id: string;
  finger_index: number;
  quality_score: number;
  created_at: string;
}

const FINGER_NAMES = [
  'Right Thumb', 'Right Index', 'Right Middle', 'Right Ring', 'Right Pinky',
  'Left Thumb', 'Left Index', 'Left Middle', 'Left Ring', 'Left Pinky'
];

export function FingerprintRegistration() {
  const {
    isConnected,
    isScanning,
    deviceInfo,
    connect,
    disconnect,
    capture,
  } = useFingerprintScanner();

  const { toast } = useToast();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [templates, setTemplates] = useState<FingerprintTemplate[]>([]);
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const [selectedFinger, setSelectedFinger] = useState('1');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    
    const [workersRes, templatesRes] = await Promise.all([
      supabase.from('workers').select('id, full_name, photo_url, designation').order('full_name'),
      supabase.from('fingerprint_templates').select('id, worker_id, finger_index, quality_score, created_at'),
    ]);

    if (workersRes.data) setWorkers(workersRes.data);
    if (templatesRes.data) setTemplates(templatesRes.data);
    setLoading(false);
  };

  const handleConnect = async () => {
    const success = await connect();
    if (!success) {
      toast({
        variant: 'destructive',
        title: 'Connection Failed',
        description: 'Could not connect to fingerprint scanner',
      });
    }
  };

  const handleRegister = async () => {
    if (!selectedWorker) {
      toast({ variant: 'destructive', title: 'Please select a worker' });
      return;
    }

    setRegistering(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Check if already registered for this finger
      const existingTemplate = templates.find(
        t => t.worker_id === selectedWorker.id && t.finger_index === parseInt(selectedFinger)
      );

      if (existingTemplate) {
        toast({
          variant: 'destructive',
          title: 'Already Registered',
          description: `${FINGER_NAMES[parseInt(selectedFinger) - 1]} is already registered. Delete it first to re-register.`,
        });
        setRegistering(false);
        return;
      }

      // Capture fingerprint
      toast({ title: 'Place finger on scanner...' });
      const result = await capture(parseInt(selectedFinger));

      if (!result.success || !result.template) {
        throw new Error(result.error || 'Failed to capture fingerprint');
      }

      // Save to database
      const { error } = await supabase.from('fingerprint_templates').insert({
        worker_id: selectedWorker.id,
        template_data: result.template.templateData,
        finger_index: result.template.fingerIndex,
        quality_score: result.template.qualityScore,
        created_by: user.id,
      });

      if (error) throw error;

      toast({
        title: 'Fingerprint Registered!',
        description: `${selectedWorker.full_name}'s ${FINGER_NAMES[parseInt(selectedFinger) - 1]} saved successfully (Quality: ${result.template.qualityScore}%)`,
      });

      loadData();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Registration Failed',
        description: error.message,
      });
    } finally {
      setRegistering(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    try {
      const { error } = await supabase
        .from('fingerprint_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;

      toast({ title: 'Fingerprint deleted' });
      loadData();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Delete Failed',
        description: error.message,
      });
    }
  };

  const getWorkerTemplates = (workerId: string) => {
    return templates.filter(t => t.worker_id === workerId);
  };

  const filteredWorkers = workers.filter(w =>
    w.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <Card className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              isConnected ? 'bg-green-500/20' : 'bg-muted'
            }`}>
              <Fingerprint className={`w-6 h-6 ${isConnected ? 'text-green-500' : 'text-muted-foreground'}`} />
            </div>
            <div>
              <h3 className="font-semibold">Scanner Status</h3>
              <p className="text-sm text-muted-foreground">
                {deviceInfo || 'Not connected'}
              </p>
            </div>
          </div>
          <Badge variant={isConnected ? 'default' : 'secondary'} className={
            isConnected ? 'bg-green-500/20 text-green-700 dark:text-green-400' : ''
          }>
            {isConnected ? <><Wifi className="w-3 h-3 mr-1" /> Connected</> : <><WifiOff className="w-3 h-3 mr-1" /> Offline</>}
          </Badge>
        </div>
        <Button
          onClick={isConnected ? disconnect : handleConnect}
          variant={isConnected ? 'outline' : 'default'}
          className="w-full"
        >
          {isConnected ? 'Disconnect' : 'Connect Scanner'}
        </Button>
      </Card>

      {/* Registration Form */}
      {isConnected && (
        <Card className="glass-card p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Hand className="w-5 h-5" />
            Register New Fingerprint
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="md:col-span-2">
              <Select
                value={selectedWorker?.id || ''}
                onValueChange={(value) => {
                  const worker = workers.find(w => w.id === value);
                  setSelectedWorker(worker || null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select worker" />
                </SelectTrigger>
                <SelectContent>
                  {workers.map(w => (
                    <SelectItem key={w.id} value={w.id}>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        {w.full_name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Select value={selectedFinger} onValueChange={setSelectedFinger}>
              <SelectTrigger>
                <SelectValue placeholder="Select finger" />
              </SelectTrigger>
              <SelectContent>
                {FINGER_NAMES.map((name, idx) => (
                  <SelectItem key={idx + 1} value={String(idx + 1)}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleRegister}
            disabled={!selectedWorker || registering}
            className="w-full"
          >
            {registering ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <Fingerprint className="w-4 h-4 mr-2" />
                Register Fingerprint
              </>
            )}
          </Button>
        </Card>
      )}

      {/* Workers List with Fingerprint Status */}
      <Card className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Worker Fingerprints</h3>
          <div className="text-sm text-muted-foreground">
            {templates.length} registered
          </div>
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

        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : filteredWorkers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No workers found</div>
          ) : (
            filteredWorkers.map((worker) => {
              const workerTemplates = getWorkerTemplates(worker.id);
              const hasFingerprint = workerTemplates.length > 0;

              return (
                <motion.div
                  key={worker.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className={`flex items-center gap-4 p-4 rounded-lg border ${
                    hasFingerprint ? 'bg-green-500/5 border-green-500/20' : 'bg-muted/30 border-border'
                  }`}
                >
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={worker.photo_url || undefined} />
                    <AvatarFallback className="bg-primary/20 text-primary">
                      {worker.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{worker.full_name}</p>
                    <p className="text-xs text-muted-foreground">{worker.designation || 'Worker'}</p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {hasFingerprint ? (
                      workerTemplates.map((t) => (
                        <div key={t.id} className="flex items-center gap-1">
                          <Badge 
                            variant="outline" 
                            className="text-xs border-green-500/30 bg-green-500/10"
                          >
                            <Fingerprint className="w-3 h-3 mr-1 text-green-500" />
                            {FINGER_NAMES[t.finger_index - 1]?.split(' ')[1] || `F${t.finger_index}`}
                          </Badge>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-6 w-6">
                                <Trash2 className="w-3 h-3 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Fingerprint?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will remove the fingerprint for {worker.full_name}'s {FINGER_NAMES[t.finger_index - 1]}.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteTemplate(t.id)}>
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      ))
                    ) : (
                      <Badge variant="secondary" className="text-xs">
                        Not Registered
                      </Badge>
                    )}
                  </div>

                  {!hasFingerprint && isConnected && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedWorker(worker);
                        setSelectedFinger('1');
                      }}
                    >
                      Register
                    </Button>
                  )}
                </motion.div>
              );
            })
          )}
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="glass-card p-4 bg-gradient-to-br from-green-500/10 to-green-500/5">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-8 h-8 text-green-500" />
            <div>
              <p className="text-xs text-muted-foreground">Registered</p>
              <p className="text-2xl font-bold text-green-600">
                {new Set(templates.map(t => t.worker_id)).size}
              </p>
            </div>
          </div>
        </Card>
        <Card className="glass-card p-4 bg-gradient-to-br from-muted/50 to-muted/30">
          <div className="flex items-center gap-3">
            <User className="w-8 h-8 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Pending</p>
              <p className="text-2xl font-bold">
                {workers.length - new Set(templates.map(t => t.worker_id)).size}
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
