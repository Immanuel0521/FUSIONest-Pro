import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
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
  CheckCircle2,
  Clock,
  LogIn,
  Camera,
  ExternalLink,
  ChevronRight,
  HardHat,
} from "lucide-react";
import { format } from "date-fns";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
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
  const [attendanceBreakdown, setAttendanceBreakdown] = useState<any[]>([]);

  useEffect(() => {
    loadAdminAnalytics();
  }, []);

  const loadAdminAnalytics = async () => {
    try {
      const today = new Date().toISOString().split("T")[0];

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: p } = await supabase
          .from("user_profiles")
          .select("is_super_admin")
          .eq("id", user.id)
          .maybeSingle();
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
      const lateToday = todayLogs.filter((l) => l.is_late).length;
      const onTimeToday = Math.max(0, presentToday - lateToday);
      const absentToday = Math.max(0, totalWorkers - presentToday);
      const totalOvertime = todayLogs.reduce(
        (acc, curr) => acc + (Number(curr.overtime_hours) || 0),
        0
      );
      const projects = projRes.data || [];
      const activeProjects = projects.filter((p) => p.status === "active").length;
      const supervisorsCount = (membersRes.data || []).filter(
        (m) => m.role === "supervisor"
      ).length;
      const attendanceRate =
        totalWorkers > 0 ? Math.round((presentToday / totalWorkers) * 100) : 0;

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

      // Attendance Breakdown Donut
      setAttendanceBreakdown([
        { name: "On-Time Present", value: onTimeToday || (presentToday > 0 ? presentToday : 0), color: "#10b981" },
        { name: "Late Entry", value: lateToday, color: "#f59e0b" },
        { name: "Absent / Not Checked In", value: absentToday, color: "#64748b" },
      ]);

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
        const dayLogs = (past7Logs || []).filter((l) => l.date === dStr);
        const otHours = dayLogs.reduce(
          (acc, curr) => acc + (Number(curr.overtime_hours) || 0),
          0
        );
        const dayLabel = idx === 6 ? "Today" : format(new Date(dStr), "EEE");
        return {
          name: dayLabel,
          Present: dayLogs.length,
          OT: Math.round(otHours * 10) / 10,
        };
      });
      setAttendanceChartData(chartTrend);

      // Distribution by status
      const completedCount = projects.filter((p) => p.status === "completed").length;
      const activeCount = projects.filter((p) => p.status === "active").length;
      const otherCount = projects.filter(
        (p) => p.status !== "completed" && p.status !== "active"
      ).length;

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
        {/* Top Executive Header Card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl border border-border/40 bg-gradient-to-r from-card via-card/90 to-primary/5 p-6 sm:p-8 backdrop-blur-xl shadow-sm"
        >
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
          
          <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Live Sync Active
                </span>

                <Badge variant="outline" className="rounded-full bg-primary/10 text-primary border-primary/20 text-xs px-2.5 py-0.5 font-medium gap-1">
                  <Building2 className="w-3 h-3" />
                  {activeCompany?.name || "Company Workspace"}
                </Badge>

                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {format(new Date(), "EEEE, d MMMM yyyy")}
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                Executive Intelligence Hub
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl leading-relaxed">
                Enterprise command center for facial biometric shift logging, geofenced labor allocation, site DPR engineering, and payroll computation.
              </p>
            </div>

            {/* Quick Navigation Buttons */}
            <div className="flex flex-wrap items-center gap-2.5">
              <Button asChild size="sm" className="rounded-2xl gap-2 font-semibold shadow-md shadow-primary/20 h-10 px-4">
                <Link to="/workforce?tab=attendance">
                  <LogIn className="w-4 h-4" /> Live Attendance
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="rounded-2xl gap-2 h-10 px-4">
                <Link to="/reports">
                  <FileBarChart className="w-4 h-4 text-primary" /> Reports &amp; Payroll
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="rounded-2xl gap-2 h-10 px-4">
                <Link to="/company-settings">
                  <Settings2 className="w-4 h-4" /> Settings
                </Link>
              </Button>
              {isSuperAdmin && (
                <Button asChild variant="outline" size="sm" className="rounded-2xl gap-2 h-10 px-4 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10">
                  <Link to="/super-admin">
                    <Crown className="w-4 h-4 text-amber-500" /> Super Admin
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </motion.div>

        {/* 4 High-Contrast Executive KPI Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Today's Attendance */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <Link to="/workforce?tab=attendance" className="block group">
              <Card className="rounded-3xl border-border/40 glass-card p-5 group-hover:border-emerald-500/40 transition-all hover:shadow-md">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <Users className="w-5 h-5" />
                  </div>
                  <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-xs font-semibold">
                    {stats.attendanceRate}% Present
                  </Badge>
                </div>
                <p className="text-3xl font-extrabold tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  {stats.presentToday} <span className="text-sm font-normal text-muted-foreground">/ {stats.totalWorkers}</span>
                </p>
                <p className="text-xs font-semibold text-foreground/80 mt-1">Crew Attendance Today</p>
                <div className="mt-2.5">
                  <Progress value={stats.attendanceRate} className="h-1.5 bg-muted" />
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-2">
                  <span>{stats.lateToday} Late Entry</span>
                  <span>{stats.absentToday} Not Checked In</span>
                </div>
              </Card>
            </Link>
          </motion.div>

          {/* 2. Cumulative Overtime */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Link to="/reports" className="block group">
              <Card className="rounded-3xl border-border/40 glass-card p-5 group-hover:border-amber-500/40 transition-all hover:shadow-md">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-11 h-11 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10 font-medium">
                    Shift +OT
                  </Badge>
                </div>
                <p className="text-3xl font-extrabold tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  {stats.totalOvertime} <span className="text-sm font-normal text-muted-foreground">hrs</span>
                </p>
                <p className="text-xs font-semibold text-foreground/80 mt-1">Cumulative Overtime</p>
                <p className="text-[11px] text-muted-foreground mt-2">
                  Calculated beyond standard 8h daily shift limit.
                </p>
                <div className="flex items-center gap-1 text-[11px] text-primary font-medium mt-2 pt-2 border-t border-border/30">
                  <span>View payroll breakdown</span>
                  <ChevronRight className="w-3 h-3" />
                </div>
              </Card>
            </Link>
          </motion.div>

          {/* 3. Active Projects */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <Link to="/projects" className="block group">
              <Card className="rounded-3xl border-border/40 glass-card p-5 group-hover:border-blue-500/40 transition-all hover:shadow-md">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-11 h-11 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <FolderKanban className="w-5 h-5" />
                  </div>
                  <Badge variant="outline" className="text-xs border-blue-500/30 text-blue-600 dark:text-blue-400 bg-blue-500/10 font-medium">
                    {projectsList.length} Total
                  </Badge>
                </div>
                <p className="text-3xl font-extrabold tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  {stats.activeProjects} <span className="text-sm font-normal text-muted-foreground">Active</span>
                </p>
                <p className="text-xs font-semibold text-foreground/80 mt-1">Site Projects Monitored</p>
                <p className="text-[11px] text-muted-foreground mt-2">
                  {stats.systemChecklists} Quality &amp; safety checklists active.
                </p>
                <div className="flex items-center gap-1 text-[11px] text-primary font-medium mt-2 pt-2 border-t border-border/30">
                  <span>Open project portfolio</span>
                  <ChevronRight className="w-3 h-3" />
                </div>
              </Card>
            </Link>
          </motion.div>

          {/* 4. Supervisors & Governance */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Link to="/workforce" className="block group">
              <Card className="rounded-3xl border-border/40 glass-card p-5 group-hover:border-purple-500/40 transition-all hover:shadow-md">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-11 h-11 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                    <HardHat className="w-5 h-5" />
                  </div>
                  <Badge variant="outline" className="text-xs border-purple-500/30 text-purple-600 dark:text-purple-400 bg-purple-500/10 font-medium">
                    Field Team
                  </Badge>
                </div>
                <p className="text-3xl font-extrabold tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  {stats.totalSupervisors} <span className="text-sm font-normal text-muted-foreground">Supervisors</span>
                </p>
                <p className="text-xs font-semibold text-foreground/80 mt-1">Field Management Force</p>
                <p className="text-[11px] text-muted-foreground mt-2">
                  Managing {stats.totalWorkers} enrolled crew members.
                </p>
                <div className="flex items-center gap-1 text-[11px] text-primary font-medium mt-2 pt-2 border-t border-border/30">
                  <span>Manage workforce roster</span>
                  <ChevronRight className="w-3 h-3" />
                </div>
              </Card>
            </Link>
          </motion.div>
        </div>

        {/* Quick Operations Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Button asChild variant="outline" className="h-12 rounded-2xl glass-card border-border/40 justify-start gap-3 hover:border-primary/40 px-4 text-xs font-semibold">
            <Link to="/workforce?tab=attendance">
              <span className="w-7 h-7 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <LogIn className="w-3.5 h-3.5" />
              </span>
              <span className="truncate">Mark Live Attendance</span>
            </Link>
          </Button>

          <Button asChild variant="outline" className="h-12 rounded-2xl glass-card border-border/40 justify-start gap-3 hover:border-primary/40 px-4 text-xs font-semibold">
            <Link to="/workforce?tab=biometrics">
              <span className="w-7 h-7 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                <Camera className="w-3.5 h-3.5" />
              </span>
              <span className="truncate">Enroll Face Biometrics</span>
            </Link>
          </Button>

          <Button asChild variant="outline" className="h-12 rounded-2xl glass-card border-border/40 justify-start gap-3 hover:border-primary/40 px-4 text-xs font-semibold">
            <Link to="/dpr">
              <span className="w-7 h-7 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Activity className="w-3.5 h-3.5" />
              </span>
              <span className="truncate">Daily Progress (DPR)</span>
            </Link>
          </Button>

          <Button asChild variant="outline" className="h-12 rounded-2xl glass-card border-border/40 justify-start gap-3 hover:border-primary/40 px-4 text-xs font-semibold">
            <Link to="/attendance-history">
              <span className="w-7 h-7 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <CalendarCheck className="w-3.5 h-3.5" />
              </span>
              <span className="truncate">Attendance Audit History</span>
            </Link>
          </Button>
        </div>

        {/* Infographic Charts Row: 7-Day Velocity + Today's Breakdown */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main 7-Day Attendance and Overtime Area Chart */}
          <div className="lg:col-span-2">
            <Card className="rounded-3xl border-border/40 glass-card p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-base font-bold flex items-center gap-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                    <TrendingUp className="w-4 h-4 text-primary" /> 7-Day Workforce &amp; Shift Trend
                  </h3>
                  <p className="text-xs text-muted-foreground">Daily crew presence vs cumulative overtime hours</p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="w-2.5 h-2.5 rounded-full bg-primary" /> Present Crew
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
                    <CartesianGrid strokeDasharray="3 3" opacity={0.12} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgba(18, 18, 22, 0.92)",
                        backdropFilter: "blur(12px)",
                        borderRadius: "14px",
                        border: "1px solid rgba(255,255,255,0.12)",
                        color: "#fff",
                        fontSize: "12px",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="Present"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#adminPresentGrad)"
                    />
                    <Area
                      type="monotone"
                      dataKey="OT"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#adminOtGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {/* Today's Attendance Breakdown Donut */}
          <div className="lg:col-span-1">
            <Card className="rounded-3xl border-border/40 glass-card p-6 h-full flex flex-col justify-between">
              <div>
                <h3 className="text-base font-bold flex items-center gap-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  <PieChartIcon className="w-4 h-4 text-primary" /> Today&apos;s Workforce Presence
                </h3>
                <p className="text-xs text-muted-foreground">Distribution of registered crew status today</p>
              </div>

              <div className="h-48 w-full my-auto flex items-center justify-center relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={attendanceBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {attendanceBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center Percentage */}
                <div className="absolute text-center pointer-events-none">
                  <span className="text-2xl font-black">{stats.attendanceRate}%</span>
                  <span className="block text-[10px] text-muted-foreground">Present</span>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-border/30">
                {attendanceBreakdown.map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      {item.name}
                    </span>
                    <span className="font-semibold">{item.value} Workers</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>

        {/* Bottom Bento Grid: Active Projects + Executive Governance Hub */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Active Site Projects */}
          <div className="lg:col-span-2">
            <Card className="rounded-3xl border-border/40 glass-card p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold flex items-center gap-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                    <FolderKanban className="w-4 h-4 text-primary" /> Active Site Projects
                  </h3>
                  <p className="text-xs text-muted-foreground">Civil construction progress, site milestones, and health</p>
                </div>
                <Button variant="ghost" size="sm" asChild className="rounded-xl text-xs gap-1">
                  <Link to="/projects">
                    View All <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </Button>
              </div>

              {projectsList.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-xs space-y-2">
                  <p>No active construction projects logged yet.</p>
                  <Button asChild size="sm" variant="outline" className="rounded-xl">
                    <Link to="/projects">Create Project</Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {projectsList.map((p) => (
                    <Link
                      key={p.id}
                      to={`/projects/${p.id}`}
                      className="group block p-4 rounded-2xl glass border border-border/40 hover:border-primary/40 hover:bg-card/70 transition-all"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-bold truncate group-hover:text-primary transition-colors">
                            {p.name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {p.location || "Site Location Unspecified"}
                          </p>
                        </div>

                        <div className="flex items-center gap-4 min-w-[200px]">
                          <div className="flex-1 space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground text-[11px]">Completion</span>
                              <span className="font-semibold text-primary text-[11px]">
                                {p.completion_percentage || 0}%
                              </span>
                            </div>
                            <Progress value={p.completion_percentage || 0} className="h-1.5" />
                          </div>
                          <Badge
                            variant={p.status === "active" ? "default" : "secondary"}
                            className="text-[10px] capitalize shrink-0"
                          >
                            {p.status || "active"}
                          </Badge>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Executive Modules & Governance Links */}
          <div className="lg:col-span-1 space-y-4">
            <Card className="rounded-3xl border-border/40 glass-card p-6">
              <h3 className="text-base font-bold flex items-center gap-2 mb-3" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                <Sliders className="w-4 h-4 text-primary" /> Admin Launchpad
              </h3>
              <div className="space-y-2">
                <Button asChild variant="outline" className="w-full justify-between rounded-xl h-12 text-xs font-semibold px-3 hover:border-primary/40">
                  <Link to="/workforce">
                    <span className="flex items-center gap-2.5">
                      <Users className="w-4 h-4 text-blue-500" /> Workforce &amp; Biometrics Roster
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                  </Link>
                </Button>

                <Button asChild variant="outline" className="w-full justify-between rounded-xl h-12 text-xs font-semibold px-3 hover:border-primary/40">
                  <Link to="/attendance-history">
                    <span className="flex items-center gap-2.5">
                      <CalendarCheck className="w-4 h-4 text-emerald-500" /> Attendance Audit History
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                  </Link>
                </Button>

                <Button asChild variant="outline" className="w-full justify-between rounded-xl h-12 text-xs font-semibold px-3 hover:border-primary/40">
                  <Link to="/stage-standards">
                    <span className="flex items-center gap-2.5">
                      <ShieldCheck className="w-4 h-4 text-cyan-500" /> Execution Quality Standards
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                  </Link>
                </Button>

                <Button asChild variant="outline" className="w-full justify-between rounded-xl h-12 text-xs font-semibold px-3 hover:border-primary/40">
                  <Link to="/company-settings">
                    <span className="flex items-center gap-2.5">
                      <Settings2 className="w-4 h-4 text-purple-500" /> Company Roles &amp; Workspaces
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                  </Link>
                </Button>

                <Button asChild variant="outline" className="w-full justify-between rounded-xl h-12 text-xs font-semibold px-3 hover:border-primary/40">
                  <Link to="/sitemap">
                    <span className="flex items-center gap-2.5">
                      <ExternalLink className="w-4 h-4 text-primary" /> Complete HTML Sitemap
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                  </Link>
                </Button>

                {isSuperAdmin && (
                  <Button asChild variant="outline" className="w-full justify-between rounded-xl h-12 text-xs font-semibold px-3 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10">
                    <Link to="/super-admin">
                      <span className="flex items-center gap-2.5">
                        <Crown className="w-4 h-4 text-amber-500" /> Platform Super Admin Console
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-amber-500" />
                    </Link>
                  </Button>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
