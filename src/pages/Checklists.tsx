import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ClipboardCheck, Plus, Search, Pencil, Trash2, FileText, ListChecks, Sparkles } from "lucide-react";
import { useChecklistTemplates, STAGE_LABEL, ChecklistStage } from "@/hooks/useChecklistTemplates";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { ImportChecklistDialog } from "@/components/checklists/ImportChecklistDialog";

const STAGES: (ChecklistStage | "all")[] = ["all", "pre_work", "during_work", "post_work", "quality_check", "safety_inspection"];

export default function Checklists() {
  const { templates, loading, reload } = useChecklistTemplates();
  const { role } = useUserRole();
  const isAdmin = role === "admin";
  const nav = useNavigate();
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState<string>("all");
  const [importOpen, setImportOpen] = useState(false);

  const filtered = useMemo(() => templates.filter((t) => {
    if (stage !== "all" && t.stage !== stage) return false;
    if (search && !`${t.title} ${t.description || ""} ${t.category || ""}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [templates, stage, search]);

  const del = async (id: string) => {
    if (!confirm("Delete this checklist template?")) return;
    const { error } = await supabase.from("checklist_templates" as any).delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); reload(); }
  };

  return (
    <DashboardLayout>
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              <ClipboardCheck className="w-6 h-6 text-primary" /> Checklists
            </h1>
            <p className="text-sm text-muted-foreground">Quality, safety and compliance checklists</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild><Link to="/my-checklists" className="gap-2"><ListChecks className="w-4 h-4" /> My Checklists</Link></Button>
            {isAdmin && (
              <>
                <Button variant="outline" onClick={() => setImportOpen(true)} className="gap-2"><Sparkles className="w-4 h-4" /> Import</Button>
                <Button onClick={() => nav("/checklists/new")} className="gap-2"><Plus className="w-4 h-4" /> Create</Button>
              </>
            )}
          </div>
        </div>

        <Card className="glass-card p-4 rounded-2xl">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search templates..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {STAGES.map((s) => (
                <Button key={s} size="sm" variant={stage === s ? "default" : "outline"} onClick={() => setStage(s)}>
                  {s === "all" ? "All" : STAGE_LABEL[s as ChecklistStage]}
                </Button>
              ))}
            </div>
          </div>
        </Card>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : filtered.length === 0 ? (
          <Card className="glass-card p-12 text-center text-muted-foreground rounded-2xl">No checklists found</Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((t) => (
              <Card key={t.id} className="glass-card rounded-2xl p-5 hover:shadow-lg transition-all">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-12 h-12 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
                    {t.checklist_type === "interactive" ? <ListChecks className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{t.title}</h3>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      <Badge variant="outline" className="text-[10px]">{t.checklist_type === "interactive" ? "Interactive" : "PDF"}</Badge>
                      {t.category && <Badge variant="secondary" className="text-[10px]">{t.category}</Badge>}
                      {t.stage && <Badge variant="secondary" className="text-[10px]">{STAGE_LABEL[t.stage]}</Badge>}
                    </div>
                  </div>
                </div>
                {t.description && <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{t.description}</p>}
                {isAdmin && (
                  <div className="flex gap-2">
                    {t.checklist_type === "interactive" && (
                      <Button size="sm" variant="outline" className="flex-1 gap-1" onClick={() => nav(`/checklists/${t.id}/edit`)}><Pencil className="w-3.5 h-3.5" /> Edit</Button>
                    )}
                    <Button size="sm" variant="outline" className="text-destructive" onClick={() => del(t.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}

        <ImportChecklistDialog open={importOpen} onOpenChange={setImportOpen} onSaved={reload} />
      </motion.div>
    </DashboardLayout>
  );
}