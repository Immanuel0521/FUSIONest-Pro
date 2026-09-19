import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Trash2, Plus, Check, FileDown, FileSpreadsheet } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, CartesianGrid } from "recharts";
import { format } from "date-fns";
import type { Project } from "@/hooks/useProjects";
import { generateProjectReport } from "@/lib/projectReport";

interface Props { project: Project; reload: () => void; }
interface Milestone { id: string; name: string; target_date: string | null; completion_date: string | null; status: string; notes: string | null; }
interface History { id: string; recorded_date: string; completion_percentage: number; notes: string | null; }

export const ProgressPanel = ({ project, reload }: Props) => {
  const { toast } = useToast();
  const [pct, setPct] = useState(project.completion_percentage || 0);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [history, setHistory] = useState<History[]>([]);
  const [activitiesForReport, setActivitiesForReport] = useState<any[]>([]);
  const [actualSpend, setActualSpend] = useState("");
  const [newMilestone, setNewMilestone] = useState({ name: "", target_date: "" });

  const load = async () => {
    const [{ data: ms }, { data: hs }, { data: acts }] = await Promise.all([
      supabase.from("project_milestones" as any).select("*").eq("project_id", project.id).order("target_date", { ascending: true }),
      supabase.from("progress_history" as any).select("*").eq("project_id", project.id).order("recorded_date"),
      supabase.from("daily_activities").select("date,description,hours_worked").eq("project_id", project.id).order("date", { ascending: false }).limit(50),
    ]);
    setMilestones((ms as any) || []);
    setHistory((hs as any) || []);
    setActivitiesForReport(acts || []);
  };

  useEffect(() => { setPct(project.completion_percentage || 0); load(); }, [project.id]);

  const saveProgress = async () => {
    await supabase.from("projects").update({ completion_percentage: pct }).eq("id", project.id);
    await supabase.from("progress_history" as any).insert({ project_id: project.id, completion_percentage: pct, recorded_date: new Date().toISOString().slice(0, 10) });
    toast({ title: `Progress saved at ${pct}%` });
    reload(); load();
  };

  const addMilestone = async () => {
    if (!newMilestone.name) return;
    const { error } = await supabase.from("project_milestones" as any).insert({ project_id: project.id, name: newMilestone.name, target_date: newMilestone.target_date || null });
    if (error) toast({ variant: "destructive", title: "Failed", description: error.message });
    else { setNewMilestone({ name: "", target_date: "" }); load(); }
  };

  const completeMilestone = async (m: Milestone) => {
    const newStatus = m.status === "completed" ? "pending" : "completed";
    await supabase.from("project_milestones" as any).update({
      status: newStatus,
      completion_date: newStatus === "completed" ? new Date().toISOString().slice(0, 10) : null,
    }).eq("id", m.id);
    load();
  };

  const delMilestone = async (id: string) => {
    await supabase.from("project_milestones" as any).delete().eq("id", id);
    load();
  };

  const exportCSV = () => {
    const rows = [["Date", "Description", "Hours"], ...activitiesForReport.map((a) => [a.date, (a.description || "").replace(/"/g, '""'), a.hours_worked || ""])];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${project.name}-activities.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const generatePDF = async () => {
    toast({ title: "Generating report..." });
    await generateProjectReport({ project, milestones, history, activities: activitiesForReport });
  };

  const days = project.expected_end_date ? Math.ceil((new Date(project.expected_end_date).getTime() - Date.now()) / 86400000) : null;
  const actualNum = Number(actualSpend) || 0;
  const budgetNum = Number(project.budget) || 0;

  return (
    <div className="space-y-4">
      <Card className="glass-card rounded-2xl p-5 space-y-3">
        <Label className="text-base font-bold">Project Completion</Label>
        <div className="flex items-center gap-3">
          <Slider value={[pct]} onValueChange={(v) => setPct(v[0])} max={100} step={1} className="flex-1" />
          <Input type="number" min="0" max="100" value={pct} onChange={(e) => setPct(Number(e.target.value))} className="w-20" />
          <Button onClick={saveProgress}>Save</Button>
        </div>
        <Progress value={pct} className="h-2" />
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="glass-card rounded-2xl p-5">
          <h4 className="font-bold mb-3">Progress Over Time</h4>
          {history.length === 0 ? <p className="text-sm text-muted-foreground">No history yet. Save progress to start tracking.</p> :
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={history.map((h) => ({ date: format(new Date(h.recorded_date), "MMM d"), value: h.completion_percentage }))}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="date" fontSize={11} />
                <YAxis domain={[0, 100]} fontSize={11} />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>}
        </Card>

        <Card className="glass-card rounded-2xl p-5">
          <h4 className="font-bold mb-3">Budget Tracking</h4>
          <div className="flex gap-2 mb-3">
            <Input type="number" placeholder="Actual spend so far" value={actualSpend} onChange={(e) => setActualSpend(e.target.value)} />
          </div>
          {budgetNum > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={[{ name: "Budget", Planned: budgetNum, Actual: actualNum }]}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="name" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip /><Legend />
                <Bar dataKey="Planned" fill="hsl(var(--primary))" />
                <Bar dataKey="Actual" fill="hsl(var(--accent))" />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-muted-foreground">Set a budget on the project to enable tracking.</p>}
          <p className="text-xs text-muted-foreground mt-2">Remaining: {(budgetNum - actualNum).toLocaleString()}</p>
        </Card>
      </div>

      <Card className="glass-card rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-bold">Milestones</h4>
          {days != null && <Badge variant={days < 0 ? "destructive" : "outline"}>{days < 0 ? `${Math.abs(days)} days overdue` : `${days} days remaining`}</Badge>}
        </div>
        <div className="grid md:grid-cols-[1fr_200px_auto] gap-2 items-end">
          <div><Label>Milestone Name</Label><Input value={newMilestone.name} onChange={(e) => setNewMilestone({ ...newMilestone, name: e.target.value })} /></div>
          <div><Label>Target Date</Label><Input type="date" value={newMilestone.target_date} onChange={(e) => setNewMilestone({ ...newMilestone, target_date: e.target.value })} /></div>
          <Button onClick={addMilestone} className="gap-2"><Plus className="w-4 h-4" /> Add</Button>
        </div>
        {milestones.length === 0 ? <p className="text-sm text-muted-foreground">No milestones yet.</p> : (
          <div className="space-y-2">
            {milestones.map((m) => (
              <div key={m.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/40">
                <div>
                  <div className="font-medium text-sm flex items-center gap-2">
                    {m.name}
                    <Badge variant={m.status === "completed" ? "default" : "outline"} className="text-[10px]">{m.status}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {m.target_date && `Target: ${format(new Date(m.target_date), "MMM d, yyyy")}`}
                    {m.completion_date && ` · Done: ${format(new Date(m.completion_date), "MMM d, yyyy")}`}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => completeMilestone(m)}><Check className="w-4 h-4" /></Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => delMilestone(m.id)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={exportCSV} className="gap-2"><FileSpreadsheet className="w-4 h-4" /> Export CSV</Button>
        <Button onClick={generatePDF} className="gap-2"><FileDown className="w-4 h-4" /> PDF Report</Button>
      </div>
    </div>
  );
};
