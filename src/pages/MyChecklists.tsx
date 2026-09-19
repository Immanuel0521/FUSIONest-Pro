import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ListChecks, AlertTriangle, Eye } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { format, isBefore } from "date-fns";
import { PC_STATUS_CLASS, PC_STATUS_LABEL, PCStatus } from "@/hooks/useProjectChecklists";

export default function MyChecklists() {
  const nav = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("project_checklists" as any)
        .select("*, template:checklist_templates(title, stage), project:projects(name)")
        .order("assigned_date", { ascending: false });
      setItems((data as any) || []);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => items.filter((i) => filter === "all" ? true : i.status === filter), [items, filter]);

  const stats = {
    total: items.length,
    pending: items.filter((i) => i.status === "not_started").length,
    inProgress: items.filter((i) => i.status === "in_progress").length,
    completed: items.filter((i) => i.status === "completed").length,
    overdue: items.filter((i) => i.due_date && i.status !== "completed" && isBefore(new Date(i.due_date), new Date())).length,
  };

  return (
    <DashboardLayout>
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            <ListChecks className="w-6 h-6 text-primary" /> My Checklists
          </h1>
          <p className="text-sm text-muted-foreground">Checklists assigned across your projects</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            ["All", stats.total, "all", ""],
            ["Pending", stats.pending, "not_started", "text-muted-foreground"],
            ["In Progress", stats.inProgress, "in_progress", "text-amber-600"],
            ["Completed", stats.completed, "completed", "text-emerald-600"],
            ["Overdue", stats.overdue, "all", "text-destructive"],
          ].map(([label, val, f, cls]) => (
            <button key={label as string} onClick={() => setFilter(f as string)} className={`glass-card rounded-xl p-4 text-left ${filter === f ? "ring-2 ring-primary" : ""}`}>
              <div className="text-xs text-muted-foreground">{label}</div>
              <div className={`text-2xl font-bold mt-1 ${cls as string}`}>{val}</div>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : filtered.length === 0 ? (
          <Card className="glass-card p-12 text-center text-muted-foreground rounded-2xl">No checklists</Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((it) => {
              const overdue = it.due_date && it.status !== "completed" && isBefore(new Date(it.due_date), new Date());
              return (
                <Card key={it.id} className="glass-card rounded-xl p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold">{it.template?.title}</h4>
                      <div className="text-xs text-muted-foreground">{it.project?.name}</div>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        <Badge className={`${PC_STATUS_CLASS[it.status as PCStatus]} border-0 text-[10px]`}>{PC_STATUS_LABEL[it.status as PCStatus]}</Badge>
                        {overdue && <Badge className="bg-destructive/15 text-destructive border-0 text-[10px] gap-1"><AlertTriangle className="w-3 h-3" /> Overdue</Badge>}
                        {it.due_date && <span className="text-[11px] text-muted-foreground self-center">Due {format(new Date(it.due_date), "MMM d")}</span>}
                      </div>
                    </div>
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => nav(`/projects/${it.project_id}/checklists/${it.id}/fill`)}>
                      <Eye className="w-3.5 h-3.5" /> {it.status === "completed" ? "View" : "Fill"}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </motion.div>
    </DashboardLayout>
  );
}