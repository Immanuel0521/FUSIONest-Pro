import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/lib/supabase";
import { ChevronDown, ChevronRight, FolderKanban, Users, Camera, ClipboardCheck, Activity, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface SupervisorRow {
  id: string;
  email: string;
  created_at: string;
  role: string | null;
  projectCount: number;
  workerCount: number;
}

interface ProjectDetail {
  id: string;
  name: string;
  client_name: string | null;
  location: string | null;
  status: string;
  start_date: string | null;
  expected_end_date: string | null;
  completion_percentage: number | null;
  workerCount: number;
  activityCount: number;
  photoCount: number;
  checklistCount: number;
  checklistDone: number;
}

export const SupervisorsOverview = () => {
  const [rows, setRows] = useState<SupervisorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [projects, setProjects] = useState<Record<string, ProjectDetail[]>>({});
  const [loadingProjects, setLoadingProjects] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const [{ data: users }, { data: roles }, { data: projs }, { data: wks }] = await Promise.all([
      supabase.rpc("get_all_supervisors"),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("projects").select("id, supervisor_id"),
      supabase.from("workers").select("id, supervisor_id"),
    ]);

    const roleMap: Record<string, string> = {};
    (roles || []).forEach((r: any) => {
      // Prefer admin > management > supervisor > viewer
      const rank = { admin: 4, management: 3, supervisor: 2, viewer: 1 } as Record<string, number>;
      if (!roleMap[r.user_id] || (rank[r.role] || 0) > (rank[roleMap[r.user_id]] || 0)) {
        roleMap[r.user_id] = r.role;
      }
    });
    const projCount: Record<string, number> = {};
    (projs || []).forEach((p: any) => { projCount[p.supervisor_id] = (projCount[p.supervisor_id] || 0) + 1; });
    const workerCount: Record<string, number> = {};
    (wks || []).forEach((w: any) => { workerCount[w.supervisor_id] = (workerCount[w.supervisor_id] || 0) + 1; });

    const out: SupervisorRow[] = (users || [])
      .map((u: any) => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        role: roleMap[u.id] || null,
        projectCount: projCount[u.id] || 0,
        workerCount: workerCount[u.id] || 0,
      }))
      .sort((a, b) => b.projectCount - a.projectCount);
    setRows(out);
    setLoading(false);
  };

  const loadProjects = async (supervisorId: string) => {
    if (projects[supervisorId]) return;
    setLoadingProjects(supervisorId);
    const { data: projs } = await supabase
      .from("projects")
      .select("id, name, client_name, location, status, start_date, expected_end_date, completion_percentage")
      .eq("supervisor_id", supervisorId)
      .order("created_at", { ascending: false });

    const ids = (projs || []).map((p) => p.id);
    let details: ProjectDetail[] = (projs || []).map((p: any) => ({
      ...p,
      workerCount: 0, activityCount: 0, photoCount: 0, checklistCount: 0, checklistDone: 0,
    }));

    if (ids.length) {
      const [{ data: pw }, { data: acts }, { data: photos }, { data: pcs }] = await Promise.all([
        supabase.from("project_workers" as any).select("project_id").in("project_id", ids),
        supabase.from("daily_activities").select("id, project_id").in("project_id", ids),
        supabase.from("project_photos" as any).select("project_id").in("project_id", ids),
        supabase.from("project_checklists" as any).select("project_id, status").in("project_id", ids),
      ]);
      const inc = (m: Record<string, number>, k: string) => { m[k] = (m[k] || 0) + 1; };
      const wm: Record<string, number> = {}, am: Record<string, number> = {}, phm: Record<string, number> = {}, cm: Record<string, number> = {}, cdm: Record<string, number> = {};
      (pw || []).forEach((r: any) => inc(wm, r.project_id));
      (acts || []).forEach((r: any) => inc(am, r.project_id));
      (photos || []).forEach((r: any) => inc(phm, r.project_id));
      (pcs || []).forEach((r: any) => { inc(cm, r.project_id); if (r.status === "completed") inc(cdm, r.project_id); });
      details = details.map((d) => ({
        ...d,
        workerCount: wm[d.id] || 0,
        activityCount: am[d.id] || 0,
        photoCount: phm[d.id] || 0,
        checklistCount: cm[d.id] || 0,
        checklistDone: cdm[d.id] || 0,
      }));
    }
    setProjects((prev) => ({ ...prev, [supervisorId]: details }));
    setLoadingProjects(null);
  };

  const toggle = (id: string) => {
    const next = openId === id ? null : id;
    setOpenId(next);
    if (next) loadProjects(next);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-3">
      {rows.length === 0 && (
        <div className="text-center py-10 text-muted-foreground text-sm">No supervisors signed up yet.</div>
      )}
      {rows.map((s) => {
        const isOpen = openId === s.id;
        const list = projects[s.id] || [];
        return (
          <Collapsible key={s.id} open={isOpen} onOpenChange={() => toggle(s.id)}>
            <Card className="glass-card border-primary/10 overflow-hidden">
              <CollapsibleTrigger asChild>
                <button className="w-full text-left p-4 hover:bg-primary/5 transition-colors flex items-center gap-4">
                  {isOpen ? <ChevronDown className="w-4 h-4 shrink-0 text-primary" /> : <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold truncate">{s.email}</span>
                      {s.role && (
                        <Badge variant="secondary" className={`text-[10px] ${
                          s.role === "admin" ? "bg-destructive/15 text-destructive" :
                          s.role === "management" ? "bg-accent/20 text-accent" :
                          s.role === "supervisor" ? "bg-primary/15 text-primary" :
                          "bg-muted text-muted-foreground"
                        }`}>{s.role}</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Joined {format(new Date(s.created_at), "MMM d, yyyy")}
                    </div>
                  </div>
                  <div className="hidden sm:flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-1 text-primary"><FolderKanban className="w-3.5 h-3.5" /> {s.projectCount} projects</div>
                    <div className="flex items-center gap-1 text-accent"><Users className="w-3.5 h-3.5" /> {s.workerCount} workers</div>
                  </div>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-4 pb-4 pt-0 border-t border-border/40">
                  {loadingProjects === s.id ? (
                    <div className="flex items-center justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-primary" /></div>
                  ) : list.length === 0 ? (
                    <div className="text-center py-6 text-sm text-muted-foreground">No projects created.</div>
                  ) : (
                    <div className="space-y-2 mt-3">
                      {list.map((p) => (
                        <Card key={p.id} className="p-3 bg-card/40 border-primary/10">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-semibold text-sm">{p.name}</h4>
                                <Badge variant="outline" className="text-[10px] capitalize">{p.status?.replace("_", " ")}</Badge>
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                {p.client_name && <>Client: {p.client_name} • </>}
                                {p.location && <>📍 {p.location} • </>}
                                {p.start_date && <>Start {format(new Date(p.start_date), "MMM d, yyyy")}</>}
                                {p.expected_end_date && <> • Due {format(new Date(p.expected_end_date), "MMM d, yyyy")}</>}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-bold text-primary">{p.completion_percentage ?? 0}%</div>
                              <div className="text-[10px] text-muted-foreground">complete</div>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                            <Stat icon={<Users className="w-3.5 h-3.5" />} label="Workers" value={p.workerCount} />
                            <Stat icon={<Activity className="w-3.5 h-3.5" />} label="Activities" value={p.activityCount} />
                            <Stat icon={<Camera className="w-3.5 h-3.5" />} label="Photos" value={p.photoCount} />
                            <Stat icon={<ClipboardCheck className="w-3.5 h-3.5" />} label="Checklists" value={`${p.checklistDone}/${p.checklistCount}`} />
                          </div>
                          <div className="mt-3 flex justify-end">
                            <Button asChild size="sm" variant="outline" className="h-7 text-xs">
                              <a href={`/projects/${p.id}`}>View Project</a>
                            </Button>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        );
      })}
    </div>
  );
};

const Stat = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) => (
  <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-primary/5">
    <div className="text-primary">{icon}</div>
    <div className="min-w-0">
      <div className="text-xs font-semibold">{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  </div>
);