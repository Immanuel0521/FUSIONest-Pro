import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { BookMarked, Plus, Pencil, Trash2, Search } from "lucide-react";
import { DPR_STAGES } from "@/pages/DprWizard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CONSUMABLE_MATERIALS } from "@/lib/materialCatalog";

export type ProjectMaterial = {
  id: string;
  project_id: string;
  name: string;
  category: string | null;
  specification: string | null;
  size: string | null;
  thickness: string | null;
  grade: string | null;
  unit: string;
  stage: string | null;
  boq_qty: number;
  min_stock_level: number;
  vendor: string | null;
  notes: string | null;
};

const empty = {
  name: "", category: "", specification: "", size: "", thickness: "", grade: "",
  unit: "nos", stage: "", boq_qty: 0, min_stock_level: 0, vendor: "", notes: "",
};

export function MaterialReferencePanel({ projectId, canManage }: { projectId: string; canManage: boolean }) {
  const { toast } = useToast();
  const [rows, setRows] = useState<ProjectMaterial[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<any>(empty);
  const [saving, setSaving] = useState(false);
  const [initializing, setInitializing] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("project_materials" as any).select("*").eq("project_id", projectId).eq("active", true).order("name");
    const existing = (data as any[]) || [];
    setRows(existing);
    if (canManage && existing.length === 0) await addStarterList(false);
  };
  useEffect(() => { load(); }, [projectId]);

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const addStarterList = async (notify = true) => {
    setInitializing(true);
    const { data: u } = await supabase.auth.getUser();
    const { data: existing } = await supabase.from("project_materials" as any).select("name").eq("project_id", projectId).eq("active", true);
    const names = new Set(((existing as any[]) || []).map((row) => row.name));
    const missing = CONSUMABLE_MATERIALS.filter((item) => !names.has(item.name)).map((item) => ({
      project_id: projectId, name: item.name, category: item.category, specification: item.specification || "Standard / as approved",
      unit: item.unit, boq_qty: 0, min_stock_level: 0, active: true, created_by: u.user?.id,
    }));
    const { error } = missing.length ? await supabase.from("project_materials" as any).insert(missing as any) : { error: null };
    setInitializing(false);
    if (error) { if (notify) toast({ variant: "destructive", title: "Could not add starter list", description: error.message }); return; }
    if (notify) toast({ title: missing.length ? `${missing.length} consumable materials added` : "Starter list is already complete" });
    if (missing.length) {
      const { data } = await supabase.from("project_materials" as any).select("*").eq("project_id", projectId).eq("active", true).order("name");
      setRows((data as any[]) || []);
    }
  };
  const openEdit = (r: ProjectMaterial) => {
    setEditing(r.id);
    setForm({ ...empty, ...r, category: r.category || "", specification: r.specification || "", size: r.size || "", thickness: r.thickness || "", grade: r.grade || "", stage: r.stage || "", vendor: r.vendor || "", notes: r.notes || "" });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) { toast({ variant: "destructive", title: "Material name is required" }); return; }
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const payload: any = {
      project_id: projectId,
      name: form.name.trim(),
      category: form.category || null,
      specification: form.specification || null,
      size: form.size || null,
      thickness: form.thickness || null,
      grade: form.grade || null,
      unit: form.unit || "nos",
      stage: form.stage || null,
      boq_qty: Number(form.boq_qty) || 0,
      min_stock_level: Number(form.min_stock_level) || 0,
      vendor: form.vendor || null,
      notes: form.notes || null,
    };
    const res = editing
      ? await supabase.from("project_materials" as any).update(payload).eq("id", editing)
      : await supabase.from("project_materials" as any).insert({ ...payload, created_by: u.user?.id });
    setSaving(false);
    if (res.error) { toast({ variant: "destructive", title: "Failed", description: res.error.message }); return; }
    toast({ title: editing ? "Material updated" : "Material added" });
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("project_materials" as any).update({ active: false }).eq("id", id);
    if (error) toast({ variant: "destructive", title: "Failed", description: error.message });
    else { toast({ title: "Material removed" }); load(); }
  };

  const filtered = rows.filter((r) =>
    !q || [r.name, r.category, r.specification, r.vendor, r.stage].filter(Boolean).join(" ").toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-4">
      <Card className="glass-card rounded-2xl p-4 flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex items-center gap-2 flex-1">
          <BookMarked className="w-5 h-5 text-primary shrink-0" />
          <div>
            <h3 className="font-bold text-sm">Material Reference Sheet</h3>
            <p className="text-[11px] text-muted-foreground">Consumables and construction materials only — machinery and tools are kept in Dispatch.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-8 h-9 w-full md:w-56" placeholder="Search materials" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {canManage && <Button size="sm" variant="outline" onClick={() => addStarterList()} disabled={initializing} className="shrink-0">{initializing ? "Loading…" : "Load starter list"}</Button>}
          {canManage && <Button size="sm" onClick={openNew} className="gap-2 shrink-0"><Plus className="w-4 h-4" /> Add</Button>}
        </div>
      </Card>

      <Card className="glass-card rounded-2xl p-4">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Preparing the consumables and materials starter list…</p>
        ) : (
          <div className="space-y-2">
            {filtered.map((r) => (
              <div key={r.id} className="p-3 rounded-xl glass flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-sm flex items-center gap-2 flex-wrap">
                    {r.name}
                    {r.category && <Badge variant="outline" className="text-[10px]">{r.category}</Badge>}
                    {r.stage && <Badge variant="secondary" className="text-[10px]">{r.stage}</Badge>}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {[r.specification, r.size && `Size ${r.size}`, r.thickness && `${r.thickness} thk`, r.grade && `Grade ${r.grade}`].filter(Boolean).join(" · ") || "—"}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    BOQ {r.boq_qty} {r.unit} · Min level {r.min_stock_level} {r.unit}{r.vendor ? ` · ${r.vendor}` : ""}
                  </div>
                </div>
                {canManage && (
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" aria-label="Edit material" onClick={() => openEdit(r)}><Pencil className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" aria-label="Remove material" onClick={() => remove(r.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit material" : "Add material"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <Field className="col-span-2" label="Material name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Category"><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></Field>
            <Field label="Unit"><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></Field>
            <Field className="col-span-2" label="Specification"><Input value={form.specification} onChange={(e) => setForm({ ...form, specification: e.target.value })} /></Field>
            <Field label="Size"><Input value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} /></Field>
            <Field label="Thickness"><Input value={form.thickness} onChange={(e) => setForm({ ...form, thickness: e.target.value })} /></Field>
            <Field label="Grade"><Input value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} /></Field>
            <Field label="Stage">
              <Select value={form.stage || "none"} onValueChange={(v) => setForm({ ...form, stage: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Select stage" /></SelectTrigger>
                <SelectContent className="max-h-60">
                  <SelectItem value="none">Not stage specific</SelectItem>
                  {DPR_STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="BOQ quantity"><Input type="number" value={form.boq_qty} onChange={(e) => setForm({ ...form, boq_qty: e.target.value })} /></Field>
            <Field label="Min stock level"><Input type="number" value={form.min_stock_level} onChange={(e) => setForm({ ...form, min_stock_level: e.target.value })} /></Field>
            <Field className="col-span-2" label="Approved vendor"><Input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} /></Field>
            <Field className="col-span-2" label="Notes"><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="text-xs text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}