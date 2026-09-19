import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Image as ImgIcon, Upload, Download, Trash2, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import JSZip from "jszip";
import { saveAs } from "file-saver";

interface Props { projectId: string; }
interface Photo { id: string; photo_url: string; caption: string | null; date_taken: string | null; category: string | null; created_at: string; }

const CATEGORIES = [
  { value: "progress", label: "Progress" },
  { value: "safety", label: "Safety" },
  { value: "issue", label: "Issue" },
  { value: "completed", label: "Completed Work" },
  { value: "before_after", label: "Before/After" },
];
const CAT_COLOR: Record<string, string> = {
  progress: "bg-primary/15 text-primary",
  safety: "bg-amber-500/15 text-amber-600",
  issue: "bg-destructive/15 text-destructive",
  completed: "bg-emerald-500/15 text-emerald-600",
  before_after: "bg-purple-500/15 text-purple-600",
};

const compress = (file: File, maxDim = 1600): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width > height) { height = (height * maxDim) / width; width = maxDim; }
        else { width = (width * maxDim) / height; height = maxDim; }
      }
      const c = document.createElement("canvas");
      c.width = width; c.height = height;
      c.getContext("2d")!.drawImage(img, 0, 0, width, height);
      c.toBlob((b) => b ? resolve(b) : reject("blob failed"), "image/jpeg", 0.85);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });

export const PhotoTimelinePanel = ({ projectId }: Props) => {
  const { toast } = useToast();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [signed, setSigned] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState("progress");
  const [caption, setCaption] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [filterFrom, setFilterFrom] = useState("");
  const [lightbox, setLightbox] = useState<Photo | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("project_photos" as any).select("*").eq("project_id", projectId).order("date_taken", { ascending: false });
    const list = (data as any) || [];
    setPhotos(list);
    const urls: Record<string, string> = {};
    await Promise.all(list.map(async (p: Photo) => {
      const { data: s } = await supabase.storage.from("project-photos").createSignedUrl(p.photo_url, 3600);
      if (s?.signedUrl) urls[p.id] = s.signedUrl;
    }));
    setSigned(urls);
    setLoading(false);
  };

  useEffect(() => { load(); }, [projectId]);

  const filtered = useMemo(() => photos.filter((p) => {
    if (filterCat !== "all" && p.category !== filterCat) return false;
    if (filterFrom && (p.date_taken || "") < filterFrom) return false;
    return true;
  }), [photos, filterCat, filterFrom]);

  const grouped = useMemo(() => {
    const m: Record<string, Photo[]> = {};
    filtered.forEach((p) => {
      const k = p.date_taken || p.created_at.slice(0, 10);
      (m[k] = m[k] || []).push(p);
    });
    return Object.entries(m).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setUploading(true);
    const { data: { user } } = await supabase.auth.getUser();
    for (const f of Array.from(files)) {
      if (f.size > 5 * 1024 * 1024) { toast({ variant: "destructive", title: `${f.name} exceeds 5MB` }); continue; }
      if (!/(jpe?g|png|webp)$/i.test(f.name)) { toast({ variant: "destructive", title: "Only JPG/PNG/WEBP allowed" }); continue; }
      try {
        const blob = await compress(f);
        const path = `${projectId}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
        const { error } = await supabase.storage.from("project-photos").upload(path, blob, { contentType: "image/jpeg" });
        if (error) throw error;
        await supabase.from("project_photos" as any).insert({
          project_id: projectId, photo_url: path, caption: caption || null,
          category, date_taken: new Date().toISOString().slice(0, 10), uploaded_by: user?.id,
        });
      } catch (e: any) {
        toast({ variant: "destructive", title: "Upload failed", description: e.message || String(e) });
      }
    }
    setUploading(false); setCaption("");
    toast({ title: "Photos uploaded" });
    load();
  };

  const del = async (p: Photo) => {
    await supabase.storage.from("project-photos").remove([p.photo_url]);
    await supabase.from("project_photos" as any).delete().eq("id", p.id);
    toast({ title: "Photo deleted" });
    load();
  };

  const downloadAll = async () => {
    if (filtered.length === 0) return;
    toast({ title: "Building ZIP..." });
    const zip = new JSZip();
    await Promise.all(filtered.map(async (p) => {
      if (!signed[p.id]) return;
      const r = await fetch(signed[p.id]);
      const b = await r.blob();
      const ext = p.photo_url.split(".").pop() || "jpg";
      zip.file(`${p.date_taken || "photo"}-${p.id.slice(0, 6)}.${ext}`, b);
    }));
    const out = await zip.generateAsync({ type: "blob" });
    saveAs(out, `project-photos-${projectId.slice(0, 8)}.zip`);
  };

  return (
    <div className="space-y-4">
      <Card className="glass-card rounded-2xl p-5 space-y-3">
        <div className="grid md:grid-cols-[1fr_1fr_auto] gap-3 items-end">
          <div>
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Caption (optional)</Label>
            <Input value={caption} onChange={(e) => setCaption(e.target.value)} />
          </div>
          <div>
            <Label className="block mb-1">Upload</Label>
            <label className="inline-flex">
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} disabled={uploading} />
              <Button type="button" asChild disabled={uploading} className="gap-2 cursor-pointer"><span><Upload className="w-4 h-4" />{uploading ? "Uploading..." : "Choose"}</span></Button>
            </label>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">JPG/PNG/WEBP · max 5MB · auto-compressed</p>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} className="w-[160px]" placeholder="From" />
        <Badge variant="outline" className="ml-auto">{filtered.length} photos</Badge>
        <Button variant="outline" onClick={downloadAll} disabled={filtered.length === 0} className="gap-2"><Download className="w-4 h-4" /> Download ZIP</Button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : filtered.length === 0 ? (
        <Card className="glass-card p-8 text-center">
          <ImgIcon className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground">No photos yet.</p>
        </Card>
      ) : (
        <div className="space-y-5">
          {grouped.map(([date, ps]) => (
            <div key={date}>
              <h4 className="text-sm font-semibold text-muted-foreground mb-2">{format(new Date(date), "EEEE, MMM d, yyyy")}</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {ps.map((p) => (
                  <div key={p.id} className="relative group rounded-xl overflow-hidden bg-muted">
                    {signed[p.id] && <img src={signed[p.id]} alt={p.caption || ""} className="w-full aspect-square object-cover cursor-pointer" onClick={() => setLightbox(p)} />}
                    <div className="absolute top-2 left-2"><Badge className={`${CAT_COLOR[p.category || "progress"]} border-0 text-[9px]`}>{p.category}</Badge></div>
                    <Button size="sm" variant="ghost" className="absolute top-1 right-1 h-7 w-7 p-0 opacity-0 group-hover:opacity-100 bg-background/70" onClick={() => del(p)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                    {p.caption && <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 truncate">{p.caption}</div>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!lightbox} onOpenChange={(v) => !v && setLightbox(null)}>
        <DialogContent className="max-w-4xl p-0 bg-transparent border-0">
          {lightbox && signed[lightbox.id] && (
            <div className="relative">
              <img src={signed[lightbox.id]} alt={lightbox.caption || ""} className="w-full max-h-[80vh] object-contain rounded-lg" />
              {lightbox.caption && <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white p-3 rounded-b-lg">{lightbox.caption}</div>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
