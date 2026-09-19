import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FaceScanner } from "@/components/FaceScanner";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";
import { 
  Scan, 
  Clock, 
  MapPin, 
  CheckCircle2,
  LogIn,
  LogOut,
  Calendar
} from "lucide-react";
import { motion } from "framer-motion";

interface AttendanceRecord {
  id: string;
  date: string;
  time_in: string;
  time_out: string | null;
  total_hours: number | null;
  overtime_hours: number | null;
  is_late: boolean;
  early_exit: boolean | null;
  face_verified_in: boolean | null;
  face_verified_out: boolean | null;
  location_in: unknown;
  location_out: unknown;
}

interface Worker {
  id: string;
  full_name: string;
  photo_url: string | null;
}

export default function WorkerAttendance() {
  const [recentAttendance, setRecentAttendance] = useState<AttendanceRecord[]>([]);
  const [todayStatus, setTodayStatus] = useState<AttendanceRecord | null>(null);
  const [identifiedWorker, setIdentifiedWorker] = useState<Worker | null>(null);
  const [loading, setLoading] = useState(false);

  const loadTodayStatus = async (workerId?: string) => {
    if (!workerId) return;
    
    const today = new Date().toISOString().split('T')[0];
    
    const { data } = await supabase
      .from('attendance_logs')
      .select('*')
      .eq('worker_id', workerId)
      .eq('date', today)
      .maybeSingle();

    if (data) {
      setTodayStatus(data);
    }

    // Also load recent history
    const { data: history } = await supabase
      .from('attendance_logs')
      .select('*')
      .eq('worker_id', workerId)
      .order('date', { ascending: false })
      .limit(7);

    if (history) {
      setRecentAttendance(history);
    }
  };

  const handleAttendanceMarked = async (workerId: string, type: 'in' | 'out') => {
    // Get worker info
    const { data: worker } = await supabase
      .from('workers')
      .select('id, full_name, photo_url')
      .eq('id', workerId)
      .single();

    if (worker) {
      setIdentifiedWorker(worker);
      loadTodayStatus(workerId);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container max-w-lg mx-auto px-4 py-8">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
            <Scan className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-2">
            Face Attendance
          </h1>
          <p className="text-muted-foreground text-sm">
            Quick & secure face recognition check-in
          </p>
        </motion.div>

        {/* Today's Status Card (if worker identified) */}
        {identifiedWorker && todayStatus && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-6"
          >
            <Card className="glass-card p-6 border-green-500/20">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-green-500" />
                </div>
                <div>
                  <h3 className="font-semibold">{identifiedWorker.full_name}</h3>
                  <p className="text-sm text-muted-foreground">Today's Status</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2 mb-1">
                    <LogIn className="w-4 h-4 text-green-500" />
                    <span className="text-xs text-muted-foreground">Check-In</span>
                  </div>
                  <p className="font-medium">
                    {format(new Date(todayStatus.time_in), 'hh:mm a')}
                  </p>
                  {todayStatus.face_verified_in && (
                    <Badge variant="outline" className="text-xs mt-1 border-green-500/30">
                      Face ✓
                    </Badge>
                  )}
                </div>

                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2 mb-1">
                    <LogOut className="w-4 h-4 text-blue-500" />
                    <span className="text-xs text-muted-foreground">Check-Out</span>
                  </div>
                  <p className="font-medium">
                    {todayStatus.time_out 
                      ? format(new Date(todayStatus.time_out), 'hh:mm a')
                      : '--:--'
                    }
                  </p>
                  {todayStatus.time_out && todayStatus.face_verified_out && (
                    <Badge variant="outline" className="text-xs mt-1 border-green-500/30">
                      Face ✓
                    </Badge>
                  )}
                </div>
              </div>

              {todayStatus.time_out && todayStatus.total_hours && (
                <div className="mt-4 p-3 rounded-lg bg-primary/10 text-center">
                  <p className="text-sm text-muted-foreground">Total Hours</p>
                  <p className="text-2xl font-bold text-primary">
                    {todayStatus.total_hours.toFixed(1)}h
                    {todayStatus.overtime_hours && todayStatus.overtime_hours > 0 && (
                      <span className="text-sm text-accent ml-2">
                        (+{todayStatus.overtime_hours.toFixed(1)}h OT)
                      </span>
                    )}
                  </p>
                </div>
              )}
            </Card>
          </motion.div>
        )}

        {/* Face Scanner */}
        <FaceScanner onAttendanceMarked={handleAttendanceMarked} />

        {/* Recent Attendance History */}
        {identifiedWorker && recentAttendance.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-6"
          >
            <Card className="glass-card p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Recent Attendance
              </h3>

              <div className="space-y-3">
                {recentAttendance.slice(0, 5).map((record) => (
                  <div 
                    key={record.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                  >
                    <div>
                      <p className="font-medium text-sm">
                        {format(new Date(record.date), 'EEE, MMM d')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(record.time_in), 'hh:mm a')}
                        {record.time_out && (
                          <> - {format(new Date(record.time_out), 'hh:mm a')}</>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {record.is_late && (
                        <Badge variant="destructive" className="text-xs">Late</Badge>
                      )}
                      {record.overtime_hours && record.overtime_hours > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          OT: {record.overtime_hours.toFixed(1)}h
                        </Badge>
                      )}
                      {record.total_hours && (
                        <span className="text-sm font-medium">
                          {record.total_hours.toFixed(1)}h
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-muted-foreground">
          <p>Powered by Face Recognition AI</p>
          <p className="mt-1">Your data is secure and encrypted</p>
        </div>
      </div>
    </div>
  );
}
