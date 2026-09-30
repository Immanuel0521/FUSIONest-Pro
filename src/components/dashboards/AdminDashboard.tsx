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
  ShieldCheck,
  Users,
  FolderKanban,
  FileBarChart,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  Settings2,
  Sliders,
  DollarSign,
  Activity,
  Layers,
  Crown,
  Database,
  Building2,
  CalendarCheck,
  Sparkles,
  PieChart as PieChartIcon,
} from "lucide-react";
import { format } from "date-fns";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";

export default function AdminDashboard() {
  const { activeCompany } = useCompanyContext();
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [stats, setStats] = useState({
    totalWorkers: 0,
    presentToday: 0,
    absentToday: 0,
    lateToday: 0,
    totalOvertime: 0,
    activeProjects: 0,
    totalSupervisors: 0,
    systemChecklists: 0,
    attendanceRate: 0,
  });
  const [projectsList, setProjectsList] = useState<any[]>([]);
  const [attendanceChartData, setAttendanceChartData] = useState<any[]>([]);
  const [projectDistribution, setProjectDistribution] = useState<any[]>([]);

  useEffect(() => {
    loadAdminAnalytics();
  }, []);

  const loadAdminAnalytics = async () => {
    try {
      const today = new Date().toISOString().split("T")[0];

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: p } = await supabase.from("user_profiles").select("is_super_admin").eq("id", user.id).maybeSingle();
        if (p?.is_super_admin) setIsSuperAdmin(true);
      }

      const [workersRes, attRes, projRes, membersRes, pcRes] = await Promise.all([
        supabase.from("workers").select("id"),
        supabase.from("attendance_logs").select("*").eq("date", today),
        supabase.from("projects").select("*").order("created_at", { ascending: false }),
        supabase.from("company_members").select("id, role").eq("is_active", true),
        supabase.from("project_checklists" as any).select("id, status"),
      ]);

      const totalWorkers = workersRes.data?.length || 0;
      const todayLogs = attRes.data || [];
      const presentToday = todayLogs.length;
      const absentToday = Math.max(0, totalWorkers - presentToday);
      const lateToday = todayLogs.filter(l => l.is_late).length;
      const totalOvertime = todayLogs.reduce((acc, curr) => acc + (Number(curr.overtime_hours) || 0), 0);
      const projects = projRes.data || [];
      const activeProjects = projects.filter(p => p.status === "active").length;
      const supervisorsCount = (membersRes.data || []).filter(m => m.role === "supervisor").length;
      const attendanceRate = totalWorkers > 0 ? Math.round((presentToday / totalWorkers) * 100) : 0;

      setStats({
        totalWorkers,
        presentToday,
        absentToday,
        lateToday,
        totalOvertime: Math.round(totalOvertime * 10) / 10,
        activeProjects,
        totalSupervisors: supervisorsCount,
        systemChecklists: pcRes.data?.length || 0,
        attendanceRate,
      });

      setProjectsList(projects.slice(0, 6));

      // Query past 7 days of actual attendance records
      const past7Days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return d.toISOString().split("T")[0];
      });

      const { data: past7Logs } = await supabase
        .from("attendance_logs")
        .select("date, overtime_hours")
        .gte("date", past7Days[0])
        .lte("date", past7Days[6]);

      const chartTrend = past7Days.map((dStr, idx) => {
        const dayLogs = (past7Logs || []).filter(l => l.date === dStr);
        const otHours = dayLogs.reduce((acc, curr) => acc + (Number(curr.overtime_hours) || 0), 0);
        const dayLabel = idx === 6 ? "Today" : format(new Date(dStr), "EEE");
        return {
          name: dayLabel,
          Present: dayLogs.length,
          OT: Math.round(otHours * 10) / 10,
        };
      });
      setAttendanceChartData(chartTrend);

      // Distribution by status
      const completedCount = projects.filter(p => p.status === "completed").length;
      const activeCount = projects.filter(p => p.status === "active").length;
      const otherCount = projects.filter(p => p.status !== "completed" && p.status !== "active").length;

      setProjectDistribution([
        { name: "Active", value: activeCount || 1, color: "hsl(var(--primary))" },
        { name: "Completed", value: completedCount, color: "#10b981" },
        { name: "Planning", value: otherCount, color: "#8b5cf6" },
      ]);
    } catch (e) {
      console.error("Admin dashboard error:", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Admin Executive Header */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-heavy rounded-3xl p-6 sm:p-8 relative overflow-hidden border border-border/30"
        >
          <div className="absolute top-0 right-0 w-80 h-80 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="rounded-full bg-primary/15 text-primary border-primary/30 px-3 py-0.5 text-xs font-semibold gap-1.5 shadow-sm">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Full System Admin Control
                </Badge>
                <Badge variant="outline" className="rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-xs px-2.5">
                  <Sparkles className="w-3 h-3 mr-1" />
                  Executive Mode
                </Badge>
                <span className="text-xs text-muted-foreground">{format(new Date(), "EEEE, d MMMM yyyy")}</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mt-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                Enterprise Administration
              </h1>
              <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                Organization: <span className="font-semibold text-foreground">{activeCompany?.name || "Company Workspace"}</span>. Complete authority across all company workforce, projects, checklists, financial overtime, and roles.
              </p>
            </div>

            {/* Quick Access to Settings & Super Admin */}
            <div className="flex flex-wrap items-center gap-2.5">
              <Button asChild className="rounded-2xl gap-2 font-semibold shadow-md shadow-primary/20">
                <Link to="/company-settings">
                  <Settings2 className="w-4 h-4" /> Company Settings
                </Link>
              </Button>
              <Button asChild variant="outline" className="rounded-2xl gap-2">
                <Link to="/reports">
                  <FileBarChart className="w-4 h-4" /> Reports & Payroll
                </Link>
              </Button>
              {isSuperAdmin && (
                <Button asChild variant="outline" className="rounded-2xl gap-2 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10">
                  <Link to="/super-admin">
                    <Crown className="w-4 h-4" /> Platform Super Admin
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </motion.div>

        {/* Executive KPI Stats Infographics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: "Workforce Present Today",
              value: `${stats.presentToday} / ${stats.totalWorkers}`,
              rate: `${stats.attendanceRate}% Attendance Rate`,
              icon: Users,
              color: "text-emerald-600 dark:text-emerald-400",
              bg: "bg-emerald-500/10",
            },
            {
              label: "Total Projects Managed",
              value: `${stats.activeProjects} Active`,
              rate: "Real-time Site DPR Tracking",
              icon: FolderKanban,
              color: "text-blue-600 dark:text-blue-400",
              bg: "bg-blue-500/10",
            },
            {
              label: "Cumulative Overtime",
              value: `${stats.totalOvertime} hrs`,
              rate: "Shift calculation beyond 8h",
              icon: TrendingUp,
              color: "text-amber-600 dark:text-amber-400",
              bg: "bg-amber-500/10",
            },
            {
              label: "Field Supervisors",
              value: `${stats.totalSupervisors} Active`,
              rate: `${stats.systemChecklists} Total site checklists`,
              icon: ShieldCheck,
              color: "text-purple-600 dark:text-purple-400",
              bg: "bg-purple-500/10",
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
                <p className="text-[11px] text-muted-foreground mt-1">{item.rate}</p>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Infographic Charts Row */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main 7-Day Attendance and Overtime Area Chart */}
          <div className="lg:col-span-2">
            <Card className="rounded-3xl border-border/30 glass-card p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-primary" /> Enterprise Attendance & Shift Trend
                  </h3>
                  <p className="text-xs text-muted-foreground">Crew deployment vs accumulated overtime hours</p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="w-2.5 h-2.5 rounded-full bg-primary" /> Present Workers
                  </span>
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Overtime (hrs)
                  </span>
                </div>
              </div>

              <div className="h-72 w-full mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={attendanceChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="adminPresentGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="adminOtGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
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
                    <Area type="monotone" dataKey="Present" stroke="hsl(var(--primary))" strokeWidth={2} fillOpacity={1} fill="url(#adminPresentGrad)" />
                    <Area type="monotone" dataKey="OT" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#adminOtGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {/* Project Distribution Pie Chart Infographic */}
          <div className="lg:col-span-1">
            <Card className="rounded-3xl border-border/30 glass-card p-6 h-full flex flex-col justify-between">
              <div>
                <h3 className="text-base font-bold flex items-center gap-2">
                  <PieChartIcon className="w-4 h-4 text-primary" /> Project Portfolio Health
                </h3>
                <p className="text-xs text-muted-foreground">Status breakdown across current contracts</p>
              </div>

              <div className="h-52 w-full my-auto flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={projectDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {projectDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2 pt-2 border-t border-border/30">
                {projectDistribution.map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      {item.name}
                    </span>
                    <span className="font-semibold">{item.value} Projects</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>

        {/* Project Health Table & Management Hub */}
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card className="rounded-3xl border-border/30 glass-card p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold flex items-center gap-2">
                    <FolderKanban className="w-4 h-4 text-primary" /> Active Site Projects
                  </h3>
                  <p className="text-xs text-muted-foreground">Direct link to construction progress and timelines</p>
                </div>
                <Button variant="ghost" size="sm" asChild className="rounded-xl text-xs gap-1">
                  <Link to="/projects">
                    View All <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </Button>
              </div>

              <div className="space-y-3">
                {projectsList.map((p) => (
                  <div key={p.id} className="p-4 rounded-2xl glass border border-border/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{p.location || "Site Location"}</p>
                    </div>

                    <div className="flex items-center gap-4 min-w-[200px]">
                      <div className="flex-1 space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Progress</span>
                          <span className="font-semibold text-primary">{p.completion_percentage || 0}%</span>
                        </div>
                        <Progress value={p.completion_percentage || 0} className="h-1.5" />
                      </div>
                      <Badge variant={p.status === "active" ? "default" : "secondary"} className="text-[10px] capitalize">
                        {p.status || "active"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Quick System Navigation Actions */}
          <div className="lg:col-span-1 space-y-4">
            <Card className="rounded-3xl border-border/30 glass-card p-6">
              <h3 className="text-base font-bold flex items-center gap-2 mb-3">
                <Sliders className="w-4 h-4 text-primary" /> Admin Modules
              </h3>
              <div className="grid grid-cols-1 gap-2">
                <Button asChild variant="outline" className="justify-start gap-2.5 rounded-xl h-11 text-xs font-semibold">
                  <Link to="/workforce">
                    <Users className="w-4 h-4 text-blue-500" /> Manage Workforce & Biometrics
                  </Link>
                </Button>
                <Button asChild variant="outline" className="justify-start gap-2.5 rounded-xl h-11 text-xs font-semibold">
                  <Link to="/attendance-history">
                    <CalendarCheck className="w-4 h-4 text-emerald-500" /> Attendance Audit History
                  </Link>
                </Button>
                <Button asChild variant="outline" className="justify-start gap-2.5 rounded-xl h-11 text-xs font-semibold">
                  <Link to="/company-settings">
                    <Settings2 className="w-4 h-4 text-purple-500" /> Company Roles & Logo Settings
                  </Link>
                </Button>
                <Button asChild variant="outline" className="justify-start gap-2.5 rounded-xl h-11 text-xs font-semibold">
                  <Link to="/super-admin">
                    <Crown className="w-4 h-4 text-amber-500" /> Super Admin Subscription & Limits
                  </Link>
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
