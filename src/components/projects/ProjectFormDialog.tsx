import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import type { Project } from "@/hooks/useProjects";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  project?: Project | null;
  onSaved: () => void;
}

const empty = {
  name: "",
  client_name: "",
  location: "",
  description: "",
  status: "not_started" as Project["status"],
  start_date: "",
  expected_end_date: "",
  budget: "",
  project_manager: "",
};

export const ProjectFormDialog = ({ open, onOpenChange, project, onSaved }: Props) => {
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (project) {
      setForm({
        name: project.name || "",
        client_name: project.client_name || "",
        location: project.location || "",
        description: project.description || "",
        status: project.status,
        start_date: project.start_date || "",
        expected_end_date: project.expected_end_date || "",
        budget: project.budget != null ? String(project.budget) : "",
        project_manager: project.project_manager || "",
      });
    } else {
      setForm(empty);
    }
  }, [project, open]);

  const save = async () => {
    if (!form.name.trim()) {
      toast({ variant: "destructive", title: "Project name is required" });
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }
    const payload: any = {
      name: form.name.trim(),
      client_name: form.client_name.trim() || null,
      location: form.location.trim() || null,
      description: form.description.trim() || null,
      status: form.status,
      start_date: form.start_date || null,
      expected_end_date: form.expected_end_date || null,
      budget: form.budget ? Number(form.budget) : null,
      project_manager: form.project_manager.trim() || null,
    };

    let error;
    if (project) {
      ({ error } = await supabase.from("projects").update(payload).eq("id", project.id));
    } else {
      payload.supervisor_id = user.id;
      ({ error } = await supabase.from("projects").insert(payload));
    }
    setSaving(false);
    if (error) {
      toast({ variant: "destructive", title: "Failed to save", description: error.message });
      return;
    }
    toast({ title: project ? "Project updated" : "Project created" });
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-heavy max-w-lg">
        <DialogHeader>
          <DialogTitle>{project ? "Edit Project" : "New Project"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Project Name *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Client</Label>
              <Input value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} />
            </div>
            <div>
              <Label>Location</Label>
              <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Start Date</Label>
              <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
            </div>
            <div>
              <Label>Expected End</Label>
              <Input type="date" value={form.expected_end_date} onChange={(e) => setForm({ ...form, expected_end_date: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Budget</Label>
              <Input type="number" min="0" step="0.01" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} />
            </div>
            <div>
              <Label>Project Manager</Label>
              <Input value={form.project_manager} onChange={(e) => setForm({ ...form, project_manager: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v: any) => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="not_started">Not Started</SelectItem>
                <SelectItem value="active">In Progress</SelectItem>
                <SelectItem value="on_hold">On Hold</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Description</Label>
            <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
