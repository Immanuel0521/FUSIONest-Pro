import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, CheckCircle2, RotateCcw, FileDown, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { generateDprPdf } from "@/lib/dprPdf";
import { useUserRole } from "@/hooks/useUserRole";

export default function DprReview() {
  const { dprId } = useParams();
  const nav = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [returnReason, setReturnReason] = useState("");
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState(false);
  const { role } = useUserRole();
  const [isReviewer, setIsReviewer] = useState(false);

  useEffect(() => { (async () => {
    if (!dprId) return;
    setLoading(true);
    const [dpr, mp, ac, mt, iss, qc, saf, ph, tAct, tMat] = await Promise.all([
      supabase.from("dpr_reports" as any).select("*, projects(*)").eq("id", dprId).single(),
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
    setData({
      dpr: (dpr as any).data, project: (dpr as any).data?.projects,
      manpower: (mp as any).data || [], activities: (ac as any).data || [],
      materials: (mt as any).data || [], issues: (iss as any).data || [],
      qc: (qc as any).data || [], safety: (saf as any).data || null,
      photos: (ph as any).data || [], tomorrowActivities: (tAct as any).data || [],
      tomorrowMaterials: (tMat as any).data || [],
    });
    setInstruction((dpr as any).data?.pm_instruction || "");

    // Mark as under review when a reviewer opens a submitted DPR
    const d: any = (dpr as any).data;
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id;
    const reviewer = role === "admin" || role === "management" ||
      (!!uid && (d?.pm_id === uid || d?.projects?.project_manager_id === uid || d?.projects?.supervisor_id === uid));
    setIsReviewer(reviewer);
    if (reviewer && d?.status === "submitted") {
      await supabase.from("dpr_reports" as any).update({ status: "under_review", pm_id: d.pm_id || uid } as any).eq("id", dprId);
      setData((prev: any) => prev ? { ...prev, dpr: { ...prev.dpr, status: "under_review" } } : prev);
    }
    setLoading(false);
  })(); }, [dprId, role]);

  async function approve() {
    if (!data) return;
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();

    // Post material consumption/wastage into the site stock ledger (idempotent per DPR)
    const { data: existingTxns } = await supabase.from("stock_transactions" as any)
      .select("id").eq("ref_type", "dpr").eq("ref_id", dprId!).limit(1);
    if (!((existingTxns as any[]) || []).length) {
      const { data: projMats } = await supabase.from("project_materials" as any)
        .select("id, material_id, name").eq("project_id", data.dpr.project_id);
      const findPm = (m: any) =>
        ((projMats as any[]) || []).find((p) => (m.material_id && p.material_id === m.material_id) ||
          (p.name || "").toLowerCase() === (m.material_name || "").toLowerCase());
      const txns: any[] = [];
      for (const m of data.materials) {
        const pm = findPm(m);
        if (!pm) continue;
        const used = Number(m.used_today || 0) + Number(m.wastage_qty || 0);
        if (used > 0) txns.push({
          project_id: data.dpr.project_id, project_material_id: pm.id, txn_type: "usage",
          qty: used, reason: `DPR ${data.dpr.dpr_number} consumption`, ref_type: "dpr", ref_id: dprId,
          created_by: u.user?.id,
        });
      }
      if (txns.length) await supabase.from("stock_transactions" as any).insert(txns as any);
    }

    // Update material stock closing values
    for (const m of data.materials) {
      if (m.material_id) {
        await supabase.from("project_material_stock" as any).upsert({
          project_id: data.dpr.project_id,
          material_id: m.material_id,
          current_stock: Number(m.closing_stock ?? 0),
        } as any, { onConflict: "project_id,material_id" } as any);
      }
    }

    // Move related alerts to procuring
    await supabase.from("material_alerts" as any).update({ status: "procuring" } as any).eq("dpr_id", dprId!).eq("status", "open");

    // Approve
    const { error } = await supabase.from("dpr_reports" as any).update({
      status: "approved",
      approved_at: new Date().toISOString(),
      pm_id: u.user?.id,
      pm_instruction: instruction || null,
    } as any).eq("id", dprId!);

    if (error) { toast({ variant: "destructive", title: "Approve failed", description: error.message }); setBusy(false); return; }

    // Progress history
    const avg = data.activities.length
      ? Math.round(data.activities.reduce((s: number, a: any) => s + (a.planned_qty > 0 ? (a.completed_qty / a.planned_qty) * 100 : 0), 0) / data.activities.length)
      : 0;
    await supabase.from("progress_history" as any).insert({
      project_id: data.dpr.project_id,
      completion_percentage: avg,
      recorded_date: data.dpr.report_date,
      notes: `DPR ${data.dpr.dpr_number} approved`,
    } as any);

    // Generate & upload PDF
    try {
      const pdf = await generateDprPdf(data);
      const blob = pdf.output("blob");
      const path = `${data.dpr.project_id}/${data.dpr.id}.pdf`;
      const up = await supabase.storage.from("dpr-reports").upload(path, blob, { upsert: true, contentType: "application/pdf" });
      if (!up.error) await supabase.from("dpr_reports" as any).update({ pdf_path: path } as any).eq("id", dprId!);
    } catch (e) { /* pdf failure non-fatal */ }

    // Notify site engineer
    if (data.dpr.site_engineer_id) {
      await supabase.from("notifications" as any).insert({
        user_id: data.dpr.site_engineer_id,
        type: "dpr_approved",
        title: "DPR approved",
        message: `${data.dpr.dpr_number} was approved.`,
        project_id: data.dpr.project_id,
      } as any);
    }

    toast({ title: "DPR approved" });
    setBusy(false);
    nav("/dpr");
  }

  async function returnDpr() {
    if (!returnReason.trim()) { toast({ variant: "destructive", title: "Reason required" }); return; }
    setBusy(true);
    const { error } = await supabase.from("dpr_reports" as any).update({
      status: "returned", returned_reason: returnReason, pm_instruction: instruction || null,
    } as any).eq("id", dprId!);
    if (!error && data.dpr.site_engineer_id) {
      await supabase.from("notifications" as any).insert({
        user_id: data.dpr.site_engineer_id,
        type: "dpr_returned",
        title: "DPR returned for correction",
        message: returnReason,
        project_id: data.dpr.project_id,
      } as any);
    }
    setBusy(false);
    if (error) toast({ variant: "destructive", title: "Failed", description: error.message });
    else { toast({ title: "Returned to engineer" }); nav("/dpr"); }
  }

  async function downloadPdf() {
    if (!data) return;
    const pdf = await generateDprPdf(data);
    pdf.save(`${data.dpr.dpr_number}.pdf`);
  }

  if (loading || !data) return <DashboardLayout><div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin inline" /></div></DashboardLayout>;
  const { dpr, project, manpower, activities, materials, issues, qc, tomorrowActivities, tomorrowMaterials } = data;
  const locked = dpr.status === "approved";

  return (
    <DashboardLayout>
      <div className="space-y-4 max-w-4xl mx-auto pb-16">
        <Link to="/dpr" className="text-xs text-muted-foreground hover:underline flex items-center gap-1"><ArrowLeft className="w-3 h-3" /> Back to DPR Hub</Link>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold">{dpr.dpr_number}</h1>
            <p className="text-xs text-muted-foreground">{project?.name} · {format(new Date(dpr.report_date), "PPP")}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="capitalize">{dpr.status.replace("_", " ")}</Badge>
            <Button size="sm" variant="outline" onClick={downloadPdf} className="gap-1"><FileDown className="w-3 h-3" /> PDF</Button>
          </div>
        </div>

        <Card className="glass-card p-5 grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Present" value={manpower.filter((m: any) => m.present).length} />
          <Stat label="Activities" value={activities.length} />
          <Stat label="Materials" value={materials.length} />
          <Stat label="Issues" value={issues.length} />
          <Stat label="QC" value={qc.length} />
          <Stat label="Tomorrow acts" value={tomorrowActivities.length} />
          <Stat label="Tomorrow mats" value={tomorrowMaterials.length} />
          <Stat label="Readiness" value={dpr.readiness || "—"} />
        </Card>

        <Card className="glass-card p-5 space-y-2">
          <h3 className="font-bold text-sm">Today's Activities</h3>
          {activities.map((a: any, i: number) => (
            <div key={i} className="text-xs p-2 rounded-lg glass">
              {a.activity_name} @ {a.location || "—"} — {a.completed_qty}/{a.planned_qty} {a.unit} · {a.status}
            </div>
          ))}
        </Card>

        {issues.length > 0 && (
          <Card className="glass-card p-5 space-y-2">
            <h3 className="font-bold text-sm">Issues</h3>
            {issues.map((i: any, idx: number) => (
              <div key={idx} className="text-xs p-2 rounded-lg glass">
                <div>[{i.category}] {i.description}</div>
                <div className="text-muted-foreground">
                  {i.impact ? `Impact: ${i.impact} · ` : ""}Action: {i.action_required || "—"} · Responsible: {i.responsible_person || "—"} ·{" "}
                  {i.resolution_date ? `Resolved ${i.resolution_date}` : "Open"}
                  {i.affects_tomorrow ? " · affects tomorrow" : ""}
                </div>
              </div>
            ))}
          </Card>
        )}

        {qc.length > 0 && (
          <Card className="glass-card p-5 space-y-2">
            <h3 className="font-bold text-sm">Quality Control</h3>
            {qc.map((q: any, idx: number) => (
              <div key={idx} className="text-xs p-2 rounded-lg glass">
                {q.activity_inspected} @ {q.area || "—"} — <span className="capitalize">{q.status}</span>
                {q.defect ? ` · ${q.defect}` : ""}
              </div>
            ))}
          </Card>
        )}

        <Card className="glass-card p-5 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm">Next-Day Work Plan</h3>
            <Badge variant="outline" className="capitalize">{dpr.readiness || "—"}</Badge>
          </div>
          {dpr.readiness_reason && <p className="text-xs text-muted-foreground">{dpr.readiness_reason}</p>}
          {tomorrowActivities.length === 0 && <p className="text-xs text-muted-foreground">No activities planned.</p>}
          {tomorrowActivities.map((a: any, idx: number) => (
            <div key={idx} className="text-xs p-2 rounded-lg glass">
              {a.activity_name || "—"} @ {a.area || "—"} — target {a.target_qty || 0} {a.unit || ""} · {a.workers_required || 0} workers
              {a.tools_required ? ` · tools: ${a.tools_required}` : ""}
              {a.prerequisite_ok === false && <Badge className="ml-2 bg-red-500/15 text-red-600">Prereq not cleared</Badge>}
            </div>
          ))}
          {tomorrowMaterials.map((m: any, idx: number) => {
            const short = Math.max(Number(m.required_qty || 0) - Number(m.available_qty || 0), 0);
            return (
              <div key={`m${idx}`} className="text-xs p-2 rounded-lg glass flex items-center justify-between">
                <span>{m.material_name}: req {m.required_qty} / avail {m.available_qty} {m.unit || ""}</span>
                {short > 0
                  ? <Badge className="bg-red-500/15 text-red-600">Short {short}</Badge>
                  : <Badge className="bg-emerald-500/15 text-emerald-600">OK</Badge>}
              </div>
            );
          })}
        </Card>

        {!locked && !isReviewer && (
          <Card className="glass-card p-4 text-xs text-muted-foreground">
            You have read-only access to this report. Only the project manager, supervisor, or an admin can approve or return it.
          </Card>
        )}

        {!locked && isReviewer && (
          <Card className="glass-card p-5 space-y-3">
            <h3 className="font-bold">PM Actions</h3>
            <div>
              <Label>PM Instruction (optional)</Label>
              <Textarea value={instruction} onChange={(e) => setInstruction(e.target.value)} className="min-h-[60px]" />
            </div>
            <div>
              <Label>Return reason (only for return)</Label>
              <Input value={returnReason} onChange={(e) => setReturnReason(e.target.value)} placeholder="What needs correction?" />
            </div>
            <div className="flex gap-2">
              <Button onClick={approve} disabled={busy} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                <CheckCircle2 className="w-4 h-4" /> Approve
              </Button>
              <Button onClick={returnDpr} disabled={busy} variant="outline" className="gap-2">
                <RotateCcw className="w-4 h-4" /> Return for correction
              </Button>
            </div>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

function Stat({ label, value }: any) {
  return (
    <div className="p-3 rounded-xl glass">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-bold capitalize">{value}</div>
    </div>
  );
}