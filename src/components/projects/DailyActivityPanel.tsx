import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Calendar, Plus, Trash2, Pencil, Activity as ActIcon } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface Props { projectId: string; }

interface Act {
  id: string;
  date: string;
  description: string | null;
  hours_worked: number | null;
  materials_used: string | null;
  equipment_used: string | null;
  weather_conditions: string | null;
  notes: string | null;
  progress_percentage: number | null;
  activity_workers: { id: string; worker_id: string | null; guest_worker_name: string | null; worker?: { full_name: string } | null }[];
}

const emptyForm = { date: new Date().toISOString().slice(0, 10), description: "", hours_worked: "", materials_used: "", equipment_used: "", weather_conditions: "", notes: "", progress_percentage: "", workerIds: [] as string[] };

export const DailyActivityPanel = ({ projectId }: Props) => {
  const { toast } = useToast();
  const [items, setItems] = useState<Act[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [projectWorkers, setProjectWorkers] = useState<{ id: string; full_name: string }[]>([]);
  const [defaultActivityType, setDefaultActivityType] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data }, { data: pw }, { data: at }] = await Promise.all([
      supabase.from("daily_activities").select("id,date,description,hours_worked,materials_used,equipment_used,weather_conditions,notes,progress_percentage,activity_workers(id,worker_id,guest_worker_name,worker:workers(full_name))").eq("project_id", projectId).order("date", { ascending: false }),
      (supabase.from("project_workers" as any).select("worker:workers(id,full_name)").eq("project_id", projectId)),
      supabase.from("activity_types").select("id").limit(1),
    ]);
    setItems((data as any) || []);
    setProjectWorkers(((pw as any) || []).map((r: any) => r.worker).filter(Boolean));
    setDefaultActivityType(at?.[0]?.id || null);
    setLoading(false);
  };

  useEffect(() => { load(); }, [projectId]);

  const filtered = useMemo(() => {
    return items.filter((a) => {
      if (filterFrom && a.date < filterFrom) return false;
      if (filterTo && a.date > filterTo) return false;
      return true;
    });
  }, [items, filterFrom, filterTo]);

  const summary = useMemo(() => {
    const hours = filtered.reduce((s, a) => s + (Number(a.hours_worked) || 0), 0);
    const workers = new Set<string>();
    filtered.forEach((a) => a.activity_workers.forEach((w) => workers.add(w.worker_id || w.guest_worker_name || "")));
    return { hours, workers: workers.size, count: filtered.length };
  }, [filtered]);

  const submit = async () => {
    if (!form.description.trim()) { toast({ variant: "destructive", title: "Description required" }); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const payload: any = {
      project_id: projectId,
      supervisor_id: user.id,
      activity_type_id: defaultActivityType,
      date: form.date,
      description: form.description.trim(),
      hours_worked: form.hours_worked ? Number(form.hours_worked) : null,
      materials_used: form.materials_used || null,
      equipment_used: form.equipment_used || null,
      weather_conditions: form.weather_conditions || null,
      notes: form.notes || null,
      progress_percentage: form.progress_percentage ? Number(form.progress_percentage) : 0,
    };

    let activityId = editing;
    if (editing) {
      const { error } = await supabase.from("daily_activities").update(payload).eq("id", editing);
      if (error) { toast({ variant: "destructive", title: "Failed", description: error.message }); return; }
      await supabase.from("activity_workers").delete().eq("daily_activity_id", editing);
    } else {
      const { data, error } = await supabase.from("daily_activities").insert(payload).select().single();
      if (error || !data) { toast({ variant: "destructive", title: "Failed", description: error?.message }); return; }
      activityId = data.id;
    }

    if (form.workerIds.length > 0 && activityId) {
      await supabase.from("activity_workers").insert(form.workerIds.map((wid) => ({
        daily_activity_id: activityId,
        worker_id: wid,
        department: "fitters" as any,
        hours_worked: form.hours_worked ? Number(form.hours_worked) / form.workerIds.length : 8,
      })));
    }

    toast({ title: editing ? "Activity updated" : "Activity logged" });
    setForm(emptyForm); setEditing(null); setShowForm(false);
    load();
  };

  const beginEdit = (a: Act) => {
    setEditing(a.id);
    setForm({
      date: a.date, description: a.description || "",
      hours_worked: a.hours_worked != null ? String(a.hours_worked) : "",
      materials_used: a.materials_used || "", equipment_used: a.equipment_used || "",
      weather_conditions: a.weather_conditions || "", notes: a.notes || "",
      progress_percentage: a.progress_percentage != null ? String(a.progress_percentage) : "",
      workerIds: a.activity_workers.map((w) => w.worker_id).filter(Boolean) as string[],
    });
    setShowForm(true);
  };

  const del = async () => {
    if (!confirmDel) return;
    const { error } = await supabase.from("daily_activities").delete().eq("id", confirmDel);
    if (error) toast({ variant: "destructive", title: "Failed", description: error.message });
    else { toast({ title: "Activity deleted" }); load(); }
    setConfirmDel(null);
  };

  const toggleWorker = (id: string) => {
    setForm((f) => ({ ...f, workerIds: f.workerIds.includes(id) ? f.workerIds.filter((x) => x !== id) : [...f.workerIds, id] }));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-2 items-center">
          <Label className="text-xs">From</Label>
          <Input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} className="w-[150px]" />
          <Label className="text-xs">To</Label>
          <Input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} className="w-[150px]" />
        </div>
        <div className="ml-auto flex gap-2">
          <Badge variant="outline">{summary.count} activities</Badge>
          <Badge variant="outline">{summary.hours.toFixed(1)} hrs</Badge>
          <Badge variant="outline">{summary.workers} workers</Badge>
        </div>
        <Button onClick={() => { setEditing(null); setForm(emptyForm); setShowForm(!showForm); }} className="gap-2">
          <Plus className="w-4 h-4" /> {showForm ? "Hide form" : "Log Activity"}
        </Button>
      </div>

      {showForm && (
        <Card className="glass-card rounded-2xl p-5 space-y-3">
          <div className="grid md:grid-cols-3 gap-3">
            <div><Label>Date</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
            <div><Label>Hours Worked</Label><Input type="number" step="0.5" value={form.hours_worked} onChange={(e) => setForm({ ...form, hours_worked: e.target.value })} /></div>
            <div><Label>Progress %</Label><Input type="number" min="0" max="100" value={form.progress_percentage} onChange={(e) => setForm({ ...form, progress_percentage: e.target.value })} /></div>
          </div>
          <div><Label>Description *</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="grid md:grid-cols-2 gap-3">
            <div><Label>Materials Used</Label><Textarea rows={2} value={form.materials_used} onChange={(e) => setForm({ ...form, materials_used: e.target.value })} /></div>
            <div><Label>Equipment Used</Label><Textarea rows={2} value={form.equipment_used} onChange={(e) => setForm({ ...form, equipment_used: e.target.value })} /></div>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <div><Label>Weather</Label><Input value={form.weather_conditions} onChange={(e) => setForm({ ...form, weather_conditions: e.target.value })} /></div>
            <div><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <div>
            <Label>Workers Involved</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {projectWorkers.length === 0 && <p className="text-xs text-muted-foreground">No workers assigned to this project.</p>}
              {projectWorkers.map((w) => (
                <Badge key={w.id} variant={form.workerIds.includes(w.id) ? "default" : "outline"} className="cursor-pointer" onClick={() => toggleWorker(w.id)}>
                  {w.full_name}
                </Badge>
              ))}
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => { setShowForm(false); setEditing(null); setForm(emptyForm); }}>Cancel</Button>
            <Button onClick={submit}>{editing ? "Update" : "Save"}</Button>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : filtered.length === 0 ? (
        <Card className="glass-card p-8 text-center">
          <ActIcon className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground">No daily activities logged.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((a) => (
            <Card key={a.id} className="glass-card rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="w-3.5 h-3.5 text-primary" />
                    <span className="font-semibold text-sm">{format(new Date(a.date), "EEE, MMM d, yyyy")}</span>
                    {a.hours_worked != null && <Badge variant="outline" className="text-[10px]">{a.hours_worked}h</Badge>}
                    {a.progress_percentage != null && <Badge variant="outline" className="text-[10px]">{a.progress_percentage}% progress</Badge>}
                  </div>
                  {a.description && <p className="text-sm">{a.description}</p>}
                  <div className="grid md:grid-cols-2 gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                    {a.materials_used && <div><strong>Materials:</strong> {a.materials_used}</div>}
                    {a.equipment_used && <div><strong>Equipment:</strong> {a.equipment_used}</div>}
                    {a.weather_conditions && <div><strong>Weather:</strong> {a.weather_conditions}</div>}
                    {a.notes && <div><strong>Notes:</strong> {a.notes}</div>}
                  </div>
                  {a.activity_workers.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {a.activity_workers.map((w) => (
                        <Badge key={w.id} variant="secondary" className="text-[10px]">{w.worker?.full_name || w.guest_worker_name}</Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => beginEdit(a)}><Pencil className="w-4 h-4" /></Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setConfirmDel(a.id)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!confirmDel} onOpenChange={(v) => !v && setConfirmDel(null)}>
        <AlertDialogContent className="glass-heavy">
          <AlertDialogHeader><AlertDialogTitle>Delete activity?</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={del} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
