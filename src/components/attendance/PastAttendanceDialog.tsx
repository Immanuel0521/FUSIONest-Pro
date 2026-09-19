import { useEffect, useMemo, useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Users, Plus, Pencil, Trash2, Save, X, Search, CalendarDays, Check, Lock, AlertTriangle, UserPlus, Moon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAttendanceGroups, GROUP_COLORS, groupChip, type AttendanceGroup } from "@/hooks/useAttendanceGroups";
import { metricsFromStrings, round2 } from "@/lib/attendanceMetrics";

type RowStatus = "present" | "half_day" | "absent";

interface RowState {
  status: RowStatus;
  timeIn: string;
  timeOut: string;
  /** If set, this worker already has a record for this date — we UPDATE instead of INSERT */
  existingId?: string;
}

interface ExistingRecord {
  id: string;
  time_in: string;
  time_out: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate: string;
  onSaved: () => void;
}

const initials = (name: string) =>
  name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

const toHHMM = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export function PastAttendanceDialog({ open, onOpenChange, defaultDate, onSaved }: Props) {
  const { groups, workers, loading, saveGroup, deleteGroup } = useAttendanceGroups();
  const [tab, setTab] = useState("mark");

  // ── mark attendance state ──────────────────────────────────────────────────
  const [date, setDate] = useState(defaultDate);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [bulkIn, setBulkIn] = useState("09:00");
  const [bulkOut, setBulkOut] = useState("18:00");
  const [saving, setSaving] = useState(false);

  // ── individual worker picker ───────────────────────────────────────────────
  const [individualIds, setIndividualIds] = useState<string[]>([]);
  const [indivSearch, setIndivSearch] = useState("");
  const [showIndivPicker, setShowIndivPicker] = useState(false);

  // ── existing records for selected date ────────────────────────────────────
  const [existingOnDate, setExistingOnDate] = useState<Map<string, ExistingRecord>>(new Map());
  const [loadingExisting, setLoadingExisting] = useState(false);

  // ── group editor state ────────────────────────────────────────────────────
  const [editing, setEditing] = useState<AttendanceGroup | null>(null);
  const [creating, setCreating] = useState(false);
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formColor, setFormColor] = useState("teal");
  const [formWorkers, setFormWorkers] = useState<string[]>([]);
  const [workerSearch, setWorkerSearch] = useState("");
  const [savingGroup, setSavingGroup] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AttendanceGroup | null>(null);

  // ── load existing records whenever date changes ───────────────────────────
  const loadExisting = useCallback(async (d: string) => {
    if (!d) return;
    setLoadingExisting(true);
    const { data } = await (supabase.from("attendance_logs") as any)
      .select("id, worker_id, time_in, time_out")
      .eq("date", d);
    const map = new Map<string, ExistingRecord>();
    ((data as any[]) || []).forEach((r) => map.set(r.worker_id, { id: r.id, time_in: r.time_in, time_out: r.time_out }));
    setExistingOnDate(map);
    setLoadingExisting(false);
  }, []);

  useEffect(() => {
    if (open) {
      setDate(defaultDate);
      loadExisting(defaultDate);
    }
  }, [open, defaultDate, loadExisting]);

  useEffect(() => {
    if (date) loadExisting(date);
  }, [date, loadExisting]);

  // ── merged list of selected workers (groups + individuals) ────────────────
  const selectedMembers = useMemo(() => {
    const map = new Map<string, { id: string; full_name: string; photo_url: string | null; groupNames: string[] }>();
    groups
      .filter((g) => selectedGroups.includes(g.id))
      .forEach((g) =>
        g.members.forEach((m) => {
          const ex = map.get(m.id);
          if (ex) ex.groupNames.push(g.name);
          else map.set(m.id, { ...m, groupNames: [g.name] });
        })
      );
    // Individual workers (not already in a selected group)
    individualIds.forEach((wId) => {
      if (!map.has(wId)) {
        const w = workers.find((x) => x.id === wId);
        if (w) map.set(wId, { ...w, groupNames: ["Individual"] });
      }
    });
    return [...map.values()].sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [groups, selectedGroups, individualIds, workers]);

  // ── sync rows when members or existingOnDate changes ─────────────────────
  useEffect(() => {
    setRows((prev) => {
      const next: Record<string, RowState> = {};
      selectedMembers.forEach((m) => {
        const ex = existingOnDate.get(m.id);
        if (ex) {
          // Pre-fill from existing record (edit mode)
          next[m.id] = prev[m.id] ?? {
            status: "present",
            timeIn: toHHMM(ex.time_in),
            timeOut: ex.time_out ? toHHMM(ex.time_out) : bulkOut,
            existingId: ex.id,
          };
          // Always keep existingId current
          next[m.id] = { ...next[m.id], existingId: ex.id };
        } else {
          next[m.id] = prev[m.id] ?? { status: "present", timeIn: bulkIn, timeOut: bulkOut };
          // Remove existingId if date changed and record no longer exists
          delete next[m.id].existingId;
        }
      });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMembers.map((m) => m.id).join(","), existingOnDate]);

  const setRow = (id: string, patch: Partial<RowState>) =>
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const applyBulkTimes = () => {
    setRows((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((id) => {
        if (next[id].status !== "absent") next[id] = { ...next[id], timeIn: bulkIn, timeOut: bulkOut };
      });
      return next;
    });
    toast.success("Times applied to everyone");
  };

  const cycleStatus = (id: string, status: RowStatus) => {
    if (status === "half_day") setRow(id, { status, timeIn: "09:00", timeOut: "13:00" });
    else if (status === "present") setRow(id, { status, timeIn: bulkIn, timeOut: bulkOut });
    else setRow(id, { status });
  };

  // ── group coverage counts for greying out ────────────────────────────────
  const groupCoverage = useMemo(() => {
    const out: Record<string, { total: number; recorded: number }> = {};
    groups.forEach((g) => {
      out[g.id] = {
        total: g.members.length,
        recorded: g.members.filter((m) => existingOnDate.has(m.id)).length,
      };
    });
    return out;
  }, [groups, existingOnDate]);

  // ── save ─────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    const toProcess = selectedMembers.filter((m) => rows[m.id] && rows[m.id].status !== "absent");
    if (!date) return toast.error("Pick a date");
    if (!toProcess.length) return toast.error("Select at least one worker and mark someone present");

    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) throw new Error("Not signed in");

      let inserted = 0;
      let updated = 0;
      let errors = 0;

      for (const m of toProcess) {
        const row = rows[m.id];
        const metrics = metricsFromStrings(date, row.timeIn, row.timeOut);
        const payload = {
          worker_id: m.id,
          supervisor_id: auth.user.id,
          date,
          time_in: metrics.timeIn.toISOString(),
          time_out: metrics.timeOut.toISOString(),
          is_late: metrics.isLate,
          late_minutes: metrics.lateMinutes,
          early_exit: metrics.earlyExit,
          total_hours: round2(metrics.totalHours),
          regular_hours: round2(metrics.totalHours),
          overtime_hours: round2(metrics.overtimeHours),
          status: "completed",
          checkin_source: "manual",
          checkout_source: "manual",
          recorded_by: "manual",
        };

        if (row.existingId) {
          // UPDATE existing record
          const { error } = await (supabase.from("attendance_logs") as any)
            .update({
              time_in: payload.time_in,
              time_out: payload.time_out,
              is_late: payload.is_late,
              late_minutes: payload.late_minutes,
              early_exit: payload.early_exit,
              total_hours: payload.total_hours,
              regular_hours: payload.regular_hours,
              overtime_hours: payload.overtime_hours,
            })
            .eq("id", row.existingId);
          if (error) { console.error(error); errors++; } else updated++;
        } else {
          // INSERT new record
          const { error } = await (supabase.from("attendance_logs") as any).insert(payload);
          if (error) { console.error(error); errors++; } else inserted++;
        }
      }

      const parts: string[] = [];
      if (inserted) parts.push(`${inserted} added`);
      if (updated) parts.push(`${updated} updated`);
      if (errors) parts.push(`${errors} failed`);
      toast[errors && !inserted && !updated ? "error" : "success"](parts.join(" · "));

      onSaved();
      if (!errors) onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Failed to save attendance");
    } finally {
      setSaving(false);
    }
  };

  // ── group form helpers ────────────────────────────────────────────────────
  const openCreate = () => {
    setCreating(true); setEditing(null);
    setFormName(""); setFormDesc(""); setFormColor("teal"); setFormWorkers([]); setWorkerSearch("");
  };
  const openEdit = (g: AttendanceGroup) => {
    setCreating(true); setEditing(g);
    setFormName(g.name); setFormDesc(g.description || ""); setFormColor(g.color);
    setFormWorkers(g.members.map((m) => m.id)); setWorkerSearch("");
  };
  const submitGroup = async () => {
    if (!formName.trim()) return toast.error("Give the group a name");
    setSavingGroup(true);
    const ok = await saveGroup({ id: editing?.id, name: formName.trim(), description: formDesc, color: formColor, workerIds: formWorkers });
    setSavingGroup(false);
    if (ok) setCreating(false);
  };

  const filteredWorkers = workers.filter((w) => w.full_name.toLowerCase().includes(workerSearch.toLowerCase()));
  const filteredIndiv = workers.filter((w) => w.full_name.toLowerCase().includes(indivSearch.toLowerCase()));

  const presentCount = selectedMembers.filter((m) => rows[m.id]?.status === "present").length;
  const halfCount = selectedMembers.filter((m) => rows[m.id]?.status === "half_day").length;
  const absentCount = selectedMembers.filter((m) => rows[m.id]?.status === "absent").length;
  const editCount = selectedMembers.filter((m) => rows[m.id]?.existingId).length;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-primary" />
              Add / Edit Past Attendance
            </DialogTitle>
          </DialogHeader>

          <Tabs value={tab} onValueChange={setTab} className="flex-1 min-h-0 flex flex-col">
            <TabsList>
              <TabsTrigger value="mark">Mark attendance</TabsTrigger>
              <TabsTrigger value="groups">Groups ({groups.length})</TabsTrigger>
            </TabsList>

            {/* ============ MARK TAB ============ */}
            <TabsContent value="mark" className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1">

              {/* Date + bulk times */}
              <div className="grid sm:grid-cols-[160px_1fr_1fr_auto] gap-3 items-end">
                <div className="space-y-1.5">
                  <Label>Date</Label>
                  <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Check-in for all</Label>
                  <Input type="time" value={bulkIn} onChange={(e) => setBulkIn(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Check-out for all</Label>
                  <Input type="time" value={bulkOut} onChange={(e) => setBulkOut(e.target.value)} />
                </div>
                <Button variant="outline" onClick={applyBulkTimes}>Apply to all</Button>
              </div>

              {/* Night shift hint */}
              <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <Moon className="w-3.5 h-3.5" />
                Night shift (check-in ≥ 18:00) and cross-midnight times (e.g. 21:00 → 02:00) are fully supported — all hours count as OT.
              </p>

              {/* ── Groups section ── */}
              <div className="space-y-2">
                <Label>Groups</Label>
                {loadingExisting && <p className="text-xs text-muted-foreground">Checking existing records…</p>}
                {groups.length === 0 ? (
                  <Card className="p-4 text-sm text-muted-foreground flex items-center justify-between gap-3">
                    <span>No groups yet. Create one in the Groups tab.</span>
                    <Button size="sm" onClick={() => { setTab("groups"); openCreate(); }}>
                      <Plus className="w-4 h-4 mr-1" /> New group
                    </Button>
                  </Card>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {groups.map((g) => {
                      const active = selectedGroups.includes(g.id);
                      const cov = groupCoverage[g.id] ?? { total: 0, recorded: 0 };
                      const fullyRecorded = cov.total > 0 && cov.recorded === cov.total;
                      const partiallyRecorded = cov.recorded > 0 && cov.recorded < cov.total;

                      return (
                        <Tooltip key={g.id}>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedGroups((prev) =>
                                  prev.includes(g.id) ? prev.filter((x) => x !== g.id) : [...prev, g.id]
                                )
                              }
                              className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all flex items-center gap-1.5 ${
                                fullyRecorded
                                  ? "bg-muted/60 border-border/50 text-muted-foreground opacity-60 cursor-pointer"
                                  : active
                                  ? groupChip(g.color) + " ring-2 ring-primary/40"
                                  : "bg-muted/40 border-border text-muted-foreground hover:bg-muted/70"
                              }`}
                            >
                              {fullyRecorded ? (
                                <Lock className="w-3 h-3" />
                              ) : partiallyRecorded ? (
                                <AlertTriangle className="w-3 h-3 text-amber-500" />
                              ) : active ? (
                                <Check className="w-3 h-3" />
                              ) : null}
                              {g.name}
                              <span className="opacity-70">· {g.members.length}</span>
                              {cov.recorded > 0 && (
                                <span className={`ml-1 text-[10px] ${fullyRecorded ? "text-muted-foreground" : "text-amber-600"}`}>
                                  {cov.recorded}/{cov.total}
                                </span>
                              )}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="text-xs">
                            {fullyRecorded
                              ? "All members already have attendance — click to select and edit times"
                              : partiallyRecorded
                              ? `${cov.recorded} of ${cov.total} already recorded — existing rows show in edit mode`
                              : `${g.members.length} member(s)`}
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ── Individual workers section ── */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Individual Workers {individualIds.length > 0 && <span className="ml-1 text-muted-foreground">({individualIds.length} selected)</span>}</Label>
                  <Button size="sm" variant="outline" onClick={() => setShowIndivPicker((v) => !v)}>
                    <UserPlus className="w-4 h-4 mr-1" />
                    {showIndivPicker ? "Hide picker" : "Add individual"}
                  </Button>
                </div>

                {showIndivPicker && (
                  <Card className="p-3 space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        className="pl-9"
                        placeholder="Search workers…"
                        value={indivSearch}
                        onChange={(e) => setIndivSearch(e.target.value)}
                      />
                    </div>
                    <ScrollArea className="h-48 rounded-lg border p-1">
                      <div className="space-y-0.5">
                        {filteredIndiv.map((w) => {
                          const checked = individualIds.includes(w.id);
                          const hasRecord = existingOnDate.has(w.id);
                          return (
                            <label
                              key={w.id}
                              className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/60 cursor-pointer"
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(v) =>
                                  setIndividualIds((prev) => (v ? [...prev, w.id] : prev.filter((x) => x !== w.id)))
                                }
                              />
                              <Avatar className="w-7 h-7">
                                <AvatarImage src={w.photo_url || undefined} />
                                <AvatarFallback className="bg-primary/20 text-primary text-[10px]">{initials(w.full_name)}</AvatarFallback>
                              </Avatar>
                              <span className="text-sm flex-1">{w.full_name}</span>
                              {hasRecord && (
                                <Badge className="text-[10px] bg-amber-500/20 text-amber-700 dark:text-amber-300">
                                  Has record
                                </Badge>
                              )}
                            </label>
                          );
                        })}
                      </div>
                    </ScrollArea>
                    {individualIds.length > 0 && (
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setIndividualIds([])}>
                        Clear selection
                      </Button>
                    )}
                  </Card>
                )}
              </div>

              {/* ── Status summary ── */}
              {selectedMembers.length > 0 && (
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">Present {presentCount}</Badge>
                  <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-300">Half day {halfCount}</Badge>
                  <Badge className="bg-rose-500/20 text-rose-700 dark:text-rose-300">Skip {absentCount}</Badge>
                  {editCount > 0 && (
                    <Badge className="bg-blue-500/20 text-blue-700 dark:text-blue-300">
                      <Pencil className="w-3 h-3 mr-1" /> {editCount} editing existing
                    </Badge>
                  )}
                </div>
              )}

              {/* ── Worker rows ── */}
              <div className="space-y-2">
                {selectedMembers.map((m) => {
                  const row = rows[m.id];
                  if (!row) return null;
                  const isEdit = !!row.existingId;
                  return (
                    <Card
                      key={m.id}
                      className={`p-3 flex flex-wrap items-center gap-3 ${isEdit ? "border-blue-500/30 bg-blue-500/5" : ""}`}
                    >
                      <Avatar className="w-9 h-9">
                        <AvatarImage src={m.photo_url || undefined} />
                        <AvatarFallback className="bg-primary/20 text-primary text-xs">{initials(m.full_name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-[140px] flex-1">
                        <div className="text-sm font-medium flex items-center gap-1.5">
                          {m.full_name}
                          {isEdit && (
                            <Badge className="text-[10px] bg-blue-500/20 text-blue-700 dark:text-blue-300 h-4 px-1.5">
                              <Pencil className="w-2.5 h-2.5 mr-0.5" /> Edit
                            </Badge>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground">{m.groupNames.join(", ")}</div>
                      </div>

                      <div className="flex gap-1">
                        {(["present", "half_day", "absent"] as RowStatus[]).map((s) => (
                          <Button
                            key={s}
                            size="sm"
                            variant={row.status === s ? "default" : "outline"}
                            className="h-8 text-xs"
                            onClick={() => cycleStatus(m.id, s)}
                          >
                            {s === "present" ? "Present" : s === "half_day" ? "Half day" : "Skip"}
                          </Button>
                        ))}
                      </div>

                      {row.status !== "absent" && (
                        <div className="flex items-center gap-2">
                          <Input
                            type="time"
                            className="w-[110px] h-8"
                            value={row.timeIn}
                            onChange={(e) => setRow(m.id, { timeIn: e.target.value })}
                          />
                          <span className="text-muted-foreground text-xs">to</span>
                          <Input
                            type="time"
                            className="w-[110px] h-8"
                            value={row.timeOut}
                            onChange={(e) => setRow(m.id, { timeOut: e.target.value })}
                          />
                          {/* OT preview for night/cross-midnight */}
                          {(() => {
                            try {
                              const h = parseInt(row.timeIn.split(":")[0]);
                              if (h >= 18 || parseInt(row.timeOut.split(":")[0]) < parseInt(row.timeIn.split(":")[0])) {
                                return <Moon className="w-3.5 h-3.5 text-indigo-400" title="Night / overnight — all hours OT" />;
                              }
                            } catch { /* ignore */ }
                            return null;
                          })()}
                        </div>
                      )}
                    </Card>
                  );
                })}

                {selectedMembers.length === 0 && (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    Select a group above or add individual workers to begin marking attendance.
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ============ GROUPS TAB ============ */}
            <TabsContent value="groups" className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1">
              {!creating ? (
                <>
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-muted-foreground">Groups stay saved until you edit or delete them.</p>
                    <Button size="sm" onClick={openCreate}><Plus className="w-4 h-4 mr-1" /> New group</Button>
                  </div>
                  {loading ? (
                    <div className="text-sm text-muted-foreground py-6 text-center">Loading...</div>
                  ) : groups.length === 0 ? (
                    <div className="text-sm text-muted-foreground py-8 text-center">
                      <Users className="w-10 h-10 mx-auto mb-2 opacity-40" />
                      No groups yet.
                    </div>
                  ) : (
                    groups.map((g) => (
                      <Card key={g.id} className="p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={groupChip(g.color)}>{g.name}</Badge>
                            <span className="text-xs text-muted-foreground">{g.members.length} worker(s)</span>
                          </div>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" onClick={() => openEdit(g)} aria-label={`Edit ${g.name}`}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm" variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setDeleteTarget(g)}
                              aria-label={`Delete ${g.name}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        {g.description && <p className="text-xs text-muted-foreground">{g.description}</p>}
                        <div className="flex flex-wrap gap-1">
                          {g.members.map((m) => (
                            <span key={m.id} className="text-[11px] px-2 py-0.5 rounded-full bg-muted">{m.full_name}</span>
                          ))}
                        </div>
                      </Card>
                    ))
                  )}
                </>
              ) : (
                <div className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Group name</Label>
                      <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Tower A Fitters" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Colour</Label>
                      <div className="flex gap-2 pt-1">
                        {GROUP_COLORS.map((c) => (
                          <button
                            key={c.key} type="button" aria-label={c.key}
                            onClick={() => setFormColor(c.key)}
                            className={`w-7 h-7 rounded-full border ${c.chip} ${formColor === c.key ? "ring-2 ring-primary" : ""}`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Notes (optional)</Label>
                    <Textarea value={formDesc} onChange={(e) => setFormDesc(e.target.value)} rows={2} />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label>Workers ({formWorkers.length})</Label>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setFormWorkers(filteredWorkers.map((w) => w.id))}>Select all</Button>
                        <Button size="sm" variant="outline" onClick={() => setFormWorkers([])}>Clear</Button>
                      </div>
                    </div>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input className="pl-9" placeholder="Search workers..." value={workerSearch} onChange={(e) => setWorkerSearch(e.target.value)} />
                    </div>
                    <ScrollArea className="h-56 rounded-xl border p-2">
                      <div className="space-y-1">
                        {filteredWorkers.map((w) => (
                          <label key={w.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/60 cursor-pointer">
                            <Checkbox
                              checked={formWorkers.includes(w.id)}
                              onCheckedChange={(v) =>
                                setFormWorkers((prev) => (v ? [...prev, w.id] : prev.filter((x) => x !== w.id)))
                              }
                            />
                            <Avatar className="w-7 h-7">
                              <AvatarImage src={w.photo_url || undefined} />
                              <AvatarFallback className="bg-primary/20 text-primary text-[10px]">{initials(w.full_name)}</AvatarFallback>
                            </Avatar>
                            <span className="text-sm">{w.full_name}</span>
                            {w.designation && <span className="text-[11px] text-muted-foreground">{w.designation}</span>}
                          </label>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setCreating(false)}><X className="w-4 h-4 mr-1" /> Cancel</Button>
                    <Button onClick={submitGroup} disabled={savingGroup}>
                      <Save className="w-4 h-4 mr-1" /> {savingGroup ? "Saving..." : editing ? "Update group" : "Create group"}
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>

          {tab === "mark" && (
            <DialogFooter className="border-t pt-3">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>
                <Save className="w-4 h-4 mr-1" /> {saving ? "Saving..." : editCount > 0 ? `Save (${selectedMembers.filter(m => rows[m.id]?.status !== "absent").length - editCount} new · ${editCount} edit)` : "Save attendance"}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete group</AlertDialogTitle>
            <AlertDialogDescription>
              Delete <strong>{deleteTarget?.name}</strong>? Attendance already recorded stays untouched.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (deleteTarget) {
                  await deleteGroup(deleteTarget.id);
                  setSelectedGroups((prev) => prev.filter((x) => x !== deleteTarget.id));
                }
                setDeleteTarget(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
