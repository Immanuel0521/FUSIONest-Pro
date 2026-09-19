import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, GripVertical, ArrowLeft, Save } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { ChecklistInputType, STAGE_LABEL, ChecklistStage } from "@/hooks/useChecklistTemplates";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface ItemDraft {
  id: string;
  item_text: string;
  input_type: ChecklistInputType;
  is_required: boolean;
  help_text: string;
  dropdown_options: string;
}

const newItem = (): ItemDraft => ({ id: crypto.randomUUID(), item_text: "", input_type: "checkbox", is_required: false, help_text: "", dropdown_options: "" });

const STAGES: ChecklistStage[] = ["pre_work", "during_work", "post_work", "quality_check", "safety_inspection"];

function SortableItem({ item, onChange, onRemove }: { item: ItemDraft; onChange: (i: ItemDraft) => void; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <Card ref={setNodeRef} style={style} className="glass-card p-4 rounded-xl space-y-3">
      <div className="flex gap-3 items-start">
        <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground mt-2"><GripVertical className="w-5 h-5" /></button>
        <div className="flex-1 grid sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2"><Label>Question / Item *</Label>
            <Input value={item.item_text} onChange={(e) => onChange({ ...item, item_text: e.target.value })} />
          </div>
          <div>
            <Label>Input Type</Label>
            <select className="w-full h-10 rounded-md border bg-background px-3 text-sm" value={item.input_type} onChange={(e) => onChange({ ...item, input_type: e.target.value as ChecklistInputType })}>
              <option value="checkbox">Checkbox (Yes/No)</option>
              <option value="text">Text</option>
              <option value="number">Number</option>
              <option value="dropdown">Dropdown</option>
              <option value="photo">Photo</option>
              <option value="signature">Signature</option>
            </select>
          </div>
          <div className="flex items-center gap-2 mt-6">
            <Checkbox checked={item.is_required} onCheckedChange={(c) => onChange({ ...item, is_required: !!c })} />
            <span className="text-sm">Required</span>
          </div>
          {item.input_type === "dropdown" && (
            <div className="sm:col-span-2"><Label>Options (comma-separated)</Label>
              <Input placeholder="Option A, Option B, ..." value={item.dropdown_options} onChange={(e) => onChange({ ...item, dropdown_options: e.target.value })} />
            </div>
          )}
          <div className="sm:col-span-2"><Label>Help Text</Label>
            <Input value={item.help_text} onChange={(e) => onChange({ ...item, help_text: e.target.value })} />
          </div>
        </div>
        <Button variant="outline" size="icon" className="text-destructive" onClick={onRemove}><Trash2 className="w-4 h-4" /></Button>
      </div>
    </Card>
  );
}

export default function ChecklistBuilder() {
  const { id } = useParams<{ id: string }>();
  const editing = !!id;
  const nav = useNavigate();
  const sensors = useSensors(useSensor(PointerSensor));

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Quality");
  const [stage, setStage] = useState<ChecklistStage>("quality_check");
  const [description, setDescription] = useState("");
  const [items, setItems] = useState<ItemDraft[]>([newItem()]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data: t } = await supabase.from("checklist_templates" as any).select("*").eq("id", id).maybeSingle();
      const { data: it } = await supabase.from("checklist_items" as any).select("*").eq("template_id", id).order("item_number");
      if (t) {
        const tt = t as any;
        setTitle(tt.title); setCategory(tt.category || ""); setStage(tt.stage); setDescription(tt.description || "");
      }
      if (it) {
        setItems((it as any[]).map((x) => ({
          id: x.id, item_text: x.item_text, input_type: x.input_type, is_required: x.is_required,
          help_text: x.help_text || "", dropdown_options: Array.isArray(x.dropdown_options) ? x.dropdown_options.join(", ") : "",
        })));
      }
    })();
  }, [id]);

  const save = async () => {
    if (!title.trim()) { toast.error("Title required"); return; }
    if (items.some((i) => !i.item_text.trim())) { toast.error("All items need text"); return; }
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      let templateId = id;
      if (editing) {
        const { error } = await supabase.from("checklist_templates" as any).update({ title, category, stage, description }).eq("id", id);
        if (error) throw error;
        await supabase.from("checklist_items" as any).delete().eq("template_id", id);
      } else {
        const { data, error } = await supabase.from("checklist_templates" as any).insert({
          title, category, stage, description, checklist_type: "interactive", created_by: user.id,
        }).select().single();
        if (error) throw error;
        templateId = (data as any).id;
      }
      const rows = items.map((it, i) => ({
        template_id: templateId, item_number: i + 1, item_text: it.item_text,
        input_type: it.input_type, is_required: it.is_required, help_text: it.help_text || null,
        dropdown_options: it.input_type === "dropdown" ? it.dropdown_options.split(",").map((s) => s.trim()).filter(Boolean) : null,
      }));
      const { error: ie } = await supabase.from("checklist_items" as any).insert(rows);
      if (ie) throw ie;
      toast.success("Saved");
      nav("/checklists");
    } catch (e: any) {
      toast.error(e.message || "Failed");
    } finally { setBusy(false); }
  };

  return (
    <DashboardLayout>
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-5 max-w-4xl mx-auto">
        <Button variant="ghost" size="sm" onClick={() => nav("/checklists")} className="gap-1"><ArrowLeft className="w-4 h-4" /> Back</Button>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{editing ? "Edit" : "Create"} Checklist</h1>

        <Card className="glass-card p-5 rounded-2xl space-y-3">
          <div><Label>Title *</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div><Label>Category</Label><Input value={category} onChange={(e) => setCategory(e.target.value)} /></div>
            <div><Label>Stage</Label>
              <select className="w-full h-10 rounded-md border bg-background px-3 text-sm" value={stage} onChange={(e) => setStage(e.target.value as ChecklistStage)}>
                {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
              </select>
            </div>
          </div>
          <div><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        </Card>

        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Items</h2>
          <Button size="sm" variant="outline" className="gap-1" onClick={() => setItems([...items, newItem()])}><Plus className="w-4 h-4" /> Add Item</Button>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => {
          const { active, over } = e;
          if (over && active.id !== over.id) {
            const oldI = items.findIndex((i) => i.id === active.id);
            const newI = items.findIndex((i) => i.id === over.id);
            setItems(arrayMove(items, oldI, newI));
          }
        }}>
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {items.map((it) => (
                <SortableItem key={it.id} item={it}
                  onChange={(updated) => setItems(items.map((x) => x.id === it.id ? updated : x))}
                  onRemove={() => setItems(items.filter((x) => x.id !== it.id))}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <div className="flex justify-end gap-2 sticky bottom-4">
          <Button onClick={save} disabled={busy} className="gap-2"><Save className="w-4 h-4" /> {busy ? "Saving..." : "Save Checklist"}</Button>
        </div>
      </motion.div>
    </DashboardLayout>
  );
}