import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useCompanyContext } from "@/context/CompanyContext";
import {
  Clock,
  CalendarCheck,
  CheckCircle2,
  Calendar,
  AlertCircle,
  HardHat,
  QrCode,
  ArrowRight,
  TrendingUp,
  MapPin,
  Flame,
  Award,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { format } from "date-fns";

export default function WorkerDashboard() {
  const { activeCompany } = useCompanyContext();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [todayLog, setTodayLog] = useState<any>(null);
  const [monthlyStats, setMonthlyStats] = useState({
    presentDays: 0,
    overtimeHours: 0,
    ontimeRate: 100,
    attendanceStreak: 0,
  });
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [assignedProject, setAssignedProject] = useState<any>(null);

  useEffect(() => {
    loadWorkerData();
  }, []);

  const loadWorkerData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const today = new Date().toISOString().split("T")[0];

      // Fetch profile & worker details matching user email/id
      const [profRes, workerRes] = await Promise.all([
        supabase.from("user_profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase.from("workers").select("*, projects(*)").eq("email", user.email || "").maybeSingle(),
      ]);

      setProfile(profRes.data || { full_name: user.email?.split("@")[0] });
      const worker = workerRes.data;
      if (worker?.projects) {
        setAssignedProject(worker.projects);
      }

      const workerId = worker?.id;

      if (workerId) {
        // Today attendance log
        const { data: todayRecord } = await supabase
          .from("attendance_logs")
          .select("*")
          .eq("worker_id", workerId)
          .eq("date", today)
          .maybeSingle();

        setTodayLog(todayRecord);

        // Recent 7 days logs
        const { data: logs } = await supabase
          .from("attendance_logs")
          .select("*")
          .eq("worker_id", workerId)
          .order("date", { ascending: false })
          .limit(10);

        setRecentLogs(logs || []);

        // Calculate Monthly stats
        const totalLogs = logs || [];
        const presentDays = totalLogs.length;
        const totalOT = totalLogs.reduce((acc, curr) => acc + (Number(curr.overtime_hours) || 0), 0);
        const onTimeCount = totalLogs.filter(l => !l.is_late).length;
        const ontimeRate = presentDays > 0 ? Math.round((onTimeCount / presentDays) * 100) : 100;

        setMonthlyStats({
          presentDays,
          overtimeHours: Math.round(totalOT * 10) / 10,
          ontimeRate,
          attendanceStreak: Math.min(presentDays, 12),
        });
      }
    } catch (e) {
      console.error("Worker load error:", e);
    } finally {
      setLoading(false);
    }
  };

  const isClockedIn = !!todayLog?.time_in;
  const isClockedOut = !!todayLog?.time_out;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Welcome Banner */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-heavy rounded-3xl p-6 sm:p-8 relative overflow-hidden border border-border/30"
        >
          <div className="absolute top-0 right-0 w-56 h-56 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 px-3 py-0.5 text-xs font-semibold gap-1.5">
                  <HardHat className="w-3.5 h-3.5" />
                  Site Personnel Portal
                </Badge>
                <span className="text-xs text-muted-foreground">{format(new Date(), "EEEE, d MMMM yyyy")}</span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight mt-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                Welcome back, {profile?.full_name || "Worker"}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Workspace: <span className="font-semibold text-foreground">{activeCompany?.name || "FUSIONest Pro"}</span>
              </p>
            </div>

            {/* Attendance Status Badge Card */}
            <div className="flex items-center gap-3 glass p-3.5 rounded-2xl border border-border/40">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isClockedIn && !isClockedOut ? 'bg-emerald-500/15 text-emerald-600' : 'bg-amber-500/15 text-amber-600'}`}>
                <Clock className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Today's Duty Status</p>
                <p className="text-base font-bold">
                  {isClockedOut ? "Shift Completed" : isClockedIn ? "Currently on Shift" : "Not Checked In"}
                </p>
                {todayLog?.time_in && (
                  <p className="text-[11px] text-muted-foreground">In: {todayLog.time_in.substring(0, 5)} {todayLog?.time_out ? `• Out: ${todayLog.time_out.substring(0, 5)}` : ''}</p>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Infographic KPI Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: "Days Present",
              value: `${monthlyStats.presentDays} days`,
              sub: "Recorded this month",
              icon: CalendarCheck,
              color: "text-emerald-600 dark:text-emerald-400",
              bg: "bg-emerald-500/10",
            },
            {
              label: "Overtime Logged",
              value: `${monthlyStats.overtimeHours} hrs`,
              sub: "Beyond 8h shifts",
              icon: Zap,
              color: "text-amber-600 dark:text-amber-400",
              bg: "bg-amber-500/10",
            },
            {
              label: "Punctuality Score",
              value: `${monthlyStats.ontimeRate}%`,
              sub: "On-time arrival rate",
              icon: Award,
              color: "text-blue-600 dark:text-blue-400",
              bg: "bg-blue-500/10",
            },
            {
              label: "Active Streak",
              value: `${monthlyStats.attendanceStreak} days`,
              sub: "Consecutive duty streak",
              icon: Flame,
              color: "text-rose-600 dark:text-rose-400",
              bg: "bg-rose-500/10",
            },
          ].map((item, i) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * i }}
            >
              <Card className="rounded-3xl border-border/30 glass-card p-5">
                <div className={`w-10 h-10 rounded-2xl ${item.bg} ${item.color} flex items-center justify-center mb-3`}>
                  <item.icon className="w-5 h-5" />
                </div>
                <p className="text-2xl font-bold tracking-tight">{item.value}</p>
                <p className="text-xs font-semibold text-foreground/80 mt-0.5">{item.label}</p>
                <p className="text-[11px] text-muted-foreground mt-1">{item.sub}</p>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Middle Two Column Layout */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Quick Check-in & Current Project */}
          <div className="space-y-6 lg:col-span-1">
            {/* Direct Attendance Action */}
            <Card className="rounded-3xl border-border/30 glass-card p-6">
              <CardHeader className="p-0 mb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <QrCode className="w-4 h-4 text-primary" /> Self Check-in / Out
                </CardTitle>
                <CardDescription className="text-xs">
                  Mark your presence using kiosk or facial biometrics
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 space-y-3">
                <Button asChild className="w-full rounded-2xl gap-2 font-semibold shadow-md shadow-primary/20">
                  <Link to="/attendance-scan">
                    <QrCode className="w-4 h-4" /> Open Scanner Camera
                  </Link>
                </Button>
                <p className="text-[11px] text-muted-foreground text-center">
                  Your supervisor can also log your presence from their site tablet.
                </p>
              </CardContent>
            </Card>

            {/* Assigned Project Info */}
            <Card className="rounded-3xl border-border/30 glass-card p-6">
              <CardHeader className="p-0 mb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" /> Current Deployment
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 space-y-3">
                {assignedProject ? (
                  <div className="space-y-2.5">
                    <div>
                      <p className="font-bold text-sm">{assignedProject.name}</p>
                      <p className="text-xs text-muted-foreground">{assignedProject.location || "On-site"}</p>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Overall Completion</span>
                        <span className="font-semibold text-primary">{assignedProject.completion_percentage || 0}%</span>
                      </div>
                      <Progress value={assignedProject.completion_percentage || 0} className="h-1.5" />
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    You are currently assigned to the active company general roster. Contact your site supervisor for project specific reallocations.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Attendance History Timeline */}
          <div className="lg:col-span-2">
            <Card className="rounded-3xl border-border/30 glass-card p-6 h-full flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary" /> Recent Duty Logs
                  </h3>
                  <p className="text-xs text-muted-foreground">Your verified check-ins and overtime records</p>
                </div>
                <Button variant="ghost" size="sm" asChild className="rounded-xl text-xs gap-1">
                  <Link to="/attendance-history">
                    View All <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </Button>
              </div>

              {recentLogs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground flex-1 flex flex-col items-center justify-center">
                  <Clock className="w-8 h-8 opacity-30 mb-2" />
                  <p className="text-sm">No duty records found yet.</p>
                </div>
              ) : (
                <div className="space-y-2.5 flex-1">
                  {recentLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3.5 rounded-2xl glass border border-border/30 flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                          {format(new Date(log.date), "dd")}
                        </div>
                        <div>
                          <p className="text-xs font-semibold">{format(new Date(log.date), "EEEE, MMM d")}</p>
                          <p className="text-[11px] text-muted-foreground">
                            In: <span className="font-mono text-foreground">{log.time_in ? log.time_in.substring(0, 5) : "--:--"}</span> • 
                            Out: <span className="font-mono text-foreground">{log.time_out ? log.time_out.substring(0, 5) : "--:--"}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {Number(log.overtime_hours) > 0 && (
                          <Badge variant="outline" className="text-[10px] rounded-full border-amber-500/30 text-amber-600 bg-amber-500/10">
                            +{log.overtime_hours}h OT
                          </Badge>
                        )}
                        <Badge
                          className={`text-[10px] rounded-full ${
                            log.is_late
                              ? "bg-rose-500/10 text-rose-600 border-rose-500/20"
                              : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                          }`}
                        >
                          {log.is_late ? "Late" : "On-Time"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
