import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Boxes, Search, SlidersHorizontal, History } from "lucide-react";
import { format } from "date-fns";

type StockRow = {
  project_material_id: string;
  name: string;
  category: string | null;
  unit: string;
  stage: string | null;
  boq_qty: number;
  min_stock_level: number;
  vendor: string | null;
  specification: string | null;
  current_stock: number;
  total_used: number;
  total_received: number;
};

function rag(row: StockRow) {
  if (row.current_stock <= 0) return { label: "Out of stock", cls: "bg-red-500/15 text-red-600 border-red-500/30" };
  if (row.current_stock <= row.min_stock_level) return { label: "Low", cls: "bg-amber-500/15 text-amber-600 border-amber-500/30" };
  return { label: "OK", cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" };
}

export function SiteStockPanel({ projectId, canManage }: { projectId: string; canManage: boolean }) {
  const { toast } = useToast();
  const [rows, setRows] = useState<StockRow[]>([]);
  const [txns, setTxns] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogRow, setDialogRow] = useState<StockRow | null>(null);
  const [txnType, setTxnType] = useState("receipt");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const [arrivalDate, setArrivalDate] = useState(new Date().toISOString().split("T")[0]);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [s, t] = await Promise.all([
      supabase.from("project_stock_summary" as any).select("*").eq("project_id", projectId).order("name"),
      supabase.from("stock_transactions" as any).select("*, project_materials(name, unit)").eq("project_id", projectId).order("created_at", { ascending: false }).limit(30),
    ]);
    setRows((s.data as any) || []);
    setTxns((t.data as any) || []);
  };
  useEffect(() => { load(); }, [projectId]);

  const filtered = useMemo(() => rows.filter((r) => {
    if (q && !`${r.name} ${r.category || ""} ${r.vendor || ""}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (statusFilter !== "all" && rag(r).label.toLowerCase() !== statusFilter) return false;
    return true;
  }), [rows, q, statusFilter]);

  const openDialog = (row: StockRow, type: string) => { setDialogRow(row); setTxnType(type); setQty(""); setReason(""); setArrivalDate(new Date().toISOString().split("T")[0]); };

  const submit = async () => {
    const n = Number(qty);
    if (!dialogRow || !n || n <= 0) { toast({ variant: "destructive", title: "Enter a quantity greater than zero" }); return; }
    if (txnType === "adjustment" && !reason.trim()) { toast({ variant: "destructive", title: "Reason is required for adjustments" }); return; }
    if (txnType === "usage" && n > dialogRow.current_stock) { toast({ variant: "destructive", title: "Not enough stock", description: `Available: ${dialogRow.current_stock} ${dialogRow.unit}` }); return; }
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("stock_transactions" as any).insert({
      project_id: projectId,
      project_material_id: dialogRow.project_material_id,
      txn_type: txnType,
      qty: n,
      transaction_date: arrivalDate,
      reason: txnType === "receipt" ? `Arrived ${arrivalDate}${reason ? ` · ${reason}` : ""}` : reason || null,
      ref_type: "manual",
      created_by: u.user?.id,
    });
    setSaving(false);
    if (error) { toast({ variant: "destructive", title: "Failed", description: error.message }); return; }
    toast({ title: "Stock updated" });
    setDialogRow(null);
    load();
  };

  return (
    <div className="space-y-4">
      <Card className="glass-card rounded-2xl p-4 flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex items-center gap-2 flex-1">
          <Boxes className="w-5 h-5 text-primary shrink-0" />
          <div>
            <h3 className="font-bold text-sm">Site Stock Register</h3>
            <p className="text-[11px] text-muted-foreground">Track what arrived on site, when it arrived, specifications, usage and balance.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-8 h-9 w-full md:w-48" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="ok">OK</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="out of stock">Out of stock</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="glass-card rounded-2xl p-4">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            {rows.length === 0 ? "No materials in the reference sheet yet — add them under Material Reference first." : "No materials match these filters."}
          </p>
        ) : (
          <div className="space-y-2">
            {filtered.map((r) => {
              const st = rag(r);
              return (
                <div key={r.project_material_id} className="p-3 rounded-xl glass flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-sm flex items-center gap-2 flex-wrap">
                      {r.name}
                      <Badge variant="outline" className={`text-[10px] ${st.cls}`}>{st.label}</Badge>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      In stock <span className="font-semibold text-foreground">{r.current_stock} {r.unit}</span> · Received {r.total_received} · Used {r.total_used} · Min {r.min_stock_level} · BOQ {r.boq_qty}
                    </div>
                    <div className="text-[11px] text-muted-foreground">Specification: {r.specification || "Standard / as approved"}</div>
                  </div>
                  {canManage && (
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" variant="outline" onClick={() => openDialog(r, "receipt")}>Receipt</Button>
                      <Button size="sm" variant="outline" onClick={() => openDialog(r, "usage")}>Usage</Button>
                      <Button size="sm" variant="ghost" aria-label="Adjust stock" onClick={() => openDialog(r, "adjustment")}><SlidersHorizontal className="w-4 h-4" /></Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card className="glass-card rounded-2xl p-4">
        <h3 className="font-bold text-sm mb-3 flex items-center gap-2"><History className="w-4 h-4 text-primary" /> Recent stock movements</h3>
        {txns.length === 0 ? <p className="text-sm text-muted-foreground">No movements recorded yet.</p> :
          <div className="space-y-1.5">
            {txns.map((t) => (
              <div key={t.id} className="text-xs flex items-center justify-between gap-3 p-2 rounded-lg glass">
                <div className="min-w-0">
                  <span className="font-medium">{t.project_materials?.name || "Material"}</span>
                  <span className="text-muted-foreground"> · {format(new Date(`${t.transaction_date || t.created_at.slice(0, 10)}T00:00:00`), "dd MMM yyyy")}</span>
                  {t.reason && <div className="text-muted-foreground truncate">{t.reason}</div>}
                </div>
                <Badge variant="outline" className="text-[10px] capitalize shrink-0">
                  {t.txn_type === "usage" ? "-" : "+"}{t.qty} {t.project_materials?.unit || ""} {t.txn_type}
                </Badge>
              </div>
            ))}
          </div>}
      </Card>

      <Dialog open={!!dialogRow} onOpenChange={(o) => !o && setDialogRow(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="capitalize">{txnType} — {dialogRow?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground">Current stock: {dialogRow?.current_stock} {dialogRow?.unit}</div>
            <div>
              <label className="text-xs text-muted-foreground">Quantity ({dialogRow?.unit})</label>
              <Input type="number" value={qty} onChange={(e) => setQty(e.target.value)} />
            </div>
            {txnType === "receipt" && <div>
              <label className="text-xs text-muted-foreground">Arrival date</label>
              <Input type="date" value={arrivalDate} onChange={(e) => setArrivalDate(e.target.value)} />
            </div>}
            <div className="text-xs text-muted-foreground">Specification: {dialogRow?.specification || "Standard / as approved"}</div>
            <div>
              <label className="text-xs text-muted-foreground">{txnType === "receipt" ? "Delivery / batch remarks (optional)" : `Reason ${txnType === "adjustment" ? "(required)" : "(optional)"}`}</label>
              <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogRow(null)}>Cancel</Button>
            <Button onClick={submit} disabled={saving}>{saving ? "Saving…" : "Record"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}