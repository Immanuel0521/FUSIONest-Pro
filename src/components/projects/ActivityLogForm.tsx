import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { WorkerSelector } from "@/components/WorkerSelector";
import { ActivityPhotoUpload } from "@/components/ActivityPhotoUpload";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Activity } from "lucide-react";

interface Props {
  onLogged: () => void;
}

export const ActivityLogForm = ({ onLogged }: Props) => {
  const { toast } = useToast();
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [activityTypes, setActivityTypes] = useState<{ id: string; name: string }[]>([]);
  const [projectId, setProjectId] = useState("");
  const [activityTypeId, setActivityTypeId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [progress, setProgress] = useState(0);
  const [description, setDescription] = useState("");
  const [materials, setMaterials] = useState("");
  const [issues, setIssues] = useState("");
  const [workers, setWorkers] = useState<any[]>([]);
  const [photos, setPhotos] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: pj }, { data: at }] = await Promise.all([
        supabase.from("projects").select("id,name").eq("status", "active").order("name"),
        supabase.from("activity_types").select("id,name").order("display_order", { nullsFirst: false }),
      ]);
      setProjects(pj || []);
      setActivityTypes(at || []);
    })();
  }, []);

  const submit = async () => {
    if (!projectId || !activityTypeId) {
      toast({ variant: "destructive", title: "Project and activity type required" });
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: activity, error } = await supabase
      .from("daily_activities")
      .insert({
        project_id: projectId,
        activity_type_id: activityTypeId,
        date,
        progress_percentage: progress,
        description: description || null,
        materials_used: materials || null,
        issues_faced: issues || null,
        supervisor_id: user.id,
      })
      .select()
      .single();

    if (error || !activity) {
      setSaving(false);
      toast({ variant: "destructive", title: "Failed to log activity", description: error?.message });
      return;
    }

    if (workers.length > 0) {
      const workerRows = workers.map((w) => ({
        daily_activity_id: activity.id,
        worker_id: w.workerId,
        guest_worker_name: w.isGuest ? w.workerName : null,
        department: w.department,
        hours_worked: w.hoursWorked,
        ot_hours: w.otHours,
      }));
      await supabase.from("activity_workers").insert(workerRows);
    }

    if (photos.length > 0) {
      for (const photo of photos) {
        const ext = photo.file.name.split(".").pop();
        const path = `${user.id}/${activity.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: upErr } = await supabase.storage.from("activity-photos").upload(path, photo.file);
        if (!upErr) {
          await supabase.from("activity_photos").insert({
            daily_activity_id: activity.id,
            photo_url: path,
            caption: photo.caption || null,
          });
        }
      }
    }

    toast({ title: "Activity logged" });
    setProjectId("");
    setActivityTypeId("");
    setProgress(0);
    setDescription("");
    setMaterials("");
    setIssues("");
    setWorkers([]);
    setPhotos([]);
    setSaving(false);
    onLogged();
  };

  return (
    <Card className="glass-card rounded-2xl p-6 space-y-5">
      <div className="flex items-center gap-2">
        <Activity className="w-5 h-5 text-primary" />
        <h3 className="font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Log Daily Activity</h3>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <Label>Project *</Label>
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
            <SelectContent>
              {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Activity Type *</Label>
          <Select value={activityTypeId} onValueChange={setActivityTypeId}>
            <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
            <SelectContent>
              {activityTypes.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <Label>Progress: <span className="text-primary font-bold">{progress}%</span></Label>
          <Slider value={[progress]} onValueChange={(v) => setProgress(v[0])} max={100} step={5} className="mt-3" />
        </div>
      </div>

      <div>
        <Label>Description</Label>
        <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What was done today?" />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <Label>Materials Used</Label>
          <Textarea rows={2} value={materials} onChange={(e) => setMaterials(e.target.value)} />
        </div>
        <div>
          <Label>Issues Faced</Label>
          <Textarea rows={2} value={issues} onChange={(e) => setIssues(e.target.value)} />
        </div>
      </div>

      <div>
        <Label className="mb-2 block">Workers</Label>
        <WorkerSelector selectedWorkers={workers} onWorkersChange={setWorkers} />
      </div>

      <div>
        <Label className="mb-2 block">Photos</Label>
        <ActivityPhotoUpload photos={photos} onPhotosChange={setPhotos} />
      </div>

      <Button onClick={submit} disabled={saving} className="w-full">
        {saving ? "Saving..." : "Log Activity"}
      </Button>
    </Card>
  );
};
