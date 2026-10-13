import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface Props { open: boolean; onOpenChange: (o: boolean) => void; onSaved: () => void; }

const CATEGORIES = ["Foundation", "Structure", "Finishing", "MEP", "Safety", "General"];

export const MethodologyUploadDialog = ({ open, onOpenChange, onSaved }: Props) => {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("General");
  const [description, setDescription] = useState("");
  const [version, setVersion] = useState("1.0");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => { setTitle(""); setCategory("General"); setDescription(""); setVersion("1.0"); setFile(null); };

  const submit = async () => {
    if (!title.trim() || !file) { toast.error("Title and PDF file required"); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("File too large (max 10MB)"); return; }
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) { toast.error("Invalid file format. Please upload a PDF document."); return; }
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const path = `${user.id}/${Date.now()}_${file.name.replace(/[^\w.-]/g, "_")}`;
      const { error: upErr } = await supabase.storage.from("methodologies").upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from("methodologies" as any).insert({
        title, category, description, version, file_path: path, file_size: file.size, uploaded_by: user.id,
      });
      if (insErr) throw insErr;
      toast.success("Methodology uploaded");
      reset();
      onOpenChange(false);
      onSaved();
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-heavy">
        <DialogHeader><DialogTitle>Upload Methodology</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Title *</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Category</Label>
              <select className="w-full h-10 rounded-md border bg-background px-3 text-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div><Label>Version</Label><Input value={version} onChange={(e) => setVersion(e.target.value)} /></div>
          </div>
          <div><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <div><Label>PDF File *</Label><Input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} /></div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
            <Button onClick={submit} disabled={busy}>{busy ? "Uploading..." : "Upload"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};