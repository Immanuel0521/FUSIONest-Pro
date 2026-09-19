import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Pencil, Trash2, MapPin, Calendar, User, DollarSign, FolderKanban, Activity, Image as ImgIcon, BarChart3, Users, ClipboardCheck, ClipboardList } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import type { Project } from "@/hooks/useProjects";
import { ProjectFormDialog } from "@/components/projects/ProjectFormDialog";
import { ProjectWorkersPanel } from "@/components/projects/ProjectWorkersPanel";
import { DailyActivityPanel } from "@/components/projects/DailyActivityPanel";
import { PhotoTimelinePanel } from "@/components/projects/PhotoTimelinePanel";
import { ProgressPanel } from "@/components/projects/ProgressPanel";
import { ProjectChecklistsPanel } from "@/components/checklists/ProjectChecklistsPanel";
import { DprPanel } from "@/components/projects/DprPanel";
import { STATUS_CLASS, STATUS_LABEL, daysRemaining, type ProjectStatus } from "@/lib/projectStatus";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { format } from "date-fns";

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { toast } = useToast();
  const [project, setProject] = useState<Project | null>(null);
  const [photoCount, setPhotoCount] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  const load = async () => {
    if (!id) return;
    const [{ data }, { count }] = await Promise.all([
      supabase.from("projects").select("*").eq("id", id).single(),
      supabase.from("project_photos" as any).select("id", { count: "exact", head: true }).eq("project_id", id),
    ]);
    setProject(data as any);
    setPhotoCount(count || 0);
  };

  useEffect(() => { load(); }, [id]);

  const del = async () => {
    if (!id) return;
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) toast({ variant: "destructive", title: "Failed", description: error.message });
    else { toast({ title: "Project deleted" }); nav("/projects"); }
  };

  if (!project) {
    return <DashboardLayout><div className="text-center py-12 text-muted-foreground">Loading...</div></DashboardLayout>;
  }

  const dr = daysRemaining(project.expected_end_date);
  const overdue = dr != null && dr < 0 && project.status !== "completed";

  return (
    <DashboardLayout>
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link to="/projects" className="flex items-center gap-1 hover:text-primary"><ArrowLeft className="w-4 h-4" /> Projects</Link>
          <span>/</span>
          <span className="text-foreground font-medium truncate">{project.name}</span>
        </div>

        <Card className="glass-card rounded-2xl p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center"><FolderKanban className="w-5 h-5 text-white" /></div>
                <div>
                  <h1 className="text-xl font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{project.name}</h1>
                  <Badge className={`${STATUS_CLASS[project.status as ProjectStatus]} border-0 text-[10px] mt-1`}>{STATUS_LABEL[project.status as ProjectStatus]}</Badge>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2 mt-3 text-xs text-muted-foreground">
                {project.client_name && <div className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" />{project.client_name}</div>}
                {project.location && <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{project.location}</div>}
                {project.project_manager && <div className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" />Mgr: {project.project_manager}</div>}
                {project.budget != null && <div className="flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5" />{Number(project.budget).toLocaleString()}</div>}
                {project.start_date && <div className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />Start: {format(new Date(project.start_date), "MMM d, yyyy")}</div>}
                {project.expected_end_date && (
                  <div className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /><span className={overdue ? "text-destructive font-semibold" : ""}>End: {format(new Date(project.expected_end_date), "MMM d, yyyy")} {dr != null && (overdue ? `(${Math.abs(dr)}d overdue)` : `(${dr}d left)`)}</span></div>
                )}
              </div>
              {project.description && <p className="text-sm mt-3 text-muted-foreground">{project.description}</p>}
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Overall Progress</span>
                  <span className="font-bold text-primary">{project.completion_percentage || 0}%</span>
                </div>
                <Progress value={project.completion_percentage || 0} className="h-2" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditOpen(true)} className="gap-2"><Pencil className="w-4 h-4" /> Edit</Button>
              <Button variant="outline" aria-label="Delete project" className="text-destructive" onClick={() => setConfirmDel(true)}><Trash2 className="w-4 h-4" /></Button>
            </div>
          </div>
        </Card>

        <Tabs defaultValue="overview">
          <TabsList className="glass-card p-1 h-11">
            <TabsTrigger value="overview" className="gap-2 px-4"><FolderKanban className="w-4 h-4" /> Overview</TabsTrigger>
            <TabsTrigger value="activities" className="gap-2 px-4"><Activity className="w-4 h-4" /> Activities</TabsTrigger>
            <TabsTrigger value="photos" className="gap-2 px-4"><ImgIcon className="w-4 h-4" /> Photos {photoCount > 0 && <Badge variant="secondary" className="ml-1 h-5 text-[10px]">{photoCount}</Badge>}</TabsTrigger>
            <TabsTrigger value="progress" className="gap-2 px-4"><BarChart3 className="w-4 h-4" /> Progress</TabsTrigger>
            <TabsTrigger value="checklists" className="gap-2 px-4"><ClipboardCheck className="w-4 h-4" /> Checklists</TabsTrigger>
            <TabsTrigger value="dpr" className="gap-2 px-4"><ClipboardList className="w-4 h-4" /> Site Operations</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-5">
            <ProjectWorkersPanel projectId={project.id} />
          </TabsContent>
          <TabsContent value="activities" className="mt-5">
            <DailyActivityPanel projectId={project.id} />
          </TabsContent>
          <TabsContent value="photos" className="mt-5">
            <PhotoTimelinePanel projectId={project.id} />
          </TabsContent>
          <TabsContent value="progress" className="mt-5">
            <ProgressPanel project={project} reload={load} />
          </TabsContent>
          <TabsContent value="checklists" className="mt-5">
            <ProjectChecklistsPanel projectId={project.id} />
          </TabsContent>
          <TabsContent value="dpr" className="mt-5">
            <DprPanel projectId={project.id} />
          </TabsContent>
        </Tabs>
      </motion.div>

      <ProjectFormDialog open={editOpen} onOpenChange={setEditOpen} project={project} onSaved={load} />

      <AlertDialog open={confirmDel} onOpenChange={setConfirmDel}>
        <AlertDialogContent className="glass-heavy">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project?</AlertDialogTitle>
            <AlertDialogDescription>This permanently removes the project and its associated data.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={del} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
