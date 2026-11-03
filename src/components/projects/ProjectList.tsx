import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Plus, FolderKanban, MapPin, Calendar, Trash2, Pencil, Users, Search, Eye } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProjects, type Project } from "@/hooks/useProjects";
import { ProjectFormDialog } from "./ProjectFormDialog";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { STATUS_CLASS, STATUS_LABEL, daysRemaining, type ProjectStatus } from "@/lib/projectStatus";

export const ProjectList = () => {
  const { projects, loading, reload } = useProjects();
  const [editing, setEditing] = useState<Project | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Project | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [managerFilter, setManagerFilter] = useState<string>("all");
  const { toast } = useToast();

  const managers = useMemo(
    () => Array.from(new Set(projects.map((p) => p.project_manager).filter(Boolean) as string[])),
    [projects]
  );

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (managerFilter !== "all" && p.project_manager !== managerFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${p.name} ${p.client_name || ""} ${p.location || ""} ${p.project_manager || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [projects, search, statusFilter, managerFilter]);

  const handleDelete = async () => {
    if (!confirmDelete) return;
    const { error } = await supabase.from("projects").delete().eq("id", confirmDelete.id);
    if (error) toast({ variant: "destructive", title: "Cannot delete", description: error.message });
    else { toast({ title: "Project deleted" }); reload(); }
    setConfirmDelete(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search projects..." className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="not_started">Not Started</SelectItem>
            <SelectItem value="active">In Progress</SelectItem>
            <SelectItem value="on_hold">On Hold</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        {managers.length > 0 && (
          <Select value={managerFilter} onValueChange={setManagerFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Managers</SelectItem>
              {managers.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }} className="gap-2">
          <Plus className="w-4 h-4" /> New Project
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : filtered.length === 0 ? (
        <Card className="glass-card p-10 text-center">
          <FolderKanban className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground">{projects.length === 0 ? "No projects yet. Create your first one." : "No projects match your filters."}</p>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p, i) => {
            const dr = daysRemaining(p.expected_end_date);
            const overdue = dr != null && dr < 0 && p.status !== "completed" && p.status !== "cancelled";
            return (
              <motion.div key={p.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <Card className="glass-card rounded-2xl p-5 hover-lift h-full flex flex-col">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-base truncate" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{p.name}</h3>
                      {p.client_name && <p className="text-xs text-muted-foreground truncate">{p.client_name}</p>}
                    </div>
                    <Badge className={`${STATUS_CLASS[p.status as ProjectStatus]} border-0 text-[10px]`}>
                      {STATUS_LABEL[p.status as ProjectStatus]}
                    </Badge>
                  </div>

                  <div className="space-y-1.5 text-xs text-muted-foreground mb-3">
                    {p.location && <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /><span className="truncate">{p.location}</span></div>}
                    {p.expected_end_date && (
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        <span className={overdue ? "text-destructive font-semibold" : ""}>
                          {overdue ? `${Math.abs(dr!)} days overdue` : dr != null ? `${dr} days remaining` : format(new Date(p.expected_end_date), "MMM d, yyyy")}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /><span>{p.workerCount || 0} workers · {p.activityCount || 0} activities</span></div>
                  </div>

                  <div className="mt-auto space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-bold text-primary">{p.progress || 0}%</span>
                    </div>
                    <Progress value={p.progress || 0} className="h-1.5" />
                    <div className="flex gap-2 pt-2">
                      <Link to={`/projects/${p.id}`} className="flex-1">
                        <Button size="sm" variant="default" className="w-full h-8 gap-1"><Eye className="w-3.5 h-3.5" /> Open</Button>
                      </Link>
                      <Button size="sm" variant="ghost" className="h-8" onClick={() => { setEditing(p); setDialogOpen(true); }}><Pencil className="w-3.5 h-3.5" /></Button>
                      <Button size="sm" variant="ghost" className="h-8 text-destructive hover:text-destructive" onClick={() => setConfirmDelete(p)}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      <ProjectFormDialog open={dialogOpen} onOpenChange={setDialogOpen} project={editing} onSaved={reload} />

      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent className="glass-heavy">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove "{confirmDelete?.name}" and its workers, milestones, photos, and progress history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
