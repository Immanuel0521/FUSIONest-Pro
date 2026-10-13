import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { AttendanceDetailsSheet } from "@/components/AttendanceDetailsSheet";
import { 
  Users, 
  ClipboardCheck, 
  Calendar, 
  Clock, 
  UserX, 
  FolderKanban,
  Activity,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Zap,
  ArrowRight,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { useUserRole } from "@/hooks/useUserRole";
import ManagementDashboard from "@/components/dashboards/ManagementDashboard";
import SupervisorDashboard from "@/components/dashboards/SupervisorDashboard";
import WorkerDashboard from "@/components/dashboards/WorkerDashboard";
import AdminDashboard from "@/components/dashboards/AdminDashboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Shield, UserCog, HardHat, Crown } from "lucide-react";

export default function Dashboard() {
  const { role } = useUserRole();

  switch (role) {
    case "worker":
      return <WorkerDashboard />;
    case "supervisor":
      return <SupervisorDashboard />;
    case "management":
      return <ManagementDashboard />;
    case "admin":
    default:
      return <AdminDashboard />;
  }
}

function DefaultDashboard() {
  const [stats, setStats] = useState({
    totalWorkers: 0,
    presentToday: 0,
    absentToday: 0,
    overtimeToday: 0,
    lateToday: 0,
    earlyExitToday: 0,
    activeProjects: 0,
    todayActivities: 0,
    delayedTasks: 0,
    completedTasks: 0,
  });
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetType, setSheetType] = useState<'present' | 'absent' | 'late' | 'early' | 'overtime'>('present');
  const [sheetWorkers, setSheetWorkers] = useState<any[]>([]);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);

  useEffect(() => {
    loadStats();
    loadRecentActivities();
  }, []);

  const loadStats = async () => {
    const today = new Date().toISOString().split('T')[0];
    const [workersRes, attendanceRes, projectsRes, activitiesRes] = await Promise.all([
      supabase.from('workers').select('id'),
      supabase.from('attendance_logs').select('id, overtime_hours, is_late, early_exit').eq('date', today),
      supabase.from('projects').select('id').eq('status', 'active'),
      supabase.from('daily_activities').select('id, progress_percentage, issues_faced').eq('date', today),
    ]);

    const totalWorkers = workersRes.data?.length || 0;
    const presentToday = attendanceRes.data?.length || 0;
    const absentToday = totalWorkers - presentToday;
    const overtimeToday = attendanceRes.data?.reduce((sum, r) => sum + (Number(r.overtime_hours) || 0), 0) || 0;
    const lateToday = attendanceRes.data?.filter(r => r.is_late).length || 0;
    const earlyExitToday = attendanceRes.data?.filter(r => r.early_exit).length || 0;
    const activeProjects = projectsRes.data?.length || 0;
    const todayActivities = activitiesRes.data?.length || 0;
    const delayedTasks = activitiesRes.data?.filter(a => a.issues_faced).length || 0;
    const completedTasks = activitiesRes.data?.filter(a => (a.progress_percentage || 0) >= 100).length || 0;

    setStats({ totalWorkers, presentToday, absentToday, overtimeToday, lateToday, earlyExitToday, activeProjects, todayActivities, delayedTasks, completedTasks });
  };

  const loadRecentActivities = async () => {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('daily_activities')
      .select(`id, description, progress_percentage, created_at, project:projects(name), activity_type:activity_types(name)`)
      .eq('date', today)
      .order('created_at', { ascending: false })
      .limit(5);
    setRecentActivities(data || []);
  };

  const openSheet = async (type: typeof sheetType) => {
    const today = new Date().toISOString().split('T')[0];
    let data: any[] = [];

    if (type === 'present') {
      const { data: records } = await supabase.from('attendance_logs').select('*, workers(id, full_name, photo_url)').eq('date', today);
      data = records?.map(r => ({ ...r.workers, time_in: r.time_in, time_out: r.time_out })) || [];
    } else if (type === 'absent') {
      const { data: allWorkers } = await supabase.from('workers').select('*');
      const { data: presentToday } = await supabase.from('attendance_logs').select('worker_id').eq('date', today);
      const presentIds = new Set(presentToday?.map(log => log.worker_id) || []);
      data = allWorkers?.filter(w => !presentIds.has(w.id)) || [];
    } else if (type === 'late') {
      const { data: records } = await supabase.from('attendance_logs').select('*, workers(id, full_name, photo_url)').eq('date', today).eq('is_late', true);
      data = records?.map(r => ({ ...r.workers, time_in: r.time_in, late_minutes: r.late_minutes })) || [];
    } else if (type === 'early') {
      const { data: records } = await supabase.from('attendance_logs').select('*, workers(id, full_name, photo_url)').eq('date', today).eq('early_exit', true);
      data = records?.map(r => ({ ...r.workers, time_out: r.time_out })) || [];
    } else if (type === 'overtime') {
      const { data: records } = await supabase.from('attendance_logs').select('*, workers(id, full_name, photo_url)').eq('date', today).gt('overtime_hours', 0);
      data = records?.map(r => ({ ...r.workers, overtime_hours: r.overtime_hours })) || [];
    }

    setSheetWorkers(data);
    setSheetType(type);
    setSheetOpen(true);
  };

  const attendanceRate = stats.totalWorkers > 0 ? Math.round((stats.presentToday / stats.totalWorkers) * 100) : 0;

  const statCards = [
    { label: "Present", value: stats.presentToday, icon: ClipboardCheck, color: "text-primary", bg: "bg-primary/10", click: () => openSheet('present') },
    { label: "Absent", value: stats.absentToday, icon: UserX, color: "text-destructive", bg: "bg-destructive/10", click: () => openSheet('absent') },
    { label: "Late", value: stats.lateToday, icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-500/10", click: () => openSheet('late') },
    { label: "OT Hours", value: `${stats.overtimeToday.toFixed(1)}h`, icon: Clock, color: "text-accent", bg: "bg-accent/10", click: () => openSheet('overtime') },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Welcome Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="glass-heavy rounded-3xl p-6 sm:p-8 relative overflow-hidden">
            {/* Decorative background elements */}
            <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-accent/8 rounded-full blur-3xl" />
            
            <div className="relative">
              <div className="flex items-start justify-between mb-1">
                <div>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="text-muted-foreground text-sm font-medium"
                  >
                    {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                  </motion.p>
                  <motion.h1
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="text-3xl sm:text-4xl font-bold tracking-tight mt-1"
                    style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                  >
                    Dashboard
                  </motion.h1>
                </div>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.4, type: 'spring' }}
                  className="flex items-center gap-2 glass rounded-full px-4 py-2"
                >
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <span className="text-xs font-medium text-muted-foreground">Live</span>
                </motion.div>
              </div>

              {/* Attendance ring */}
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="flex items-center gap-6 mt-5"
              >
                <div className="relative w-20 h-20">
                  <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                    <circle cx="40" cy="40" r="34" fill="none" stroke="hsl(var(--muted))" strokeWidth="6" />
                    <circle
                      cx="40" cy="40" r="34" fill="none"
                      stroke="hsl(var(--primary))"
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeDasharray={`${attendanceRate * 2.136} 213.6`}
                      className="transition-all duration-1000 ease-out"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-lg font-bold">{attendanceRate}%</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Attendance Rate</p>
                  <p className="text-2xl font-bold">{stats.presentToday}<span className="text-base font-normal text-muted-foreground">/{stats.totalWorkers}</span></p>
                  <p className="text-xs text-muted-foreground mt-0.5">workers present today</p>
                </div>
              </motion.div>
            </div>
          </div>
        </motion.div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {statCards.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * i + 0.3 }}
            >
              <Card
                className="glass-card rounded-2xl p-4 cursor-pointer hover-lift group"
                onClick={stat.click}
              >
                <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <p className="text-2xl font-bold tracking-tight">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Two Column Layout */}
        <div className="grid lg:grid-cols-5 gap-4">
          {/* Projects Summary */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="lg:col-span-2"
          >
            <Card className="glass-card rounded-2xl p-5 h-full">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold flex items-center gap-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  <FolderKanban className="w-5 h-5 text-primary" />
                  Projects
                </h2>
                <Link to="/projects" className="text-xs text-primary hover:underline flex items-center gap-1">
                  View All <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="space-y-2.5">
                {[
                  { label: "Active Projects", value: stats.activeProjects, icon: Zap, color: "text-primary" },
                  { label: "Today's Activities", value: stats.todayActivities, icon: Activity, color: "text-foreground" },
                  { label: "Completed", value: stats.completedTasks, icon: CheckCircle2, color: "text-primary" },
                  { label: "With Issues", value: stats.delayedTasks, icon: AlertTriangle, color: "text-amber-500" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between p-3 rounded-xl glass hover:bg-primary/5 transition-colors">
                    <div className="flex items-center gap-2.5">
                      <item.icon className={`w-4 h-4 ${item.color}`} />
                      <span className="text-sm text-muted-foreground">{item.label}</span>
                    </div>
                    <span className={`text-lg font-bold ${item.color}`}>{item.value}</span>
                  </div>
                ))}
              </div>

              {/* Quick info bar */}
              <div className="mt-4 pt-3 border-t border-border/30 flex items-center justify-between text-xs text-muted-foreground">
                <span>Early Exits: <span className="font-semibold text-foreground">{stats.earlyExitToday}</span></span>
                <span>Total Workers: <span className="font-semibold text-foreground">{stats.totalWorkers}</span></span>
              </div>
            </Card>
          </motion.div>

          {/* Recent Activities */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="lg:col-span-3"
          >
            <Card className="glass-card rounded-2xl p-5 h-full">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold flex items-center gap-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  <Activity className="w-5 h-5 text-primary" />
                  Today's Activities
                </h2>
                <Link to="/projects" className="text-xs text-primary hover:underline flex items-center gap-1">
                  View All <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              {recentActivities.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-3">
                    <Activity className="w-7 h-7 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm text-muted-foreground">No activities logged today</p>
                  <Link to="/projects" className="text-xs text-primary hover:underline mt-2 flex items-center gap-1">
                    Log Activity <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentActivities.map((activity, index) => (
                    <motion.div
                      key={activity.id}
                      initial={{ opacity: 0, x: -15 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.08 * index + 0.6 }}
                      className="flex items-center gap-3 p-3 rounded-xl glass hover-lift cursor-default"
                    >
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <TrendingUp className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">
                          {activity.activity_type?.name || 'Activity'}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {activity.project?.name || 'Unknown Project'}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-sm font-bold text-primary">{activity.progress_percentage || 0}%</div>
                        <div className="text-[10px] text-muted-foreground">
                          {format(new Date(activity.created_at), 'HH:mm')}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </Card>
          </motion.div>
        </div>

        <AttendanceDetailsSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          title={
            sheetType === 'present' ? 'Present Today' :
            sheetType === 'absent' ? 'Absent Today' :
            sheetType === 'late' ? 'Late Arrivals' :
            sheetType === 'early' ? 'Early Exits' :
            'Overtime Today'
          }
          workers={sheetWorkers}
          type={sheetType}
        />
      </div>
    </DashboardLayout>
  );
}
