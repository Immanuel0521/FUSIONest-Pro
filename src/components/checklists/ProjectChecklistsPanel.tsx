import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Eye, Trash2, AlertTriangle } from "lucide-react";
import { useProjectChecklists, PC_STATUS_LABEL, PC_STATUS_CLASS, PCStatus } from "@/hooks/useProjectChecklists";
import { AssignChecklistDialog } from "./AssignChecklistDialog";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { format, isBefore } from "date-fns";
import { STAGE_LABEL, ChecklistStage } from "@/hooks/useChecklistTemplates";
import { useUserRole } from "@/hooks/useUserRole";

interface Props { projectId: string; }

export const ProjectChecklistsPanel = ({ projectId }: Props) => {
  const { items, loading, reload } = useProjectChecklists(projectId);
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const { role } = useUserRole();
  const isAdmin = role === "admin";

  const stats = {
    total: items.length,
    completed: items.filter((i) => i.status === "completed").length,
    inProgress: items.filter((i) => i.status === "in_progress").length,
    overdue: items.filter((i) => i.due_date && i.status !== "completed" && isBefore(new Date(i.due_date), new Date())).length,
  };

  const remove = async (id: string) => {
    if (!confirm("Remove this assignment?")) return;
    const { error } = await supabase.from("project_checklists" as any).delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Removed"); reload(); }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ["Total", stats.total, "bg-primary/10 text-primary"],
          ["Completed", stats.completed, "bg-emerald-500/10 text-emerald-600"],
          ["In Progress", stats.inProgress, "bg-amber-500/10 text-amber-600"],
          ["Overdue", stats.overdue, "bg-destructive/10 text-destructive"],
        ].map(([label, val, cls]) => (
          <Card key={label as string} className={`glass-card rounded-xl p-4 ${cls as string}`}>
            <div className="text-xs opacity-80">{label}</div>
            <div className="text-2xl font-bold mt-1">{val}</div>
          </Card>
        ))}
      </div>

      {isAdmin && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setOpen(true)} className="gap-1"><Plus className="w-4 h-4" /> Assign Checklist</Button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-muted-foreground text-sm">Loading...</div>
      ) : items.length === 0 ? (
        <Card className="glass-card p-10 text-center text-muted-foreground rounded-2xl">No checklists assigned yet</Card>
      ) : (
        <div className="space-y-2">
          {items.map((it) => {
            const overdue = it.due_date && it.status !== "completed" && isBefore(new Date(it.due_date), new Date());
            return (
              <Card key={it.id} className="glass-card rounded-xl p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold">{it.template?.title}</h4>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      <Badge className={`${PC_STATUS_CLASS[it.status as PCStatus]} border-0 text-[10px]`}>{PC_STATUS_LABEL[it.status as PCStatus]}</Badge>
                      {it.template?.stage && <Badge variant="secondary" className="text-[10px]">{STAGE_LABEL[it.template.stage as ChecklistStage]}</Badge>}
                      {overdue && <Badge className="bg-destructive/15 text-destructive border-0 text-[10px] gap-1"><AlertTriangle className="w-3 h-3" /> Overdue</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-2">
                      Assigned {format(new Date(it.assigned_date), "MMM d, yyyy")}
                      {it.due_date && ` • Due ${format(new Date(it.due_date), "MMM d, yyyy")}`}
                      {it.completed_at && ` • Completed ${format(new Date(it.completed_at), "MMM d, yyyy")}`}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => nav(`/projects/${projectId}/checklists/${it.id}/fill`)}>
                      <Eye className="w-3.5 h-3.5" /> {it.status === "completed" ? "View" : "Fill Out"}
                    </Button>
                    {isAdmin && (
                      <Button size="sm" variant="outline" className="text-destructive" onClick={() => remove(it.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <AssignChecklistDialog open={open} onOpenChange={setOpen} projectId={projectId} onAssigned={reload} />
    </div>
  );
};