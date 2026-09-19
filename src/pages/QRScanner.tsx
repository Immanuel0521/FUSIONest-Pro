import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Html5QrcodeScanner } from "html5-qrcode";
import { supabase } from "@/lib/supabase";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { sanitizeError } from "@/lib/errorHandler";
import { QrCode, UserCheck } from "lucide-react";
import { attendanceFormSchema } from "@/lib/validationSchemas";
import {
  STANDARD_PAYABLE_HOURS,
  LUNCH_BREAK_HOURS,
  SHIFT_START_HOUR,
  LATE_THRESHOLD_HOUR,
  LATE_THRESHOLD_MINUTE,
  EARLY_EXIT_THRESHOLD_HOUR,
  EARLY_EXIT_THRESHOLD_MINUTE,
} from "@/lib/attendanceConfig";

interface QRScannerProps {
  embedded?: boolean;
}

const QRScanner = ({ embedded = false }: QRScannerProps) => {
  const navigate = useNavigate();
  const [scanning, setScanning] = useState(false);
  const [workerId, setWorkerId] = useState("");
  const [workerName, setWorkerName] = useState("");
  const [attendanceTime, setAttendanceTime] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [existingAttendance, setExistingAttendance] = useState<any>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/");
      }
    };
    checkAuth();
  }, [navigate]);

  const startScanner = () => {
    setScanning(true);
    
    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      { 
        fps: 10, 
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
      },
      false
    );

    scanner.render(
      async (decodedText) => {
        try {
          const data = JSON.parse(decodedText);
          if (data.workerId) {
            const { data: worker, error } = await supabase
              .from('workers')
              .select('id, full_name')
              .eq('id', data.workerId)
              .single();

            if (error || !worker) {
              toast.error("Invalid QR code or worker not found");
              return;
            }

            setWorkerId(worker.id);
            setWorkerName(worker.full_name);
            
            // Check existing attendance
            const today = new Date().toISOString().split('T')[0];
            const { data: attendance } = await supabase
              .from('attendance_logs')
              .select('*')
              .eq('worker_id', worker.id)
              .eq('date', today)
              .maybeSingle();
            
            setExistingAttendance(attendance);
            
            scanner.clear();
            setScanning(false);
            toast.success(`Worker ${worker.full_name} scanned successfully`);
          } else {
            toast.error("Invalid QR code format");
          }
        } catch (error) {
          toast.error("Invalid QR code");
        }
      },
      (errorMessage) => {
        console.log("QR scan error:", errorMessage);
      }
    );

    scannerRef.current = scanner;
  };

  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.clear();
      scannerRef.current = null;
    }
    setScanning(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!workerId) {
      toast.error("Please scan a worker QR code first");
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error("Please login to mark attendance");
        return;
      }

      const today = new Date().toISOString().split('T')[0];
      const [hour, minute] = attendanceTime.split(':').map(Number);
      const timestamp = new Date();
      timestamp.setHours(hour, minute, 0, 0);

      // Check if attendance already exists
      if (existingAttendance) {
        // This is a CHECK-OUT
        if (existingAttendance.time_out) {
          toast.error("Both check-in and check-out already marked for today");
          setLoading(false);
          return;
        }

        // CRITICAL FIX: Use check-in date as base for checkout
        const timeIn = new Date(existingAttendance.time_in);
        const timeOut = new Date(timeIn); // Same date as check-in
        const [outHour, outMin] = attendanceTime.split(':').map(Number);
        timeOut.setHours(outHour, outMin, 0, 0);
        
        // Early exit: only before 5:30 PM (based on check-in date)
        const earlyThreshold = new Date(timeIn);
        earlyThreshold.setHours(EARLY_EXIT_THRESHOLD_HOUR, EARLY_EXIT_THRESHOLD_MINUTE, 0, 0);
        const earlyExit = timeOut < earlyThreshold;
        
        // Calculate total working hours with 1 hour lunch deduction
        const rawHours = Math.max(0, (timeOut.getTime() - timeIn.getTime()) / (1000 * 60 * 60));
        const totalHoursAfterLunch = Math.max(0, rawHours - LUNCH_BREAK_HOURS);
        
        // Working hours capped at 8
        const totalHours = Math.min(totalHoursAfterLunch, STANDARD_PAYABLE_HOURS);
        
        // OT Tolerance: No OT if checkout is before 6:10 PM
        // OT = time worked AFTER 6:10 PM (not hours beyond 8)
        const otCutoff = new Date(timeIn);
        otCutoff.setHours(18, 10, 0, 0); // 6:10 PM
        
        let overtimeHours = 0;
        if (timeOut > otCutoff) {
          // OT = time after 6:10 PM (in hours)
          const otMs = timeOut.getTime() - otCutoff.getTime();
          overtimeHours = otMs / (1000 * 60 * 60);
        }

        const { error } = await supabase
          .from('attendance_logs')
          .update({
            time_out: timeOut.toISOString(),
            early_exit: earlyExit,
            total_hours: parseFloat(totalHours.toFixed(2)),
            overtime_hours: parseFloat(overtimeHours.toFixed(2)),
            notes: notes || existingAttendance.notes,
          })
          .eq('id', existingAttendance.id);

        if (error) throw error;

        toast.success(`Check-Out! Hours: ${totalHours.toFixed(2)}h${overtimeHours > 0 ? `, OT: ${overtimeHours.toFixed(2)}h` : ''}`);
      } else {
        // This is a CHECK-IN
        // Late only if after 9:30 AM
        const lateThreshold = new Date();
        lateThreshold.setHours(LATE_THRESHOLD_HOUR, LATE_THRESHOLD_MINUTE, 0, 0);
        
        const shiftStart = new Date();
        shiftStart.setHours(SHIFT_START_HOUR, 0, 0, 0);
        
        const isLate = timestamp > lateThreshold;
        const lateMinutes = isLate ? Math.floor((timestamp.getTime() - shiftStart.getTime()) / (1000 * 60)) : 0;

        const { error } = await supabase.from("attendance_logs").insert({
          worker_id: workerId,
          supervisor_id: user.id,
          date: today,
          time_in: timestamp.toISOString(),
          time_out: null,
          is_late: isLate,
          late_minutes: lateMinutes,
          early_exit: false,
          total_hours: 0,
          overtime_hours: 0,
          notes: notes || null,
        });

        if (error) throw error;

        toast.success(`Check-In${isLate ? ` (Late by ${lateMinutes}m)` : ''}`);
      }
      
      setWorkerId("");
      setWorkerName("");
      setAttendanceTime(() => {
        const now = new Date();
        return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      });
      setNotes("");
      setExistingAttendance(null);
    } catch (error: any) {
      if (import.meta.env.DEV) console.error("Error marking attendance:", error);
      toast.error(sanitizeError(error));
    } finally {
      setLoading(false);
    }
  };

  const content = (
    <div className="space-y-6">
      {!embedded && (
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            QR Code Attendance
          </h1>
          <p className="text-muted-foreground mt-2">
            Scan worker QR codes for quick attendance marking
          </p>
        </div>
      )}

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5" />
                QR Scanner
              </CardTitle>
              <CardDescription>
                Position the QR code within the frame to scan
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div id="qr-reader" className={scanning ? "block" : "hidden"}></div>
              
              {!scanning && (
                <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed rounded-lg">
                  <QrCode className="h-16 w-16 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">Ready to scan</p>
                  <Button onClick={startScanner}>
                    Start Scanner
                  </Button>
                </div>
              )}

              {scanning && (
                <Button onClick={stopScanner} variant="destructive" className="w-full mt-4">
                  Stop Scanner
                </Button>
              )}

              {workerName && !scanning && (
                <div className="mt-4 space-y-2">
                  <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                      <UserCheck className="h-5 w-5" />
                      <span className="font-medium">Scanned: {workerName}</span>
                    </div>
                  </div>
                  {existingAttendance && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        {existingAttendance.time_out 
                          ? '✅ Already checked in and out today' 
                          : `✓ Checked in at ${new Date(existingAttendance.time_in).toLocaleTimeString()} - Ready for check-out`}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Attendance Details</CardTitle>
              <CardDescription>
                Add additional information before submitting
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Worker</Label>
                  <Input 
                    value={workerName || "No worker scanned"} 
                    disabled 
                    className="bg-muted"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="attendance_time">
                    {existingAttendance && !existingAttendance.time_out ? 'Check-Out Time *' : 'Check-In Time *'}
                  </Label>
                  <Input
                    id="attendance_time"
                    type="time"
                    value={attendanceTime}
                    onChange={(e) => setAttendanceTime(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {existingAttendance && !existingAttendance.time_out 
                      ? 'Normal: 5:40-6:20 PM. Early if before 5:40 PM' 
                      : 'Normal: 8:40-9:20 AM. Late if after 9:20 AM'}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes (Optional)</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add any additional notes..."
                    rows={3}
                  />
                </div>

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={loading || !workerId || (existingAttendance && existingAttendance.time_out)}
                >
                  {loading ? "Marking..." : existingAttendance && !existingAttendance.time_out ? "Mark Check-Out" : "Mark Check-In"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );

  if (embedded) return content;
  return <DashboardLayout>{content}</DashboardLayout>;
};

export default QRScanner;
