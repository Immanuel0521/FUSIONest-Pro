import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import {
  FolderKanban,
  Users,
  AlertTriangle,
  TrendingUp,
  FileBarChart,
  ArrowRight,
  ClipboardCheck,
  BookOpen,
  Activity,
} from "lucide-react";
import { format, differenceInCalendarDays } from "date-fns";

type ProjectRow = {
  id: string;
  name: string;
  location: string | null;
  status: string | null;
  completion_percentage: number | null;
  expected_end_date: string | null;
  supervisor_id: string;
};

export default function ManagementDashboard() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [workersToday, setWorkersToday] = useState(0);
  const [overdueChecklists, setOverdueChecklists] = useState(0);
  const [pendingChecklists, setPendingChecklists] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    const today = new Date().toISOString().split("T")[0];
    const [projRes, attRes, pcRes] = await Promise.all([
      supabase
        .from("projects")
        .select("id, name, location, status, completion_percentage, expected_end_date, supervisor_id")
        .order("created_at", { ascending: false }),
      supabase.from("attendance_logs").select("id").eq("date", today),
      supabase
        .from("project_checklists" as any)
        .select("id, status, due_date"),
    ]);

    setProjects((projRes.data as ProjectRow[]) || []);
    setWorkersToday(attRes.data?.length || 0);

    const pcs = (pcRes.data as any[]) || [];
    const pending = pcs.filter((p) => p.status !== "completed");
    setPendingChecklists(pending.length);
    setOverdueChecklists(
      pending.filter((p) => p.due_date && p.due_date < today).length
    );
    setLoading(false);
  };

  const activeProjects = projects.filter((p) => p.status === "active");
  const avgProgress = activeProjects.length
    ? Math.round(
        activeProjects.reduce(
          (s, p) => s + (p.completion_percentage || 0),
          0
        ) / activeProjects.length
      )
    : 0;
  const behindSchedule = activeProjects.filter((p) => {
    if (!p.expected_end_date) return false;
    const days = differenceInCalendarDays(
      new Date(p.expected_end_date),
      new Date()
    );
    return days < 14 && (p.completion_percentage || 0) < 80;
  });

  const kpis = [
    {
      label: "Active Projects",
      value: activeProjects.length,
      icon: FolderKanban,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "Avg Progress",
      value: `${avgProgress}%`,
      icon: TrendingUp,
      color: "text-accent",
      bg: "bg-accent/10",
    },
    {
      label: "Workers Today",
      value: workersToday,
      icon: Users,
      color: "text-foreground",
      bg: "bg-muted",
    },
    {
      label: "Overdue Tasks",
      value: overdueChecklists,
      icon: AlertTriangle,
      color: "text-destructive",
      bg: "bg-destructive/10",
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="glass-heavy rounded-3xl p-6 sm:p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 rounded-full blur-3xl" />
            <div className="relative">
              <p className="text-muted-foreground text-sm font-medium">
                {format(new Date(), "EEEE, MMMM d")}
              </p>
              <h1
                className="text-3xl sm:text-4xl font-bold tracking-tight mt-1"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                Management Overview
              </h1>
              <p className="text-sm text-muted-foreground mt-2">
                Read-only oversight across all projects, attendance, and compliance.
              </p>
            </div>
          </div>
        </motion.div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {kpis.map((k, i) => (
            <motion.div
              key={k.label}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 + 0.2 }}
            >
              <Card className="glass-card rounded-2xl p-4">
                <div
                  className={`w-10 h-10 rounded-xl ${k.bg} flex items-center justify-center mb-3`}
                >
                  <k.icon className={`w-5 h-5 ${k.color}`} />
                </div>
                <p className="text-2xl font-bold tracking-tight">{k.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{k.label}</p>
              </Card>
            </motion.div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          {/* Projects Overview */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="lg:col-span-2"
          >
            <Card className="glass-card rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2
                  className="font-bold flex items-center gap-2"
                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  <FolderKanban className="w-5 h-5 text-primary" /> Projects Overview
                </h2>
                <Link
                  to="/projects"
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  View All <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Loading...
                </div>
              ) : projects.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No projects yet
                </div>
              ) : (
                <div className="space-y-2.5">
                  {projects.slice(0, 8).map((p) => (
                    <Link
                      key={p.id}
                      to={`/projects/${p.id}`}
                      className="block p-3 rounded-xl glass hover:bg-primary/5 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">
                            {p.name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {p.location || "No location"}
                          </p>
                        </div>
                        <Badge
                          variant={p.status === "active" ? "default" : "secondary"}
                          className="text-[10px]"
                        >
                          {p.status || "unknown"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Progress
                          value={p.completion_percentage || 0}
                          className="h-1.5 flex-1"
                        />
                        <span className="text-xs font-semibold text-primary tabular-nums w-9 text-right">
                          {p.completion_percentage || 0}%
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </Card>
          </motion.div>

          {/* Critical Alerts + Quick Access */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="space-y-4"
          >
            <Card className="glass-card rounded-2xl p-5">
              <h2
                className="font-bold flex items-center gap-2 mb-3"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                <AlertTriangle className="w-5 h-5 text-amber-500" /> Critical Alerts
              </h2>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 rounded-xl bg-destructive/5">
                  <span className="text-sm">Projects behind schedule</span>
                  <span className="text-lg font-bold text-destructive">
                    {behindSchedule.length}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-amber-500/5">
                  <span className="text-sm">Overdue checklists</span>
                  <span className="text-lg font-bold text-amber-500">
                    {overdueChecklists}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl glass">
                  <span className="text-sm">Pending checklists</span>
                  <span className="text-lg font-bold">{pendingChecklists}</span>
                </div>
              </div>
            </Card>

            <Card className="glass-card rounded-2xl p-5">
              <h2
                className="font-bold flex items-center gap-2 mb-3"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                <Activity className="w-5 h-5 text-primary" /> Quick Access
              </h2>
              <div className="grid grid-cols-2 gap-2">
                <Button asChild variant="outline" size="sm" className="gap-1.5">
                  <Link to="/reports">
                    <FileBarChart className="w-4 h-4" /> Reports
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="gap-1.5">
                  <Link to="/methodologies">
                    <BookOpen className="w-4 h-4" /> Methods
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="gap-1.5">
                  <Link to="/checklists">
                    <ClipboardCheck className="w-4 h-4" /> Checklists
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="gap-1.5">
                  <Link to="/attendance-history">
                    <Users className="w-4 h-4" /> Attendance
                  </Link>
                </Button>
              </div>
            </Card>
          </motion.div>
        </div>
      </div>
    </DashboardLayout>
  );
}
