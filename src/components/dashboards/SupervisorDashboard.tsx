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
  UserCog,
  Users,
  CheckSquare,
  ClipboardList,
  AlertTriangle,
  FolderKanban,
  ArrowRight,
  TrendingUp,
  MapPin,
  Clock,
  Scan,
  ShieldAlert,
  Calendar,
  Layers,
} from "lucide-react";
import { format } from "date-fns";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export default function SupervisorDashboard() {
  const { activeCompany } = useCompanyContext();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    activeWorkersCount: 0,
    presentCount: 0,
    absentCount: 0,
    lateCount: 0,
    overtimeHours: 0,
    assignedProjectsCount: 0,
    pendingChecklistsCount: 0,
    todayDprCount: 0,
  });
  const [assignedProjects, setAssignedProjects] = useState<any[]>([]);
  const [dailyActivityLogs, setDailyActivityLogs] = useState<any[]>([]);
  const [attendanceTrend, setAttendanceTrend] = useState<any[]>([]);

  useEffect(() => {
    loadSupervisorData();
  }, []);

  const loadSupervisorData = async () => {
    try {
      const today = new Date().toISOString().split("T")[0];

      // Query active projects, workers, and attendance
      const [projRes, workerRes, attRes, pcRes, dprRes] = await Promise.all([
        supabase.from("projects").select("*").eq("status", "active"),
        supabase.from("workers").select("id, full_name, photo_url"),
        supabase.from("attendance_logs").select("*").eq("date", today),
        supabase.from("project_checklists" as any).select("id, status, due_date"),
        supabase.from("daily_activities").select("id, date").eq("date", today),
      ]);

      const projects = projRes.data || [];
      const totalWorkers = workerRes.data?.length || 0;
      const todayLogs = attRes.data || [];
      const presentCount = todayLogs.length;
      const absentCount = Math.max(0, totalWorkers - presentCount);
      const lateCount = todayLogs.filter(l => l.is_late).length;
      const overtimeHours = todayLogs.reduce((acc, curr) => acc + (Number(curr.overtime_hours) || 0), 0);
      const checklists = (pcRes.data as any[]) || [];
      const pendingChecklistsCount = checklists.filter(c => c.status !== "completed").length;

      setAssignedProjects(projects);
      setStats({
        activeWorkersCount: totalWorkers,
        presentCount,
        absentCount,
        lateCount,
        overtimeHours: Math.round(overtimeHours * 10) / 10,
        assignedProjectsCount: projects.length,
        pendingChecklistsCount,
        todayDprCount: dprRes.data?.length || 0,
      });

      // Fetch last 7 days activities
      const { data: acts } = await supabase
        .from("daily_activities")
        .select("id, description, progress_percentage, created_at, project:projects(name)")
        .order("created_at", { ascending: false })
        .limit(6);
      setDailyActivityLogs(acts || []);

      // Build 7-day attendance trend data for infographic from actual logs
      const past7Days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return d.toISOString().split("T")[0];
      });

      const { data: past7Logs } = await supabase
        .from("attendance_logs")
        .select("date")
        .gte("date", past7Days[0])
        .lte("date", past7Days[6]);

      const trend = past7Days.map((dStr, idx) => {
        const count = (past7Logs || []).filter(l => l.date === dStr).length;
        const dayLabel = idx === 6 ? "Today" : format(new Date(dStr), "EEE");
        return {
          day: dayLabel,
          present: count,
        };
      });
      setAttendanceTrend(trend);
    } catch (e) {
      console.error("Supervisor dashboard error:", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Welcome Header */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-heavy rounded-3xl p-6 sm:p-8 relative overflow-hidden border border-border/30"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="rounded-full bg-primary/10 text-primary border-primary/20 px-3 py-0.5 text-xs font-semibold gap-1.5">
                  <UserCog className="w-3.5 h-3.5" />
                  Site Supervisor Command Center
                </Badge>
                <span className="text-xs text-muted-foreground">{format(new Date(), "EEEE, d MMMM yyyy")}</span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight mt-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                Field Operations & Site Execution
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Company: <span className="font-semibold text-foreground">{activeCompany?.name || "FUSIONest Pro"}</span> • Direct oversight of ground crew, checklists & daily DPRs
              </p>
            </div>

            {/* Supervisor Quick Operational Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild size="sm" className="rounded-xl gap-2 font-semibold shadow-md shadow-primary/20">
                <Link to="/attendance-scan">
                  <Scan className="w-4 h-4" /> Scan Attendance
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="rounded-xl gap-2">
                <Link to="/dpr">
                  <ClipboardList className="w-4 h-4" /> Log DPR
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="rounded-xl gap-2">
                <Link to="/checklists">
                  <CheckSquare className="w-4 h-4" /> Checklists
                </Link>
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Infographic KPI Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: "Workers Present",
              value: `${stats.presentCount} / ${stats.activeWorkersCount}`,
              sub: `${stats.absentCount} absent today`,
              icon: Users,
              color: "text-emerald-600 dark:text-emerald-400",
              bg: "bg-emerald-500/10",
            },
            {
              label: "Total Site Overtime",
              value: `${stats.overtimeHours} hrs`,
              sub: "Accumulated today",
              icon: Clock,
              color: "text-amber-600 dark:text-amber-400",
              bg: "bg-amber-500/10",
            },
            {
              label: "Pending Checklists",
              value: `${stats.pendingChecklistsCount}`,
              sub: "Quality & Safety inspections",
              icon: CheckSquare,
              color: "text-purple-600 dark:text-purple-400",
              bg: "bg-purple-500/10",
            },
            {
              label: "Active Projects",
              value: `${stats.assignedProjectsCount}`,
              sub: "Currently supervised",
              icon: FolderKanban,
              color: "text-blue-600 dark:text-blue-400",
              bg: "bg-blue-500/10",
            },
          ].map((item, i) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 * i }}
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

        {/* Charts & Project Status */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Infographic Attendance & Overtime Chart */}
          <div className="lg:col-span-2">
            <Card className="rounded-3xl border-border/30 glass-card p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-primary" /> Shift Attendance Infographic (7-Day)
                  </h3>
                  <p className="text-xs text-muted-foreground">Workers reporting to site across active workdays</p>
                </div>
                <Badge variant="outline" className="text-xs rounded-full">
                  Live Attendance
                </Badge>
              </div>

              <div className="h-64 w-full mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={attendanceTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgba(23, 23, 23, 0.85)",
                        backdropFilter: "blur(12px)",
                        borderRadius: "12px",
                        border: "1px solid rgba(255,255,255,0.1)",
                        color: "#fff",
                      }}
                    />
                    <Bar dataKey="present" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} name="Crew Present" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {/* Active Projects Quick Inspection */}
          <div className="lg:col-span-1">
            <Card className="rounded-3xl border-border/30 glass-card p-6 h-full flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold flex items-center gap-2">
                  <Layers className="w-4 h-4 text-primary" /> Active Site Progress
                </h3>
                <Button variant="ghost" size="sm" asChild className="rounded-xl text-xs gap-1">
                  <Link to="/projects">
                    All <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </Button>
              </div>

              {assignedProjects.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground flex-1 flex flex-col items-center justify-center">
                  <FolderKanban className="w-8 h-8 opacity-30 mb-2" />
                  <p className="text-sm">No active projects assigned.</p>
                </div>
              ) : (
                <div className="space-y-3.5 flex-1">
                  {assignedProjects.slice(0, 4).map((p) => (
                    <div key={p.id} className="p-3.5 rounded-2xl glass border border-border/30 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-bold truncate">{p.name}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{p.location || "Site location"}</p>
                        </div>
                        <Badge variant="outline" className="text-[10px] shrink-0 font-mono">
                          {p.completion_percentage || 0}%
                        </Badge>
                      </div>
                      <Progress value={p.completion_percentage || 0} className="h-1.5" />
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>

        {/* Recent Daily Progress Reports / Activity Feed */}
        <Card className="rounded-3xl border-border/30 glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-primary" /> Recent Daily Progress Reports (DPR)
              </h3>
              <p className="text-xs text-muted-foreground">Work completed and site activities filed today</p>
            </div>
            <Button asChild size="sm" variant="outline" className="rounded-xl text-xs gap-1.5">
              <Link to="/dpr">
                View Site DPR <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </Button>
          </div>

          {dailyActivityLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No DPR activities logged for today yet.
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              {dailyActivityLogs.map((act) => (
                <div key={act.id} className="p-4 rounded-2xl glass border border-border/30 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-primary truncate">{act.project?.name || "Project Site"}</p>
                    <span className="text-[10px] text-muted-foreground">{format(new Date(act.created_at), "HH:mm")}</span>
                  </div>
                  <p className="text-xs text-foreground/90 line-clamp-2">{act.description || "Activity recorded"}</p>
                  <div className="flex items-center gap-2 pt-1">
                    <Progress value={act.progress_percentage || 0} className="h-1 flex-1" />
                    <span className="text-[10px] text-muted-foreground font-mono">{act.progress_percentage || 0}%</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
}
