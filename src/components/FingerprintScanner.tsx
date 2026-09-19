import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { useFingerprintScanner } from '@/hooks/useFingerprintScanner';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Fingerprint, Wifi, WifiOff, Loader2, CheckCircle2, XCircle, Clock, LogIn, LogOut, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Worker {
  id: string;
  full_name: string;
  photo_url: string | null;
}

interface FingerprintScannerProps {
  onAttendanceMarked?: (workerId: string, type: 'in' | 'out') => void;
}

export function FingerprintScanner({ onAttendanceMarked }: FingerprintScannerProps) {
  const {
    isConnected,
    isScanning,
    deviceInfo,
    connect,
    disconnect,
    capture,
    verify,
  } = useFingerprintScanner();

  const { toast } = useToast();
  const [scanStatus, setScanStatus] = useState<'idle' | 'scanning' | 'success' | 'error'>('idle');
  const [matchedWorker, setMatchedWorker] = useState<Worker | null>(null);
  const [attendanceType, setAttendanceType] = useState<'in' | 'out' | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

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

  const handleScan = async () => {
    setScanStatus('scanning');
    setMatchedWorker(null);
    setAttendanceType(null);

    try {
      // Capture fingerprint
      const result = await capture(1);
      
      if (!result.success || !result.template) {
        throw new Error(result.error || 'Failed to capture fingerprint');
      }

      // Get all stored templates
      const { data: templates, error: templatesError } = await supabase
        .from('fingerprint_templates')
        .select(`
          worker_id,
          template_data,
          workers (
            id,
            full_name,
            photo_url
          )
        `);

      if (templatesError) throw templatesError;

      if (!templates || templates.length === 0) {
        throw new Error('No fingerprints registered. Please register workers first.');
      }

      // Format templates for verification
      const formattedTemplates = templates.map(t => ({
        workerId: t.worker_id,
        templateData: t.template_data,
        workerName: (t.workers as any)?.full_name || 'Unknown',
      }));

      // Verify against stored templates
      const matchResult = await verify(
        result.template.templateData,
        formattedTemplates
      );

      if (matchResult.matched && matchResult.workerId) {
        const worker = templates.find(t => t.worker_id === matchResult.workerId)?.workers as Worker;
        
        if (worker) {
          setMatchedWorker(worker);
          
          // Check existing attendance for today
          const today = new Date().toISOString().split('T')[0];
          const { data: existingAttendance } = await supabase
            .from('attendance_logs')
            .select('id, time_in, time_out')
            .eq('worker_id', worker.id)
            .eq('date', today)
            .maybeSingle();

          // Determine attendance type
          if (!existingAttendance) {
            setAttendanceType('in');
          } else if (!existingAttendance.time_out) {
            setAttendanceType('out');
          } else {
            toast({
              title: 'Already Complete',
              description: `${worker.full_name} has already completed attendance for today`,
            });
            setScanStatus('success');
            return;
          }

          setScanStatus('success');
          toast({
            title: 'Fingerprint Matched!',
            description: `Identified: ${worker.full_name} (${matchResult.confidence}% confidence)`,
          });
        }
      } else {
        setScanStatus('error');
        toast({
          variant: 'destructive',
          title: 'No Match Found',
          description: 'Fingerprint not recognized. Please try again or register.',
        });
      }
    } catch (error: any) {
      setScanStatus('error');
      toast({
        variant: 'destructive',
        title: 'Scan Error',
        description: error.message || 'Failed to process fingerprint',
      });
    }
  };

  const handleMarkAttendance = async () => {
    if (!matchedWorker || !attendanceType) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const today = new Date().toISOString().split('T')[0];
      const now = new Date();

      if (attendanceType === 'in') {
        // Check-in logic
        const shiftStart = new Date();
        shiftStart.setHours(9, 0, 0, 0);
        const isLate = now > shiftStart;
        const lateMinutes = isLate ? Math.floor((now.getTime() - shiftStart.getTime()) / (1000 * 60)) : 0;

        const { error } = await supabase.from('attendance_logs').insert({
          worker_id: matchedWorker.id,
          supervisor_id: user.id,
          date: today,
          time_in: now.toISOString(),
          is_late: isLate,
          late_minutes: lateMinutes,
          early_exit: false,
          total_hours: 0,
          overtime_hours: 0,
        });

        if (error) throw error;

        toast({
          title: 'Check-In Successful',
          description: `${matchedWorker.full_name} checked in at ${now.toLocaleTimeString()}${isLate ? ` (Late by ${lateMinutes} min)` : ''}`,
        });
      } else {
        // Check-out logic
        const { data: attendance } = await supabase
          .from('attendance_logs')
          .select('id, time_in')
          .eq('worker_id', matchedWorker.id)
          .eq('date', today)
          .single();

        if (!attendance) throw new Error('No check-in record found');

        const timeIn = new Date(attendance.time_in);
        const shiftEnd = new Date();
        shiftEnd.setHours(18, 0, 0, 0);
        
        const earlyExit = now < shiftEnd;
        const totalHours = Math.max(0, (now.getTime() - timeIn.getTime()) / (1000 * 60 * 60));
        const overtimeHours = Math.max(0, totalHours - 9);

        const { error } = await supabase
          .from('attendance_logs')
          .update({
            time_out: now.toISOString(),
            early_exit: earlyExit,
            total_hours: parseFloat(totalHours.toFixed(2)),
            overtime_hours: parseFloat(overtimeHours.toFixed(2)),
          })
          .eq('id', attendance.id);

        if (error) throw error;

        toast({
          title: 'Check-Out Successful',
          description: `${matchedWorker.full_name} checked out. Total: ${totalHours.toFixed(2)}h${overtimeHours > 0 ? ` (OT: ${overtimeHours.toFixed(2)}h)` : ''}`,
        });
      }

      onAttendanceMarked?.(matchedWorker.id, attendanceType);
      
      // Reset for next scan
      setTimeout(() => {
        setScanStatus('idle');
        setMatchedWorker(null);
        setAttendanceType(null);
      }, 2000);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Connection Status Card */}
      <Card className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              isConnected ? 'bg-green-500/20' : 'bg-muted'
            }`}>
              <Fingerprint className={`w-6 h-6 ${isConnected ? 'text-green-500' : 'text-muted-foreground'}`} />
            </div>
            <div>
              <h3 className="font-semibold">Fingerprint Scanner</h3>
              <p className="text-sm text-muted-foreground">
                {deviceInfo || 'Not connected'}
              </p>
            </div>
          </div>
          <Badge variant={isConnected ? 'default' : 'secondary'} className={
            isConnected ? 'bg-green-500/20 text-green-700 dark:text-green-400' : ''
          }>
            {isConnected ? (
              <>
                <Wifi className="w-3 h-3 mr-1" />
                Connected
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 mr-1" />
                Disconnected
              </>
            )}
          </Badge>
        </div>

        <Button
          onClick={isConnected ? disconnect : handleConnect}
          variant={isConnected ? 'outline' : 'default'}
          className="w-full"
        >
          {isConnected ? 'Disconnect Scanner' : 'Connect Scanner'}
        </Button>
      </Card>

      {/* Scan Area */}
      {isConnected && (
        <Card className="glass-card p-8">
          <div className="text-center">
            <motion.div
              className={`w-32 h-32 mx-auto mb-6 rounded-full flex items-center justify-center relative ${
                scanStatus === 'scanning' ? 'bg-primary/20' :
                scanStatus === 'success' ? 'bg-green-500/20' :
                scanStatus === 'error' ? 'bg-red-500/20' :
                'bg-muted'
              }`}
              animate={isScanning ? { scale: [1, 1.05, 1] } : {}}
              transition={{ repeat: Infinity, duration: 1.5 }}
            >
              {isScanning ? (
                <Loader2 className="w-16 h-16 text-primary animate-spin" />
              ) : scanStatus === 'success' ? (
                <CheckCircle2 className="w-16 h-16 text-green-500" />
              ) : scanStatus === 'error' ? (
                <XCircle className="w-16 h-16 text-red-500" />
              ) : (
                <Fingerprint className="w-16 h-16 text-muted-foreground" />
              )}
              
              {/* Scanning animation rings */}
              {isScanning && (
                <>
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-primary/50"
                    animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                  />
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-primary/30"
                    animate={{ scale: [1, 2], opacity: [0.3, 0] }}
                    transition={{ repeat: Infinity, duration: 1.5, delay: 0.3 }}
                  />
                </>
              )}
            </motion.div>

            <h2 className="text-xl font-bold mb-2">
              {isScanning ? 'Scanning...' :
               scanStatus === 'success' ? 'Fingerprint Matched!' :
               scanStatus === 'error' ? 'Not Recognized' :
               'Place Finger on Scanner'}
            </h2>
            <p className="text-muted-foreground mb-6">
              {isScanning ? 'Keep your finger steady on the scanner' :
               scanStatus === 'success' ? 'Worker identified successfully' :
               scanStatus === 'error' ? 'Try again or register fingerprint' :
               'Press the scan button when ready'}
            </p>

            {scanStatus !== 'success' && (
              <Button
                size="lg"
                onClick={handleScan}
                disabled={isScanning}
                className="w-48 h-14 text-lg gap-2"
              >
                {isScanning ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Scanning...
                  </>
                ) : (
                  <>
                    <Fingerprint className="w-5 h-5" />
                    Scan Now
                  </>
                )}
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Matched Worker & Attendance Action */}
      <AnimatePresence>
        {matchedWorker && scanStatus === 'success' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Card className="glass-card p-6 border-green-500/30">
              <div className="flex items-center gap-4 mb-6">
                <Avatar className="w-16 h-16">
                  <AvatarImage src={matchedWorker.photo_url || undefined} />
                  <AvatarFallback className="bg-primary/20 text-primary text-xl">
                    {matchedWorker.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="text-xl font-bold">{matchedWorker.full_name}</h3>
                  <p className="text-sm text-muted-foreground">ID: {matchedWorker.id.slice(0, 8)}</p>
                </div>
                <Badge className="bg-green-500/20 text-green-700 dark:text-green-400">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Verified
                </Badge>
              </div>

              {attendanceType && (
                <div className="flex gap-4">
                  <div className="flex-1 p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Action</span>
                    </div>
                    <p className="font-semibold">
                      {attendanceType === 'in' ? 'Check In' : 'Check Out'}
                    </p>
                  </div>
                  <Button
                    size="lg"
                    onClick={handleMarkAttendance}
                    className="flex-1 h-auto py-4"
                  >
                    {attendanceType === 'in' ? (
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
                </div>
              )}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Instructions */}
      <Card className="glass-card p-4 bg-gradient-to-r from-primary/5 to-accent/5">
        <h3 className="font-semibold mb-2 text-primary text-sm">How to Use</h3>
        <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
          <li>Connect the USB fingerprint scanner</li>
          <li>Click "Scan Now" when ready</li>
          <li>Place your finger firmly on the scanner</li>
          <li>Hold still until the scan completes</li>
          <li>Confirm attendance marking</li>
        </ol>
      </Card>
    </div>
  );
}
