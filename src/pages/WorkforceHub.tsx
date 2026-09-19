import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { MapPin, Users2, Layers, Plus, ArrowRightLeft, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";

type Project = { id: string; name: string };
type Site = { id: string; project_id: string; name: string; location: string | null; status: string };
type Group = { id: string; site_id: string; name: string; trade: string | null; status: string };
type Worker = {
  id: string;
  name: string;
  role: string | null;
  current_group_id: string | null;
  supervisor_id?: string | null;
  supervisor_email?: string | null;
  current_group_name?: string | null;
  current_site_name?: string | null;
};

export default function WorkforceHub() {
  const { toast } = useToast();
  const { role } = useUserRole();
  const isAdmin = role === "admin" || role === "management";

  const [projects, setProjects] = useState<Project[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);

  // selections
  const [selProject, setSelProject] = useState<string>("");
  const [selSite, setSelSite] = useState<string>("");
  const [selGroup, setSelGroup] = useState<string>("");

  // dialogs
  const [siteOpen, setSiteOpen] = useState(false);
  const [siteForm, setSiteForm] = useState({ name: "", location: "" });
  const [groupOpen, setGroupOpen] = useState(false);
  const [groupForm, setGroupForm] = useState({ name: "", trade: "" });
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferWorker, setTransferWorker] = useState<string>("");
  const [transferTarget, setTransferTarget] = useState<string>("");
  const [transferReason, setTransferReason] = useState<string>("");

  // deployment
  const [selectedWorkers, setSelectedWorkers] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadAll();
    // re-load when admin role resolves so we switch to RPC
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const loadAll = async () => {
    const [p, s, g] = await Promise.all([
      supabase.from("projects").select("id, name").order("name"),
      (supabase.from("sites") as any).select("*").order("created_at", { ascending: false }),
      (supabase.from("worker_groups") as any).select("*").order("created_at", { ascending: false }),
    ]);
    setProjects((p.data as any) || []);
    setSites((s.data as any) || []);
    setGroups((g.data as any) || []);

    // Admin / management: use SECURITY DEFINER RPC so they see every worker across all supervisors.
    if (isAdmin) {
      const { data, error } = await (supabase.rpc as any)("admin_list_workers_for_deployment");
      if (!error && data) {
        setWorkers(
          (data as any[]).map((r) => ({
            id: r.id,
            name: r.full_name,
            role: r.designation,
            current_group_id: r.current_group_id,
            supervisor_id: r.supervisor_id,
            supervisor_email: r.supervisor_email,
            current_group_name: r.current_group_name,
            current_site_name: r.current_site_name,
          }))
        );
        return;
      }
    }
    // Supervisors fall back to RLS-scoped query
    const { data: w } = await supabase
      .from("workers")
      .select("id, name:full_name, role:designation, current_group_id, supervisor_id")
      .order("full_name");
    setWorkers((w as any) || []);
  };

  const filteredSites = selProject ? sites.filter((s) => s.project_id === selProject) : sites;
  const filteredGroups = selSite ? groups.filter((g) => g.site_id === selSite) : groups;
  const groupMembers = selGroup ? workers.filter((w) => w.current_group_id === selGroup) : [];
  const unassignedWorkers = workers.filter((w) => !w.current_group_id);

  const createSite = async () => {
    if (!selProject || !siteForm.name) {
      toast({ variant: "destructive", title: "Project & name required" });
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await (supabase.from("sites") as any).insert({
      project_id: selProject,
      name: siteForm.name,
      location: siteForm.location || null,
      created_by: user?.id,
    });
    if (error) return toast({ variant: "destructive", title: "Error", description: error.message });
    toast({ title: "Site created" });
    setSiteOpen(false);
    setSiteForm({ name: "", location: "" });
    loadAll();
  };

  const createGroup = async () => {
    if (!selSite || !groupForm.name) {
      toast({ variant: "destructive", title: "Site & name required" });
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await (supabase.from("worker_groups") as any).insert({
      site_id: selSite,
      name: groupForm.name,
      trade: groupForm.trade || null,
      created_by: user?.id,
    });
    if (error) return toast({ variant: "destructive", title: "Error", description: error.message });
    toast({ title: "Group created" });
    setGroupOpen(false);
    setGroupForm({ name: "", trade: "" });
    loadAll();
  };

  const deleteSite = async (id: string) => {
    if (!confirm("Delete this site and all its groups?")) return;
    const { error } = await (supabase.from("sites") as any).delete().eq("id", id);
    if (error) return toast({ variant: "destructive", title: "Error", description: error.message });
    toast({ title: "Site deleted" });
    loadAll();
  };

  const deleteGroup = async (id: string) => {
    if (!confirm("Delete this group?")) return;
    const { error } = await (supabase.from("worker_groups") as any).delete().eq("id", id);
    if (error) return toast({ variant: "destructive", title: "Error", description: error.message });
    toast({ title: "Group deleted" });
    loadAll();
  };

  const saveDeployment = async () => {
    if (!selProject || !selSite || !selGroup) {
      toast({ variant: "destructive", title: "Pick project, site, and group" });
      return;
    }
    const ids = Object.keys(selectedWorkers).filter((id) => selectedWorkers[id]);
    if (ids.length === 0) {
      toast({ variant: "destructive", title: "Select at least one worker" });
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    // Transfer each worker into this group (function handles single-active-membership + history)
    for (const wid of ids) {
      const { error } = await (supabase.rpc as any)("transfer_worker_to_group", {
        p_worker_id: wid,
        p_to_group_id: selGroup,
        p_reason: "Workforce deployment",
      });
      if (error) {
        toast({ variant: "destructive", title: "Error", description: error.message });
        return;
      }
    }
    // Record deployment
    await (supabase.from("deployments") as any).insert({
      project_id: selProject,
      site_id: selSite,
      group_id: selGroup,
      worker_ids: ids,
      created_by: user?.id,
    });
    toast({ title: `Deployed ${ids.length} workers` });
    setSelectedWorkers({});
    loadAll();
  };

  const transferWorkerNow = async () => {
    if (!transferWorker || !transferTarget) {
      toast({ variant: "destructive", title: "Worker & target group required" });
      return;
    }
    const { error } = await (supabase.rpc as any)("transfer_worker_to_group", {
      p_worker_id: transferWorker,
      p_to_group_id: transferTarget,
      p_reason: transferReason || null,
    });
    if (error) return toast({ variant: "destructive", title: "Error", description: error.message });
    toast({ title: "Worker transferred" });
    setTransferOpen(false);
    setTransferWorker("");
    setTransferTarget("");
    setTransferReason("");
    loadAll();
  };

  return (
    <DashboardLayout>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
            <Layers className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
              Workforce Deployment
            </h1>
            <p className="text-sm text-muted-foreground">Sites · Groups · Worker assignment</p>
          </div>
        </div>

        <Tabs defaultValue="sites" className="w-full">
          <TabsList className="glass-card p-1 border border-primary/10 h-12">
            <TabsTrigger value="sites" className="px-6 gap-2"><MapPin className="w-4 h-4" />Sites</TabsTrigger>
            <TabsTrigger value="groups" className="px-6 gap-2"><Users2 className="w-4 h-4" />Groups</TabsTrigger>
            <TabsTrigger value="deploy" className="px-6 gap-2"><Layers className="w-4 h-4" />Deployment</TabsTrigger>
            <TabsTrigger value="transfers" className="px-6 gap-2"><ArrowRightLeft className="w-4 h-4" />Transfers</TabsTrigger>
          </TabsList>

          {/* SITES */}
          <TabsContent value="sites" className="mt-6 space-y-4">
            <Card className="glass-card">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Sites</CardTitle>
                <div className="flex items-center gap-2">
                  <Select value={selProject} onValueChange={setSelProject}>
                    <SelectTrigger className="w-56"><SelectValue placeholder="Filter by project" /></SelectTrigger>
                    <SelectContent>
                      {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {isAdmin && (
                    <Dialog open={siteOpen} onOpenChange={setSiteOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm"><Plus className="w-4 h-4 mr-1" />New Site</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>Create Site</DialogTitle></DialogHeader>
                        <div className="space-y-3">
                          <div><Label>Project</Label>
                            <Select value={selProject} onValueChange={setSelProject}>
                              <SelectTrigger><SelectValue placeholder="Pick project" /></SelectTrigger>
                              <SelectContent>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <div><Label>Name</Label><Input value={siteForm.name} onChange={(e) => setSiteForm({ ...siteForm, name: e.target.value })} placeholder="Site A" /></div>
                          <div><Label>Location</Label><Input value={siteForm.location} onChange={(e) => setSiteForm({ ...siteForm, location: e.target.value })} placeholder="Address" /></div>
                        </div>
                        <DialogFooter><Button onClick={createSite}>Create</Button></DialogFooter>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </CardHeader>
              <CardContent className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredSites.map((s) => (
                  <Card key={s.id} className="glass-card hover:shadow-lg transition-all cursor-pointer" onClick={() => setSelSite(s.id)}>
                    <CardContent className="p-4 flex items-start justify-between">
                      <div>
                        <div className="font-semibold">{s.name}</div>
                        <div className="text-xs text-muted-foreground">{s.location || "—"}</div>
                        <Badge variant="secondary" className="mt-2 text-[10px]">{s.status}</Badge>
                      </div>
                      {isAdmin && (
                        <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); deleteSite(s.id); }}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
                {filteredSites.length === 0 && <p className="text-sm text-muted-foreground col-span-full">No sites yet.</p>}
              </CardContent>
            </Card>
          </TabsContent>

          {/* GROUPS */}
          <TabsContent value="groups" className="mt-6 space-y-4">
            <Card className="glass-card">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Groups / Teams</CardTitle>
                <div className="flex items-center gap-2">
                  <Select value={selSite} onValueChange={setSelSite}>
                    <SelectTrigger className="w-56"><SelectValue placeholder="Filter by site" /></SelectTrigger>
                    <SelectContent>
                      {sites.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {isAdmin && (
                    <Dialog open={groupOpen} onOpenChange={setGroupOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm"><Plus className="w-4 h-4 mr-1" />New Group</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>Create Group</DialogTitle></DialogHeader>
                        <div className="space-y-3">
                          <div><Label>Site</Label>
                            <Select value={selSite} onValueChange={setSelSite}>
                              <SelectTrigger><SelectValue placeholder="Pick site" /></SelectTrigger>
                              <SelectContent>{sites.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <div><Label>Name</Label><Input value={groupForm.name} onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })} placeholder="Roofing Team" /></div>
                          <div><Label>Trade</Label><Input value={groupForm.trade} onChange={(e) => setGroupForm({ ...groupForm, trade: e.target.value })} placeholder="Roofing, Mason, Electrical…" /></div>
                        </div>
                        <DialogFooter><Button onClick={createGroup}>Create</Button></DialogFooter>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </CardHeader>
              <CardContent className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredGroups.map((g) => {
                  const count = workers.filter((w) => w.current_group_id === g.id).length;
                  return (
                    <Card key={g.id} className="glass-card hover:shadow-lg transition-all cursor-pointer" onClick={() => setSelGroup(g.id)}>
                      <CardContent className="p-4 flex items-start justify-between">
                        <div>
                          <div className="font-semibold">{g.name}</div>
                          <div className="text-xs text-muted-foreground">{g.trade || "—"}</div>
                          <div className="text-xs mt-2"><Badge variant="secondary">{count} workers</Badge></div>
                        </div>
                        {isAdmin && (
                          <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); deleteGroup(g.id); }}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
                {filteredGroups.length === 0 && <p className="text-sm text-muted-foreground col-span-full">No groups yet.</p>}
              </CardContent>
            </Card>

            {selGroup && (
              <Card className="glass-card">
                <CardHeader><CardTitle>Members of {groups.find(g => g.id === selGroup)?.name}</CardTitle></CardHeader>
                <CardContent>
                  {groupMembers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No workers in this group.</p>
                  ) : (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {groupMembers.map((w) => (
                        <div key={w.id} className="glass-card p-3 rounded-xl flex items-center justify-between">
                          <div>
                            <div className="font-medium text-sm">{w.name}</div>
                            <div className="text-xs text-muted-foreground">{w.role || "—"}</div>
                          </div>
                          <Button size="sm" variant="ghost" onClick={() => { setTransferWorker(w.id); setTransferOpen(true); }}>
                            <ArrowRightLeft className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* DEPLOYMENT */}
          <TabsContent value="deploy" className="mt-6 space-y-4">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Add Members to a Group</CardTitle>
                <p className="text-sm text-muted-foreground">Pick a site, pick a group, then tick the workers you want to add.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <Label>Site</Label>
                    <Select value={selSite} onValueChange={(v) => {
                      setSelSite(v); setSelGroup("");
                      const site = sites.find(s => s.id === v);
                      if (site) setSelProject(site.project_id);
                    }}>
                      <SelectTrigger><SelectValue placeholder="Pick a site" /></SelectTrigger>
                      <SelectContent>
                        {sites.map((s) => {
                          const proj = projects.find(p => p.id === s.project_id);
                          return <SelectItem key={s.id} value={s.id}>{s.name}{proj ? ` · ${proj.name}` : ""}</SelectItem>;
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Group</Label>
                    <Select value={selGroup} onValueChange={setSelGroup} disabled={!selSite}>
                      <SelectTrigger><SelectValue placeholder={selSite ? "Pick a group" : "Pick a site first"} /></SelectTrigger>
                      <SelectContent>{filteredGroups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>

                {selGroup && (
                  <>
                    <div className="flex items-center justify-between pt-2">
                      <div className="text-sm font-medium">
                        Workers ({workers.length}) · Selected {Object.values(selectedWorkers).filter(Boolean).length}
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => {
                          const all: Record<string, boolean> = {};
                          workers.filter(w => w.current_group_id !== selGroup).forEach(w => { all[w.id] = true; });
                          setSelectedWorkers(all);
                        }}>Select all</Button>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedWorkers({})}>Clear</Button>
                        <Button onClick={saveDeployment}>Add to Group</Button>
                      </div>
                    </div>
                    {workers.length === 0 ? (
                      <div className="glass-card p-6 rounded-xl text-center text-sm text-muted-foreground">
                        No workers found. Add workers in the Workforce page first.
                      </div>
                    ) : (
                      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[440px] overflow-y-auto">
                        {workers.map((w) => {
                          const inThis = w.current_group_id === selGroup;
                          const inOther = w.current_group_id && !inThis;
                          const otherGroup = inOther ? groups.find(g => g.id === w.current_group_id)?.name : null;
                          return (
                            <label key={w.id} className={`glass-card p-3 rounded-xl flex items-center gap-3 cursor-pointer hover:bg-primary/5 ${inThis ? "opacity-60" : ""}`}>
                              <Checkbox
                                checked={!!selectedWorkers[w.id] || inThis}
                                disabled={inThis}
                                onCheckedChange={(c) => setSelectedWorkers({ ...selectedWorkers, [w.id]: !!c })}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate">{w.name}</div>
                                <div className="text-xs text-muted-foreground truncate">
                                  {w.role || "—"}
                                  {inThis && <span className="ml-2 text-emerald-600">· Already in group</span>}
                                  {inOther && <span className="ml-2 text-amber-600">· In {otherGroup || "another group"}</span>}
                                </div>
                                {isAdmin && w.supervisor_email && (
                                  <div className="text-[10px] text-muted-foreground/80 truncate mt-0.5">
                                    Sup: {w.supervisor_email}
                                  </div>
                                )}
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {unassignedWorkers.length > 0 && (
              <Card className="glass-card">
                <CardHeader><CardTitle>Unassigned Workers ({unassignedWorkers.length})</CardTitle></CardHeader>
                <CardContent className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {unassignedWorkers.map((w) => (
                    <div key={w.id} className="glass-card p-3 rounded-xl text-sm">{w.name}</div>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* TRANSFERS */}
          <TabsContent value="transfers" className="mt-6 space-y-4">
            <Card className="glass-card">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Transfer Worker</CardTitle>
                <Button onClick={() => setTransferOpen(true)}><ArrowRightLeft className="w-4 h-4 mr-1" />New Transfer</Button>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Move a worker to a different group. The previous assignment is preserved permanently in transfer history.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Transfer dialog (shared) */}
        <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Transfer Worker</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Worker</Label>
                <Select value={transferWorker} onValueChange={setTransferWorker}>
                  <SelectTrigger><SelectValue placeholder="Pick worker" /></SelectTrigger>
                  <SelectContent>{workers.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Target Group</Label>
                <Select value={transferTarget} onValueChange={setTransferTarget}>
                  <SelectTrigger><SelectValue placeholder="Pick group" /></SelectTrigger>
                  <SelectContent>{groups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Reason (optional)</Label><Input value={transferReason} onChange={(e) => setTransferReason(e.target.value)} /></div>
            </div>
            <DialogFooter><Button onClick={transferWorkerNow}>Transfer</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </motion.div>
    </DashboardLayout>
  );
}