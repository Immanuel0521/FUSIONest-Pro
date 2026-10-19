import jsPDF from "jspdf";
import { format } from "date-fns";

export interface DprPdfData {
  dpr: any;
  project: any;
  manpower: any[];
  activities: any[];
  materials: any[];
  issues: any[];
  qc: any[];
  safety: any | null;
  photos: any[];
  tomorrowActivities: any[];
  tomorrowMaterials: any[];
  siteEngineerName?: string;
  pmName?: string;
  companyName?: string;
}

const TEAL: [number, number, number] = [15, 118, 110];

export async function generateDprPdf(d: DprPdfData): Promise<jsPDF> {
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const w = pdf.internal.pageSize.getWidth();
  let y = 40;

  pdf.setFillColor(...TEAL);
  pdf.rect(0, 0, w, 60, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(18);
  pdf.text(`${d.companyName || "Workforce"} — Daily Progress Report`, 40, 38);
  pdf.setFontSize(9);
  pdf.text(d.dpr.dpr_number || "", w - 40, 38, { align: "right" });
  y = 80;

  pdf.setTextColor(20, 20, 20);
  pdf.setFontSize(11);
  pdf.text(`Project: ${d.project?.name || ""}`, 40, y);
  pdf.text(`Date: ${format(new Date(d.dpr.report_date), "PPP")}`, w - 40, y, { align: "right" });
  y += 16;
  pdf.setFontSize(9);
  pdf.setTextColor(90, 90, 90);
  pdf.text(`Site Engineer: ${d.siteEngineerName || "—"}   |   PM: ${d.pmName || "—"}   |   Status: ${d.dpr.status}`, 40, y);
  y += 20;

  const section = (title: string) => {
    if (y > 760) { pdf.addPage(); y = 40; }
    pdf.setFillColor(240, 249, 247);
    pdf.rect(40, y, w - 80, 20, "F");
    pdf.setTextColor(...TEAL);
    pdf.setFontSize(11);
    pdf.text(title, 48, y + 14);
    y += 28;
    pdf.setTextColor(30, 30, 30);
    pdf.setFontSize(9);
  };

  const line = (t: string) => {
    if (y > 780) { pdf.addPage(); y = 40; }
    pdf.text(t, 48, y);
    y += 12;
  };

  const present = d.manpower.filter((m) => m.present).length;
  const absent = d.manpower.length - present;
  const totalReg = d.manpower.reduce((s, m) => s + Number(m.regular_hours || 0), 0);
  const totalOt = d.manpower.reduce((s, m) => s + Number(m.ot_hours || 0), 0);

  section("Manpower Summary");
  line(`Present: ${present}   Absent: ${absent}   Regular hrs: ${totalReg}   OT hrs: ${totalOt}`);
  d.manpower.slice(0, 20).forEach((m) => line(`• ${m.worker_name || m.worker_id || "—"} (${m.trade || "—"}) — ${m.present ? "P" : "A"} — ${m.regular_hours}h + ${m.ot_hours} OT`));

  section("Today's Activities");
  d.activities.forEach((a) => {
    const pct = a.planned_qty > 0 ? Math.round((a.completed_qty / a.planned_qty) * 100) : 0;
    line(`• ${a.activity_name || "—"} @ ${a.location || "—"} — ${a.completed_qty}/${a.planned_qty} ${a.unit || ""} (${pct}%) — ${a.status}`);
  });

  section("Material Consumption");
  d.materials.forEach((m) => line(`• ${m.material_name}: open ${m.opening_stock} + recv ${m.received_today} − used ${m.used_today} − waste ${m.wastage_qty} = close ${m.closing_stock} ${m.unit || ""}`));

  if (d.issues.length) {
    section("Issues & Delays");
    d.issues.forEach((i) => line(`• [${i.category}] ${i.description} — resp: ${i.responsible_person || "—"} — affects tomorrow: ${i.affects_tomorrow ? "Yes" : "No"}`));
  }

  if (d.qc.length) {
    section("Quality Control");
    d.qc.forEach((q) => line(`• ${q.activity_inspected} @ ${q.area || "—"} — ${q.status}${q.defect ? " — " + q.defect : ""}`));
  }

  if (d.safety) {
    section("Safety");
    line(`PPE: ${d.safety.ppe_ok ? "OK" : "Not OK"}   Unsafe: ${d.safety.unsafe_condition ? "Yes" : "No"}   Incident: ${d.safety.incident ? "Yes" : "No"}   Near miss: ${d.safety.near_miss ? "Yes" : "No"}`);
    if (d.safety.description) line(`Notes: ${d.safety.description}`);
  }

  section("Tomorrow's Plan");
  d.tomorrowActivities.forEach((a) => line(`• ${a.activity_name || "—"} @ ${a.area || "—"} — target ${a.target_qty || 0} ${a.unit || ""} — workers ${a.workers_required || 0}${a.prerequisite_ok === false ? "  🔴 PREREQ NOT CLEARED" : ""}`));
  d.tomorrowMaterials.forEach((m) => {
    const short = Math.max(Number(m.required_qty) - Number(m.available_qty), 0);
    line(`  – ${m.material_name}: req ${m.required_qty} / avail ${m.available_qty} ${m.unit || ""}${short > 0 ? `  🔴 SHORT ${short}` : "  🟢"}`);
  });

  section("Tomorrow Readiness");
  line(`Overall: ${d.dpr.readiness || "—"}${d.dpr.readiness_reason ? " — " + d.dpr.readiness_reason : ""}`);

  if (d.photos.length) {
    section("Site Photographs");
    for (const p of d.photos.slice(0, 12)) {
      try {
        if (y > 640) { pdf.addPage(); y = 40; }
        const img = await fetch(p.photo_url).then((r) => r.blob()).then((b) => new Promise<string>((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result as string); fr.readAsDataURL(b); }));
        pdf.addImage(img, "JPEG", 48, y, 120, 90);
        pdf.text(`${p.category}${p.area ? " · " + p.area : ""}`, 176, y + 14);
        y += 100;
      } catch { /* skip bad image */ }
    }
  }

  if (y > 750) { pdf.addPage(); y = 40; }
  y += 16;
  pdf.setDrawColor(...TEAL);
  pdf.line(40, y, w - 40, y);
  y += 14;
  pdf.setFontSize(9);
  pdf.text(`Prepared by: ${d.siteEngineerName || "—"}    Submitted: ${d.dpr.submitted_at ? format(new Date(d.dpr.submitted_at), "PPp") : "—"}`, 48, y);
  y += 12;
  pdf.text(`Approved by: ${d.pmName || "—"}    Approved: ${d.dpr.approved_at ? format(new Date(d.dpr.approved_at), "PPp") : "—"}`, 48, y);

  return pdf;
}