import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Trash2, UserPlus, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

interface Props { projectId: string; }

interface PW { id: string; worker_id: string; role: string | null; assigned_date: string; worker?: { full_name: string; designation: string | null } }

export const ProjectWorkersPanel = ({ projectId }: Props) => {
  const { toast } = useToast();
  const [assigned, setAssigned] = useState<PW[]>([]);
  const [allWorkers, setAllWorkers] = useState<{ id: string; full_name: string }[]>([]);
  const [busyAssigned, setBusyAssigned] = useState<Set<string>>(new Set());
  const [pickedWorker, setPickedWorker] = useState("");
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [{ data: pw, error: assignmentsError }, { data: workers, error: workersError }, { data: busy }] = await Promise.all([
      (supabase.from("project_workers" as any).select("id,worker_id,role,assigned_date").eq("project_id", projectId).order("assigned_date")),
      supabase.from("workers").select("id, full_name").order("full_name"),
      (supabase.from("project_workers" as any).select("worker_id, project:projects(status)")),
    ]);
    if (assignmentsError || workersError) {
      toast({ variant: "destructive", title: "Could not load workers", description: assignmentsError?.message || workersError?.message });
      setLoading(false);
      return;
    }
    const workerIds = ((pw as any[]) || []).map((row) => row.worker_id);
    const { data: workerDetails, error: detailsError } = workerIds.length
      ? await supabase.from("workers").select("id,full_name,designation").in("id", workerIds)
      : { data: [], error: null };
    const details = new Map(((workerDetails as any[]) || []).map((worker) => [worker.id, worker]));
    setAssigned(((pw as any[]) || []).map((row) => ({ ...row, worker: details.get(row.worker_id) })));
    if (detailsError) toast({ variant: "destructive", title: "Worker details unavailable", description: detailsError.message });
    setAllWorkers(workers || []);
    const busySet = new Set<string>();
    ((busy as any) || []).forEach((b: any) => {
      if (b.project?.status === "active") busySet.add(b.worker_id);
    });
    setBusyAssigned(busySet);
    setLoading(false);
  };

  useEffect(() => { load(); }, [projectId]);

  const add = async () => {
    if (!pickedWorker) return;
    const { error } = await supabase.from("project_workers" as any).insert({ project_id: projectId, worker_id: pickedWorker, role: role || null });
    if (error) toast({ variant: "destructive", title: "Failed", description: error.message });
    else { toast({ title: "Worker assigned" }); setPickedWorker(""); setRole(""); load(); }
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("project_workers" as any).delete().eq("id", id);
    if (error) toast({ variant: "destructive", title: "Failed", description: error.message });
    else { toast({ title: "Worker removed" }); load(); }
  };

  const assignedIds = new Set(assigned.map((a) => a.worker_id));
  const available = allWorkers.filter((w) => !assignedIds.has(w.id));

  return (
    <Card className="glass-card rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Users className="w-5 h-5 text-primary" />
        <h3 className="font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Assigned Workers ({assigned.length})</h3>
      </div>

      <div className="grid md:grid-cols-[1fr_1fr_auto] gap-2 items-end">
        <div>
          <Label>Worker</Label>
          <Select value={pickedWorker} onValueChange={setPickedWorker}>
            <SelectTrigger><SelectValue placeholder="Select worker" /></SelectTrigger>
            <SelectContent>
              {available.length === 0 && <div className="px-3 py-2 text-sm text-muted-foreground">No more workers</div>}
              {available.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.full_name} {busyAssigned.has(w.id) && <span className="text-xs text-amber-600">(on other active project)</span>}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Role</Label>
          <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Lead Fitter" />
        </div>
        <Button onClick={add} disabled={!pickedWorker} className="gap-2"><UserPlus className="w-4 h-4" /> Assign</Button>
      </div>

      {loading ? (
        <div className="text-center py-4 text-sm text-muted-foreground">Loading...</div>
      ) : assigned.length === 0 ? (
        <div className="text-center py-6 text-sm text-muted-foreground">No workers assigned yet.</div>
      ) : (
        <div className="space-y-2">
          {assigned.map((a) => (
            <div key={a.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/40">
              <div>
                <div className="font-medium text-sm">{a.worker?.full_name}</div>
                <div className="text-xs text-muted-foreground flex gap-2 items-center">
                  {a.role && <Badge variant="outline" className="text-[10px]">{a.role}</Badge>}
                  <span>since {new Date(a.assigned_date).toLocaleDateString()}</span>
                </div>
              </div>
              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => remove(a.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
