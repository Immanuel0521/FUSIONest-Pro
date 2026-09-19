import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useChecklistTemplates, STAGE_LABEL, ChecklistStage } from "@/hooks/useChecklistTemplates";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface Props { open: boolean; onOpenChange: (o: boolean) => void; projectId: string; onAssigned: () => void; }

export const AssignChecklistDialog = ({ open, onOpenChange, projectId, onAssigned }: Props) => {
  const { templates } = useChecklistTemplates();
  const [templateId, setTemplateId] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!templateId) { toast.error("Pick a template"); return; }
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("project_checklists" as any).insert({
      project_id: projectId, template_id: templateId, due_date: dueDate || null, assigned_by: user?.id,
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success("Assigned"); onOpenChange(false); setTemplateId(""); setDueDate(""); onAssigned(); }
  };

  const interactive = templates.filter((t) => t.checklist_type === "interactive");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-heavy">
        <DialogHeader><DialogTitle>Assign Checklist</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Template *</Label>
            <select className="w-full h-10 rounded-md border bg-background px-3 text-sm" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
              <option value="">Select a checklist...</option>
              {interactive.map((t) => (
                <option key={t.id} value={t.id}>{t.title}{t.stage ? ` — ${STAGE_LABEL[t.stage as ChecklistStage]}` : ""}</option>
              ))}
            </select>
          </div>
          <div><Label>Due Date</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
            <Button onClick={submit} disabled={busy}>{busy ? "Assigning..." : "Assign"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};