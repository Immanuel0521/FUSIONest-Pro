import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { ClipboardList, AlertTriangle, TrendingUp, Users } from "lucide-react";
import { format } from "date-fns";

export default function DprOverview() {
  const [projects, setProjects] = useState<any[]>([]);
  const [today, setToday] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);

  useEffect(() => { (async () => {
    const todayDate = new Date().toISOString().split("T")[0];
    const [pr, dpr, al] = await Promise.all([
      supabase.from("projects").select("*").in("status", ["active", "not_started"]),
      supabase.from("dpr_reports" as any).select("*, projects(name)").eq("report_date", todayDate),
      supabase.from("material_alerts" as any).select("*, projects(name)").eq("status", "open"),
    ]);
    setProjects((pr.data as any[]) || []);
    setToday((dpr.data as any[]) || []);
    setAlerts((al.data as any[]) || []);
  })(); }, []);

  const submitted = today.filter((d) => ["submitted", "under_review", "approved"].includes(d.status)).length;
  const pending = projects.length - submitted;
  const atRisk = today.filter((d) => d.readiness === "at_risk" || d.readiness === "blocked").length;

  const projectHealth = projects.map((p) => {
    const dpr = today.find((d) => d.project_id === p.id);
    const openAlerts = alerts.filter((a) => a.project_id === p.id).length;
    const light = !dpr ? "red" : dpr.readiness === "blocked" || openAlerts > 2 ? "red" : dpr.readiness === "at_risk" || openAlerts > 0 ? "amber" : "green";
    return { project: p, dpr, openAlerts, light };
  });

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">DPR Management Overview</h1>
            <p className="text-xs text-muted-foreground">Org-wide health of daily progress reporting</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Kpi icon={ClipboardList} label="Active Projects" value={projects.length} />
          <Kpi icon={ClipboardList} label="Submitted Today" value={submitted} />
          <Kpi icon={ClipboardList} label="Pending" value={pending} tone="amber" />
          <Kpi icon={AlertTriangle} label="At Risk / Blocked" value={atRisk} tone="red" />
          <Kpi icon={AlertTriangle} label="Open Material Alerts" value={alerts.length} tone="red" />
        </div>

        <Card className="glass-card p-5">
          <h3 className="font-bold mb-3">Project Health</h3>
          {projectHealth.length === 0 ? <p className="text-sm text-muted-foreground">No active projects.</p> :
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {projectHealth.map(({ project, dpr, openAlerts, light }) => (
                <Link key={project.id} to={`/projects/${project.id}?tab=dpr`}
                  className="p-4 rounded-xl glass hover:shadow-lg transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold">{project.name}</div>
                    <div className={`w-3 h-3 rounded-full ${light === "green" ? "bg-emerald-500" : light === "amber" ? "bg-amber-500" : "bg-red-500"}`} />
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <div>Progress: {project.completion_percentage || 0}%</div>
                    <div>Today's DPR: {dpr ? <Badge variant="outline" className="ml-1 text-[10px]">{dpr.status}</Badge> : <span className="text-red-500">Not submitted</span>}</div>
                    {dpr && <div>Readiness: <span className="capitalize">{dpr.readiness || "—"}</span></div>}
                    <div>Open alerts: {openAlerts}</div>
                  </div>
                </Link>
              ))}
            </div>
          }
        </Card>
      </div>
    </DashboardLayout>
  );
}

function Kpi({ icon: Icon, label, value, tone }: any) {
  const toneCls = tone === "red" ? "text-red-600" : tone === "amber" ? "text-amber-600" : "text-primary";
  return (
    <Card className="glass-card p-4">
      <Icon className={`w-4 h-4 ${toneCls} mb-2`} />
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </Card>
  );
}