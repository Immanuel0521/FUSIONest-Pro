import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Users2, LogIn, LogOut, UserPlus, Edit3, ArrowRightLeft } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import { unifiedCheckIn, unifiedCheckOut } from "@/lib/attendanceService";

type Site = { id: string; project_id: string; name: string };
type Group = { id: string; site_id: string; name: string; trade: string | null };
type Worker = { id: string; name: string; role: string | null; current_group_id: string | null; supervisor_id: string };
type AttendanceRow = {
  id: string;
  worker_id: string;
  group_id: string | null;
  time_in: string | null;
  time_out: string | null;
  status: string;
  checkin_source: string | null;
  checkout_source: string | null;
  is_late: boolean | null;
  overtime_hours: number | null;
};

function toDateOnDay(time: string, day: string) {
  // time = "HH:MM", day = "YYYY-MM-DD"
  const [h, m] = time.split(":").map(Number);
  const [y, mo, d] = day.split("-").map(Number);
  const dt = new Date();
  dt.setFullYear(y, (mo || 1) - 1, d || 1);
  dt.setHours(h || 0, m || 0, 0, 0);
  return dt;
}

const todayStr = () => new Date().toISOString().split("T")[0];

export default function GroupAttendance() {
  const { toast } = useToast();
  const { isAdmin, isManagement } = useUserRole();
  const elevated = isAdmin || isManagement;

  const [sites, setSites] = useState<Site[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [logs, setLogs] = useState<Record<string, AttendanceRow>>({}); // by worker_id

  const [selSite, setSelSite] = useState("");
  const [day, setDay] = useState<string>(todayStr());
  const [defaultIn, setDefaultIn] = useState("09:00");
  const [defaultOut, setDefaultOut] = useState("18:00");
  const [busyGroup, setBusyGroup] = useState<string | null>(null);

  // selected workers across all groups (for bulk in row checkbox)
  const [picked, setPicked] = useState<Record<string, boolean>>({});

  // Late dialog
  const [lateOpen, setLateOpen] = useState(false);
  const [lateGroup, setLateGroup] = useState("");
  const [lateWorker, setLateWorker] = useState("");
  const [lateTime, setLateTime] = useState("10:15");
  const [lateReason, setLateReason] = useState("Late arrival");

  // Edit time dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editWorker, setEditWorker] = useState<Worker | null>(null);
  const [editMode, setEditMode] = useState<"in" | "out">("out");
  const [editTime, setEditTime] = useState("18:00");
  const [editReason, setEditReason] = useState("");

  // Move dialog
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveWorker, setMoveWorker] = useState<Worker | null>(null);
  const [moveTarget, setMoveTarget] = useState("");
  const [moveScope, setMoveScope] = useState<"today" | "permanent">("today");
  const [moveReason, setMoveReason] = useState("");

  useEffect(() => {
    (async () => {
      const [s, g] = await Promise.all([
        (supabase.from("sites") as any).select("id, project_id, name").order("name"),
        (supabase.from("worker_groups") as any).select("id, site_id, name, trade").order("name"),
      ]);
      setSites((s.data as any) || []);
      setGroups((g.data as any) || []);
    })();
  }, []);

  // Load workers (admin: RPC, others: RLS-scoped)
  useEffect(() => {
    (async () => {
      if (elevated) {
        const { data } = await (supabase.rpc as any)("admin_list_workers_for_deployment");
        const rows = (data || []).map((r: any) => ({
          id: r.id,
          name: r.full_name,
          role: r.designation,
          current_group_id: r.current_group_id,
          supervisor_id: r.supervisor_id,
        }));
        setWorkers(rows);
      } else {
        const { data } = await supabase
          .from("workers")
          .select("id, name:full_name, role:designation, current_group_id, supervisor_id");
        setWorkers((data as any) || []);
      }
    })();
  }, [elevated]);

  const siteGroups = useMemo(() => groups.filter((g) => g.site_id === selSite), [groups, selSite]);

  // Members of each group for the chosen day:
  //   includes workers whose permanent group is this group AND
  //   includes day-override workers (attendance_logs.group_id == this group for the day)
  const groupMembers = useMemo(() => {
    const map: Record<string, Worker[]> = {};
    siteGroups.forEach((g) => {
      map[g.id] = [];
    });
    const seen = new Set<string>();
    // permanent
    workers.forEach((w) => {
      if (w.current_group_id && map[w.current_group_id]) {
        // skip if overridden today to another group
        const log = logs[w.id];
        const todayGroup = log?.group_id;
        if (todayGroup && todayGroup !== w.current_group_id && map[todayGroup]) {
          // will be added under todayGroup below
          return;
        }
        map[w.current_group_id].push(w);
        seen.add(w.id);
      }
    });
    // day overrides
    Object.values(logs).forEach((log) => {
      if (!log.group_id || !map[log.group_id]) return;
      if (seen.has(log.worker_id)) return;
      const w = workers.find((x) => x.id === log.worker_id);
      if (w) {
        map[log.group_id].push(w);
        seen.add(w.id);
      }
    });
    return map;
  }, [siteGroups, workers, logs]);

  const loadLogs = async () => {
    if (!selSite) return setLogs({});
    const siteWorkerIds = workers
      .filter((w) => siteGroups.some((g) => g.id === w.current_group_id))
      .map((w) => w.id);
    
    let q = (supabase.from("attendance_logs") as any)
      .select("id, worker_id, group_id, time_in, time_out, status, checkin_source, checkout_source, is_late, overtime_hours")
      .eq("date", day);
    
    if (siteWorkerIds.length > 0) {
      q = q.or(`site_id.eq.${selSite},worker_id.in.(${siteWorkerIds.join(",")})`);
    } else {
      q = q.eq("site_id", selSite);
    }
    
    const { data } = await q;
    const map: Record<string, AttendanceRow> = {};
    (data || []).forEach((r: AttendanceRow) => { map[r.worker_id] = r; });
    setLogs(map);
  };
  useEffect(() => { loadLogs(); /* eslint-disable-next-line */ }, [selSite, day, workers]);

  const getSupervisorId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || "";
  };

  const doCheckIn = async (w: Worker, opts?: { time?: Date; groupId?: string; supervisorId?: string }) => {
    const sId = opts?.supervisorId || await getSupervisorId();
    const gid = opts?.groupId || w.current_group_id;
    const sid = groups.find(g => g.id === gid)?.site_id;
    const res = await unifiedCheckIn({
      workerId: w.id,
      supervisorId: w.supervisor_id || sId,
      source: "manual",
      recordedBy: "group",
      timeIn: opts?.time || toDateOnDay(defaultIn, day),
      groupId: gid || undefined,
      siteId: sid || undefined,
    });
    return res;
  };
  const doCheckOut = async (w: Worker, opts?: { time?: Date }) => {
    return unifiedCheckOut({
      workerId: w.id,
      source: "manual",
      recordedBy: "group",
      timeOut: opts?.time || toDateOnDay(defaultOut, day),
    });
  };

  const bulkCheckIn = async (groupId: string) => {
    const members = groupMembers[groupId] || [];
    const targets = members.filter((w) => !logs[w.id]);
    if (targets.length === 0) {
      toast({ title: "Everyone is already marked" });
      return;
    }
    setBusyGroup(`in:${groupId}`);
    const sId = await getSupervisorId();
    const results = await Promise.all(targets.map(w => doCheckIn(w, { groupId, supervisorId: sId })));
    const ok = results.filter((r) => r.status === "success").length;
    const skipped = results.length - ok;
    const firstError = results.find((r) => r.status === "error");
    toast({ title: `Checked in ${ok}`, description: firstError?.message || (skipped ? `${skipped} already marked` : undefined), variant: firstError ? "destructive" : "default" });
    await loadLogs();
    setBusyGroup(null);
  };
  const bulkCheckOut = async (groupId: string) => {
    const members = groupMembers[groupId] || [];
    const activeTargets = members.filter(w => logs[w.id]?.status === "active");
    if (activeTargets.length === 0) {
      toast({ title: "No active check-ins" });
      return;
    }
    setBusyGroup(`out:${groupId}`);
    const results = await Promise.all(activeTargets.map(w => doCheckOut(w)));
    const ok = results.filter((r) => r.status === "success").length;
    const skipped = results.length - ok;
    const firstError = results.find((r) => r.status === "error");
    toast({ title: `Checked out ${ok}`, description: firstError?.message || (skipped ? `${skipped} skipped` : undefined), variant: firstError ? "destructive" : "default" });
    await loadLogs();
    setBusyGroup(null);
  };
  const submitLate = async () => {
    const w = workers.find((x) => x.id === lateWorker);
    if (!w) return;
    const r = await doCheckIn(w, { time: toDateOnDay(lateTime, day), groupId: lateGroup || w.current_group_id || undefined });
    if (r.status !== "success") {
      toast({ variant: "destructive", title: "Failed", description: r.message });
    } else {
      await (supabase.from("attendance_logs") as any)
        .update({ notes_in: lateReason })
        .eq("worker_id", lateWorker).eq("date", day);
      toast({ title: "Check-in added", description: r.message });
    }
    setLateOpen(false); setLateWorker(""); setLateGroup("");
    loadLogs();
  };

  const submitEdit = async () => {
    if (!editWorker) return;
    const t = toDateOnDay(editTime, day);
    if (editMode === "out") {
      const r = await doCheckOut(editWorker, { time: t });
      if (r.status !== "success") return toast({ variant: "destructive", title: "Failed", description: r.message });
      await (supabase.from("attendance_logs") as any).update({ notes_out: editReason }).eq("worker_id", editWorker.id).eq("date", day);
    } else {
      // edit in time: update the existing log time_in directly
      const log = logs[editWorker.id];
      if (!log) return;
      await (supabase.from("attendance_logs") as any).update({ time_in: t.toISOString(), notes_in: editReason }).eq("id", log.id);
    }
    toast({ title: "Saved" });
    setEditOpen(false); setEditWorker(null); setEditReason("");
    loadLogs();
  };

  const submitMove = async () => {
    if (!moveWorker || !moveTarget) return;
    if (moveScope === "permanent") {
      const { error } = await (supabase.rpc as any)("transfer_worker_to_group", {
        p_worker_id: moveWorker.id,
        p_to_group_id: moveTarget,
        p_reason: moveReason || null,
      });
      if (error) return toast({ variant: "destructive", title: "Transfer failed", description: error.message });
      // refresh worker list quickly
      setWorkers((prev) => prev.map((w) => w.id === moveWorker.id ? { ...w, current_group_id: moveTarget } : w));
      toast({ title: "Worker transferred" });
    } else {
      // day-only: if log exists, update group_id; else create check-in with chosen group
      const log = logs[moveWorker.id];
      if (log) {
        const targetSite = groups.find((g) => g.id === moveTarget)?.site_id || null;
        await (supabase.from("attendance_logs") as any).update({ group_id: moveTarget, site_id: targetSite }).eq("id", log.id);
      } else {
        await doCheckIn(moveWorker, { groupId: moveTarget });
      }
      toast({ title: "Moved for today" });
    }
    setMoveOpen(false); setMoveWorker(null); setMoveTarget(""); setMoveReason("");
    loadLogs();
  };

  const renderStatus = (w: Worker) => {
    const log = logs[w.id];
    if (!log) return <Badge variant="secondary">Not in</Badge>;
    if (log.status === "completed") {
      return <Badge className="bg-emerald-500/20 text-emerald-700">Out · {new Date(log.time_out!).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Badge>;
    }
    return <Badge className="bg-blue-500/20 text-blue-700">In · {new Date(log.time_in!).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Badge>;
  };

  // Summary across all visible groups
  const summary = useMemo(() => {
    let inCount = 0, outCount = 0, missing = 0, total = 0;
    siteGroups.forEach((g) => {
      (groupMembers[g.id] || []).forEach((w) => {
        total++;
        const l = logs[w.id];
        if (!l) missing++;
        else if (l.status === "completed") outCount++;
        else inCount++;
      });
    });
    return { inCount, outCount, missing, total };
  }, [siteGroups, groupMembers, logs]);

  return (
    <DashboardLayout>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
            <Users2 className="w-7 h-7 text-white" />
          </div>
          <div className="flex-1 min-w-[200px]">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
              Today's Roster
            </h1>
            <p className="text-sm text-muted-foreground">Pick a site — mark attendance group-by-group in one tap</p>
          </div>
          {selSite && (
            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{summary.inCount}</span> in ·{" "}
              <span className="font-medium text-foreground">{summary.outCount}</span> out ·{" "}
              <span className="font-medium text-foreground">{summary.missing}</span> missing
              <span className="opacity-50"> / {summary.total}</span>
            </div>
          )}
        </div>

        <Card className="glass-card">
          <CardHeader><CardTitle>Site & Day</CardTitle></CardHeader>
          <CardContent className="grid sm:grid-cols-4 gap-3">
            <div className="sm:col-span-2">
              <Label>Site</Label>
              <Select value={selSite} onValueChange={setSelSite}>
                <SelectTrigger><SelectValue placeholder="Pick a site" /></SelectTrigger>
                <SelectContent>
                  {sites.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Default In</Label>
                <Input type="time" value={defaultIn} onChange={(e) => setDefaultIn(e.target.value)} />
              </div>
              <div>
                <Label>Default Out</Label>
                <Input type="time" value={defaultOut} onChange={(e) => setDefaultOut(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        {selSite && siteGroups.length === 0 && (
          <Card className="glass-card"><CardContent className="p-6 text-sm text-muted-foreground">
            No groups at this site yet. Create groups in the Workforce Hub first.
          </CardContent></Card>
        )}

        {selSite && siteGroups.map((g) => {
          const members = groupMembers[g.id] || [];
          return (
            <Card key={g.id} className="glass-card">
              <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-lg">
                  {g.name}
                  {g.trade && <span className="ml-2 text-xs font-normal text-muted-foreground">· {g.trade}</span>}
                  <span className="ml-2 text-sm font-normal text-muted-foreground">({members.length})</span>
                </CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <Button onClick={() => bulkCheckIn(g.id)} size="sm" disabled={members.length === 0 || busyGroup !== null}>
                    <LogIn className="w-4 h-4 mr-1" />{busyGroup === `in:${g.id}` ? "Checking In…" : "Check In All"}
                  </Button>
                  <Button onClick={() => bulkCheckOut(g.id)} size="sm" variant="secondary" disabled={members.length === 0 || busyGroup !== null}>
                    <LogOut className="w-4 h-4 mr-1" />{busyGroup === `out:${g.id}` ? "Checking Out…" : "Check Out All"}
                  </Button>
                  <Button onClick={() => { setLateGroup(g.id); setLateOpen(true); }} size="sm" variant="outline">
                    <UserPlus className="w-4 h-4 mr-1" />Add Late
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {members.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No workers in this group.</p>
                ) : (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {members.map((w) => {
                      const log = logs[w.id];
                      const isOverride = log?.group_id && w.current_group_id && log.group_id !== w.current_group_id;
                      return (
                        <div key={w.id} className="glass-card p-3 rounded-xl flex items-center gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate flex items-center gap-1">
                              {w.name}
                              {isOverride && <Badge variant="outline" className="text-[10px] py-0">today</Badge>}
                            </div>
                            <div className="mt-1 flex items-center gap-1 flex-wrap">
                              {renderStatus(w)}
                              {w.role && <span className="text-[10px] text-muted-foreground">{w.role}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-0.5">
                            {!log && (
                              <Button size="icon" variant="ghost" title="Check in" onClick={() => doCheckIn(w, { groupId: g.id }).then(loadLogs)}>
                                <LogIn className="w-4 h-4" />
                              </Button>
                            )}
                            {log?.status === "active" && (
                              <Button size="icon" variant="ghost" title="Check out" onClick={() => doCheckOut(w).then(loadLogs)}>
                                <LogOut className="w-4 h-4" />
                              </Button>
                            )}
                            {log && (
                              <Button size="icon" variant="ghost" title="Edit time" onClick={() => {
                                setEditWorker(w);
                                setEditMode(log.status === "active" ? "in" : "out");
                                setEditTime(log.status === "active"
                                  ? new Date(log.time_in!).toTimeString().slice(0, 5)
                                  : new Date(log.time_out!).toTimeString().slice(0, 5));
                                setEditOpen(true);
                              }}>
                                <Edit3 className="w-4 h-4" />
                              </Button>
                            )}
                            <Button size="icon" variant="ghost" title="Move to another group" onClick={() => {
                              setMoveWorker(w); setMoveTarget(""); setMoveScope("today"); setMoveOpen(true);
                            }}>
                              <ArrowRightLeft className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}

        {/* Late dialog */}
        <Dialog open={lateOpen} onOpenChange={setLateOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Late Check-In</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Worker</Label>
                <Select value={lateWorker} onValueChange={setLateWorker}>
                  <SelectTrigger><SelectValue placeholder="Pick worker" /></SelectTrigger>
                  <SelectContent>
                    {(groupMembers[lateGroup] || []).filter((w) => !logs[w.id]).map((w) => (
                      <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Time</Label><Input type="time" value={lateTime} onChange={(e) => setLateTime(e.target.value)} /></div>
              <div><Label>Reason</Label><Input value={lateReason} onChange={(e) => setLateReason(e.target.value)} /></div>
            </div>
            <DialogFooter><Button onClick={submitLate}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit time dialog */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Edit {editMode === "in" ? "Check-In" : "Check-Out"} Time</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">{editWorker?.name}</div>
              <div><Label>Time</Label><Input type="time" value={editTime} onChange={(e) => setEditTime(e.target.value)} /></div>
              <div><Label>Reason</Label><Input value={editReason} onChange={(e) => setEditReason(e.target.value)} placeholder="Optional note" /></div>
            </div>
            <DialogFooter><Button onClick={submitEdit}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Move dialog */}
        <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Move Worker</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">{moveWorker?.name}</div>
              <div>
                <Label>Move to group</Label>
                <Select value={moveTarget} onValueChange={setMoveTarget}>
                  <SelectTrigger><SelectValue placeholder="Choose target group" /></SelectTrigger>
                  <SelectContent>
                    {siteGroups.filter((g) => g.id !== moveWorker?.current_group_id).map((g) => (
                      <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>When</Label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <Button type="button" variant={moveScope === "today" ? "default" : "outline"} onClick={() => setMoveScope("today")}>
                    Just today
                  </Button>
                  <Button type="button" variant={moveScope === "permanent" ? "default" : "outline"} onClick={() => setMoveScope("permanent")}>
                    From now on
                  </Button>
                </div>
              </div>
              {moveScope === "permanent" && (
                <div><Label>Reason</Label><Input value={moveReason} onChange={(e) => setMoveReason(e.target.value)} placeholder="Reason for transfer" /></div>
              )}
            </div>
            <DialogFooter><Button onClick={submitMove} disabled={!moveTarget}>Confirm</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </motion.div>
    </DashboardLayout>
  );
}