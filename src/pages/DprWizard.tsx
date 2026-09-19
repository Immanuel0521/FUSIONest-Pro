import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, ArrowRight, Save, Send, Users, Hammer, Package, AlertTriangle,
  Camera, CalendarClock, CheckCircle2, Plus, Trash2, ExternalLink, Loader2,
} from "lucide-react";
import { format } from "date-fns";

export const DPR_STAGES = [
  "MS Structure Fabrication",
  "MS Structure Erection / Assembly",
  "GI Frame Fabrication",
  "GI Frame Assembly",
  "Roof Fabrication",
  "Roof Work",
  "Vapour Barrier / Membrane",
  "Internal Board Fixing",
  "Electrical Works",
  "Plumbing Works",
  "Insulation",
  "External Board Fixing",
  "Joint Treatment",
  "Putty",
  "Primer",
  "Painting",
  "Flooring / Tiles",
  "Doors & Windows",
  "Fixtures / Final Finishing",
  "Other",
];

const STEPS = [
  { id: 1, label: "Manpower", icon: Users },
  { id: 2, label: "Progress", icon: Hammer },
  { id: 3, label: "Materials", icon: Package },
  { id: 4, label: "Issues / QC / Safety", icon: AlertTriangle },
  { id: 5, label: "Photos", icon: Camera },
  { id: 6, label: "Tomorrow", icon: CalendarClock },
  { id: 7, label: "Review", icon: CheckCircle2 },
];

