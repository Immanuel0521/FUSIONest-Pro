import { useEffect, useState, useMemo } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { unifiedCheckIn, unifiedCheckOut } from "@/lib/attendanceService";
import { Clock, LogIn, LogOut, Search, User } from "lucide-react";
import { DailyWorkNotes } from "@/components/DailyWorkNotes";

interface Worker {
  id: string;
  full_name: string;
  photo_url: string | null;
  designation: string | null;
}

interface AttendanceRecord {
  id: string;
  worker_id: string;
  time_in: string;
  time_out: string | null;
  is_late: boolean;
  early_exit: boolean;
  overtime_hours: number;
}

interface WorkerWithAttendance extends Worker {
  attendance: AttendanceRecord | null;
  editableTimeIn: string;
  editableTimeOut: string;
}

type StatusType = 'not-checked-in' | 'present' | 'late-arrival' | 'ot' | 'left-early' | 'absent';

const getStatus = (worker: WorkerWithAttendance): StatusType => {
  if (!worker.attendance) return 'not-checked-in';
  
  const { time_out, is_late, early_exit, overtime_hours } = worker.attendance;
  
  if (time_out) {
    if (overtime_hours > 0) return 'ot';
    if (early_exit) return 'left-early';
    return 'present';
  }
  
  if (is_late) return 'late-arrival';
  return 'present';
};

