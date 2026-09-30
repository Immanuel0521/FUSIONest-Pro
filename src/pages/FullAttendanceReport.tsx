import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  FileSpreadsheet, FileText, Users, Clock, Timer, CalendarX,
  Search, Loader2, TrendingUp, Calendar, CalendarDays, Plus, Trash2, Sparkles, AlertCircle
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  Tooltip as RTooltip, Legend, AreaChart, Area
} from "recharts";
import {
  classifyLog, hoursToHM, round2, STATUS_LABEL, type DayCell, type DayStatus
} from "@/lib/attendanceMetrics";
import {
  exportMatrixExcel, exportMatrixPdf, type MatrixData, type MatrixRow
} from "@/lib/attendanceReport";
import { useAttendanceGroups, groupChip } from "@/hooks/useAttendanceGroups";
import { useCompanyContext } from "@/context/CompanyContext";
import {
  fetchCompanyHolidays, addCompanyHoliday, removeCompanyHoliday,
  seedStandardHolidays, type CompanyHoliday
} from "@/lib/holidayConfig";

interface Props {
  embedded?: boolean;
}

const cellClass: Record<DayStatus, string> = {
  present:        "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
  half_day:       "bg-amber-500/25 text-amber-800 dark:text-amber-300",
  absent:         "bg-rose-500/20 text-rose-700 dark:text-rose-300",
  in_progress:    "bg-blue-500/20 text-blue-700 dark:text-blue-300",
  sunday:         "bg-muted text-muted-foreground",
  sunday_worked:  "bg-indigo-500/25 text-indigo-700 dark:text-indigo-300 font-bold",
  holiday:        "bg-sky-500/20 text-sky-700 dark:text-sky-300",
  holiday_worked: "bg-purple-500/25 text-purple-700 dark:text-purple-300 font-bold",
  not_joined:     "bg-muted/40 text-muted-foreground/60",
};