export default function DprWizard() {
  const { id: projectId, dprId } = useParams();
  const nav = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dpr, setDpr] = useState<any>(null);
  const [project, setProject] = useState<any>(null);

  // Step data
  const [manpower, setManpower] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [materialsMaster, setMaterialsMaster] = useState<any[]>([]);
  const [stock, setStock] = useState<Record<string, number>>({});
  const [issues, setIssues] = useState<any[]>([]);
  const [qc, setQc] = useState<any[]>([]);
  const [safety, setSafety] = useState<any>({
    ppe_ok: true, unsafe_condition: false, incident: false, near_miss: false, description: "",
  });
  const [photos, setPhotos] = useState<any[]>([]);
  const [tomorrowActs, setTomorrowActs] = useState<any[]>([]);
  const [tomorrowMats, setTomorrowMats] = useState<any[]>([]);
  const [readiness, setReadiness] = useState<"ready" | "at_risk" | "blocked">("ready");
  const [readinessReason, setReadinessReason] = useState("");
  const [confirmAccuracy, setConfirmAccuracy] = useState(false);
  const [activityTypes, setActivityTypes] = useState<any[]>([]);
  const [siteConditions, setSiteConditions] = useState<any>({
    supervisor: "", weather: "", work_start: "", work_end: "",
  });
  const [siteEngineerName, setSiteEngineerName] = useState<string>("");
  const [pmName, setPmName] = useState<string>("");
  const [projStock, setProjStock] = useState<any[]>([]);
  const [prevOpenIssues, setPrevOpenIssues] = useState<any[]>([]);

  const locked = dpr && dpr.status !== "draft" && dpr.status !== "returned";

  // -------- load ----------
  useEffect(() => {
    (async () => {
      if (!dprId || !projectId) return;
      setLoading(true);
      const [dprRes, projRes, actTypes, matMaster, stockRes, projStockRes] = await Promise.all([
        supabase.from("dpr_reports" as any).select("*").eq("id", dprId).single(),
        supabase.from("projects").select("*").eq("id", projectId).single(),
        supabase.from("activity_types" as any).select("*").order("display_order"),
        supabase.from("materials" as any).select("*").eq("active", true).order("name"),
        supabase.from("project_material_stock" as any).select("*").eq("project_id", projectId),
        supabase.from("project_stock_summary" as any).select("*").eq("project_id", projectId).order("name"),
      ]);
      if ((dprRes as any).error || !dprRes.data) {
        toast({ variant: "destructive", title: "Failed to load DPR" });
        nav(`/projects/${projectId}`);
        return;
      }
      const d: any = dprRes.data;
      setDpr(d);
      setProject(projRes.data);
      setActivityTypes((actTypes.data as any[]) || []);
      setMaterialsMaster((matMaster.data as any[]) || []);
      setProjStock((projStockRes.data as any[]) || []);
      const stockMap: Record<string, number> = {};
      ((stockRes.data as any[]) || []).forEach((s: any) => { stockMap[s.material_id] = Number(s.current_stock); });
      setStock(stockMap);
      setReadiness(d.readiness || "ready");
      setReadinessReason(d.readiness_reason || "");
      setConfirmAccuracy(!!d.confirm_accuracy);
      setSiteConditions({
        supervisor: d.site_conditions?.supervisor || "",
        weather: d.site_conditions?.weather || "",
        work_start: d.site_conditions?.work_start || "",
        work_end: d.site_conditions?.work_end || "",
      });

      // Resolve engineer / PM names for the auto-fill header
      const ids = [d.site_engineer_id, projRes.data?.project_manager_id].filter(Boolean);
      if (ids.length) {
        const { data: profs } = await supabase.from("user_profiles").select("id, full_name").in("id", ids);
        const map: Record<string, string> = {};
        (profs as any[] || []).forEach((p) => { map[p.id] = p.full_name || ""; });
        setSiteEngineerName(map[d.site_engineer_id] || "");
        setPmName(map[projRes.data?.project_manager_id] || projRes.data?.project_manager || "");
      } else if (projRes.data?.project_manager) {
        setPmName(projRes.data.project_manager);
      }

      // child rows
      const [mp, ac, mt, iss, qcRes, saf, ph, tAct, tMat] = await Promise.all([
        supabase.from("dpr_manpower" as any).select("*").eq("dpr_id", dprId),
        supabase.from("dpr_activities" as any).select("*").eq("dpr_id", dprId),
        supabase.from("dpr_materials" as any).select("*").eq("dpr_id", dprId),
        supabase.from("dpr_issues" as any).select("*").eq("dpr_id", dprId),
        supabase.from("dpr_qc" as any).select("*").eq("dpr_id", dprId),
        supabase.from("dpr_safety" as any).select("*").eq("dpr_id", dprId).maybeSingle(),
        supabase.from("dpr_photos" as any).select("*").eq("dpr_id", dprId),
        supabase.from("dpr_tomorrow_activities" as any).select("*").eq("dpr_id", dprId),
        supabase.from("dpr_tomorrow_materials" as any).select("*").eq("dpr_id", dprId),
      ]);

      // Manpower — prefill from attendance if empty
      if ((mp.data as any[])?.length) {
        setManpower(mp.data as any[]);
      } else {
        const { data: att } = await (supabase.from("attendance_logs") as any)
          .select("worker_id, regular_hours, overtime_hours, status, workers(full_name, designation)")
          .eq("date", d.report_date);
        const rows = ((att as any[]) || []).map((a) => ({
          dpr_id: dprId,
          worker_id: a.worker_id,
          worker_name: a.workers?.full_name || null,
          trade: a.workers?.designation || null,
          present: a.status === "completed" || a.status === "active",
          regular_hours: Number(a.regular_hours || 0),
          ot_hours: Number(a.overtime_hours || 0),
          work_area: "",
          activity_assigned: "",
          remarks: "",
        }));
        setManpower(rows);
      }

      // Activities — prefill from daily_activities
      if ((ac.data as any[])?.length) {
        setActivities(ac.data as any[]);
      } else {
        const { data: da } = await (supabase.from("daily_activities") as any)
          .select("activity_type_id, custom_activity_name, progress_percentage, description, activity_types(name)")
          .eq("project_id", projectId).eq("date", d.report_date);
        const rows = ((da as any[]) || []).map((x: any) => ({
          dpr_id: dprId,
          activity_type_id: x.activity_type_id,
          activity_name: x.custom_activity_name || x.activity_types?.name || "",
          location: "",
          planned_qty: 100, completed_qty: x.progress_percentage || 0, unit: "%",
          status: (x.progress_percentage || 0) >= 100 ? "completed" : "partial",
          remarks: x.description || "",
          cumulative_before: 0, cumulative_after: 0, total_project_qty: 0,
        }));
        setActivities(rows);
      }

      setMaterials((mt.data as any[]) || []);
      setIssues((iss.data as any[]) || []);
      setQc((qcRes.data as any[]) || []);
      if (saf.data) setSafety(saf.data);
      setPhotos((ph.data as any[]) || []);
      setTomorrowActs((tAct.data as any[]) || []);
      setTomorrowMats((tMat.data as any[]) || []);

      // Carry-forward source: previous DPR's unresolved issues
      const { data: prevDprs } = await supabase.from("dpr_reports" as any)
        .select("id, report_date").eq("project_id", projectId)
        .lt("report_date", d.report_date).order("report_date", { ascending: false }).limit(1);
      const prevId = (prevDprs as any[])?.[0]?.id;
      if (prevId) {
        const { data: prevIss } = await supabase.from("dpr_issues" as any)
          .select("*").eq("dpr_id", prevId).is("resolution_date", null);
        setPrevOpenIssues((prevIss as any[]) || []);
      }

      setLoading(false);
    })();
  }, [dprId, projectId]);

  // -------- autosave (debounced) ----------
  const saveTimer = useRef<any>(null);
  const scheduleSave = () => {
    if (locked) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(saveAll, 1500);
  };

  async function saveAll() {
    if (!dprId || locked) return;
    setSaving(true);
    try {
      await supabase.from("dpr_reports" as any).update({
        readiness, readiness_reason: readinessReason, confirm_accuracy: confirmAccuracy,
        site_conditions: siteConditions,
      } as any).eq("id", dprId);

      // Replace child collections (simplest correct approach for autosave)
      const replace = async (table: string, rows: any[]) => {
        await (supabase.from(table as any) as any).delete().eq("dpr_id", dprId);
        if (rows.length) {
          const clean = rows.map(({ id, created_at, ...r }: any) => ({ ...r, dpr_id: dprId }));
          await (supabase.from(table as any) as any).insert(clean);
        }
      };
      await Promise.all([
        replace("dpr_manpower", manpower),
        replace("dpr_activities", activities),
        replace("dpr_materials", materials),
        replace("dpr_issues", issues),
        replace("dpr_qc", qc),
        replace("dpr_tomorrow_activities", tomorrowActs),
        replace("dpr_tomorrow_materials", tomorrowMats),
      ]);

      // Safety is a single row per DPR
      await (supabase.from("dpr_safety") as any).delete().eq("dpr_id", dprId);
      await (supabase.from("dpr_safety") as any).insert({ ...safety, dpr_id: dprId });
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => { if (!loading) scheduleSave(); /* eslint-disable-next-line */ }, [
    manpower, activities, materials, issues, qc, safety, tomorrowActs, tomorrowMats,
    readiness, readinessReason, confirmAccuracy, siteConditions,
  ]);

  // -------- submit ----------
  async function submitDpr() {
    if (!confirmAccuracy) { toast({ variant: "destructive", title: "Please confirm accuracy" }); return; }
    const missingReason = activities.find((a: any) => a.target_reached === false && !(a.reason_not_achieved || "").trim());
    if (missingReason) {
      toast({ variant: "destructive", title: "Missing reason", description: "Enter a reason for every activity where the target was not reached." });
      setStep(2); return;
    }
    if (!photos.some((p) => p.category === "overall") || !photos.some((p) => p.category === "major_work")) {
      toast({ variant: "destructive", title: "Photos required", description: "Upload at least one 'overall' and one 'major_work' photo." });
      setStep(5); return;
    }
    if (tomorrowActs.length === 0) {
      toast({ variant: "destructive", title: "Next-day plan required", description: "Add at least one activity planned for tomorrow." });
      setStep(6); return;
    }
    if (readiness !== "ready" && !readinessReason.trim()) {
      toast({ variant: "destructive", title: "Readiness reason required", description: "Explain why tomorrow is at risk or blocked." });
      setStep(6); return;
    }
    setSubmitting(true);
    await saveAll();

    // Auto-create material alerts for shortages
    const shortages = tomorrowMats.filter((m) => Number(m.required_qty) - Number(m.available_qty) > 0);
    if (shortages.length) {
      const { data: u } = await supabase.auth.getUser();
      const alerts = shortages.map((m) => ({
        project_id: projectId,
        dpr_id: dprId,
        material_id: m.material_id,
        material_name: m.material_name,
        required_qty: m.required_qty,
        available_qty: m.available_qty,
        shortfall: Number(m.required_qty) - Number(m.available_qty),
        priority: "high",
        status: "open",
        requested_by: u.user?.id,
      }));
      await supabase.from("material_alerts" as any).insert(alerts as any);
    }

    const { error } = await supabase.from("dpr_reports" as any).update({
      status: "submitted",
      submitted_at: new Date().toISOString(),
    } as any).eq("id", dprId!);

    // Notify PM
    if (project?.project_manager_id) {
      await supabase.from("notifications" as any).insert({
        user_id: project.project_manager_id,
        type: "dpr_submitted",
        title: "DPR awaiting review",
        message: `${dpr.dpr_number} for ${project.name} submitted.`,
        project_id: projectId,
      } as any);
    }

    setSubmitting(false);
    if (error) toast({ variant: "destructive", title: "Submit failed", description: error.message });
    else { toast({ title: "DPR submitted for review" }); nav(`/projects/${projectId}`); }
  }

  // -------- photo upload (reuse project-photos bucket) ----------
  async function uploadPhoto(file: File, category: string) {
    if (!dprId || !projectId) return;
    const { data: u } = await supabase.auth.getUser();
    const path = `dpr/${projectId}/${dpr.report_date}/${Date.now()}-${file.name}`;
    const up = await supabase.storage.from("project-photos").upload(path, file);
    if (up.error) { toast({ variant: "destructive", title: "Upload failed", description: up.error.message }); return; }
    const { data: signed } = await supabase.storage.from("project-photos").createSignedUrl(path, 60 * 60 * 24 * 365);
    const url = signed?.signedUrl || "";
    const row = { dpr_id: dprId, category, photo_url: url, uploaded_by: u.user?.id, captured_at: new Date().toISOString() };
    const { data: ins } = await supabase.from("dpr_photos" as any).insert(row as any).select().single();
    setPhotos((p) => [...p, ins]);
    // mirror into project_photos so Photo Timeline stays canonical
    await supabase.from("project_photos" as any).insert({
      project_id: projectId, photo_url: url, caption: `DPR ${dpr.dpr_number} · ${category}`,
      date_taken: dpr.report_date, category, uploaded_by: u.user?.id,
    } as any);
  }

  if (loading) return <DashboardLayout><div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin inline" /></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="space-y-4 max-w-4xl mx-auto pb-24">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <Link to={`/projects/${projectId}`} className="text-xs text-muted-foreground hover:underline flex items-center gap-1">
              <ArrowLeft className="w-3 h-3" /> Back to project
            </Link>
            <h1 className="text-2xl font-bold mt-1">{dpr?.dpr_number}</h1>
            <p className="text-xs text-muted-foreground">{project?.name} · {format(new Date(dpr.report_date), "PPP")}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="capitalize">{dpr?.status?.replace("_", " ")}</Badge>
            {saving && <span className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Saving…</span>}
          </div>
        </div>

        {/* Section A — Project details auto-fill + site conditions */}
        {(dpr?.status === "returned" || dpr?.pm_instruction) && (
          <Card className="glass-card p-4 border-l-4 border-amber-500 space-y-1">
            <div className="font-semibold text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              {dpr?.status === "returned" ? "Returned for correction" : "PM instruction"}
            </div>
            {dpr?.returned_reason && <p className="text-xs text-muted-foreground">Reason: {dpr.returned_reason}</p>}
            {dpr?.pm_instruction && <p className="text-xs text-muted-foreground">PM instruction: {dpr.pm_instruction}</p>}
          </Card>
        )}
        <Card className="glass-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">Project Details</h3>
            <Badge variant="secondary" className="text-[10px]">Auto-filled</Badge>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            {[
              ["Project", project?.name],
              ["Code", project?.project_code],
              ["Client", project?.client_name],
              ["Location", project?.location],
              ["Site Engineer", siteEngineerName || "—"],
              ["Project Manager", pmName || "—"],
              ["Date", format(new Date(dpr.report_date), "PPP")],
              ["Day", format(new Date(dpr.report_date), "EEEE")],
            ].map(([k, v]) => (
              <div key={k as string} className="p-2 rounded-lg glass">
                <div className="text-[10px] uppercase text-muted-foreground">{k}</div>
                <div className="font-medium truncate">{(v as string) || "—"}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div><Label className="text-xs">Supervisor</Label><Input value={siteConditions.supervisor} onChange={(e) => setSiteConditions({ ...siteConditions, supervisor: e.target.value })} disabled={!!locked} /></div>
            <div>
              <Label className="text-xs">Weather</Label>
              <Select value={siteConditions.weather} onValueChange={(v) => setSiteConditions({ ...siteConditions, weather: v })} disabled={!!locked}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {["Clear","Cloudy","Light Rain","Heavy Rain","Windy","Hot","Cold"].map((w) => <SelectItem key={w} value={w}>{w}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Work Start</Label><Input type="time" value={siteConditions.work_start} onChange={(e) => setSiteConditions({ ...siteConditions, work_start: e.target.value })} disabled={!!locked} /></div>
            <div><Label className="text-xs">Work End</Label><Input type="time" value={siteConditions.work_end} onChange={(e) => setSiteConditions({ ...siteConditions, work_end: e.target.value })} disabled={!!locked} /></div>
          </div>
        </Card>

        <Card className="glass-card p-3">
          <div className="flex items-center gap-1 overflow-x-auto">
            {STEPS.map((s) => {
              const Icon = s.icon;
              const active = step === s.id;
              return (
                <button key={s.id} onClick={() => setStep(s.id)}
                  className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all ${
                    active ? "bg-gradient-to-r from-primary to-accent text-white shadow" : "hover:bg-muted"
                  }`}>
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{s.id}. {s.label}</span>
                  <span className="sm:hidden">{s.id}</span>
                </button>
              );
            })}
          </div>
          <Progress value={(step / 7) * 100} className="h-1 mt-2" />
        </Card>

        {step === 1 && (
          <StepManpower rows={manpower} setRows={setManpower} projectId={projectId!} locked={!!locked} />
        )}
        {step === 2 && (
          <StepProgress rows={activities} setRows={setActivities} types={activityTypes} projectId={projectId!} date={dpr.report_date} locked={!!locked} />
        )}
        {step === 3 && (
          <StepMaterials rows={materials} setRows={setMaterials} master={materialsMaster} stock={stock} locked={!!locked} />
        )}
        {step === 4 && (
          <StepIssuesQCSafety
            issues={issues} setIssues={setIssues}
            qc={qc} setQc={setQc}
            safety={safety} setSafety={setSafety}
            projectId={projectId!} locked={!!locked}
            prevOpenIssues={prevOpenIssues}
          />
        )}
        {step === 5 && (
          <StepPhotos photos={photos} setPhotos={setPhotos} upload={uploadPhoto} locked={!!locked} />
        )}
        {step === 6 && (
          <StepTomorrow
            acts={tomorrowActs} setActs={setTomorrowActs}
            mats={tomorrowMats} setMats={setTomorrowMats}
            types={activityTypes} master={materialsMaster} stock={stock}
            readiness={readiness} setReadiness={setReadiness}
            reason={readinessReason} setReason={setReadinessReason}
            locked={!!locked}
            todayActs={activities}
            projStock={projStock}
          />
        )}
        {step === 7 && (
          <StepReview
            manpower={manpower} activities={activities} materials={materials}
            issues={issues} qc={qc} tomorrowActs={tomorrowActs} tomorrowMats={tomorrowMats}
            readiness={readiness} confirmAccuracy={confirmAccuracy} setConfirmAccuracy={setConfirmAccuracy}
            onJump={setStep} locked={!!locked}
          />
        )}

        <div className="flex items-center justify-between sticky bottom-4 z-10">
          <Button variant="outline" disabled={step === 1} onClick={() => setStep((s) => Math.max(1, s - 1))} className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={saveAll} disabled={saving || locked} className="gap-2">
              <Save className="w-4 h-4" /> Save
            </Button>
            {step < 7 ? (
              <Button onClick={() => setStep((s) => Math.min(7, s + 1))} className="gap-2">
                Next <ArrowRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button onClick={submitDpr} disabled={submitting || locked} className="gap-2 bg-gradient-to-r from-primary to-accent">
                <Send className="w-4 h-4" /> Submit for Review
              </Button>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

/* ================ Step 1: Manpower ================ */
function StepManpower({ rows, setRows, projectId, locked }: any) {
  const update = (i: number, patch: any) => setRows((prev: any[]) => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  return (
    <Card className="glass-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold flex items-center gap-2"><Users className="w-4 h-4 text-primary" /> Today's Manpower</h3>
        <Link to="/group-attendance" className="text-xs text-primary flex items-center gap-1 hover:underline">
          Open Group Attendance <ExternalLink className="w-3 h-3" />
        </Link>
      </div>
      {rows.length === 0 ? (
        <div className="text-sm text-muted-foreground p-4 rounded-lg glass">
          No attendance recorded for today yet. Use Group Attendance to check-in workers, then reopen this DPR to prefill the manpower list.
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r: any, i: number) => (
            <div key={i} className="p-3 rounded-xl glass grid grid-cols-1 md:grid-cols-6 gap-2 items-center">
              <div className="md:col-span-2">
                <div className="font-semibold text-sm">{r.worker_name || r.worker_id}</div>
                <div className="text-xs text-muted-foreground">{r.trade || "—"}</div>
              </div>
              <div className="text-xs">
                <Badge variant="outline" className={r.present ? "text-emerald-600" : "text-red-600"}>
                  {r.present ? "Present" : "Absent"}
                </Badge>
                <div className="text-muted-foreground mt-1">{r.regular_hours}h + {r.ot_hours} OT</div>
              </div>
              <Input placeholder="Work area" value={r.work_area || ""} onChange={(e) => update(i, { work_area: e.target.value })} disabled={locked} />
              <Input placeholder="Activity assigned" value={r.activity_assigned || ""} onChange={(e) => update(i, { activity_assigned: e.target.value })} disabled={locked} />
              <Input placeholder="Remarks" value={r.remarks || ""} onChange={(e) => update(i, { remarks: e.target.value })} disabled={locked} />
            </div>
          ))}
        </div>
      )}
      <div className="text-xs text-muted-foreground">
        Totals — Present: {rows.filter((r: any) => r.present).length} · Regular: {rows.reduce((s: number, r: any) => s + Number(r.regular_hours || 0), 0).toFixed(1)}h · OT: {rows.reduce((s: number, r: any) => s + Number(r.ot_hours || 0), 0).toFixed(1)}h
      </div>
    </Card>
  );
}

/* ================ Step 2: Progress ================ */
function StepProgress({ rows, setRows, types, projectId, date, locked }: any) {
  const update = (i: number, patch: any) => setRows((p: any[]) => p.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  const add = () => setRows((p: any[]) => [...p, { activity_type_id: null, stage: "", activity_name: "", location: "", planned_qty: 0, completed_qty: 0, unit: "sqm", status: "partial", target_reached: null, reason_not_achieved: "", remarks: "" }]);
  const remove = (i: number) => setRows((p: any[]) => p.filter((_, idx) => idx !== i));
  return (
    <Card className="glass-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-bold flex items-center gap-2"><Hammer className="w-4 h-4 text-primary" /> Today's Work Progress</h3>
        <Button size="sm" variant="outline" onClick={add} disabled={locked} className="gap-1"><Plus className="w-3 h-3" /> Add</Button>
      </div>
      {rows.length === 0 && <p className="text-sm text-muted-foreground">No activities. Prefills from Daily Activities logged today; add rows if missing.</p>}
      {rows.map((r: any, i: number) => (
        <div key={i} className="p-3 rounded-xl glass space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <Select value={r.stage || ""} onValueChange={(v) => update(i, { stage: v })} disabled={locked}>
              <SelectTrigger><SelectValue placeholder="Construction stage" /></SelectTrigger>
              <SelectContent>{DPR_STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={r.activity_type_id || ""} onValueChange={(v) => update(i, { activity_type_id: v, activity_name: types.find((t: any) => t.id === v)?.name || r.activity_name })} disabled={locked}>
              <SelectTrigger><SelectValue placeholder="Activity type" /></SelectTrigger>
              <SelectContent>{types.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
            <Input placeholder="Location / area" value={r.location || ""} onChange={(e) => update(i, { location: e.target.value })} disabled={locked} />
          </div>
          <Input placeholder="Work description / custom name" value={r.activity_name || ""} onChange={(e) => update(i, { activity_name: e.target.value })} disabled={locked} />
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 items-center">
            <Input type="number" placeholder="Planned" value={r.planned_qty} onChange={(e) => update(i, { planned_qty: Number(e.target.value) })} disabled={locked} />
            <Input type="number" placeholder="Completed" value={r.completed_qty} onChange={(e) => update(i, { completed_qty: Number(e.target.value) })} disabled={locked} />
            <Input placeholder="Unit" value={r.unit || ""} onChange={(e) => update(i, { unit: e.target.value })} disabled={locked} />
            <Select value={r.status} onValueChange={(v) => update(i, { status: v })} disabled={locked}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="not_started">Not started</SelectItem>
              </SelectContent>
            </Select>
            <div className="text-xs text-muted-foreground">
              {r.planned_qty > 0 ? `${Math.round((r.completed_qty / r.planned_qty) * 100)}%` : "—"}
              <Button size="icon" variant="ghost" onClick={() => remove(i)} disabled={locked} className="ml-2 h-7 w-7"><Trash2 className="w-3 h-3" /></Button>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-muted-foreground">Target reached?</span>
            <label className="flex items-center gap-1"><input type="radio" checked={r.target_reached === true} onChange={() => update(i, { target_reached: true, reason_not_achieved: "" })} disabled={locked} /> Yes</label>
            <label className="flex items-center gap-1"><input type="radio" checked={r.target_reached === false} onChange={() => update(i, { target_reached: false })} disabled={locked} /> No</label>
          </div>
          {r.target_reached === false && (
            <Textarea placeholder="Reason for target not achieved (required)" value={r.reason_not_achieved || ""} onChange={(e) => update(i, { reason_not_achieved: e.target.value })} disabled={locked} className="min-h-[60px] border-amber-500/50" />
          )}
          <Textarea placeholder="Remarks" value={r.remarks || ""} onChange={(e) => update(i, { remarks: e.target.value })} disabled={locked} className="min-h-[60px]" />
        </div>
      ))}
    </Card>
  );
}

/* ================ Step 3: Materials ================ */
function StepMaterials({ rows, setRows, master, stock, locked }: any) {
  const update = (i: number, patch: any) => setRows((p: any[]) => p.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  const add = () => setRows((p: any[]) => [...p, { material_id: null, material_name: "", unit: "", opening_stock: 0, received_today: 0, used_today: 0, wastage_qty: 0, wastage_reason: "" }]);
  const remove = (i: number) => setRows((p: any[]) => p.filter((_, idx) => idx !== i));
  const closing = (r: any) => Number(r.opening_stock || 0) + Number(r.received_today || 0) - Number(r.used_today || 0) - Number(r.wastage_qty || 0);
  return (
    <Card className="glass-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-bold flex items-center gap-2"><Package className="w-4 h-4 text-primary" /> Material Consumption</h3>
        <Button size="sm" variant="outline" onClick={add} disabled={locked} className="gap-1"><Plus className="w-3 h-3" /> Add</Button>
      </div>
      {rows.map((r: any, i: number) => (
        <div key={i} className="p-3 rounded-xl glass space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <Select value={r.material_id || ""} onValueChange={(v) => {
              const m = master.find((x: any) => x.id === v);
              update(i, { material_id: v, material_name: m?.name || "", unit: m?.unit || "", opening_stock: stock[v] || 0 });
            }} disabled={locked}>
              <SelectTrigger><SelectValue placeholder="Material" /></SelectTrigger>
              <SelectContent>{master.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.name} ({m.unit})</SelectItem>)}</SelectContent>
            </Select>
            <div className="text-xs text-muted-foreground self-center">
              Opening: {r.opening_stock} {r.unit} · Closing: <strong>{closing(r)}</strong> {r.unit}
            </div>
            <Button size="icon" variant="ghost" onClick={() => remove(i)} disabled={locked} className="justify-self-end"><Trash2 className="w-3 h-3" /></Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div><Label className="text-xs">Received</Label><Input type="number" value={r.received_today} onChange={(e) => update(i, { received_today: Number(e.target.value) })} disabled={locked} /></div>
            <div><Label className="text-xs">Used</Label><Input type="number" value={r.used_today} onChange={(e) => update(i, { used_today: Number(e.target.value) })} disabled={locked} /></div>
            <div><Label className="text-xs">Wastage</Label><Input type="number" value={r.wastage_qty} onChange={(e) => update(i, { wastage_qty: Number(e.target.value) })} disabled={locked} /></div>
            <div><Label className="text-xs">Wastage reason</Label><Input value={r.wastage_reason || ""} onChange={(e) => update(i, { wastage_reason: e.target.value })} disabled={locked} /></div>
          </div>
        </div>
      ))}
    </Card>
  );
}

/* ================ Step 4: Issues / QC / Safety ================ */
function StepIssuesQCSafety({ issues, setIssues, qc, setQc, safety, setSafety, projectId, locked, prevOpenIssues = [] }: any) {
  const addIssue = () => setIssues((p: any[]) => [...p, { category: "delay", description: "", impact: "", responsible_person: "", action_required: "", resolution_date: null, affects_tomorrow: false }]);
  const updIssue = (i: number, patch: any) => setIssues((p: any[]) => p.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  const rmIssue = (i: number) => setIssues((p: any[]) => p.filter((_, idx) => idx !== i));

  const carryForward = () => {
    const existing = new Set(issues.map((i: any) => (i.description || "").trim()));
    const add = prevOpenIssues
      .filter((i: any) => !existing.has((i.description || "").trim()))
      .map(({ id, created_at, dpr_id, ...r }: any) => ({ ...r }));
    if (add.length) setIssues((p: any[]) => [...p, ...add]);
  };

  const addQc = () => setQc((p: any[]) => [...p, { activity_inspected: "", area: "", status: "ok", defect: "", corrective_action: "" }]);
  const updQc = (i: number, patch: any) => setQc((p: any[]) => p.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  const rmQc = (i: number) => setQc((p: any[]) => p.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-3">
      <Card className="glass-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500" /> Issues & Delays</h3>
          <div className="flex gap-2">
            {prevOpenIssues.length > 0 && (
              <Button size="sm" variant="outline" onClick={carryForward} disabled={locked} className="gap-1">
                Carry forward {prevOpenIssues.length} open
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={addIssue} disabled={locked} className="gap-1"><Plus className="w-3 h-3" /> Add</Button>
          </div>
        </div>
        {issues.length === 0 && <p className="text-sm text-muted-foreground">No issues reported.</p>}
        {issues.map((r: any, i: number) => (
          <div key={i} className="p-3 rounded-xl glass space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <Select value={r.category} onValueChange={(v) => updIssue(i, { category: v })} disabled={locked}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["delay","material","manpower","design","weather","safety","other"].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input placeholder="Responsible person" value={r.responsible_person || ""} onChange={(e) => updIssue(i, { responsible_person: e.target.value })} disabled={locked} />
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={r.affects_tomorrow} onCheckedChange={(v) => updIssue(i, { affects_tomorrow: !!v })} disabled={locked} />
                Affects tomorrow
                <Button size="icon" variant="ghost" onClick={() => rmIssue(i)} disabled={locked} className="ml-auto h-7 w-7"><Trash2 className="w-3 h-3" /></Button>
              </label>
            </div>
            <Textarea placeholder="Description (required)" value={r.description || ""} onChange={(e) => updIssue(i, { description: e.target.value })} disabled={locked} className="min-h-[60px]" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <Input placeholder="Action required" value={r.action_required || ""} onChange={(e) => updIssue(i, { action_required: e.target.value })} disabled={locked} />
              <Input placeholder="Impact on schedule" value={r.impact || ""} onChange={(e) => updIssue(i, { impact: e.target.value })} disabled={locked} />
              <div>
                <Label className="text-[10px] text-muted-foreground">Resolved on (blank = still open)</Label>
                <Input type="date" value={r.resolution_date || ""} onChange={(e) => updIssue(i, { resolution_date: e.target.value || null })} disabled={locked} />
              </div>
            </div>
          </div>
        ))}
      </Card>

      <Card className="glass-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold">Quality Control</h3>
          <div className="flex gap-2">
            <Link to={`/projects/${projectId}?tab=checklists`} className="text-xs text-primary flex items-center gap-1 hover:underline">
              Open project checklists <ExternalLink className="w-3 h-3" />
            </Link>
            <Button size="sm" variant="outline" onClick={addQc} disabled={locked} className="gap-1"><Plus className="w-3 h-3" /> Add</Button>
          </div>
        </div>
        {qc.map((r: any, i: number) => (
          <div key={i} className="p-3 rounded-xl glass grid grid-cols-1 md:grid-cols-4 gap-2">
            <Input placeholder="Activity inspected" value={r.activity_inspected || ""} onChange={(e) => updQc(i, { activity_inspected: e.target.value })} disabled={locked} />
            <Input placeholder="Area" value={r.area || ""} onChange={(e) => updQc(i, { area: e.target.value })} disabled={locked} />
            <Select value={r.status} onValueChange={(v) => updQc(i, { status: v })} disabled={locked}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{["ok","defect","rework","hold"].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
            </Select>
            <div className="flex gap-2 items-center">
              <Input placeholder="Defect / notes" value={r.defect || ""} onChange={(e) => updQc(i, { defect: e.target.value })} disabled={locked} />
              <Button size="icon" variant="ghost" onClick={() => rmQc(i)} disabled={locked} className="h-7 w-7"><Trash2 className="w-3 h-3" /></Button>
            </div>
          </div>
        ))}
      </Card>

      <Card className="glass-card p-5 space-y-3">
        <h3 className="font-bold">Safety</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
          {[
            { k: "ppe_ok", label: "PPE OK" },
            { k: "unsafe_condition", label: "Unsafe condition" },
            { k: "incident", label: "Incident" },
            { k: "near_miss", label: "Near miss" },
          ].map((f) => (
            <label key={f.k} className="flex items-center gap-2">
              <Checkbox checked={!!safety[f.k]} onCheckedChange={(v) => setSafety({ ...safety, [f.k]: !!v })} disabled={locked} />
              {f.label}
            </label>
          ))}
        </div>
        <Textarea placeholder="Description / actions taken" value={safety.description || ""} onChange={(e) => setSafety({ ...safety, description: e.target.value })} disabled={locked} className="min-h-[60px]" />
      </Card>
    </div>
  );
}

/* ================ Step 5: Photos ================ */
function StepPhotos({ photos, setPhotos, upload, locked }: any) {
  const [uploading, setUploading] = useState(false);
  const [cat, setCat] = useState("overall");
  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setUploading(true);
    await upload(f, cat);
    setUploading(false);
  };
  const cats = ["overall","major_work","qc","material","issue","safety","before_after","other"];
  const has = (c: string) => photos.some((p: any) => p.category === c);
  return (
    <Card className="glass-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-bold flex items-center gap-2"><Camera className="w-4 h-4 text-primary" /> Site Photos</h3>
        <div className="text-xs">
          Overall: {has("overall") ? "✓" : <span className="text-red-500">Required</span>} · Major work: {has("major_work") ? "✓" : <span className="text-red-500">Required</span>}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={cat} onValueChange={setCat} disabled={locked}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>{cats.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
        <input type="file" accept="image/*" capture="environment" onChange={(e) => onFile(e.target.files?.[0])} disabled={locked || uploading} className="text-sm" />
        {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {photos.map((p: any) => (
          <div key={p.id} className="rounded-xl overflow-hidden glass">
            <img src={p.photo_url} alt={p.category} className="w-full h-32 object-cover" />
            <div className="p-2 text-xs">{p.category}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ================ Step 6: Tomorrow ================ */
function StepTomorrow({ acts, setActs, mats, setMats, types, master, stock, readiness, setReadiness, reason, setReason, locked, todayActs = [], projStock = [] }: any) {
  const addAct = () => setActs((p: any[]) => [...p, { activity_type_id: null, activity_name: "", area: "", target_qty: 0, unit: "", workers_required: 0, trade_required: "", tools_required: "", expected_duration_hrs: 0, prerequisite_ok: true, remarks: "" }]);
  const updAct = (i: number, patch: any) => setActs((p: any[]) => p.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  const rmAct = (i: number) => setActs((p: any[]) => p.filter((_, idx) => idx !== i));

  const unfinished = todayActs.filter((a: any) => a.status !== "completed");
  const carryForwardActs = () => {
    const existing = new Set(acts.map((a: any) => `${a.activity_name}|${a.area}`));
    const add = unfinished
      .filter((a: any) => !existing.has(`${a.activity_name}|${a.location || ""}`))
      .map((a: any) => ({
        activity_type_id: a.activity_type_id || null,
        activity_name: a.activity_name || "",
        area: a.location || "",
        target_qty: Math.max(Number(a.planned_qty || 0) - Number(a.completed_qty || 0), 0),
        unit: a.unit || "",
        workers_required: 0,
        trade_required: "",
        tools_required: "",
        expected_duration_hrs: 0,
        prerequisite_ok: true,
        remarks: "Carried forward from today",
      }));
    if (add.length) setActs((p: any[]) => [...p, ...add]);
  };

  const stockFor = (materialId: string) => {
    const row = projStock.find((s: any) => s.project_material_id === materialId || s.material_id === materialId);
    if (row) return Number(row.current_stock || 0);
    return Number(stock[materialId] || 0);
  };

  const addMat = () => setMats((p: any[]) => [...p, { material_id: null, material_name: "", unit: "", required_qty: 0, available_qty: 0 }]);
  const updMat = (i: number, patch: any) => setMats((p: any[]) => p.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  const rmMat = (i: number) => setMats((p: any[]) => p.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-3">
      <Card className="glass-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold flex items-center gap-2"><CalendarClock className="w-4 h-4 text-primary" /> Tomorrow's Activities</h3>
          <div className="flex gap-2">
            {unfinished.length > 0 && (
              <Button size="sm" variant="outline" onClick={carryForwardActs} disabled={locked} className="gap-1">
                Carry forward {unfinished.length} unfinished
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={addAct} disabled={locked} className="gap-1"><Plus className="w-3 h-3" /> Add</Button>
          </div>
        </div>
        {acts.map((r: any, i: number) => (
          <div key={i} className="p-3 rounded-xl glass space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
            <Select value={r.activity_type_id || ""} onValueChange={(v) => updAct(i, { activity_type_id: v, activity_name: types.find((t: any) => t.id === v)?.name || "" })} disabled={locked}>
              <SelectTrigger className="md:col-span-2"><SelectValue placeholder="Activity" /></SelectTrigger>
              <SelectContent>{types.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
            <Input placeholder="Area" value={r.area || ""} onChange={(e) => updAct(i, { area: e.target.value })} disabled={locked} />
            <Input type="number" placeholder="Target" value={r.target_qty || 0} onChange={(e) => updAct(i, { target_qty: Number(e.target.value) })} disabled={locked} />
            <Input placeholder="Trade" value={r.trade_required || ""} onChange={(e) => updAct(i, { trade_required: e.target.value })} disabled={locked} />
            <div className="flex gap-2">
              <Input type="number" placeholder="Workers" value={r.workers_required || 0} onChange={(e) => updAct(i, { workers_required: Number(e.target.value) })} disabled={locked} />
              <Button size="icon" variant="ghost" onClick={() => rmAct(i)} disabled={locked} className="h-9 w-9"><Trash2 className="w-3 h-3" /></Button>
            </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-center">
              <Input placeholder="Unit" value={r.unit || ""} onChange={(e) => updAct(i, { unit: e.target.value })} disabled={locked} />
              <Input placeholder="Tools / equipment required" value={r.tools_required || ""} onChange={(e) => updAct(i, { tools_required: e.target.value })} disabled={locked} />
              <Input type="number" placeholder="Expected hrs" value={r.expected_duration_hrs || 0} onChange={(e) => updAct(i, { expected_duration_hrs: Number(e.target.value) })} disabled={locked} />
              <label className="flex items-center gap-2 text-xs">
                <Checkbox checked={r.prerequisite_ok !== false} onCheckedChange={(v) => updAct(i, { prerequisite_ok: !!v })} disabled={locked} />
                Prerequisites cleared
                {r.prerequisite_ok === false && <Badge className="bg-red-500/15 text-red-600">Blocked</Badge>}
              </label>
            </div>
            {r.remarks && <p className="text-[10px] text-muted-foreground">{r.remarks}</p>}
          </div>
        ))}
      </Card>

      <Card className="glass-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold">Materials required tomorrow</h3>
          <Button size="sm" variant="outline" onClick={addMat} disabled={locked} className="gap-1"><Plus className="w-3 h-3" /> Add</Button>
        </div>
        {mats.map((r: any, i: number) => {
          const short = Math.max(Number(r.required_qty) - Number(r.available_qty), 0);
          return (
            <div key={i} className="p-3 rounded-xl glass grid grid-cols-1 md:grid-cols-5 gap-2 items-center">
              <Select value={r.material_id || ""} onValueChange={(v) => {
                const m = master.find((x: any) => x.id === v);
                updMat(i, { material_id: v, material_name: m?.name || "", unit: m?.unit || "", available_qty: stockFor(v) });
              }} disabled={locked}>
                <SelectTrigger className="md:col-span-2"><SelectValue placeholder="Material" /></SelectTrigger>
                <SelectContent>{master.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
              </Select>
              <Input type="number" placeholder="Required" value={r.required_qty} onChange={(e) => updMat(i, { required_qty: Number(e.target.value) })} disabled={locked} />
              <div className="text-xs">
                Avail: {r.available_qty} {r.unit}
                {short > 0 ? <Badge className="ml-1 bg-red-500/15 text-red-600">Short {short}</Badge> : <Badge className="ml-1 bg-emerald-500/15 text-emerald-600">OK</Badge>}
              </div>
              <Button size="icon" variant="ghost" onClick={() => rmMat(i)} disabled={locked} className="h-8 w-8 justify-self-end"><Trash2 className="w-3 h-3" /></Button>
            </div>
          );
        })}
      </Card>

      <Card className="glass-card p-5 space-y-3">
        <h3 className="font-bold">Overall Readiness</h3>
        <div className="flex gap-2">
          {(["ready","at_risk","blocked"] as const).map((r) => (
            <Button key={r} variant={readiness === r ? "default" : "outline"} onClick={() => setReadiness(r)} disabled={locked}
              className={readiness === r ? (r === "ready" ? "bg-emerald-500" : r === "at_risk" ? "bg-amber-500" : "bg-red-500") : ""}>
              {r.replace("_", " ")}
            </Button>
          ))}
        </div>
        {readiness !== "ready" && (
          <Textarea placeholder="Reason (required)" value={reason} onChange={(e) => setReason(e.target.value)} disabled={locked} className="min-h-[60px]" />
        )}
      </Card>
    </div>
  );
}

/* ================ Step 7: Review ================ */
function StepReview({ manpower, activities, materials, issues, qc, tomorrowActs, tomorrowMats, readiness, confirmAccuracy, setConfirmAccuracy, onJump, locked }: any) {
  const K = ({ label, value, step }: any) => (
    <div className="p-3 rounded-xl glass">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-bold">{value}</div>
      <Button size="sm" variant="ghost" onClick={() => onJump(step)} className="text-xs h-6 px-2 mt-1">Edit</Button>
    </div>
  );
  return (
    <Card className="glass-card p-5 space-y-4">
      <h3 className="font-bold text-lg">Review & Submit</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <K label="Present workers" value={manpower.filter((m: any) => m.present).length} step={1} />
        <K label="Activities" value={activities.length} step={2} />
        <K label="Materials logged" value={materials.length} step={3} />
        <K label="Issues" value={issues.length} step={4} />
        <K label="QC entries" value={qc.length} step={4} />
        <K label="Tomorrow acts" value={tomorrowActs.length} step={6} />
        <K label="Tomorrow mats" value={tomorrowMats.length} step={6} />
        <K label="Readiness" value={readiness} step={6} />
      </div>
      <label className="flex items-center gap-2 text-sm p-3 rounded-xl glass">
        <Checkbox checked={confirmAccuracy} onCheckedChange={(v) => setConfirmAccuracy(!!v)} disabled={locked} />
        I confirm this DPR is accurate and complete.
      </label>
    </Card>
  );
}