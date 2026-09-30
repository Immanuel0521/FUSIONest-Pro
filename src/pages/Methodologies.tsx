import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Download, Eye, Plus, Search, Trash2, FileText } from "lucide-react";
import { useMethodologies, getMethodologySignedUrl } from "@/hooks/useMethodologies";
import { useUserRole } from "@/hooks/useUserRole";
import { MethodologyUploadDialog } from "@/components/checklists/MethodologyUploadDialog";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { format } from "date-fns";

const CATEGORIES = ["all", "Foundation", "Structure", "Finishing", "MEP", "Safety", "General"];

export default function Methodologies({ embedded }: { embedded?: boolean } = {}) {
  const { items, loading, reload } = useMethodologies();
  const { role } = useUserRole();
  const isAdmin = role === "admin";
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("all");
  const [uploadOpen, setUploadOpen] = useState(false);

  const filtered = useMemo(() => items.filter((m) => {
    if (cat !== "all" && m.category !== cat) return false;
    if (search && !`${m.title} ${m.description || ""} ${m.category || ""}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [items, cat, search]);

  const view = async (path: string) => {
    const url = await getMethodologySignedUrl(path);
    if (url) window.open(url, "_blank");
  };

  const download = async (path: string, title: string) => {
    const url = await getMethodologySignedUrl(path);
    if (!url) return;
    const r = await fetch(url);
    const blob = await r.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${title}.pdf`;
    a.click();
  };

  const del = async (id: string, path: string) => {
    if (!confirm("Delete this methodology?")) return;
    await supabase.storage.from("methodologies").remove([path]);
    const { error } = await supabase.from("methodologies" as any).delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); reload(); }
  };

  const content = (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              <BookOpen className="w-6 h-6 text-primary" /> Methodologies
            </h1>
            <p className="text-sm text-muted-foreground">Construction work procedures and standards</p>
          </div>
          {isAdmin && <Button onClick={() => setUploadOpen(true)} className="gap-2"><Plus className="w-4 h-4" /> Upload</Button>}
        </div>

        <Card className="glass-card p-4 rounded-2xl">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search methodologies..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {CATEGORIES.map((c) => (
                <Button key={c} size="sm" variant={cat === c ? "default" : "outline"} onClick={() => setCat(c)} className="capitalize">
                  {c}
                </Button>
              ))}
            </div>
          </div>
        </Card>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : filtered.length === 0 ? (
          <Card className="glass-card p-12 text-center text-muted-foreground rounded-2xl">No methodologies found</Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((m) => (
              <Card key={m.id} className="glass-card rounded-2xl p-5 hover:shadow-lg transition-all">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-12 h-12 rounded-xl bg-primary/15 text-primary flex items-center justify-center"><FileText className="w-6 h-6" /></div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{m.title}</h3>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {m.category && <Badge variant="secondary" className="text-[10px]">{m.category}</Badge>}
                      {m.version && <Badge variant="outline" className="text-[10px]">v{m.version}</Badge>}
                    </div>
                  </div>
                </div>
                {m.description && <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{m.description}</p>}
                <div className="text-[11px] text-muted-foreground mb-3">
                  {format(new Date(m.upload_date), "MMM d, yyyy")}
                  {m.file_size != null && ` • ${(m.file_size / 1024 / 1024).toFixed(2)} MB`}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1 gap-1" onClick={() => view(m.file_path)}><Eye className="w-3.5 h-3.5" /> View</Button>
                  <Button size="sm" variant="outline" className="flex-1 gap-1" onClick={() => download(m.file_path, m.title)}><Download className="w-3.5 h-3.5" /> Get</Button>
                  {isAdmin && <Button size="sm" variant="outline" className="text-destructive" onClick={() => del(m.id, m.file_path)}><Trash2 className="w-3.5 h-3.5" /></Button>}
                </div>
              </Card>
            ))}
          </div>
        )}
      </motion.div>
  );

  if (embedded) {
    return (
      <>
        {content}
        {isAdmin && <MethodologyUploadDialog open={uploadOpen} onOpenChange={setUploadOpen} onSaved={reload} />}
      </>
    );
  }

  return (
    <DashboardLayout>
      {content}
      {isAdmin && <MethodologyUploadDialog open={uploadOpen} onOpenChange={setUploadOpen} onSaved={reload} />}
    </DashboardLayout>
  );
}