const StatusBadge = ({ status }: { status: StatusType }) => {
  const variants: Record<StatusType, { label: string; className: string }> = {
    'not-checked-in': { label: 'Not Checked In', className: 'bg-muted text-muted-foreground' },
    'present': { label: 'Present', className: 'bg-green-500/20 text-green-700 dark:text-green-400' },
    'late-arrival': { label: 'Late Arrival', className: 'bg-orange-500/20 text-orange-700 dark:text-orange-400' },
    'ot': { label: 'OT', className: 'bg-purple-500/20 text-purple-700 dark:text-purple-400' },
    'left-early': { label: 'Left Early', className: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400' },
    'absent': { label: 'Absent', className: 'bg-red-500/20 text-red-700 dark:text-red-400' },
  };

  const { label, className } = variants[status];
  return <Badge className={className}>{label}</Badge>;
};

interface AttendanceProps {
  embedded?: boolean;
}

export default function Attendance({ embedded = false }: AttendanceProps) {
  const [workers, setWorkers] = useState<WorkerWithAttendance[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const loadWorkersWithAttendance = async () => {
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];

    const { data: workersData } = await supabase
      .from('workers')
      .select('id, full_name, photo_url, designation')
      .order('full_name');

    if (!workersData) {
      setLoading(false);
      return;
    }

    const { data: attendanceData } = await supabase
      .from('attendance_logs')
      .select('id, worker_id, time_in, time_out, is_late, early_exit, overtime_hours')
      .eq('date', today);

    const workersWithAttendance: WorkerWithAttendance[] = workersData.map((worker) => {
      const attendance = attendanceData?.find(a => a.worker_id === worker.id) || null;
      
      return {
        ...worker,
        attendance,
        editableTimeIn: attendance?.time_in 
          ? new Date(attendance.time_in).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
          : '09:00',
        editableTimeOut: attendance?.time_out 
          ? new Date(attendance.time_out).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
          : '18:00',
      };
    });

    setWorkers(workersWithAttendance);
    setLoading(false);
  };

  useEffect(() => {
    loadWorkersWithAttendance();
  }, []);

  const updateWorkerTime = (workerId: string, field: 'editableTimeIn' | 'editableTimeOut', value: string) => {
    setWorkers(prev => prev.map(w => 
      w.id === workerId ? { ...w, [field]: value } : w
    ));
  };

  /**
   * Check-In with NEW logic:
   * - Login 8:40 AM - 9:20 AM: Normal (no late flag)
   * - Login after 9:30 AM: Mark as Late Entry
   */
  const handleCheckIn = async (worker: WorkerWithAttendance) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const [hours, minutes] = worker.editableTimeIn.split(':').map(Number);
      const timeIn = new Date();
      timeIn.setHours(hours, minutes, 0, 0);

      const result = await unifiedCheckIn({
        workerId: worker.id,
        supervisorId: user.id,
        source: 'manual',
        recordedBy: 'supervisor',
        timeIn,
      });

      if (result.status === 'already_checked_in') {
        toast({
          variant: "destructive",
          title: "Already Checked In",
          description: result.message,
        });
        return;
      }

      if (result.status === 'error') throw new Error(result.message);

      toast({
        title: "Check-In Successful",
        description: result.message,
      });

      loadWorkersWithAttendance();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    }
  };

  /**
   * Check-Out with NEW logic:
   * - Logout 5:40 PM - 6:20 PM: Normal (no early flag)
   * - Logout before 5:30 PM: Mark as Early Exit
   * - Working hours = (Checkout - Checkin) - 1 hour lunch
   * - Working hours capped at 8 hours
   * - Overtime = hours beyond 8
   */
  const handleCheckOut = async (worker: WorkerWithAttendance) => {
    if (!worker.attendance) return;

    try {
      const [hours, minutes] = worker.editableTimeOut.split(':').map(Number);
      const timeOut = new Date();
      timeOut.setHours(hours, minutes, 0, 0);

      const result = await unifiedCheckOut({
        workerId: worker.id,
        source: 'manual',
        recordedBy: 'supervisor',
        timeOut,
      });

      if (result.status === 'already_checked_out') {
        toast({
          variant: "destructive",
          title: "Already Checked Out",
          description: result.message,
        });
        return;
      }

      if (result.status === 'no_checkin' || result.status === 'error') {
        throw new Error(result.message);
      }

      toast({
        title: "Check-Out Successful",
        description: result.message,
      });

      loadWorkersWithAttendance();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    }
  };

  // Fuzzy search with matching workers at top
  const sortedWorkers = useMemo(() => {
    if (!searchTerm.trim()) return workers;

    const term = searchTerm.toLowerCase();
    const matching: WorkerWithAttendance[] = [];
    const nonMatching: WorkerWithAttendance[] = [];

    workers.forEach(worker => {
      if (worker.full_name.toLowerCase().includes(term)) {
        matching.push(worker);
      } else {
        nonMatching.push(worker);
      }
    });

    return [...matching, ...nonMatching];
  }, [workers, searchTerm]);

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const content = (
    <div className="max-w-5xl mx-auto space-y-6">
      {!embedded && (
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-2">
            Mark Attendance
          </h1>
          <p className="text-muted-foreground flex items-center justify-center gap-2">
            <Clock className="w-4 h-4" />
            {new Date().toLocaleDateString()} - {new Date().toLocaleTimeString()}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Shift: 9:00 AM - 6:00 PM | Lunch: 1 hr deducted | Max 8 payable hrs/day
          </p>
        </div>
      )}

        {/* Search Bar */}
        <Card className="glass-card p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search worker by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 glass-card border-primary/20"
            />
          </div>
        </Card>

        {/* Workers List */}
        <Card className="glass-card p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <User className="w-5 h-5" />
              All Workers ({sortedWorkers.length})
            </h2>
          </div>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading workers...</div>
          ) : sortedWorkers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No workers found</div>
          ) : (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
              {sortedWorkers.map((worker) => {
                const status = getStatus(worker);
                const isCheckedIn = !!worker.attendance;
                const isCheckedOut = !!worker.attendance?.time_out;
                const isSearchMatch = searchTerm && worker.full_name.toLowerCase().includes(searchTerm.toLowerCase());

                return (
                  <div
                    key={worker.id}
                    className={`flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-lg border transition-all ${
                      isSearchMatch 
                        ? 'bg-primary/10 border-primary/30 ring-1 ring-primary/20' 
                        : 'bg-card hover:bg-accent/30 border-border'
                    }`}
                  >
                    {/* Worker Info */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Avatar className="w-12 h-12 shrink-0">
                        <AvatarImage src={worker.photo_url || undefined} />
                        <AvatarFallback className="bg-primary/20 text-primary">
                          {worker.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{worker.full_name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {worker.designation || 'Worker'} • ID: {worker.id.slice(0, 8)}
                        </p>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="shrink-0">
                      <StatusBadge status={status} />
                    </div>

                    {/* Time Fields */}
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-muted-foreground">In</label>
                        <Input
                          type="time"
                          value={worker.editableTimeIn}
                          onChange={(e) => updateWorkerTime(worker.id, 'editableTimeIn', e.target.value)}
                          disabled={isCheckedIn}
                          className="w-24 h-8 text-xs"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-muted-foreground">Out</label>
                        <Input
                          type="time"
                          value={worker.editableTimeOut}
                          onChange={(e) => updateWorkerTime(worker.id, 'editableTimeOut', e.target.value)}
                          disabled={!isCheckedIn || isCheckedOut}
                          className="w-24 h-8 text-xs"
                        />
                      </div>
                    </div>

                    {/* Actual Times Display */}
                    {worker.attendance && (
                      <div className="text-xs text-muted-foreground shrink-0 min-w-[100px]">
                        <div>In: {formatTime(worker.attendance.time_in)}</div>
                        {worker.attendance.time_out && (
                          <div>Out: {formatTime(worker.attendance.time_out)}</div>
                        )}
                      </div>
                    )}

                    {/* Action Button */}
                    <div className="shrink-0">
                      {isCheckedOut ? (
                        <Button size="sm" disabled variant="outline" className="w-24">
                          Done
                        </Button>
                      ) : isCheckedIn ? (
                        <Button 
                          size="sm" 
                          variant="secondary"
                          onClick={() => handleCheckOut(worker)}
                          className="w-24"
                        >
                          <LogOut className="w-4 h-4 mr-1" />
                          Out
                        </Button>
                      ) : (
                        <Button 
                          size="sm"
                          onClick={() => handleCheckIn(worker)}
                          className="w-24"
                        >
                          <LogIn className="w-4 h-4 mr-1" />
                          In
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Quick Guide */}
        <Card className="glass-card p-4 bg-gradient-to-r from-primary/5 to-accent/5">
          <h3 className="font-semibold mb-2 text-primary text-sm">Status Guide</h3>
          <div className="flex flex-wrap gap-2 text-xs mb-3">
            <StatusBadge status="not-checked-in" />
            <StatusBadge status="present" />
            <StatusBadge status="late-arrival" />
            <StatusBadge status="ot" />
            <StatusBadge status="left-early" />
          </div>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>• <strong>Early OT:</strong> Login before 8:50 AM (time from login to 9:00 AM)</p>
            <p>• <strong>Late:</strong> Login after 9:30 AM</p>
            <p>• <strong>Early Exit:</strong> Logout before 5:30 PM</p>
            <p>• <strong>Working Hours:</strong> (Checkout - Checkin) - 1hr lunch, max 8 hours</p>
            <p>• <strong>Evening OT:</strong> Time after 6:00 PM (supports overnight)</p>
          </div>
        </Card>

        {/* Daily Work Notes Section */}
        <DailyWorkNotes 
          workers={workers.map(w => ({ id: w.id, full_name: w.full_name }))} 
        />
      </div>
    );

  if (embedded) return content;
  return <DashboardLayout>{content}</DashboardLayout>;
}
