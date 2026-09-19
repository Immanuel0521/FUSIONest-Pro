import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { FileSpreadsheet, FileText, Users, Clock, Timer, CalendarX, Search, Loader2, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as RTooltip, Legend, AreaChart, Area } from "recharts";
import { classifyLog, hoursToHM, round2, STATUS_LABEL, type DayCell, type DayStatus } from "@/lib/attendanceMetrics";
import { exportMatrixExcel, exportMatrixPdf, type MatrixData, type MatrixRow } from "@/lib/attendanceReport";
import { useAttendanceGroups, groupChip } from "@/hooks/useAttendanceGroups";

interface Props {
  embedded?: boolean;
}

const cellClass: Record<DayStatus, string> = {
  present: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
  half_day: "bg-amber-500/25 text-amber-800 dark:text-amber-300",
  absent: "bg-rose-500/20 text-rose-700 dark:text-rose-300",
  in_progress: "bg-blue-500/20 text-blue-700 dark:text-blue-300",
  sunday: "bg-muted text-muted-foreground",
  not_joined: "bg-muted/40 text-muted-foreground/60",
};

export default function FullAttendanceReport({ embedded = false }: Props) {
  const [month, setMonth] = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
  });
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<MatrixRow[]>([]);
  const [dates, setDates] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState<string | null>(null);
  const { groups } = useAttendanceGroups();

  const monthLabel = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }, [month]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const load = async () => {
    setLoading(true);
    const [y, m] = month.split("-").map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === y && today.getMonth() === m - 1;
    const endDay = isCurrentMonth ? today.getDate() : lastDay;

    const dateList: string[] = [];
    for (let d = 1; d <= endDay; d++) {
      dateList.push(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
    }

    const [{ data: workers, error: wErr }, { data: logs, error: lErr }] = await Promise.all([
      supabase.from("workers").select("id, full_name, designation, date_of_joining").order("full_name"),
      supabase
        .from("attendance_logs")
        .select("worker_id, date, time_in, time_out, total_hours, overtime_hours, is_late, early_exit")
        .gte("date", dateList[0])
        .lte("date", dateList[dateList.length - 1]),
    ]);

    if (wErr || lErr) {
      toast.error(wErr?.message || lErr?.message || "Failed to load report");
      setLoading(false);
      return;
    }

    const logsByWorker = new Map<string, Map<string, any>>();
    ((logs as any[]) || []).forEach((l) => {
      const map = logsByWorker.get(l.worker_id) || new Map();
      map.set(l.date, l);
      logsByWorker.set(l.worker_id, map);
    });

    const built: MatrixRow[] = ((workers as any[]) || []).map((w) => {
      const cells: Record<string, DayCell> = {};
      let presentDays = 0, halfDays = 0, absentDays = 0, totalHours = 0, totalOT = 0, lateCount = 0, earlyCount = 0;
      const joining = w.date_of_joining ? new Date(w.date_of_joining + "T00:00:00") : null;

      dateList.forEach((d) => {
        const log = logsByWorker.get(w.id)?.get(d);
        const dt = new Date(d + "T00:00:00");
        if (log) {
          const cell = classifyLog(log);
          cells[d] = cell;
          if (cell.status === "present") presentDays++;
          else if (cell.status === "half_day") halfDays++;
          totalHours += cell.hours;
          totalOT += cell.ot;
          if (cell.late) lateCount++;
          if (cell.early) earlyCount++;
        } else if (joining && dt < joining) {
          cells[d] = { status: "not_joined", hours: 0, ot: 0, late: false, early: false };
        } else if (dt.getDay() === 0) {
          cells[d] = { status: "sunday", hours: 0, ot: 0, late: false, early: false };
        } else {
          cells[d] = { status: "absent", hours: 0, ot: 0, late: false, early: false };
          absentDays++;
        }
      });

      return {
        workerId: w.id,
        name: w.full_name,
        designation: w.designation,
        cells,
        presentDays,
        halfDays,
        absentDays,
        totalHours: round2(totalHours),
        totalOT: round2(totalOT),
        lateCount,
        earlyCount,
      };
    });

    setDates(dateList);
    setRows(built);
    setLoading(false);
  };

  const groupMemberIds = useMemo(() => {
    if (!groupFilter) return null;
    const g = groups.find((x) => x.id === groupFilter);
    return g ? new Set(g.members.map((m) => m.id)) : null;
  }, [groupFilter, groups]);

  const visibleRows = useMemo(
    () =>
      rows.filter(
        (r) =>
          r.name.toLowerCase().includes(search.toLowerCase()) &&
          (!groupMemberIds || groupMemberIds.has(r.workerId))
      ),
    [rows, search, groupMemberIds]
  );

  const totals = useMemo(
    () =>
      visibleRows.reduce(
        (a, r) => ({
          present: a.present + r.presentDays,
          half: a.half + r.halfDays,
          absent: a.absent + r.absentDays,
          hours: a.hours + r.totalHours,
          ot: a.ot + r.totalOT,
          late: a.late + r.lateCount,
        }),
        { present: 0, half: 0, absent: 0, hours: 0, ot: 0, late: 0 }
      ),
    [visibleRows]
  );

  const dailyTrend = useMemo(
    () =>
      dates.map((d) => {
        let present = 0, half = 0, absent = 0, ot = 0;
        visibleRows.forEach((r) => {
          const c = r.cells[d];
          if (!c) return;
          if (c.status === "present" || c.status === "in_progress") present++;
          else if (c.status === "half_day") half++;
          else if (c.status === "absent") absent++;
          ot += c.ot;
        });
        return { day: Number(d.split("-")[2]), Present: present, "Half day": half, Absent: absent, OT: round2(ot) };
      }),
    [dates, visibleRows]
  );

  const topOT = useMemo(
    () =>
      [...visibleRows]
        .sort((a, b) => b.totalOT - a.totalOT)
        .slice(0, 8)
        .map((r) => ({ name: r.name.split(" ")[0], OT: round2(r.totalOT), Hours: round2(r.totalHours) })),
    [visibleRows]
  );

  const matrix = (): MatrixData => ({ monthLabel, dates, rows: visibleRows });

  const attendanceRate = (r: MatrixRow) => {
    const counted = r.presentDays + r.halfDays + r.absentDays;
    if (!counted) return 0;
    return Math.round(((r.presentDays + r.halfDays * 0.5) / counted) * 100);
  };

  const content = (
    <div className="space-y-5">
      {!embedded && (
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Full Attendance Report
          </h1>
          <p className="text-muted-foreground mt-1">Worker-by-day attendance, hours and overtime</p>
        </div>
      )}

      {/* Controls */}
      <Card className="p-4 flex flex-wrap gap-4 items-end">
        <div className="space-y-1.5">
          <Label>Month</Label>
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-40" />
        </div>
        <div className="flex-1 min-w-[200px] space-y-1.5">
          <Label>Search worker</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search by name..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => exportMatrixPdf(matrix())} disabled={loading || !visibleRows.length}>
            <FileText className="w-4 h-4 mr-1" /> PDF
          </Button>
          <Button onClick={() => exportMatrixExcel(matrix())} disabled={loading || !visibleRows.length}>
            <FileSpreadsheet className="w-4 h-4 mr-1" /> Excel
          </Button>
        </div>
      </Card>

      {groups.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-muted-foreground">Filter by group:</span>
          <button
            onClick={() => setGroupFilter(null)}
            className={`px-3 py-1 rounded-full text-xs border ${!groupFilter ? "bg-primary text-primary-foreground border-primary" : "bg-muted/40"}`}
          >
            All workers
          </button>
          {groups.map((g) => (
            <button
              key={g.id}
              onClick={() => setGroupFilter(g.id === groupFilter ? null : g.id)}
              className={`px-3 py-1 rounded-full text-xs border ${g.id === groupFilter ? groupChip(g.color) + " ring-2 ring-primary/40" : "bg-muted/40 border-border text-muted-foreground"}`}
            >
              {g.name} · {g.members.length}
            </button>
          ))}
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Workers", value: visibleRows.length, icon: Users, cls: "from-teal-500 to-emerald-500" },
          { label: "Present days", value: totals.present, icon: TrendingUp, cls: "from-emerald-500 to-green-600" },
          { label: "Half days", value: totals.half, icon: Clock, cls: "from-amber-500 to-orange-500" },
          { label: "Absent days", value: totals.absent, icon: CalendarX, cls: "from-rose-500 to-red-600" },
          { label: "Hours worked", value: hoursToHM(totals.hours), icon: Clock, cls: "from-blue-500 to-indigo-500" },
          { label: "OT hours", value: hoursToHM(totals.ot), icon: Timer, cls: "from-violet-500 to-purple-600" },
        ].map((k) => (
          <Card key={k.label} className="p-3 relative overflow-hidden">
            <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${k.cls}`} />
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <k.icon className="w-3.5 h-3.5" /> {k.label}
            </div>
            <div className="text-xl font-bold mt-1">{k.value}</div>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <h3 className="font-semibold text-sm mb-3">Daily attendance trend</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyTrend}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="day" fontSize={11} />
                <YAxis fontSize={11} />
                <RTooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="Present" stackId="1" stroke="#059669" fill="#6ee7b7" />
                <Area type="monotone" dataKey="Half day" stackId="1" stroke="#d97706" fill="#fcd34d" />
                <Area type="monotone" dataKey="Absent" stackId="1" stroke="#dc2626" fill="#fca5a5" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-4">
          <h3 className="font-semibold text-sm mb-3">Top overtime earners</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topOT}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="name" fontSize={11} />
                <YAxis fontSize={11} />
                <RTooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Hours" fill="#0d9488" radius={[4, 4, 0, 0]} />
                <Bar dataKey="OT" fill="#7c3aed" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 text-xs">
        {(["present", "half_day", "absent", "in_progress", "sunday"] as DayStatus[]).map((s) => (
          <Badge key={s} className={`${cellClass[s]} font-medium`}>
            {STATUS_LABEL[s]} —{" "}
            {s === "present" ? "Present" : s === "half_day" ? "Half day (<4.5h)" : s === "absent" ? "Absent" : s === "in_progress" ? "No check-out" : "Sunday"}
          </Badge>
        ))}
      </div>

      {/* Matrix */}
      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Building report...
          </div>
        ) : visibleRows.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">No workers found</div>
        ) : (
          <div className="overflow-auto max-h-[70vh]">
            <table className="text-xs border-collapse w-full">
              <thead className="sticky top-0 z-20">
                <tr className="bg-primary text-primary-foreground">
                  <th className="sticky left-0 z-30 bg-primary px-3 py-2 text-left min-w-[180px]">Worker</th>
                  {dates.map((d) => (
                    <th key={d} className="px-1 py-2 min-w-[28px] font-medium">
                      <div>{Number(d.split("-")[2])}</div>
                      <div className="opacity-70 text-[9px]">
                        {new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "narrow" })}
                      </div>
                    </th>
                  ))}
                  <th className="px-2 py-2 min-w-[46px]">P</th>
                  <th className="px-2 py-2 min-w-[46px]">HD</th>
                  <th className="px-2 py-2 min-w-[46px]">A</th>
                  <th className="px-2 py-2 min-w-[70px]">Hours</th>
                  <th className="px-2 py-2 min-w-[70px]">OT</th>
                  <th className="px-2 py-2 min-w-[110px]">Attendance</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((r, i) => (
                  <tr key={r.workerId} className={i % 2 ? "bg-muted/30" : ""}>
                    <td className={`sticky left-0 z-10 px-3 py-1.5 font-medium ${i % 2 ? "bg-muted" : "bg-background"}`}>
                      <div className="truncate max-w-[170px]">{r.name}</div>
                      {r.designation && <div className="text-[10px] text-muted-foreground">{r.designation}</div>}
                    </td>
                    {dates.map((d) => {
                      const c = r.cells[d];
                      const status = c?.status || "absent";
                      return (
                        <Tooltip key={d}>
                          <TooltipTrigger asChild>
                            <td className={`text-center font-semibold ${cellClass[status]} border border-background/60 cursor-default`}>
                              {STATUS_LABEL[status]}
                            </td>
                          </TooltipTrigger>
                          <TooltipContent className="text-xs">
                            <div className="font-semibold">{new Date(d + "T00:00:00").toLocaleDateString()}</div>
                            {c && c.status !== "absent" && c.status !== "sunday" && c.status !== "not_joined" ? (
                              <>
                                <div>In: {c.timeIn || "—"} · Out: {c.timeOut || "—"}</div>
                                <div>Worked: {hoursToHM(c.hours)} · OT: {hoursToHM(c.ot)}</div>
                                {c.late && <div className="text-rose-400">Late arrival</div>}
                                {c.early && <div className="text-amber-400">Early exit</div>}
                              </>
                            ) : (
                              <div>
                                {status === "sunday" ? "Sunday (weekly off)" : status === "not_joined" ? "Not joined yet" : "Absent"}
                              </div>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                    <td className="text-center font-semibold text-emerald-600">{r.presentDays}</td>
                    <td className="text-center font-semibold text-amber-600">{r.halfDays}</td>
                    <td className="text-center font-semibold text-rose-600">{r.absentDays}</td>
                    <td className="text-center">{hoursToHM(r.totalHours)}</td>
                    <td className="text-center">
                      {r.totalOT > 0 ? (
                        <Badge className="bg-violet-500/20 text-violet-700 dark:text-violet-300">{hoursToHM(r.totalOT)}</Badge>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-2">
                      <div className="flex items-center gap-2">
                        <Progress value={attendanceRate(r)} className="h-1.5 flex-1" />
                        <span className="text-[10px] w-8 text-right">{attendanceRate(r)}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );

  return embedded ? content : <DashboardLayout>{content}</DashboardLayout>;
}
