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
import { Truck, Plus, Trash2, PackageCheck } from "lucide-react";
import { format } from "date-fns";
import { DISPATCH_CHECKLIST, DISPATCH_SECTIONS } from "@/lib/materialCatalog";

type Mat = { id: string; name: string; unit: string; specification: string | null };
type Item = { id?: string; category?: string; project_material_id: string | null; material_name: string; unit: string; specification: string | null; qty_in_factory: number; qty_sent: number; dispatched_by: string | null; qty_received: number | null; qty_returned: number; returned_by: string | null; condition: string | null; shortage_qty: number; remarks: string | null };

const STATUS_META: Record<string, { label: string; cls: string }> = {
  preparing: { label: "Preparing", cls: "bg-muted text-muted-foreground border-border" },
  dispatched: { label: "Dispatched", cls: "bg-blue-500/15 text-blue-600 border-blue-500/30" },
  in_transit: { label: "In transit", cls: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
  partially_received: { label: "Partially received", cls: "bg-orange-500/15 text-orange-600 border-orange-500/30" },
  received: { label: "Received", cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" },
  issue: { label: "Issue", cls: "bg-red-500/15 text-red-600 border-red-500/30" },
};

export function DispatchPanel({ projectId, canManage }: { projectId: string; canManage: boolean }) {
  const { toast } = useToast();
  const [dispatches, setDispatches] = useState<any[]>([]);
  const [materials, setMaterials] = useState<Mat[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [saving, setSaving] = useState(false);

  // create dialog
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({});
  const [items, setItems] = useState<Item[]>([]);

  // receive dialog
  const [receiving, setReceiving] = useState<any | null>(null);
  const [recItems, setRecItems] = useState<Item[]>([]);

  const load = async () => {
    const [d, m] = await Promise.all([
      supabase.from("material_dispatches" as any).select("*, material_dispatch_items(*)").eq("project_id", projectId).order("dispatch_date", { ascending: false }),
      supabase.from("project_materials" as any).select("id, name, unit, specification").eq("project_id", projectId).eq("active", true).order("name"),
    ]);
    setDispatches((d.data as any) || []);
    setMaterials((m.data as any) || []);
  };
  useEffect(() => { load(); }, [projectId]);

  const filtered = useMemo(() => dispatches.filter((d) => statusFilter === "all" || d.status === statusFilter), [dispatches, statusFilter]);
  const inTransit = dispatches.filter((d) => ["dispatched", "in_transit", "partially_received"].includes(d.status)).length;

  const openCreate = () => {
    setForm({ dispatch_number: "", source: "factory", vendor_name: "", vehicle_number: "", driver_name: "", driver_phone: "", dispatch_date: new Date().toISOString().split("T")[0], return_date: "", expected_delivery_date: "", status: "preparing", notes: "", factory_store_manager: "", site_incharge: "", qc_project_manager: "", return_verified_by: "" });
    setItems(DISPATCH_CHECKLIST.map((entry) => {
      const linked = entry.category === "Consumables & Materials" ? materials.find((material) => material.name === entry.name) : undefined;
      return { category: entry.category, project_material_id: linked?.id || null, material_name: entry.name, unit: entry.unit, specification: linked?.specification || entry.specification || "", qty_in_factory: 0, qty_sent: 0, dispatched_by: null, qty_received: null, qty_returned: 0, returned_by: null, condition: null, shortage_qty: 0, remarks: null };
    }));
    setOpen(true);
  };

  const setItem = (i: number, patch: Partial<Item>) => setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  const saveDispatch = async () => {
    if (!form.dispatch_number?.trim()) { toast({ variant: "destructive", title: "Dispatch number is required" }); return; }
    const rows = items.filter((it) => it.material_name.trim() && Number(it.qty_sent) > 0);
    if (rows.length === 0) { toast({ variant: "destructive", title: "Add at least one material with a quantity" }); return; }
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const { data: created, error } = await supabase.from("material_dispatches" as any).insert({
      project_id: projectId,
      dispatch_number: form.dispatch_number.trim(),
      source: form.source,
      vendor_name: form.vendor_name || null,
      vehicle_number: form.vehicle_number || null,
      driver_name: form.driver_name || null,
      driver_phone: form.driver_phone || null,
      dispatch_date: form.dispatch_date,
      return_date: form.return_date || null,
      expected_delivery_date: form.expected_delivery_date || null,
      status: form.status,
      notes: form.notes || null,
      factory_store_manager: form.factory_store_manager || null,
      site_incharge: form.site_incharge || null,
      qc_project_manager: form.qc_project_manager || null,
      return_verified_by: form.return_verified_by || null,
      created_by: u.user?.id,
    } as any).select().single();
    if (error || !created) { setSaving(false); toast({ variant: "destructive", title: "Failed", description: error?.message }); return; }
    const { error: e2 } = await supabase.from("material_dispatch_items" as any).insert(rows.map((it) => ({
      dispatch_id: (created as any).id,
      project_material_id: it.project_material_id,
      material_name: it.material_name.trim(),
      unit: it.unit,
      specification: it.specification || null,
      qty_in_factory: Number(it.qty_in_factory) || 0,
      qty_sent: Number(it.qty_sent),
      dispatched_by: it.dispatched_by || null,
      qty_returned: Number(it.qty_returned) || 0,
      returned_by: it.returned_by || null,
      remarks: it.remarks || null,
    })) as any);
    setSaving(false);
    if (e2) { toast({ variant: "destructive", title: "Items failed", description: e2.message }); return; }
    toast({ title: "Dispatch created" });
    setOpen(false);
    load();
  };

  const updateStatus = async (d: any, status: string) => {
    const { error } = await supabase.from("material_dispatches" as any).update({ status } as any).eq("id", d.id);
    if (error) toast({ variant: "destructive", title: "Failed", description: error.message });
    else load();
  };

  const openReceive = (d: any) => {
    setReceiving(d);
    setRecItems((d.material_dispatch_items || []).map((it: any) => ({
      ...it,
        qty_received: it.qty_received ?? it.qty_sent,
        qty_returned: it.qty_returned || 0,
      condition: it.condition || "good",
      remarks: it.remarks || "",
    })));
  };

  const confirmReceipt = async () => {
    if (!receiving) return;
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    let anyShort = false;
    for (const it of recItems) {
      const rec = Number(it.qty_received || 0);
      const shortage = Math.max(0, Number(it.qty_sent) - rec);
      if (shortage > 0 || it.condition === "damaged") anyShort = true;
      await supabase.from("material_dispatch_items" as any).update({
        qty_received: rec, shortage_qty: shortage, condition: it.condition, remarks: it.remarks || null,
        qty_returned: Number(it.qty_returned) || 0, returned_by: it.returned_by || null,
      } as any).eq("id", it.id!);
      // Stock is increased only on confirmed receipt at site
      if (rec > 0 && it.project_material_id) {
        await supabase.from("stock_transactions" as any).insert({
          project_id: projectId,
          project_material_id: it.project_material_id,
          txn_type: "receipt",
          qty: rec,
          transaction_date: new Date().toISOString().split("T")[0],
          reason: `Dispatch ${receiving.dispatch_number}`,
          ref_type: "dispatch",
          ref_id: receiving.id,
          created_by: u.user?.id,
        } as any);
      }
    }
    await supabase.from("material_dispatches" as any).update({
      status: anyShort ? "partially_received" : "received",
      received_at: new Date().toISOString(),
      received_by: u.user?.id,
    } as any).eq("id", receiving.id);
    setSaving(false);
    toast({ title: "Receipt confirmed", description: "Site stock has been updated." });
    setReceiving(null);
    load();
  };

  const removeDispatch = async (d: any) => {
    const { error } = await supabase.from("material_dispatches" as any).delete().eq("id", d.id);
    if (error) toast({ variant: "destructive", title: "Failed", description: error.message });
    else { toast({ title: "Dispatch deleted" }); load(); }
  };

  return (
    <div className="space-y-4">
      <Card className="glass-card rounded-2xl p-4 flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex items-center gap-2 flex-1">
          <Truck className="w-5 h-5 text-primary shrink-0" />
          <div>
            <h3 className="font-bold text-sm">Factory → Site Dispatch & Return Checklist</h3>
            <p className="text-[11px] text-muted-foreground">{inTransit} shipment{inTransit === 1 ? "" : "s"} in transit · machinery, tools, consumables and PPE are pre-listed.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              {Object.entries(STATUS_META).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
            </SelectContent>
          </Select>
          {canManage && <Button size="sm" className="gap-2" onClick={openCreate}><Plus className="w-4 h-4" /> New dispatch</Button>}
        </div>
      </Card>

      <Card className="glass-card rounded-2xl p-4">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            {dispatches.length === 0 ? "No dispatches recorded for this project yet." : "No dispatches match this filter."}
          </p>
        ) : (
          <div className="space-y-2">
            {filtered.map((d) => {
              const st = STATUS_META[d.status] || STATUS_META.preparing;
              const its = d.material_dispatch_items || [];
              return (
                <div key={d.id} className="p-3 rounded-xl glass space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm flex items-center gap-2 flex-wrap">
                        {d.dispatch_number}
                        <Badge variant="outline" className={`text-[10px] ${st.cls}`}>{st.label}</Badge>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {d.source === "vendor" ? d.vendor_name || "Vendor" : "Factory"} · Sent {format(new Date(d.dispatch_date), "dd MMM yyyy")}
                        {d.expected_delivery_date && ` · ETA ${format(new Date(d.expected_delivery_date), "dd MMM")}`}
                        {d.vehicle_number && ` · ${d.vehicle_number}`}
                        {d.driver_name && ` · ${d.driver_name}`}
                        {` · ${its.length} item${its.length === 1 ? "" : "s"}`}
                      </div>
                    </div>
                    {canManage && (
                      <div className="flex gap-2 shrink-0 flex-wrap">
                        {d.status === "preparing" && <Button size="sm" variant="outline" onClick={() => updateStatus(d, "dispatched")}>Mark dispatched</Button>}
                        {d.status === "dispatched" && <Button size="sm" variant="outline" onClick={() => updateStatus(d, "in_transit")}>In transit</Button>}
                        {["dispatched", "in_transit", "partially_received"].includes(d.status) && (
                          <Button size="sm" className="gap-1" onClick={() => openReceive(d)}><PackageCheck className="w-4 h-4" /> Receive</Button>
                        )}
                        <Button size="sm" variant="ghost" aria-label="Delete dispatch" onClick={() => removeDispatch(d)}><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    )}
                  </div>
                  {its.length > 0 && (
                    <div className="grid gap-1">
                      {its.map((it: any) => (
                        <div key={it.id} className="text-[11px] text-muted-foreground flex items-center justify-between gap-3">
                          <span className="truncate">{it.material_name}</span>
                          <span className="shrink-0">
                            {it.qty_received != null ? `${it.qty_received}/${it.qty_sent}` : it.qty_sent} {it.unit}
                            {it.qty_returned > 0 && <span> · returned {it.qty_returned}</span>}
                            {it.shortage_qty > 0 && <span className="text-red-600"> · short {it.shortage_qty}</span>}
                            {it.condition === "damaged" && <span className="text-red-600"> · damaged</span>}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Factory → Site Dispatch & Return Checklist</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="text-xs text-muted-foreground">Dispatch number *</label><Input value={form.dispatch_number || ""} onChange={(e) => setForm({ ...form, dispatch_number: e.target.value })} /></div>
            <div>
              <label className="text-xs text-muted-foreground">Source</label>
              <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="factory">Factory</SelectItem><SelectItem value="vendor">Vendor</SelectItem></SelectContent>
              </Select>
            </div>
            {form.source === "vendor" && <div><label className="text-xs text-muted-foreground">Vendor name</label><Input value={form.vendor_name || ""} onChange={(e) => setForm({ ...form, vendor_name: e.target.value })} /></div>}
            <div><label className="text-xs text-muted-foreground">Vehicle number</label><Input value={form.vehicle_number || ""} onChange={(e) => setForm({ ...form, vehicle_number: e.target.value })} /></div>
            <div><label className="text-xs text-muted-foreground">Driver name</label><Input value={form.driver_name || ""} onChange={(e) => setForm({ ...form, driver_name: e.target.value })} /></div>
            <div><label className="text-xs text-muted-foreground">Driver phone</label><Input value={form.driver_phone || ""} onChange={(e) => setForm({ ...form, driver_phone: e.target.value })} /></div>
            <div><label className="text-xs text-muted-foreground">Dispatch date</label><Input type="date" value={form.dispatch_date || ""} onChange={(e) => setForm({ ...form, dispatch_date: e.target.value })} /></div>
            <div><label className="text-xs text-muted-foreground">Return date</label><Input type="date" value={form.return_date || ""} onChange={(e) => setForm({ ...form, return_date: e.target.value })} /></div>
            <div><label className="text-xs text-muted-foreground">Expected delivery</label><Input type="date" value={form.expected_delivery_date || ""} onChange={(e) => setForm({ ...form, expected_delivery_date: e.target.value })} /></div>
            <div>
              <label className="text-xs text-muted-foreground">Status</label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="preparing">Preparing</SelectItem><SelectItem value="dispatched">Dispatched</SelectItem><SelectItem value="in_transit">In transit</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2"><label className="text-xs text-muted-foreground">Notes</label><Textarea rows={2} value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>

          <div className="space-y-5">
            {DISPATCH_SECTIONS.map((section) => <div key={section} className="space-y-2">
              <h4 className="text-sm font-semibold border-b border-border pb-2">{section}</h4>
              <div className="hidden md:grid grid-cols-12 gap-2 text-[10px] text-muted-foreground px-2"><span className="col-span-3">Item</span><span className="col-span-2">Specification</span><span>Unit</span><span>Factory</span><span>Dispatch</span><span className="col-span-2">Dispatched by</span><span className="col-span-2">Remarks / condition</span></div>
              {items.map((it, i) => it.category === section && <div key={`${section}-${it.material_name}`} className="grid grid-cols-2 md:grid-cols-12 gap-2 p-2 rounded-lg glass items-center">
                <div className="col-span-2 md:col-span-3 text-xs font-medium">{it.material_name}</div>
                <Input className="md:col-span-2" aria-label={`${it.material_name} specification`} placeholder="Specification" value={it.specification || ""} onChange={(e) => setItem(i, { specification: e.target.value })} />
                <Input aria-label={`${it.material_name} unit`} placeholder="Unit" value={it.unit} onChange={(e) => setItem(i, { unit: e.target.value })} />
                <Input type="number" aria-label={`${it.material_name} factory quantity`} placeholder="Factory qty" value={it.qty_in_factory || ""} onChange={(e) => setItem(i, { qty_in_factory: Number(e.target.value) })} />
                <Input type="number" aria-label={`${it.material_name} dispatch quantity`} placeholder="Dispatch qty" value={it.qty_sent || ""} onChange={(e) => setItem(i, { qty_sent: Number(e.target.value) })} />
                <Input className="md:col-span-2" aria-label={`${it.material_name} dispatched by`} placeholder="Dispatched by / sign" value={it.dispatched_by || ""} onChange={(e) => setItem(i, { dispatched_by: e.target.value })} />
                <Input className="md:col-span-2" aria-label={`${it.material_name} remarks`} placeholder="Remarks / condition" value={it.remarks || ""} onChange={(e) => setItem(i, { remarks: e.target.value })} />
              </div>)}
            </div>)}
            <p className="text-[10px] text-muted-foreground">Fill quantities only for dispatched items. Consumables linked to Materials List update Site Stock when receipt is confirmed.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-border pt-4">
            <div><label className="text-xs text-muted-foreground">Factory Store Manager</label><Input value={form.factory_store_manager || ""} onChange={(e) => setForm({ ...form, factory_store_manager: e.target.value })} /></div>
            <div><label className="text-xs text-muted-foreground">Site Engineer / Supervisor</label><Input value={form.site_incharge || ""} onChange={(e) => setForm({ ...form, site_incharge: e.target.value })} /></div>
            <div><label className="text-xs text-muted-foreground">QC / Project Manager</label><Input value={form.qc_project_manager || ""} onChange={(e) => setForm({ ...form, qc_project_manager: e.target.value })} /></div>
            <div><label className="text-xs text-muted-foreground">Verified by (return check)</label><Input value={form.return_verified_by || ""} onChange={(e) => setForm({ ...form, return_verified_by: e.target.value })} /></div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={saveDispatch} disabled={saving}>{saving ? "Saving…" : "Create dispatch"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!receiving} onOpenChange={(o) => !o && setReceiving(null)}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Confirm receipt — {receiving?.dispatch_number}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {recItems.map((it, i) => (
              <div key={it.id} className="p-3 rounded-xl glass space-y-2">
                <div className="text-sm font-medium">{it.material_name} <span className="text-xs text-muted-foreground">· sent {it.qty_sent} {it.unit}</span></div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground">Received qty</label>
                    <Input type="number" value={it.qty_received ?? ""} onChange={(e) => setRecItems((p) => p.map((x, idx) => idx === i ? { ...x, qty_received: Number(e.target.value) } : x))} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Condition</label>
                    <Select value={it.condition || "good"} onValueChange={(v) => setRecItems((p) => p.map((x, idx) => idx === i ? { ...x, condition: v } : x))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="good">Good</SelectItem><SelectItem value="damaged">Damaged</SelectItem><SelectItem value="partial">Partial</SelectItem></SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-xs text-muted-foreground">Qty returned to factory</label><Input type="number" value={it.qty_returned || ""} onChange={(e) => setRecItems((p) => p.map((x, idx) => idx === i ? { ...x, qty_returned: Number(e.target.value) } : x))} /></div>
                  <div><label className="text-xs text-muted-foreground">Returned by / sign</label><Input value={it.returned_by || ""} onChange={(e) => setRecItems((p) => p.map((x, idx) => idx === i ? { ...x, returned_by: e.target.value } : x))} /></div>
                </div>
                <Input placeholder="Remarks (optional)" value={it.remarks || ""} onChange={(e) => setRecItems((p) => p.map((x, idx) => idx === i ? { ...x, remarks: e.target.value } : x))} />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceiving(null)}>Cancel</Button>
            <Button onClick={confirmReceipt} disabled={saving}>{saving ? "Saving…" : "Confirm & update stock"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
