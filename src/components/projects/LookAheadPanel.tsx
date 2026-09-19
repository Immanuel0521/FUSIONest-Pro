import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { CalendarRange, AlertTriangle, Truck, Boxes, CheckCircle2 } from "lucide-react";
import { addDays, format } from "date-fns";

type Row = {
  project_material_id: string;
  material_id: string | null;
  name: string;
  unit: string;
  current_stock: number;
  min_stock_level: number;
};

type DayCell = { date: string; demand: number; incoming: number; closing: number };

const IN_TRANSIT = ["preparing", "dispatched", "in_transit", "partially_received"];

export function LookAheadPanel({ projectId, canManage }: { projectId: string; canManage: boolean }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [demand, setDemand] = useState<Record<string, Record<string, number>>>({});
  const [incoming, setIncoming] = useState<Record<string, Record<string, number>>>({});
  const [holidayDates, setHolidayDates] = useState<string[]>([]);
  const [raising, setRaising] = useState<string | null>(null);
  const [openAlerts, setOpenAlerts] = useState<Record<string, boolean>>({});

  const load = async () => {
    setLoading(true);
    const today = format(new Date(), "yyyy-MM-dd");
    const horizonEnd = format(addDays(new Date(), 10), "yyyy-MM-dd");
    const since = format(addDays(new Date(), -14), "yyyy-MM-dd");

    const [stock, hol, plans, dispatches, txns, alerts] = await Promise.all([
      supabase.from("project_stock_summary" as any).select("*").eq("project_id", projectId).order("name"),
      supabase.from("holidays" as any).select("holiday_date").or(`project_id.eq.${projectId},project_id.is.null`),
      supabase.from("dpr_tomorrow_materials" as any)
        .select("material_id, material_name, unit, required_qty, dpr_reports!inner(project_id, report_date)")
        .eq("dpr_reports.project_id", projectId)
        .gte("dpr_reports.report_date", since),
      supabase.from("material_dispatches" as any)
        .select("id, status, expected_delivery_date, dispatch_date, material_dispatch_items(project_material_id, qty_sent, qty_received)")
        .eq("project_id", projectId).in("status", IN_TRANSIT),
      supabase.from("stock_transactions" as any)
        .select("project_material_id, qty, txn_type, created_at").eq("project_id", projectId).eq("txn_type", "usage").gte("created_at", since),
      supabase.from("material_alerts" as any).select("material_id, material_name, status").eq("project_id", projectId).in("status", ["open", "procuring"]),
    ]);

    const stockRows: Row[] = ((stock.data as any[]) || []).map((r) => ({
      project_material_id: r.project_material_id,
      material_id: r.material_id ?? null,
      name: r.name,
      unit: r.unit,
      current_stock: Number(r.current_stock || 0),
      min_stock_level: Number(r.min_stock_level || 0),
    }));

    const byName = new Map(stockRows.map((r) => [r.name.trim().toLowerCase(), r]));
    const byMaterialId = new Map(stockRows.filter((r) => r.material_id).map((r) => [r.material_id as string, r]));

    // Planned demand: a DPR's "tomorrow materials" are needed the day after that report.
    const dem: Record<string, Record<string, number>> = {};
    for (const p of ((plans.data as any[]) || [])) {
      const target = (p.material_id && byMaterialId.get(p.material_id)) || byName.get(String(p.material_name || "").trim().toLowerCase());
      if (!target) continue;
      const reportDate = p.dpr_reports?.report_date;
      if (!reportDate) continue;
      const day = format(addDays(new Date(reportDate), 1), "yyyy-MM-dd");
      if (day < today) continue;
      dem[target.project_material_id] = dem[target.project_material_id] || {};
      dem[target.project_material_id][day] = (dem[target.project_material_id][day] || 0) + Number(p.required_qty || 0);
    }

    // Fallback demand: 14-day average daily usage for materials with no explicit plan.
    const usage: Record<string, number> = {};
    for (const t of ((txns.data as any[]) || [])) {
      usage[t.project_material_id] = (usage[t.project_material_id] || 0) + Number(t.qty || 0);
    }

    // Incoming: undelivered dispatch quantities land on their expected delivery date.
    const inc: Record<string, Record<string, number>> = {};
    for (const d of ((dispatches.data as any[]) || [])) {
      const day = d.expected_delivery_date || d.dispatch_date;
      if (!day) continue;
      const eta = day < today ? today : day;
      if (eta > horizonEnd) continue;
      for (const it of (d.material_dispatch_items || [])) {
        if (!it.project_material_id) continue;
        const pending = Number(it.qty_sent || 0) - Number(it.qty_received || 0);
        if (pending <= 0) continue;
        inc[it.project_material_id] = inc[it.project_material_id] || {};
        inc[it.project_material_id][eta] = (inc[it.project_material_id][eta] || 0) + pending;
      }
    }

    const alertMap: Record<string, boolean> = {};
    for (const a of ((alerts.data as any[]) || [])) {
      const target = (a.material_id && byMaterialId.get(a.material_id)) || byName.get(String(a.material_name || "").trim().toLowerCase());
      if (target) alertMap[target.project_material_id] = true;
    }

    // Stash average daily usage under a reserved key so it can back-fill unplanned days.
    for (const r of stockRows) {
      const avg = (usage[r.project_material_id] || 0) / 14;
      if (avg > 0) {
        dem[r.project_material_id] = dem[r.project_material_id] || {};
        dem[r.project_material_id]["__avg"] = avg;
      }
    }

    setRows(stockRows);
    setDemand(dem);
    setIncoming(inc);
    setHolidayDates(((hol.data as any[]) || []).map((h) => h.holiday_date));
    setOpenAlerts(alertMap);
    setLoading(false);
  };

  useEffect(() => { load(); }, [projectId]);

  // Next 4 working days: skip Sundays and configured holidays.
  const days = useMemo(() => {
    const out: string[] = [];
    let cursor = new Date();
    let guard = 0;
    while (out.length < 4 && guard < 30) {
      const ds = format(cursor, "yyyy-MM-dd");
      if (cursor.getDay() !== 0 && !holidayDates.includes(ds)) out.push(ds);
      cursor = addDays(cursor, 1);
      guard++;
    }
    return out;
  }, [holidayDates]);

  const table = useMemo(() => rows.map((r) => {
    const d = demand[r.project_material_id] || {};
    const i = incoming[r.project_material_id] || {};
    const avg = d["__avg"] || 0;
    let balance = r.current_stock;
    const cells: DayCell[] = days.map((day) => {
      const dayDemand = d[day] != null ? d[day] : avg;
      const dayIncoming = i[day] || 0;
      balance = balance + dayIncoming - dayDemand;
      return { date: day, demand: dayDemand, incoming: dayIncoming, closing: balance };
    });
    const shortDay = cells.find((c) => c.closing < 0);
    const lowDay = cells.find((c) => c.closing <= r.min_stock_level);
    const shortfall = shortDay ? Math.abs(shortDay.closing) : 0;
    return { row: r, cells, shortDay, lowDay, shortfall, planned: Object.keys(d).some((k) => k !== "__avg") };
  }), [rows, demand, incoming, days]);

  const risky = table.filter((t) => t.shortDay || t.lowDay);
  const healthy = table.filter((t) => !t.shortDay && !t.lowDay);

  const raiseAlert = async (t: (typeof table)[number]) => {
    setRaising(t.row.project_material_id);
    const { data: u } = await supabase.auth.getUser();
    const required = t.cells.reduce((s, c) => s + c.demand, 0);
    const { error } = await supabase.from("material_alerts" as any).insert({
      project_id: projectId,
      material_id: t.row.material_id,
      material_name: t.row.name,
      required_qty: required,
      available_qty: t.row.current_stock,
      shortfall: t.shortfall || Math.max(0, t.row.min_stock_level - t.row.current_stock),
      required_date: (t.shortDay || t.lowDay)?.date,
      priority: t.shortDay ? "high" : "medium",
      status: "open",
      requested_by: u.user?.id,
      notes: "Raised from 4-day look-ahead",
    } as any);
    setRaising(null);
    if (error) { toast({ variant: "destructive", title: "Failed", description: error.message }); return; }
    toast({ title: "Procurement alert raised", description: t.row.name });
    setOpenAlerts((p) => ({ ...p, [t.row.project_material_id]: true }));
  };

  const MaterialCard = ({ t }: { t: (typeof table)[number] }) => {
    const { row } = t;
    const state = t.shortDay ? { label: "Shortage", cls: "bg-red-500/15 text-red-600 border-red-500/30" }
      : t.lowDay ? { label: "At risk", cls: "bg-amber-500/15 text-amber-600 border-amber-500/30" }
      : { label: "Ready", cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" };
    return (
      <div className="p-3 rounded-xl glass">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0">
            <div className="font-semibold text-sm truncate">{row.name}</div>
            <div className="text-[11px] text-muted-foreground">
              In stock {row.current_stock} {row.unit} · min {row.min_stock_level} {row.unit} · {t.planned ? "planned demand" : "14-day average usage"}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="outline" className={`text-[10px] ${state.cls}`}>{state.label}</Badge>
            {canManage && (t.shortDay || t.lowDay) && (
              openAlerts[row.project_material_id]
                ? <Badge variant="outline" className="text-[10px]">Alert raised</Badge>
                : <Button size="sm" variant="outline" className="h-7 text-[11px]" disabled={raising === row.project_material_id} onClick={() => raiseAlert(t)}>Raise alert</Button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {t.cells.map((c) => (
            <div key={c.date} className={`rounded-lg p-2 text-center border ${c.closing < 0 ? "border-red-500/30 bg-red-500/10" : c.closing <= row.min_stock_level ? "border-amber-500/30 bg-amber-500/10" : "border-border/50"}`}>
              <div className="text-[10px] text-muted-foreground">{format(new Date(c.date), "EEE d MMM")}</div>
              <div className="text-sm font-bold">{Math.round(c.closing * 100) / 100}</div>
              <div className="text-[10px] text-muted-foreground">
                −{Math.round(c.demand * 100) / 100}
                {c.incoming > 0 && <span className="text-emerald-600"> +{Math.round(c.incoming * 100) / 100}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <Card className="glass-card rounded-2xl p-4 flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex items-center gap-2 flex-1">
          <CalendarRange className="w-5 h-5 text-primary shrink-0" />
          <div>
            <h3 className="font-bold text-sm">4-Day Material Readiness</h3>
            <p className="text-[11px] text-muted-foreground">
              Opening stock, planned usage from next-day plans and confirmed incoming dispatches across the next four working days.
            </p>
          </div>
        </div>
        <div className="flex gap-2 text-[11px] flex-wrap">
          <span className="px-2 py-1 rounded-lg bg-red-500/10 text-red-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{table.filter((t) => t.shortDay).length} shortage</span>
          <span className="px-2 py-1 rounded-lg bg-amber-500/10 text-amber-600 flex items-center gap-1"><Boxes className="w-3 h-3" />{table.filter((t) => !t.shortDay && t.lowDay).length} at risk</span>
          <span className="px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />{healthy.length} ready</span>
        </div>
      </Card>

      {loading ? (
        <Card className="glass-card rounded-2xl p-6 text-center text-sm text-muted-foreground">Building the look-ahead…</Card>
      ) : rows.length === 0 ? (
        <Card className="glass-card rounded-2xl p-6 text-center text-sm text-muted-foreground">
          No materials in the reference sheet yet — add them under Material Reference first.
        </Card>
      ) : (
        <>
          <Card className="glass-card rounded-2xl p-4 space-y-2">
            <h4 className="font-bold text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-600" /> Needs attention</h4>
            {risky.length === 0
              ? <p className="text-sm text-muted-foreground">Every material stays above its minimum level for the next four working days.</p>
              : risky.map((t) => <MaterialCard key={t.row.project_material_id} t={t} />)}
          </Card>
          <Card className="glass-card rounded-2xl p-4 space-y-2">
            <h4 className="font-bold text-sm flex items-center gap-2"><Truck className="w-4 h-4 text-primary" /> On track</h4>
            {healthy.length === 0
              ? <p className="text-sm text-muted-foreground">Nothing is fully covered right now.</p>
              : healthy.map((t) => <MaterialCard key={t.row.project_material_id} t={t} />)}
          </Card>
        </>
      )}
    </div>
  );
}