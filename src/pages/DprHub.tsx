import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { ClipboardList, AlertTriangle, ArrowRight } from "lucide-react";
import { format } from "date-fns";

export default function DprHub({ embedded }: { embedded?: boolean } = {}) {
  const [reports, setReports] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { (async () => {
    const [r, a] = await Promise.all([
      supabase.from("dpr_reports" as any).select("*, projects(name)").order("report_date", { ascending: false }).limit(50),
      supabase.from("material_alerts" as any).select("*, projects(name)").eq("status", "open").order("created_at", { ascending: false }).limit(20),
    ]);
    setReports((r.data as any[]) || []);
    setAlerts((a.data as any[]) || []);
    setLoading(false);
  })(); }, []);

  const statusColor = (s: string) => ({
    approved: "bg-emerald-500/15 text-emerald-600",
    submitted: "bg-blue-500/15 text-blue-600",
    under_review: "bg-blue-500/15 text-blue-600",
    draft: "bg-amber-500/15 text-amber-600",
    returned: "bg-red-500/15 text-red-600",
    not_started: "bg-muted text-muted-foreground",
  } as any)[s] || "bg-muted";

  const content = (
    <div className="space-y-5">
      {!embedded && (
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <ClipboardList className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Site DPR & Planning</h1>
            <p className="text-sm text-muted-foreground">Daily progress reports across every project</p>
          </div>
        </div>
      )}

        {alerts.length > 0 && (
          <Card className="glass-card rounded-2xl p-5">
            <h2 className="font-bold mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500" /> Open Material Alerts</h2>
            <div className="space-y-2">
              {alerts.map((a) => (
                <div key={a.id} className="flex items-center justify-between p-3 rounded-xl glass text-sm">
                  <div>
                    <div className="font-semibold">{a.material_name} — short {a.shortfall}</div>
                    <div className="text-xs text-muted-foreground">{a.projects?.name} · required {a.required_date ? format(new Date(a.required_date), "PP") : "—"}</div>
                  </div>
                  <Badge variant="outline">{a.priority}</Badge>
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card className="glass-card rounded-2xl p-5">
          <h2 className="font-bold mb-3">Recent DPRs</h2>
          {loading ? <div className="text-sm text-muted-foreground py-6 text-center">Loading…</div> :
           reports.length === 0 ? <div className="text-sm text-muted-foreground py-6 text-center">No DPRs yet. Open any project → Site DPR tab to start.</div> :
           <div className="space-y-2">
             {reports.map((r) => (
               <Link key={r.id} to={
                 r.status === "submitted" || r.status === "under_review" || r.status === "approved"
                   ? `/dpr/${r.id}/review`
                   : `/projects/${r.project_id}/dpr/${r.id}`
               } className="flex items-center justify-between p-3 rounded-xl glass hover:bg-primary/5">
                 <div>
                   <div className="font-semibold text-sm">{r.dpr_number} — {r.projects?.name}</div>
                   <div className="text-xs text-muted-foreground">{format(new Date(r.report_date), "PPP")}</div>
                 </div>
                 <div className="flex items-center gap-2">
                   <Badge className={`${statusColor(r.status)} border-0 text-[10px]`}>{r.status}</Badge>
                   <ArrowRight className="w-4 h-4 text-muted-foreground" />
                 </div>
               </Link>
             ))}
           </div>}
        </Card>
      </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <DashboardLayout>
      {content}
    </DashboardLayout>
  );
}