export default function FullAttendanceReport({ embedded = false }: Props) {
  const { activeCompany } = useCompanyContext();
  const [month, setMonth] = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
  });
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<MatrixRow[]>([]);
  const [dates, setDates] = useState<string[]>([]);
  const [holidays, setHolidays] = useState<CompanyHoliday[]>([]);
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState<string | null>(null);
  const { groups } = useAttendanceGroups();

  // Holiday dialog state
  const [holidayDialogOpen, setHolidayDialogOpen] = useState(false);
  const [newHolidayDate, setNewHolidayDate] = useState("");
  const [newHolidayName, setNewHolidayName] = useState("");
  const [holidaySaving, setHolidaySaving] = useState(false);

  const monthLabel = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }, [month]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, activeCompany?.id]);

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

    // Load company holidays
    const companyId = activeCompany?.id || "default";
    const holList = await fetchCompanyHolidays(companyId);
    setHolidays(holList);

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

    const holidayMap = new Map<string, string>();
    holList.forEach((h) => holidayMap.set(h.holiday_date, h.name));

    const built: MatrixRow[] = ((workers as any[]) || []).map((w) => {
      const cells: Record<string, DayCell> = {};
      let presentDays = 0, halfDays = 0, absentDays = 0, totalHours = 0, totalOT = 0;
      let sundayWorkedDays = 0, holidayWorkedDays = 0;
      let lateCount = 0, earlyCount = 0;
      const joining = w.date_of_joining ? new Date(w.date_of_joining + "T00:00:00") : null;

      dateList.forEach((d) => {
        const log = logsByWorker.get(w.id)?.get(d);
        const dt = new Date(d + "T00:00:00");
        const isSun = dt.getDay() === 0;
        const holName = holidayMap.get(d);
        const isHol = Boolean(holName);

        if (log) {
          const cell = classifyLog(log, isHol, holName);
          cells[d] = cell;

          if (isSun) {
            sundayWorkedDays++;
          } else if (isHol) {
            holidayWorkedDays++;
          } else {
            if (cell.status === "present") presentDays++;
            else if (cell.status === "half_day") halfDays++;
          }

          totalHours += cell.hours;
          totalOT += cell.ot;
          if (cell.late) lateCount++;
          if (cell.early) earlyCount++;
        } else if (joining && dt < joining) {
          cells[d] = { status: "not_joined", hours: 0, ot: 0, late: false, early: false };
        } else if (isSun) {
          cells[d] = { status: "sunday", hours: 0, ot: 0, late: false, early: false };
        } else if (isHol) {
          cells[d] = { status: "holiday", hours: 0, ot: 0, late: false, early: false, holidayName: holName };
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
        sundayWorkedDays,
        holidayWorkedDays,
        halfDays,
        absentDays,
        totalDaysWorked: presentDays + sundayWorkedDays + holidayWorkedDays,
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

  // Month-level breakdown of working days, Sundays, and holidays
  const monthCalendarStats = useMemo(() => {
    let sundays = 0;
    let monthHols = 0;
    dates.forEach((d) => {
      const dt = new Date(d + "T00:00:00");
      const isSun = dt.getDay() === 0;
      const isHol = holidays.some((h) => h.holiday_date === d);
      if (isSun) sundays++;
      else if (isHol) monthHols++;
    });
    const workingDays = Math.max(0, dates.length - sundays - monthHols);
    return {
      totalDays: dates.length,
      sundays,
      holidays: monthHols,
      workingDays,
    };
  }, [dates, holidays]);

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
          sundayWorked: a.sundayWorked + (r.sundayWorkedDays || 0),
          holidayWorked: a.holidayWorked + (r.holidayWorkedDays || 0),
          totalWorked: a.totalWorked + (r.totalDaysWorked || r.presentDays),
          hours: a.hours + r.totalHours,
          ot: a.ot + r.totalOT,
          late: a.late + r.lateCount,
        }),
        { present: 0, half: 0, absent: 0, sundayWorked: 0, holidayWorked: 0, totalWorked: 0, hours: 0, ot: 0, late: 0 }
      ),
    [visibleRows]
  );

  const dailyTrend = useMemo(
    () =>
      dates.map((d) => {
        let present = 0, half = 0, absent = 0, sundayWorked = 0, holidayWorked = 0, ot = 0;
        visibleRows.forEach((r) => {
          const c = r.cells[d];
          if (!c) return;
          if (c.status === "present" || c.status === "in_progress") present++;
          else if (c.status === "half_day") half++;
          else if (c.status === "sunday_worked") sundayWorked++;
          else if (c.status === "holiday_worked") holidayWorked++;
          else if (c.status === "absent") absent++;
          ot += c.ot;
        });
        return {
          day: Number(d.split("-")[2]),
          "Workday Present": present,
          "Half Day": half,
          "Sunday OT": sundayWorked,
          "Holiday OT": holidayWorked,
          Absent: absent,
          OT: round2(ot),
        };
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

  const matrix = (): MatrixData => ({
    monthLabel,
    dates,
    rows: visibleRows,
    workingDaysCount: monthCalendarStats.workingDays,
    sundaysCount: monthCalendarStats.sundays,
    holidaysCount: monthCalendarStats.holidays,
  });

  const attendanceRate = (r: MatrixRow) => {
    const counted = r.presentDays + r.halfDays + r.absentDays;
    if (!counted) return 0;
    return Math.round(((r.presentDays + r.halfDays * 0.5) / counted) * 100);
  };

  // ── Holiday Handlers ────────────────────────────────────────────────────────
  const handleAddHoliday = async () => {
    if (!newHolidayDate) { toast.error("Please pick a date for the holiday"); return; }
    if (!newHolidayName.trim()) { toast.error("Please enter a holiday name (e.g. Independence Day)"); return; }
    setHolidaySaving(true);
    try {
      const companyId = activeCompany?.id || "default";
      await addCompanyHoliday(companyId, newHolidayDate, newHolidayName.trim());
      toast.success(`Holiday "${newHolidayName.trim()}" added on ${newHolidayDate}`);
      setNewHolidayDate("");
      setNewHolidayName("");
      await load();
    } catch (e: any) {
      toast.error(e.message || "Failed to add holiday");
    } finally {
      setHolidaySaving(false);
    }
  };

  const handleRemoveHoliday = async (id: string, date: string, name: string) => {
    try {
      const companyId = activeCompany?.id || "default";
      await removeCompanyHoliday(id, companyId, date);
      toast.success(`Removed holiday "${name}"`);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Failed to remove holiday");
    }
  };

  const handleImportStandards = async () => {
    setHolidaySaving(true);
    try {
      const [y] = month.split("-").map(Number);
      const companyId = activeCompany?.id || "default";
      await seedStandardHolidays(companyId, y);
      toast.success(`Standard public holidays imported for ${y}!`);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Failed to import holidays");
    } finally {
      setHolidaySaving(false);
    }
  };

  const content = (
    <div className="space-y-5">
      {!embedded && (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Full Attendance Report
            </h1>
            <p className="text-muted-foreground mt-1">
              Master attendance sheet with working days, Sundays, holidays, and overtime (OT) breakdown
            </p>
          </div>
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
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => setHolidayDialogOpen(true)}
            className="gap-1.5 border-dashed border-sky-500/50 text-sky-700 dark:text-sky-300 hover:bg-sky-500/10"
          >
            <Sparkles className="w-4 h-4 text-sky-500" />
            Manage Holidays ({holidays.length})
          </Button>
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
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <Card className="p-3 relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-teal-500 to-emerald-500" />
          <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
            <Users className="w-3.5 h-3.5" /> Workers
          </div>
          <div className="text-xl font-bold mt-1">{visibleRows.length}</div>
          <p className="text-[10px] text-muted-foreground mt-0.5">Total registered</p>
        </Card>

        <Card className="p-3 relative overflow-hidden bg-primary/5">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary to-accent" />
          <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
            <Calendar className="w-3.5 h-3.5" /> Working Days
          </div>
          <div className="text-xl font-bold mt-1 text-primary">{monthCalendarStats.workingDays}</div>
          <p className="text-[10px] text-muted-foreground mt-0.5">Excludes Sun & Hol</p>
        </Card>

        <Card className="p-3 relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-400 to-blue-500" />
          <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
            <CalendarDays className="w-3.5 h-3.5" /> Sundays / Hol
          </div>
          <div className="text-xl font-bold mt-1 text-sky-600">{monthCalendarStats.sundays} / {monthCalendarStats.holidays}</div>
          <p className="text-[10px] text-muted-foreground mt-0.5">Official Off-Days</p>
        </Card>

        <Card className="p-3 relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 to-green-600" />
          <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
            <TrendingUp className="w-3.5 h-3.5" /> Workday Present
          </div>
          <div className="text-xl font-bold mt-1 text-emerald-600">{totals.present}</div>
          <p className="text-[10px] text-muted-foreground mt-0.5">Normal shifts</p>
        </Card>

        <Card className="p-3 relative overflow-hidden bg-indigo-500/5">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 to-purple-600" />
          <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
            <Clock className="w-3.5 h-3.5" /> Sunday Duty
          </div>
          <div className="text-xl font-bold mt-1 text-indigo-600">{totals.sundayWorked}</div>
          <p className="text-[10px] text-muted-foreground mt-0.5">Counted as OT</p>
        </Card>

        <Card className="p-3 relative overflow-hidden bg-purple-500/5">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-purple-500 to-pink-600" />
          <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
            <Sparkles className="w-3.5 h-3.5" /> Holiday Duty
          </div>
          <div className="text-xl font-bold mt-1 text-purple-600">{totals.holidayWorked}</div>
          <p className="text-[10px] text-muted-foreground mt-0.5">Counted as OT</p>
        </Card>

        <Card className="p-3 relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-500 to-purple-600" />
          <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
            <Timer className="w-3.5 h-3.5" /> Total OT
          </div>
          <div className="text-xl font-bold mt-1 text-violet-600">{hoursToHM(totals.ot)}</div>
          <p className="text-[10px] text-muted-foreground mt-0.5">All OT hours</p>
        </Card>

        <Card className="p-3 relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-rose-500 to-red-600" />
          <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
            <CalendarX className="w-3.5 h-3.5" /> Absent Days
          </div>
          <div className="text-xl font-bold mt-1 text-rose-600">{totals.absent}</div>
          <p className="text-[10px] text-muted-foreground mt-0.5">Regular workdays</p>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <h3 className="font-semibold text-sm mb-3">Daily Attendance Trend (Workdays vs OT Duty)</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyTrend}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="day" fontSize={11} />
                <YAxis fontSize={11} />
                <RTooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="Workday Present" stackId="1" stroke="#059669" fill="#6ee7b7" />
                <Area type="monotone" dataKey="Sunday OT" stackId="1" stroke="#4f46e5" fill="#c7d2fe" />
                <Area type="monotone" dataKey="Holiday OT" stackId="1" stroke="#9333ea" fill="#e9d5ff" />
                <Area type="monotone" dataKey="Absent" stackId="1" stroke="#dc2626" fill="#fca5a5" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-4">
          <h3 className="font-semibold text-sm mb-3">Top Overtime Earners (Including Sundays & Holidays)</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topOT}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="name" fontSize={11} />
                <YAxis fontSize={11} />
                <RTooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Hours" fill="#0d9488" radius={[4, 4, 0, 0]} name="Regular Hrs" />
                <Bar dataKey="OT" fill="#7c3aed" radius={[4, 4, 0, 0]} name="OT Hrs" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge className={`${cellClass.present} font-medium`}>P — Workday Present</Badge>
        <Badge className={`${cellClass.half_day} font-medium`}>HD — Half Day (&lt;4.5h)</Badge>
        <Badge className={`${cellClass.absent} font-medium`}>A — Absent (Workday)</Badge>
        <Badge className={`${cellClass.sunday} font-medium`}>S — Sunday (Off)</Badge>
        <Badge className={`${cellClass.sunday_worked} font-medium`}>SW — Sunday Worked (OT)</Badge>
        <Badge className={`${cellClass.holiday} font-medium`}>H — Holiday (Off)</Badge>
        <Badge className={`${cellClass.holiday_worked} font-medium`}>HW — Holiday Worked (OT)</Badge>
        <Badge className={`${cellClass.in_progress} font-medium`}>IN — Active Shift</Badge>
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
                  <th className="sticky left-0 z-30 bg-primary px-3 py-2 text-left min-w-[170px]">Worker</th>
                  {dates.map((d) => {
                    const dt = new Date(d + "T00:00:00");
                    const isSun = dt.getDay() === 0;
                    const hol = holidays.find((h) => h.holiday_date === d);
                    return (
                      <th
                        key={d}
                        className={`px-1 py-1.5 min-w-[30px] font-medium ${isSun ? "bg-primary/80" : hol ? "bg-sky-700" : ""}`}
                        title={hol ? `Holiday: ${hol.name}` : isSun ? "Sunday" : d}
                      >
                        <div>{Number(d.split("-")[2])}</div>
                        <div className="opacity-80 text-[8px]">
                          {hol ? "H" : dt.toLocaleDateString("en-US", { weekday: "narrow" })}
                        </div>
                      </th>
                    );
                  })}
                  <th className="px-2 py-2 min-w-[42px]" title="Working Days Present">P</th>
                  <th className="px-2 py-2 min-w-[42px]" title="Sunday Duty (Counted as OT)">SW</th>
                  <th className="px-2 py-2 min-w-[42px]" title="Holiday Duty (Counted as OT)">HW</th>
                  <th className="px-2 py-2 min-w-[46px]" title="Total Days Worked (P + SW + HW)">Tot</th>
                  <th className="px-2 py-2 min-w-[42px]" title="Absent Workdays">A</th>
                  <th className="px-2 py-2 min-w-[65px]">Reg Hrs</th>
                  <th className="px-2 py-2 min-w-[65px]">OT Hrs</th>
                  <th className="px-2 py-2 min-w-[100px]">Attendance</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((r, i) => (
                  <tr key={r.workerId} className={i % 2 ? "bg-muted/30" : ""}>
                    <td className={`sticky left-0 z-10 px-3 py-1.5 font-medium ${i % 2 ? "bg-muted" : "bg-background"}`}>
                      <div className="truncate max-w-[160px] font-semibold">{r.name}</div>
                      {r.designation && <div className="text-[10px] text-muted-foreground">{r.designation}</div>}
                    </td>
                    {dates.map((d) => {
                      const c = r.cells[d];
                      const status = c?.status || "absent";
                      return (
                        <Tooltip key={d}>
                          <TooltipTrigger asChild>
                            <td className={`text-center font-semibold ${cellClass[status]} border border-background/60 cursor-default p-0 h-7`}>
                              {STATUS_LABEL[status]}
                            </td>
                          </TooltipTrigger>
                          <TooltipContent className="text-xs">
                            <div className="font-semibold">{new Date(d + "T00:00:00").toLocaleDateString()}</div>
                            {status === "sunday_worked" ? (
                              <div className="text-indigo-400 font-medium">Sunday Duty (100% OT): {hoursToHM(c?.ot || 0)}</div>
                            ) : status === "holiday_worked" ? (
                              <div className="text-purple-400 font-medium">Holiday Duty ({c?.holidayName}): 100% OT ({hoursToHM(c?.ot || 0)})</div>
                            ) : status === "holiday" ? (
                              <div className="text-sky-400 font-medium">Company Holiday: {c?.holidayName || "Public Holiday"}</div>
                            ) : status === "sunday" ? (
                              <div className="text-muted-foreground">Sunday (Weekly Off)</div>
                            ) : c && c.status !== "absent" && c.status !== "not_joined" ? (
                              <>
                                <div>In: {c.timeIn || "—"} · Out: {c.timeOut || "—"}</div>
                                <div>Worked: {hoursToHM(c.hours)} · OT: {hoursToHM(c.ot)}</div>
                                {c.late && <div className="text-rose-400">Late arrival</div>}
                                {c.early && <div className="text-amber-400">Early exit</div>}
                              </>
                            ) : (
                              <div>{status === "not_joined" ? "Not joined yet" : "Absent on Workday"}</div>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                    <td className="text-center font-bold text-emerald-600">{r.presentDays}</td>
                    <td className="text-center font-bold text-indigo-600" title="Sundays Worked (OT)">
                      {r.sundayWorkedDays > 0 ? (
                        <span className="px-1.5 py-0.5 rounded bg-indigo-500/20">{r.sundayWorkedDays}</span>
                      ) : "0"}
                    </td>
                    <td className="text-center font-bold text-purple-600" title="Holidays Worked (OT)">
                      {r.holidayWorkedDays > 0 ? (
                        <span className="px-1.5 py-0.5 rounded bg-purple-500/20">{r.holidayWorkedDays}</span>
                      ) : "0"}
                    </td>
                    <td className="text-center font-bold text-teal-700 dark:text-teal-300">
                      {r.totalDaysWorked}
                    </td>
                    <td className="text-center font-bold text-rose-600">{r.absentDays}</td>
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
                        <span className="text-[10px] w-8 text-right font-medium">{attendanceRate(r)}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── Holiday Management Dialog ── */}
      <Dialog open={holidayDialogOpen} onOpenChange={setHolidayDialogOpen}>
        <DialogContent className="max-w-md glass-heavy">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-sky-500" />
              Company Holidays & OT Settings
            </DialogTitle>
            <DialogDescription>
              Holidays are excluded from normal working days. Workers who duty on these dates receive 100% Overtime (OT).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Add Holiday Form */}
            <div className="p-3 rounded-xl border border-border/40 bg-muted/20 space-y-3">
              <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-primary" /> Add Custom Holiday
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[11px]">Holiday Date</Label>
                  <Input
                    type="date"
                    value={newHolidayDate}
                    onChange={(e) => setNewHolidayDate(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">Holiday Name</Label>
                  <Input
                    placeholder="e.g. Independence Day"
                    value={newHolidayName}
                    onChange={(e) => setNewHolidayName(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
              <Button
                size="sm"
                onClick={handleAddHoliday}
                disabled={holidaySaving}
                className="w-full h-8 text-xs gap-1.5"
              >
                {holidaySaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Add Holiday
              </Button>
            </div>

            {/* Existing Holidays */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold">Configured Holidays ({holidays.length})</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleImportStandards}
                  disabled={holidaySaving}
                  className="h-7 text-[11px] text-primary hover:bg-primary/10 gap-1"
                >
                  <Sparkles className="w-3 h-3" /> Import National Holidays
                </Button>
              </div>

              {holidays.length === 0 ? (
                <div className="text-center py-6 text-xs text-muted-foreground border border-dashed rounded-xl p-4">
                  <AlertCircle className="w-6 h-6 mx-auto mb-1 text-muted-foreground/60" />
                  No holidays configured yet.
                  <p className="mt-1">Click "Import National Holidays" or add August 15th above.</p>
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                  {holidays.map((h) => (
                    <div
                      key={h.id || h.holiday_date}
                      className="flex items-center justify-between p-2 rounded-lg bg-background border border-border/30 text-xs"
                    >
                      <div>
                        <p className="font-semibold">{h.name}</p>
                        <p className="text-[10px] text-muted-foreground">{new Date(h.holiday_date + "T00:00:00").toLocaleDateString("en-US", { dateStyle: "medium" })}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveHoliday(h.id, h.holiday_date, h.name)}
                        className="h-7 w-7 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-lg"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setHolidayDialogOpen(false)} className="w-full">
              Close & Update Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  return embedded ? content : <DashboardLayout>{content}</DashboardLayout>;
}
