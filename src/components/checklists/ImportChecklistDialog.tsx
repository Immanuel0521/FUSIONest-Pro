import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Upload, Loader2, FileText, Plus, Trash2, ArrowUp, ArrowDown, Sparkles, Save } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { STAGE_LABEL, ChecklistStage, ChecklistInputType } from "@/hooks/useChecklistTemplates";

const STAGES: ChecklistStage[] = ["pre_work", "during_work", "post_work", "quality_check", "safety_inspection"];
const ACCEPT = ".pdf,.docx,.xlsx,.xls,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel";

interface ItemDraft {
  id: string;
  item_text: string;
  input_type: ChecklistInputType;
  is_required: boolean;
  help_text: string;
  dropdown_options: string;
}

const fileToB64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result || "");
      resolve(s.includes(",") ? s.split(",")[1] : s);
    };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });

export function ImportChecklistDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"smart_ai" | "rule_based">("smart_ai");
  const [dragOver, setDragOver] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Quality");
  const [stage, setStage] = useState<ChecklistStage>("during_work");
  const [description, setDescription] = useState("");
  const [items, setItems] = useState<ItemDraft[]>([]);
  const [parsed, setParsed] = useState(false);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setTitle(""); setCategory("Quality"); setStage("during_work"); setDescription("");
    setItems([]); setParsed(false); setError(null); setProgress(0);
  };

  const close = (o: boolean) => { if (!o) reset(); onOpenChange(o); };

  const handleFile = async (file: File) => {
    setError(null);
    if (file.size > 10 * 1024 * 1024) { setError("File exceeds 10MB limit"); return; }
    const okExt = /\.(pdf|docx|xlsx|xls)$/i.test(file.name);
    if (!okExt) { setError("Please upload PDF, Word (.docx) or Excel (.xlsx) only"); return; }

    setProcessing(true);
    setProgress(15);
    try {
      const dataBase64 = await fileToB64(file);
      setProgress(40);
      const { data, error: fnErr } = await supabase.functions.invoke("convert-checklist", {
        body: { filename: file.name, mime: file.type, dataBase64, mode },
      });
      setProgress(90);
      if (fnErr) throw new Error(fnErr.message || "Conversion failed");
      if ((data as any)?.error) throw new Error((data as any).error);

      const result = data as any;
      setTitle(result.title || "");
      setCategory(result.category || "Quality");
      setStage(result.stage || "during_work");
      setDescription(result.description || "");
      setItems((result.items || []).map((it: any) => ({
        id: crypto.randomUUID(),
        item_text: it.item_text,
        input_type: it.input_type,
        is_required: !!it.is_required,
        help_text: it.help_text || "",
        dropdown_options: Array.isArray(it.dropdown_options) ? it.dropdown_options.join(", ") : "",
      })));
      setParsed(true);
      setProgress(100);
      if (!result.items?.length) toast.warning("No checklist items detected. You can add them manually.");
      else toast.success(`Extracted ${result.items.length} item${result.items.length === 1 ? "" : "s"}`);
    } catch (e: any) {
      setError(e.message || "Failed to process file");
    } finally {
      setProcessing(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const updateItem = (id: string, patch: Partial<ItemDraft>) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const removeItem = (id: string) => setItems((p) => p.filter((i) => i.id !== id));
  const move = (id: string, dir: -1 | 1) => {
    setItems((prev) => {
      const i = prev.findIndex((x) => x.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };
  const addItem = () => setItems((p) => [...p, {
    id: crypto.randomUUID(), item_text: "", input_type: "checkbox", is_required: false, help_text: "", dropdown_options: "",
  }]);

  const save = async () => {
    if (!title.trim()) { toast.error("Title is required"); return; }
    if (!items.length) { toast.error("Add at least one item"); return; }
    if (items.some((i) => !i.item_text.trim())) { toast.error("All items need text"); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const { data, error: tErr } = await supabase.from("checklist_templates" as any).insert({
        title: title.trim(), category: category || null, stage, description: description || null,
        checklist_type: "interactive", created_by: user.id,
      }).select().single();
      if (tErr) throw tErr;
      const templateId = (data as any).id;
      const rows = items.map((it, i) => ({
        template_id: templateId,
        item_number: i + 1,
        item_text: it.item_text.trim(),
        input_type: it.input_type,
        is_required: it.is_required,
        help_text: it.help_text || null,
        dropdown_options: it.input_type === "dropdown"
          ? it.dropdown_options.split(",").map((s) => s.trim()).filter(Boolean)
          : null,
      }));
      const { error: iErr } = await supabase.from("checklist_items" as any).insert(rows);
      if (iErr) throw iErr;
      toast.success("Checklist template saved");
      onSaved();
      close(false);
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" /> Import Checklist from File
          </DialogTitle>
          <DialogDescription>
            Upload a PDF, Word, or Excel file. AI will detect items and let you edit before saving.
          </DialogDescription>
        </DialogHeader>

        {!parsed && (
          <div className="space-y-4">
            <div>
              <Label>Processing Mode</Label>
              <select className="w-full h-10 rounded-md border bg-background px-3 text-sm mt-1"
                value={mode} onChange={(e) => setMode(e.target.value as any)} disabled={processing}>
                <option value="smart_ai">Smart AI (Recommended)</option>
                <option value="rule_based">Rule-based (Fast, free)</option>
              </select>
            </div>

            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => !processing && fileRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors ${dragOver ? "border-primary bg-primary/5" : "border-border"} ${processing ? "opacity-60 pointer-events-none" : ""}`}
            >
              <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <p className="font-medium">Drag & drop or click to upload</p>
              <p className="text-xs text-muted-foreground mt-1">PDF, Word (.docx), Excel (.xlsx) — max 10MB</p>
              <input ref={fileRef} type="file" accept={ACCEPT} className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
            </div>

            {processing && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing… extracting and analyzing checklist (10–30s)
                </div>
                <Progress value={progress} />
              </div>
            )}

            {error && (
              <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">{error}</div>
            )}
          </div>
        )}

        {parsed && (
          <div className="space-y-4">
            <Card className="p-4 rounded-xl space-y-3">
              <div><Label>Title *</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div><Label>Category</Label><Input value={category} onChange={(e) => setCategory(e.target.value)} /></div>
                <div>
                  <Label>Stage</Label>
                  <select className="w-full h-10 rounded-md border bg-background px-3 text-sm" value={stage} onChange={(e) => setStage(e.target.value as ChecklistStage)}>
                    {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
                  </select>
                </div>
              </div>
              <div><Label>Description</Label><Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
            </Card>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <FileText className="w-4 h-4 text-primary" />
                <span className="font-medium">{items.length} item{items.length === 1 ? "" : "s"} detected</span>
              </div>
              <Button size="sm" variant="outline" onClick={addItem} className="gap-1"><Plus className="w-4 h-4" /> Add Item</Button>
            </div>

            <div className="space-y-3">
              {items.map((it, idx) => (
                <Card key={it.id} className="p-3 rounded-xl space-y-2">
                  <div className="flex items-start gap-2">
                    <div className="flex flex-col gap-1">
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => move(it.id, -1)} disabled={idx === 0}><ArrowUp className="w-3 h-3" /></Button>
                      <span className="text-xs text-center text-muted-foreground">{idx + 1}</span>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => move(it.id, 1)} disabled={idx === items.length - 1}><ArrowDown className="w-3 h-3" /></Button>
                    </div>
                    <div className="flex-1 space-y-2">
                      <Textarea rows={2} placeholder="Item text" value={it.item_text} onChange={(e) => updateItem(it.id, { item_text: e.target.value })} />
                      <div className="grid sm:grid-cols-3 gap-2">
                        <select className="h-9 rounded-md border bg-background px-2 text-sm"
                          value={it.input_type} onChange={(e) => updateItem(it.id, { input_type: e.target.value as ChecklistInputType })}>
                          <option value="checkbox">Checkbox</option>
                          <option value="text">Text</option>
                          <option value="number">Number</option>
                          <option value="dropdown">Dropdown</option>
                          <option value="photo">Photo</option>
                          <option value="signature">Signature</option>
                        </select>
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox checked={it.is_required} onCheckedChange={(c) => updateItem(it.id, { is_required: !!c })} />
                          Required
                        </label>
                        {it.input_type === "dropdown" && (
                          <Input placeholder="Opt A, Opt B" value={it.dropdown_options} onChange={(e) => updateItem(it.id, { dropdown_options: e.target.value })} />
                        )}
                      </div>
                      <Input placeholder="Help text (optional)" value={it.help_text} onChange={(e) => updateItem(it.id, { help_text: e.target.value })} />
                    </div>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => removeItem(it.id)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </Card>
              ))}
            </div>

            <div className="flex justify-between gap-2 pt-2">
              <Button variant="outline" onClick={() => reset()}>Start Over</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => close(false)}>Cancel</Button>
                <Button onClick={save} disabled={saving} className="gap-2">
                  <Save className="w-4 h-4" />{saving ? "Saving..." : "Save as Template"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}