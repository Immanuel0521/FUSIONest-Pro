import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Save, Send, Camera, X, Download, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { format } from "date-fns";
import { SignaturePad } from "@/components/checklists/SignaturePad";
import { exportChecklistPdf } from "@/lib/checklistPdf";

interface Item { id: string; item_number: number; item_text: string; input_type: string; dropdown_options: string[] | null; is_required: boolean; help_text: string | null; }
interface Response { item_id: string; response_value: string | null; response_photos: string[] | null; response_signature: string | null; }

const compress = (file: File, maxDim = 1600): Promise<Blob> => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => {
    let { width, height } = img;
    if (width > maxDim || height > maxDim) {
      if (width > height) { height = (height * maxDim) / width; width = maxDim; } else { width = (width * maxDim) / height; height = maxDim; }
    }
    const c = document.createElement("canvas"); c.width = width; c.height = height;
    c.getContext("2d")!.drawImage(img, 0, 0, width, height);
    c.toBlob((b) => b ? resolve(b) : reject("blob failed"), "image/jpeg", 0.85);
  };
  img.onerror = reject;
  img.src = URL.createObjectURL(file);
});

export default function FillChecklist() {
  const { projectId, pcId } = useParams<{ projectId: string; pcId: string }>();
  const nav = useNavigate();

  const [pc, setPc] = useState<any>(null);
  const [project, setProject] = useState<any>(null);
  const [template, setTemplate] = useState<any>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [responses, setResponses] = useState<Record<string, Response>>({});
  const [overallNotes, setOverallNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [signedPhotoUrls, setSignedPhotoUrls] = useState<Record<string, string>>({});

  const completed = pc?.status === "completed";

  const loadSignedUrls = useCallback(async (resp: Record<string, Response>) => {
    const urls: Record<string, string> = {};
    await Promise.all(Object.values(resp).flatMap((r) => {
      const all = [...(r.response_photos || [])];
      if (r.response_signature) all.push(r.response_signature);
      return all.map(async (p) => {
        const { data } = await supabase.storage.from("checklist-responses").createSignedUrl(p, 3600);
        if (data?.signedUrl) urls[p] = data.signedUrl;
      });
    }));
    setSignedPhotoUrls(urls);
  }, []);

  useEffect(() => {
    (async () => {
      if (!pcId) return;
      setLoading(true);
      const { data: pcData } = await supabase.from("project_checklists" as any).select("*").eq("id", pcId).maybeSingle();
      if (!pcData) { toast.error("Not found"); nav(-1); return; }
      const pcRow = pcData as any;
      setPc(pcRow);
      setOverallNotes(pcRow.overall_notes || "");
      const [{ data: pj }, { data: tpl }, { data: it }, { data: rp }] = await Promise.all([
        supabase.from("projects").select("name").eq("id", pcRow.project_id).maybeSingle(),
        supabase.from("checklist_templates" as any).select("*").eq("id", pcRow.template_id).maybeSingle(),
        supabase.from("checklist_items" as any).select("*").eq("template_id", pcRow.template_id).order("item_number"),
        supabase.from("checklist_responses" as any).select("*").eq("project_checklist_id", pcId),
      ]);
      setProject(pj);
      setTemplate(tpl);
      setItems((it as any) || []);
      const respMap: Record<string, Response> = {};
      ((rp as any) || []).forEach((r: any) => { respMap[r.item_id] = r; });
      setResponses(respMap);
      await loadSignedUrls(respMap);
      setLoading(false);
    })();
  }, [pcId, nav, loadSignedUrls]);

  // Persist a single response (debounced via setTimeout per-item)
  const timers = useRef<Record<string, any>>({});
  const persist = useCallback(async (itemId: string, patch: Partial<Response>) => {
    if (!pcId) return;
    const merged: Response = {
      item_id: itemId,
      response_value: null,
      response_photos: null,
      response_signature: null,
      ...(responses[itemId] || {}),
      ...patch,
    };
    setResponses((prev) => ({ ...prev, [itemId]: merged }));
    clearTimeout(timers.current[itemId]);
    timers.current[itemId] = setTimeout(async () => {
      const { error } = await supabase.from("checklist_responses" as any).upsert({
        project_checklist_id: pcId, item_id: itemId,
        response_value: merged.response_value,
        response_photos: merged.response_photos,
        response_signature: merged.response_signature,
        response_date: new Date().toISOString(),
      }, { onConflict: "project_checklist_id,item_id" });
      if (error) { toast.error("Auto-save failed"); return; }
      // bump status to in_progress
      if (pc && pc.status === "not_started") {
        await supabase.from("project_checklists" as any).update({ status: "in_progress" }).eq("id", pcId);
        setPc({ ...pc, status: "in_progress" });
      }
      setSavedAt(new Date());
    }, 1200);
  }, [pcId, responses, pc]);

  const uploadPhoto = async (itemId: string, file: File) => {
    if (file.size > 5 * 1024 * 1024) { toast.error("Photo > 5MB"); return; }
    const blob = await compress(file);
    const path = `${pcId}/${itemId}/${Date.now()}.jpg`;
    const { error } = await supabase.storage.from("checklist-responses").upload(path, blob, { contentType: "image/jpeg" });
    if (error) { toast.error(error.message); return; }
    const cur = responses[itemId]?.response_photos || [];
    const next = [...cur, path];
    await persist(itemId, { response_photos: next });
    const { data } = await supabase.storage.from("checklist-responses").createSignedUrl(path, 3600);
    if (data?.signedUrl) setSignedPhotoUrls((u) => ({ ...u, [path]: data.signedUrl }));
  };

  const removePhoto = async (itemId: string, path: string) => {
    await supabase.storage.from("checklist-responses").remove([path]);
    const next = (responses[itemId]?.response_photos || []).filter((p) => p !== path);
    await persist(itemId, { response_photos: next.length ? next : null });
  };

  const saveSignature = async (itemId: string, dataUrl: string | null) => {
    if (!dataUrl) { await persist(itemId, { response_signature: null }); return; }
    const blob = await (await fetch(dataUrl)).blob();
    const path = `${pcId}/${itemId}/signature_${Date.now()}.png`;
    const { error } = await supabase.storage.from("checklist-responses").upload(path, blob, { contentType: "image/png", upsert: true });
    if (error) { toast.error(error.message); return; }
    await persist(itemId, { response_signature: path });
    const { data } = await supabase.storage.from("checklist-responses").createSignedUrl(path, 3600);
    if (data?.signedUrl) setSignedPhotoUrls((u) => ({ ...u, [path]: data.signedUrl }));
  };

  const completion = useMemo(() => {
    if (!items.length) return 0;
    const filled = items.filter((it) => {
      const r = responses[it.id];
      if (!r) return false;
      if (it.input_type === "photo") return (r.response_photos?.length || 0) > 0;
      if (it.input_type === "signature") return !!r.response_signature;
      return r.response_value != null && r.response_value !== "";
    }).length;
    return Math.round((filled / items.length) * 100);
  }, [items, responses]);

  const submit = async () => {
    const missing = items.filter((it) => {
      if (!it.is_required) return false;
      const r = responses[it.id];
      if (!r) return true;
      if (it.input_type === "photo") return !(r.response_photos?.length);
      if (it.input_type === "signature") return !r.response_signature;
      return !r.response_value;
    });
    if (missing.length) { toast.error(`${missing.length} required item(s) missing`); return; }
    if (!confirm("Submit checklist? You can still view it later.")) return;
    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("project_checklists" as any).update({
      status: "completed", completed_by: user?.id, completed_at: new Date().toISOString(), overall_notes: overallNotes || null,
    }).eq("id", pcId);
    setSubmitting(false);
    if (error) toast.error(error.message); else { toast.success("Submitted!"); setPc({ ...pc, status: "completed", completed_at: new Date().toISOString() }); }
  };

  const saveNotesNow = async () => {
    await supabase.from("project_checklists" as any).update({ overall_notes: overallNotes || null }).eq("id", pcId);
    setSavedAt(new Date()); toast.success("Notes saved");
  };

  const downloadPdf = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    await exportChecklistPdf({
      projectName: project?.name || "Project",
      templateTitle: template?.title || "Checklist",
      inspector: user?.email || "",
      completedAt: pc?.completed_at,
      overallNotes,
      items,
      responses: Object.values(responses).map((r) => ({
        item_id: r.item_id,
        response_value: r.response_value,
        response_photos: r.response_photos,
        response_signature: r.response_signature,
      })),
    });
  };

  if (loading) return <DashboardLayout><div className="text-center py-12 text-muted-foreground">Loading...</div></DashboardLayout>;

  return (
    <DashboardLayout>
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 max-w-3xl mx-auto pb-32">
        <Button variant="ghost" size="sm" onClick={() => nav(-1)} className="gap-1"><ArrowLeft className="w-4 h-4" /> Back</Button>

        <Card className="glass-heavy rounded-2xl p-5 sticky top-2 z-10">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{template?.title}</h1>
              <div className="text-sm text-muted-foreground">{project?.name}</div>
              <div className="flex items-center gap-2 mt-1">
                {completed && <Badge className="bg-emerald-500/15 text-emerald-600 border-0 gap-1"><CheckCircle2 className="w-3 h-3" /> Completed {pc.completed_at && format(new Date(pc.completed_at), "MMM d, yyyy")}</Badge>}
                {savedAt && !completed && <span className="text-[11px] text-muted-foreground">Saved {format(savedAt, "HH:mm:ss")}</span>}
              </div>
            </div>
            <Button size="sm" variant="outline" className="gap-1" onClick={downloadPdf}><Download className="w-4 h-4" /> PDF</Button>
          </div>
          <div className="mt-3">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">Completion</span>
              <span className="font-semibold text-primary">{completion}%</span>
            </div>
            <Progress value={completion} className="h-2" />
          </div>
        </Card>

        {items.map((it) => {
          const r = responses[it.id];
          return (
            <Card key={it.id} className="glass-card rounded-xl p-4 space-y-2">
              <div>
                <Label className="text-sm">
                  <span className="text-muted-foreground mr-1">#{it.item_number}</span>
                  {it.item_text}
                  {it.is_required && <span className="text-destructive ml-1">*</span>}
                </Label>
                {it.help_text && <p className="text-xs text-muted-foreground mt-0.5">{it.help_text}</p>}
              </div>

              {it.input_type === "checkbox" && (
                <div className="flex gap-4">
                  {["Yes", "No"].map((v) => (
                    <label key={v} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox disabled={completed} checked={r?.response_value === v} onCheckedChange={(c) => persist(it.id, { response_value: c ? v : null })} />
                      <span className="text-sm">{v}</span>
                    </label>
                  ))}
                </div>
              )}
              {it.input_type === "text" && <Input disabled={completed} value={r?.response_value || ""} onChange={(e) => persist(it.id, { response_value: e.target.value })} />}
              {it.input_type === "number" && <Input disabled={completed} type="number" value={r?.response_value || ""} onChange={(e) => persist(it.id, { response_value: e.target.value })} />}
              {it.input_type === "dropdown" && (
                <select disabled={completed} className="w-full h-10 rounded-md border bg-background px-3 text-sm" value={r?.response_value || ""} onChange={(e) => persist(it.id, { response_value: e.target.value })}>
                  <option value="">Select...</option>
                  {(it.dropdown_options || []).map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              )}
              {it.input_type === "photo" && (
                <div className="space-y-2">
                  {!completed && (
                    <label className="inline-flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer hover:bg-muted text-sm w-fit">
                      <Camera className="w-4 h-4" /> Add Photo
                      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto(it.id, f); e.target.value = ""; }} />
                    </label>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {(r?.response_photos || []).map((p) => (
                      <div key={p} className="relative w-20 h-20 rounded-md overflow-hidden border">
                        {signedPhotoUrls[p] && <img src={signedPhotoUrls[p]} className="w-full h-full object-cover" alt="" />}
                        {!completed && <button onClick={() => removePhoto(it.id, p)} className="absolute top-0 right-0 bg-destructive text-destructive-foreground rounded-bl p-0.5"><X className="w-3 h-3" /></button>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {it.input_type === "signature" && (
                <>
                  {completed && r?.response_signature && signedPhotoUrls[r.response_signature] ? (
                    <img src={signedPhotoUrls[r.response_signature]} className="border rounded h-32 bg-background" alt="Worker signature" />
                  ) : (
                    !completed && <SignaturePad initial={r?.response_signature} onChange={(d) => saveSignature(it.id, d)} />
                  )}
                </>
              )}
            </Card>
          );
        })}

        <Card className="glass-card rounded-xl p-4 space-y-2">
          <Label>Overall Notes / Comments</Label>
          <Textarea disabled={completed} value={overallNotes} onChange={(e) => setOverallNotes(e.target.value)} onBlur={saveNotesNow} rows={4} />
        </Card>

        {!completed && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex gap-2 glass-heavy rounded-full px-4 py-2 shadow-lg z-20">
            <Button size="sm" variant="outline" onClick={saveNotesNow} className="gap-1"><Save className="w-4 h-4" /> Save Draft</Button>
            <Button size="sm" onClick={submit} disabled={submitting} className="gap-1"><Send className="w-4 h-4" /> {submitting ? "Submitting..." : "Submit"}</Button>
          </div>
        )}
      </motion.div>
    </DashboardLayout>
  );
}