import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { unifiedCheckIn, unifiedCheckOut } from "@/lib/attendanceService";
import { Clock, LogIn, LogOut, Search, User, Plus, History, Users, CheckCheck, Loader2, Sparkles, Filter, CheckCircle2 } from "lucide-react";
import { DailyWorkNotes } from "@/components/DailyWorkNotes";
import { PastAttendanceDialog } from "@/components/attendance/PastAttendanceDialog";
import { useAttendanceGroups, groupChip } from "@/hooks/useAttendanceGroups";

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
  const [showPastDialog, setShowPastDialog] = useState(false);
  const { groups, loading: groupsLoading } = useAttendanceGroups();
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'present' | 'absent' | 'completed'>('all');
  const [groupBulkInTime, setGroupBulkInTime] = useState<string>("09:00");
  const [groupBulkOutTime, setGroupBulkOutTime] = useState<string>("18:00");
  const [groupProcessing, setGroupProcessing] = useState<boolean>(false);
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

  // Multi-Group selection helpers
  const toggleGroupSelection = (groupId: string) => {
    setSelectedGroupIds(prev =>
      prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]
    );
  };

  const clearGroupSelection = () => {
    setSelectedGroupIds([]);
  };

  const selectAllGroups = () => {
    setSelectedGroupIds(groups.map(g => g.id));
  };

  // Active selected groups objects
  const activeSelectedGroups = useMemo(() => {
    if (selectedGroupIds.length === 0) return [];
    return groups.filter(g => selectedGroupIds.includes(g.id));
  }, [groups, selectedGroupIds]);

  // Set of worker IDs belonging to ANY of the selected groups
  const groupMemberWorkerIds = useMemo(() => {
    if (selectedGroupIds.length === 0) return null;
    const ids = new Set<string>();
    activeSelectedGroups.forEach(g => {
      g.members.forEach(m => ids.add(m.id));
    });
    return ids;
  }, [selectedGroupIds, activeSelectedGroups]);

  // 1. Filter workers by group selection
  const groupFilteredWorkers = useMemo(() => {
    if (!groupMemberWorkerIds) return workers;
    return workers.filter(w => groupMemberWorkerIds.has(w.id));
  }, [workers, groupMemberWorkerIds]);

  // Aggregate stats computed on current group selection (for status badges & counters)
  const statusCounts = useMemo(() => {
    const list = groupFilteredWorkers;
    const total = list.length;
    const present = list.filter(w => !!w.attendance).length;
    const absent = list.filter(w => !w.attendance).length;
    const checkedOut = list.filter(w => !!w.attendance?.time_out).length;
    const pendingOut = list.filter(w => w.attendance && !w.attendance.time_out).length;
    return { total, present, absent, checkedOut, pendingOut };
  }, [groupFilteredWorkers]);

  // 2. Filter workers by status filter ('all' | 'present' | 'absent' | 'completed')
  const statusFilteredWorkers = useMemo(() => {
    switch (statusFilter) {
      case 'present':
        return groupFilteredWorkers.filter(w => !!w.attendance);
      case 'absent':
        return groupFilteredWorkers.filter(w => !w.attendance);
      case 'completed':
        return groupFilteredWorkers.filter(w => !!w.attendance?.time_out);
      case 'all':
      default:
        return groupFilteredWorkers;
    }
  }, [groupFilteredWorkers, statusFilter]);

  // Bulk Check-In: checks in all un-checked-in workers in the current group scope
  const handleBulkCheckIn = async () => {
    const targetWorkers = groupFilteredWorkers.filter(w => !w.attendance);
    if (targetWorkers.length === 0) {
      toast({
        title: "All Workers Checked In",
        description: "There are no pending absentees to check in for this selection.",
      });
      return;
    }

    setGroupProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const [hours, minutes] = groupBulkInTime.split(':').map(Number);
      const timeIn = new Date();
      timeIn.setHours(hours, minutes, 0, 0);

      let successCount = 0;
      let errorCount = 0;

      for (const worker of targetWorkers) {
        try {
          const res = await unifiedCheckIn({
            workerId: worker.id,
            supervisorId: user.id,
            source: 'manual',
            recordedBy: 'supervisor',
            timeIn,
          });
          if (res.status === 'success') {
            successCount++;
          }
        } catch {
          errorCount++;
        }
      }

      await loadWorkersWithAttendance();

      toast({
        title: "Bulk Check-In Complete",
        description: `Checked in ${successCount} worker(s) at ${groupBulkInTime}${errorCount > 0 ? ` (${errorCount} failed)` : ''}`,
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Bulk Check-In Failed",
        description: err.message,
      });
    } finally {
      setGroupProcessing(false);
    }
  };

  // Bulk Check-Out: checks out all checked-in workers in the current group scope
  const handleBulkCheckOut = async () => {
    const targetWorkers = groupFilteredWorkers.filter(w => w.attendance && !w.attendance.time_out);
    if (targetWorkers.length === 0) {
      toast({
        title: "No Workers to Check Out",
        description: "All checked-in workers in this selection have already checked out.",
      });
      return;
    }

    setGroupProcessing(true);
    try {
      const [hours, minutes] = groupBulkOutTime.split(':').map(Number);
      const timeOut = new Date();
      timeOut.setHours(hours, minutes, 0, 0);

      let successCount = 0;
      let errorCount = 0;

      for (const worker of targetWorkers) {
        try {
          const res = await unifiedCheckOut({
            workerId: worker.id,
            source: 'manual',
            recordedBy: 'supervisor',
            timeOut,
          });
          if (res.status === 'success') {
            successCount++;
          }
        } catch {
          errorCount++;
        }
      }

      await loadWorkersWithAttendance();

      toast({
        title: "Bulk Check-Out Complete",
        description: `Checked out ${successCount} worker(s) at ${groupBulkOutTime}${errorCount > 0 ? ` (${errorCount} failed)` : ''}`,
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Bulk Check-Out Failed",
        description: err.message,
      });
    } finally {
      setGroupProcessing(false);
    }
  };

  // 3. Fuzzy search with matching workers at top
  const sortedWorkers = useMemo(() => {
    const baseList = statusFilteredWorkers;
    if (!searchTerm.trim()) return baseList;

    const term = searchTerm.toLowerCase();
    const matching: WorkerWithAttendance[] = [];
    const nonMatching: WorkerWithAttendance[] = [];

    baseList.forEach(worker => {
      if (worker.full_name.toLowerCase().includes(term)) {
        matching.push(worker);
      } else {
        nonMatching.push(worker);
      }
    });

    return [...matching, ...nonMatching];
  }, [statusFilteredWorkers, searchTerm]);

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

        {/* Search Bar & Quick Actions */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <Card className="glass-card p-3 flex-1">
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
          <div className="flex gap-2">
            <Button onClick={() => setShowPastDialog(true)} className="gap-2 shadow-sm whitespace-nowrap">
              <Plus className="w-4 h-4" />
              Past / Group Attendance
            </Button>
            <Button variant="outline" asChild className="gap-2 whitespace-nowrap">
              <Link to="/attendance-history">
                <History className="w-4 h-4 text-primary" />
                History &amp; Edit
              </Link>
            </Button>
          </div>
        </div>

        {/* Group Selector & Multi-Filter Chips */}
        {groups.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground px-1 flex-wrap gap-2">
              <span className="flex items-center gap-1.5 font-medium">
                <Users className="w-3.5 h-3.5 text-primary" /> Filter by Attendance Group:
                {selectedGroupIds.length > 0 && (
                  <Badge variant="outline" className="text-[10px] py-0 px-2 bg-primary/10 text-primary border-primary/20">
                    {selectedGroupIds.length} of {groups.length} Selected
                  </Badge>
                )}
              </span>

              <div className="flex items-center gap-3">
                {selectedGroupIds.length > 0 && (
                  <button
                    type="button"
                    onClick={clearGroupSelection}
                    className="text-xs text-muted-foreground hover:text-foreground font-medium underline"
                  >
                    Clear Filter
                  </button>
                )}
                <button
                  type="button"
                  onClick={selectAllGroups}
                  className="text-xs text-primary hover:underline font-medium"
                >
                  Select All Groups
                </button>
                <button
                  type="button"
                  onClick={() => setShowPastDialog(true)}
                  className="text-xs text-primary hover:underline font-medium flex items-center gap-1"
                >
                  Manage Groups <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Group Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none flex-wrap sm:flex-nowrap">
              <button
                type="button"
                onClick={clearGroupSelection}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border ${
                  selectedGroupIds.length === 0
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-muted/40 hover:bg-muted text-muted-foreground border-border/40"
                }`}
              >
                All Workers ({workers.length})
              </button>
              {groups.map((group) => {
                const isSelected = selectedGroupIds.includes(group.id);
                const memberIds = new Set(group.members.map((m) => m.id));
                const memberWorkers = workers.filter((w) => memberIds.has(w.id));
                const presentCount = memberWorkers.filter((w) => !!w.attendance).length;

                return (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => toggleGroupSelection(group.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 border ${
                      isSelected
                        ? "bg-primary/20 text-primary border-primary ring-2 ring-primary/20 font-semibold shadow-sm"
                        : `${groupChip(group.color)} hover:opacity-85`
                    }`}
                  >
                    {isSelected && <span className="text-[11px] font-bold">✓</span>}
                    <span>{group.name}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-background/50 border border-current/20">
                      {presentCount}/{memberWorkers.length}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Presentees & Absentees Status Filter Tabs */}
            <div className="flex items-center gap-2 pt-1 border-t border-border/30 overflow-x-auto pb-1 scrollbar-none">
              <span className="text-xs text-muted-foreground font-medium flex items-center gap-1 shrink-0 pr-1">
                <Filter className="w-3.5 h-3.5 text-primary" /> Status:
              </span>

              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all border ${
                  statusFilter === 'all'
                    ? "bg-foreground text-background border-foreground font-semibold shadow-sm"
                    : "bg-card hover:bg-muted/60 text-muted-foreground border-border/50"
                }`}
              >
                All Status ({statusCounts.total})
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('present')}
                className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 border ${
                  statusFilter === 'present'
                    ? "bg-emerald-600 text-white border-emerald-600 font-semibold shadow-sm"
                    : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Presentees ({statusCounts.present})
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('absent')}
                className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 border ${
                  statusFilter === 'absent'
                    ? "bg-amber-600 text-white border-amber-600 font-semibold shadow-sm"
                    : "bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                Absentees / Not Checked In ({statusCounts.absent})
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('completed')}
                className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 border ${
                  statusFilter === 'completed'
                    ? "bg-purple-600 text-white border-purple-600 font-semibold shadow-sm"
                    : "bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/30"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-purple-500" />
                Checked Out ({statusCounts.checkedOut})
              </button>
            </div>
          </div>
        )}

        {/* Group & Bulk Check-In / Check-Out Action Banner */}
        <Card className="glass-card p-4 border-primary/30 bg-primary/5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold uppercase tracking-wider text-primary">
                  Bulk Attendance Operations
                </span>
                {activeSelectedGroups.length > 0 ? (
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs font-semibold">
                    {activeSelectedGroups.map(g => g.name).join(", ")}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs">All Groups Scope</Badge>
                )}
                <span className="text-xs text-muted-foreground">
                  ({statusCounts.total} Workers in Scope)
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Status: <strong className="text-emerald-600 dark:text-emerald-400">{statusCounts.present} Present</strong> • <strong className="text-amber-600 dark:text-amber-400">{statusCounts.absent} Absentees</strong> • {statusCounts.checkedOut} Completed Shift
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Bulk Check-In for Absentees */}
              <div className="flex items-center gap-1.5 bg-background/85 p-1.5 rounded-xl border border-border/50 shadow-sm">
                <span className="text-[11px] font-medium text-muted-foreground pl-1">In:</span>
                <Input
                  type="time"
                  value={groupBulkInTime}
                  onChange={(e) => setGroupBulkInTime(e.target.value)}
                  className="h-8 w-24 text-xs font-mono p-1"
                />
                <Button
                  size="sm"
                  onClick={handleBulkCheckIn}
                  disabled={statusCounts.absent === 0 || groupProcessing}
                  className="h-8 text-xs gap-1.5 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {groupProcessing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <LogIn className="w-3.5 h-3.5" />
                  )}
                  Check In Absentees ({statusCounts.absent})
                </Button>
              </div>

              {/* Bulk Check-Out for Presentees */}
              <div className="flex items-center gap-1.5 bg-background/85 p-1.5 rounded-xl border border-border/50 shadow-sm">
                <span className="text-[11px] font-medium text-muted-foreground pl-1">Out:</span>
                <Input
                  type="time"
                  value={groupBulkOutTime}
                  onChange={(e) => setGroupBulkOutTime(e.target.value)}
                  className="h-8 w-24 text-xs font-mono p-1"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleBulkCheckOut}
                  disabled={statusCounts.pendingOut === 0 || groupProcessing}
                  className="h-8 text-xs gap-1.5 font-semibold border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
                >
                  {groupProcessing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <LogOut className="w-3.5 h-3.5" />
                  )}
                  Check Out Presentees ({statusCounts.pendingOut})
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Workers List */}
        <Card className="glass-card p-4">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <User className="w-5 h-5" />
              {statusFilter === 'present' ? 'Present Workers' : statusFilter === 'absent' ? 'Absent Workers' : statusFilter === 'completed' ? 'Checked Out Workers' : 'Workers'}
              {activeSelectedGroups.length > 0 && ` (${activeSelectedGroups.map(g => g.name).join(', ')})`} ({sortedWorkers.length})
            </h2>

            {statusFilter !== 'all' && (
              <Badge variant="outline" className="text-xs cursor-pointer hover:bg-muted" onClick={() => setStatusFilter('all')}>
                Showing {statusFilter} only • Click to show all
              </Badge>
            )}
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

        {/* Group & Past Attendance Dialog */}
        <PastAttendanceDialog
          open={showPastDialog}
          onOpenChange={setShowPastDialog}
          defaultDate={new Date().toISOString().split('T')[0]}
          onSaved={loadWorkersWithAttendance}
        />
      </div>
    );

  if (embedded) return content;
  return <DashboardLayout>{content}</DashboardLayout>;
}
