import { useEffect, useState, useMemo } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/lib/supabase";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Calendar, TrendingUp, Clock, AlertTriangle, Download, FileText, Search, Users, Timer, FileSpreadsheet, ArrowUpDown, Percent, Sun } from "lucide-react";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from "sonner";
import {
  STANDARD_PAYABLE_HOURS,
  LUNCH_BREAK_HOURS,
  getWorkingDaysInMonth,
  getSundaysInMonth,
  calculateEarlyOT,
  calculateEveningOT,
} from "@/lib/attendanceConfig";

interface Worker {
  id: string;
  full_name: string;
  photo_url: string | null;
  date_of_joining: string | null;
}

interface AttendanceLog {
  id: string;
  worker_id: string;
  date: string;
  time_in: string;
  time_out: string | null;
  overtime_hours: number;
  is_late: boolean;
  early_exit: boolean;
}

interface OTDetail {
  date: string;
  timeIn: string;
  timeOut: string;
  earlyOT: number;
  eveningOT: number;
  totalOT: number;
}

interface MonthlyAttendanceStats {
  workerId: string;
  workerName: string;
  photoUrl: string | null;
  daysWorked: number;
  daysAbsent: number;
  sundayCount: number;
  totalOvertimeHours: number;
  lateArrivals: number;
  earlyExits: number;
  attendancePercentage: number;
  absentDates: string[];
  otDetails: OTDetail[];
}

interface MonthlyAttendanceProps {
  embedded?: boolean;
}

type SortKey = 'name' | 'worked' | 'absent' | 'late' | 'ot' | 'attendance';

export default function MonthlyAttendance({ embedded = false }: MonthlyAttendanceProps) {
  const [stats, setStats] = useState<MonthlyAttendanceStats[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Sheet for absent dates and OT details
  const [selectedWorkerAbsents, setSelectedWorkerAbsents] = useState<{ name: string; dates: string[] } | null>(null);
  const [selectedWorkerOTDetails, setSelectedWorkerOTDetails] = useState<{ name: string; details: OTDetail[] } | null>(null);

  useEffect(() => {
    loadMonthlyStats();
  }, [selectedMonth]);

  const loadMonthlyStats = async () => {
    setLoading(true);

    const { data: workers } = await supabase
      .from('workers')
      .select('id, full_name, photo_url, date_of_joining')
      .order('full_name');

    if (!workers) {
      setLoading(false);
      return;
    }

    const [year, month] = selectedMonth.split('-').map(Number);
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDayOfMonth = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;

    const { data: attendance } = await supabase
      .from('attendance_logs')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate);

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // Get working days (excluding Sundays only) and Sundays for the month
    const effectiveEndDate = todayStr < endDate ? new Date(todayStr) : new Date(endDate);
    const workingDays = getWorkingDaysInMonth(year, month - 1, effectiveEndDate);
    const sundays = getSundaysInMonth(year, month - 1, effectiveEndDate);

    const monthlyStats: MonthlyAttendanceStats[] = workers.map((worker) => {
      const workerAttendance = attendance?.filter(a => a.worker_id === worker.id) || [];
      const attendedDates = new Set(workerAttendance.map(a => a.date));

      // Effective start: later of (month start, worker join date)
      let effectiveStartDate = startDate;
      if (worker.date_of_joining && worker.date_of_joining > startDate) {
        effectiveStartDate = worker.date_of_joining;
      }

      // Filter working days to only those after the worker joined
      const applicableWorkingDays = workingDays.filter(d => 
        d.toISOString().split('T')[0] >= effectiveStartDate
      );

      // Absent dates: working days without attendance
      const absentDates = applicableWorkingDays
        .filter(d => !attendedDates.has(d.toISOString().split('T')[0]))
        .map(d => d.toISOString().split('T')[0]);

      // Days worked
      const daysWorked = workerAttendance.filter(a => 
        a.date >= effectiveStartDate && a.date <= (todayStr < endDate ? todayStr : endDate)
      ).length;

      // Calculate OT, late, early from attendance records with early morning OT
      let totalOvertimeHours = 0;
      let lateArrivals = 0;
      let earlyExits = 0;
      const otDetails: OTDetail[] = [];

      workerAttendance.forEach(a => {
        // Recalculate OT from actual times to include early morning OT
        const checkIn = new Date(a.time_in);
        const earlyOT = calculateEarlyOT(checkIn);
        let eveningOT = 0;
        
        if (a.time_out) {
          const checkOut = new Date(a.time_out);
          eveningOT = calculateEveningOT(checkIn, checkOut);
        }
        
        const dayOT = earlyOT + eveningOT;
        if (dayOT > 0) {
          totalOvertimeHours += dayOT;
          otDetails.push({
            date: a.date,
            timeIn: a.time_in,
            timeOut: a.time_out || '',
            earlyOT,
            eveningOT,
            totalOT: dayOT,
          });
        }
        if (a.is_late) lateArrivals++;
        if (a.early_exit) earlyExits++;
      });

      // Attendance percentage
      const attendancePercentage = applicableWorkingDays.length > 0 
        ? (daysWorked / applicableWorkingDays.length) * 100 
        : 0;

      return {
        workerId: worker.id,
        workerName: worker.full_name,
        photoUrl: worker.photo_url,
        daysWorked,
        daysAbsent: absentDates.length,
        sundayCount: sundays.length,
        totalOvertimeHours: parseFloat(totalOvertimeHours.toFixed(2)),
        lateArrivals,
        earlyExits,
        attendancePercentage: parseFloat(attendancePercentage.toFixed(1)),
        absentDates,
        otDetails,
      };
    });

    setStats(monthlyStats);
    setLoading(false);
  };

  // Filter and sort
  const filteredAndSortedStats = useMemo(() => {
    let result = stats.filter(s => 
      s.workerName.toLowerCase().includes(searchQuery.toLowerCase())
    );

    result.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'name': cmp = a.workerName.localeCompare(b.workerName); break;
        case 'worked': cmp = a.daysWorked - b.daysWorked; break;
        case 'absent': cmp = a.daysAbsent - b.daysAbsent; break;
        case 'late': cmp = a.lateArrivals - b.lateArrivals; break;
        case 'ot': cmp = a.totalOvertimeHours - b.totalOvertimeHours; break;
        case 'attendance': cmp = a.attendancePercentage - b.attendancePercentage; break;
      }
      return sortAsc ? cmp : -cmp;
    });

    return result;
  }, [stats, searchQuery, sortKey, sortAsc]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedStats.length / itemsPerPage);
  const paginatedStats = filteredAndSortedStats.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Summary
  const summary = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    const effectiveEnd = todayStr < endDate ? new Date(todayStr) : new Date(endDate);

    const workingDays = getWorkingDaysInMonth(year, month - 1, effectiveEnd);
    const sundays = getSundaysInMonth(year, month - 1, effectiveEnd);

    const totalDaysWorked = stats.reduce((sum, s) => sum + s.daysWorked, 0);
    const totalPossible = stats.length * workingDays.length;
    const overallAttendance = totalPossible > 0 ? ((totalDaysWorked / totalPossible) * 100).toFixed(1) : '0';
    const totalOT = stats.reduce((sum, s) => sum + s.totalOvertimeHours, 0);
    const totalAbsent = stats.reduce((sum, s) => sum + s.daysAbsent, 0);
    const totalLate = stats.reduce((sum, s) => sum + s.lateArrivals, 0);

    return {
      workingDays: workingDays.length,
      sundayCount: sundays.length,
      overallAttendance,
      totalOT,
      totalAbsent,
      totalLate,
      totalWorkers: stats.length,
    };
  }, [stats, selectedMonth]);

  const getMonthName = () => {
    const [year, month] = selectedMonth.split('-');
    return new Date(parseInt(year), parseInt(month) - 1).toLocaleString('en-US', { 
      month: 'long', 
      year: 'numeric' 
    });
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const exportPDF = () => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // Header
      doc.setFillColor(37, 99, 235);
      doc.rect(0, 0, pageWidth, 35, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text('FUSIONest Monthly Attendance', 14, 18);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('Attendance Overview Report (Management)', 14, 26);
      
      // Month
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(`Month: ${getMonthName()}`, 14, 48);
      
      // Summary boxes
      const summaryY = 58;
      const boxWidth = 40;
      const boxGap = 3;
      
      const summaryItems = [
        { label: 'Working Days', value: summary.workingDays, color: [59, 130, 246] },
        { label: 'Sundays', value: summary.sundayCount, color: [249, 115, 22] },
        { label: 'Attendance %', value: `${summary.overallAttendance}%`, color: [34, 197, 94] },
        { label: 'Total OT Hrs', value: summary.totalOT.toFixed(1), color: [139, 92, 246] },
        { label: 'Total Absences', value: summary.totalAbsent, color: [239, 68, 68] },
      ];
      
      summaryItems.forEach((item, idx) => {
        const x = 14 + (boxWidth + boxGap) * idx;
        doc.setFillColor(item.color[0], item.color[1], item.color[2]);
        doc.roundedRect(x, summaryY, boxWidth, 18, 2, 2, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(String(item.value), x + boxWidth / 2, summaryY + 8, { align: 'center' });
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.text(item.label, x + boxWidth / 2, summaryY + 14, { align: 'center' });
      });

      // Summary Table
      const tableData = stats.map(s => [
        s.workerName,
        s.daysWorked.toString(),
        s.daysAbsent.toString(),
        s.sundayCount.toString(),
        `${Math.floor(s.totalOvertimeHours)}h ${Math.round((s.totalOvertimeHours - Math.floor(s.totalOvertimeHours)) * 60)}m`,
        `${s.attendancePercentage}%`,
      ]);

      autoTable(doc, {
        startY: 85,
        head: [['Worker Name', 'Days Worked', 'Days Absent', 'Sundays', 'OT (Hrs Min)', 'Attendance %']],
        body: tableData,
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        didParseCell: (data) => {
          if (data.section === 'body') {
            const attendance = parseFloat(tableData[data.row.index]?.[5] || '0');
            if (data.column.index === 5) {
              if (attendance >= 90) data.cell.styles.textColor = [34, 197, 94];
              else if (attendance >= 75) data.cell.styles.textColor = [249, 115, 22];
              else data.cell.styles.textColor = [239, 68, 68];
            }
          }
        }
      });

      // DETAILED SECTION: Per-worker Leave Dates & OT Details
      stats.forEach(s => {
        if (s.absentDates.length === 0 && s.otDetails.length === 0) return;
        
        doc.addPage();
        doc.setFillColor(37, 99, 235);
        doc.rect(0, 0, pageWidth, 25, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(`${s.workerName} - Detailed Report`, 14, 16);

        let yPos = 35;

        // Leave Dates
        if (s.absentDates.length > 0) {
          doc.setTextColor(239, 68, 68);
          doc.setFontSize(12);
          doc.setFont('helvetica', 'bold');
          doc.text(`Leave Days: ${s.absentDates.length}`, 14, yPos);
          yPos += 5;

          const leaveData = s.absentDates.map((d, idx) => [
            (idx + 1).toString(),
            new Date(d).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' }),
          ]);

          autoTable(doc, {
            startY: yPos,
            head: [['#', 'Leave Date']],
            body: leaveData,
            styles: { fontSize: 9, cellPadding: 2 },
            headStyles: { fillColor: [239, 68, 68], textColor: 255 },
            alternateRowStyles: { fillColor: [254, 226, 226] },
          });

          yPos = (doc as any).lastAutoTable.finalY + 10;
        }

        // OT Details
        if (s.otDetails.length > 0) {
          if (yPos > 240) { doc.addPage(); yPos = 20; }

          doc.setTextColor(139, 92, 246);
          doc.setFontSize(12);
          doc.setFont('helvetica', 'bold');
          doc.text(`OT Details: ${Math.floor(s.totalOvertimeHours)}h ${Math.round((s.totalOvertimeHours - Math.floor(s.totalOvertimeHours)) * 60)}m total`, 14, yPos);
          yPos += 5;

          const formatTimeShort = (iso: string) => {
            if (!iso) return '—';
            return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
          };

          const otData = s.otDetails.map((ot, idx) => {
            const earlyLabel = ot.earlyOT > 0 ? `${Math.round(ot.earlyOT * 60)}m (AM)` : '—';
            const eveningLabel = ot.eveningOT > 0 ? `${Math.floor(ot.eveningOT)}h ${Math.round((ot.eveningOT - Math.floor(ot.eveningOT)) * 60)}m` : '—';
            return [
              (idx + 1).toString(),
              new Date(ot.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
              formatTimeShort(ot.timeIn),
              ot.timeOut ? formatTimeShort(ot.timeOut) : '—',
              earlyLabel,
              eveningLabel,
              `${Math.floor(ot.totalOT)}h ${Math.round((ot.totalOT - Math.floor(ot.totalOT)) * 60)}m`,
            ];
          });

          autoTable(doc, {
            startY: yPos,
            head: [['#', 'Date', 'Check-In', 'Check-Out', 'Early OT', 'Evening OT', 'Total OT']],
            body: otData,
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fillColor: [139, 92, 246], textColor: 255 },
            alternateRowStyles: { fillColor: [245, 243, 255] },
          });
        }
      });

      // Footer on all pages
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(128, 128, 128);
        doc.text(
          `Generated by FUSIONest Pro · ${new Date().toLocaleString()}`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: 'center' }
        );
        doc.text(`Page ${i} of ${pageCount}`, pageWidth - 14, doc.internal.pageSize.getHeight() - 10, { align: 'right' });
      }

      doc.save(`monthly-attendance-overview-${selectedMonth}.pdf`);
      toast.success("PDF exported with detailed leave & OT info!");
    } catch (error) {
      console.error('PDF export error:', error);
      toast.error("Failed to export PDF");
    }
  };

  const exportCSV = () => {
    try {
      const headers = ['Worker Name', 'Days Worked', 'Days Absent', 'Sundays', 'OT Hours', 'OT Minutes', 'Late Arrivals', 'Early Exits', 'Attendance %'];
      const rows = stats.map(s => [
        s.workerName,
        s.daysWorked.toString(),
        s.daysAbsent.toString(),
        s.sundayCount.toString(),
        Math.floor(s.totalOvertimeHours).toString(),
        Math.round((s.totalOvertimeHours - Math.floor(s.totalOvertimeHours)) * 60).toString(),
        s.lateArrivals.toString(),
        s.earlyExits.toString(),
        `${s.attendancePercentage}%`,
      ]);

      const summaryRows = [
        ['FUSIONest Monthly Attendance Overview'],
        [`Month: ${getMonthName()}`],
        [`Working Days: ${summary.workingDays} | Sundays: ${summary.sundayCount}`],
        [`Overall Attendance: ${summary.overallAttendance}%`],
        [''],
      ];

      const csv = [
        ...summaryRows.map(row => row.join(',')),
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `monthly-attendance-overview-${selectedMonth}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success("CSV exported successfully!");
    } catch (error) {
      console.error('CSV export error:', error);
      toast.error("Failed to export CSV");
    }
  };

  const SortButton = ({ sortKeyVal, label }: { sortKeyVal: SortKey; label: string }) => (
    <button 
      onClick={() => handleSort(sortKeyVal)}
      className="flex items-center gap-1 hover:text-primary transition-colors"
    >
      {label}
      <ArrowUpDown className="w-3 h-3" />
    </button>
  );

  const content = (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Monthly Attendance Overview
        </h1>
        <p className="text-muted-foreground mt-2">
          Attendance summary for {getMonthName()} (Management Review)
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <Card className="p-4 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <div className="flex items-center gap-3">
            <Calendar className="w-8 h-8 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Working Days</p>
              <p className="text-2xl font-bold">{summary.workingDays}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-orange-500/10 to-orange-500/5 border-orange-500/20">
          <div className="flex items-center gap-3">
            <Sun className="w-8 h-8 text-orange-500" />
            <div>
              <p className="text-xs text-muted-foreground">Sundays</p>
              <p className="text-2xl font-bold text-orange-600">{summary.sundayCount}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
          <div className="flex items-center gap-3">
            <Percent className="w-8 h-8 text-green-500" />
            <div>
              <p className="text-xs text-muted-foreground">Attendance</p>
              <p className="text-2xl font-bold text-green-600">{summary.overallAttendance}%</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-8 h-8 text-purple-500" />
            <div>
              <p className="text-xs text-muted-foreground">Total OT</p>
              <p className="text-2xl font-bold text-purple-600">{summary.totalOT.toFixed(1)}h</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/20">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-red-500" />
            <div>
              <p className="text-xs text-muted-foreground">Absences</p>
              <p className="text-2xl font-bold text-red-600">{summary.totalAbsent}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-yellow-500/10 to-yellow-500/5 border-yellow-500/20">
          <div className="flex items-center gap-3">
            <Clock className="w-8 h-8 text-yellow-600" />
            <div>
              <p className="text-xs text-muted-foreground">Late Total</p>
              <p className="text-2xl font-bold text-yellow-600">{summary.totalLate}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-secondary/50 to-secondary/20">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Workers</p>
              <p className="text-2xl font-bold">{summary.totalWorkers}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Note about Sundays */}
      <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900 rounded-lg p-3 text-sm">
        <Sun className="w-4 h-4 inline-block mr-2 text-orange-500" />
        <strong>Note:</strong> Sundays are not counted as absent days or working days. They are shown separately for reference.
      </div>

      <Card className="glass-card p-6">
        {/* Controls */}
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4 mb-6">
          <div className="flex-1 max-w-xs">
            <Label htmlFor="month">Select Month</Label>
            <Input
              id="month"
              type="month"
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                setCurrentPage(1);
              }}
              className="glass-card border-primary/20"
            />
          </div>
          
          <div className="flex-1 max-w-sm">
            <Label htmlFor="search">Search Worker</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Search by name..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-10 glass-card border-primary/20"
              />
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="mt-auto">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={exportPDF}>
                <FileText className="w-4 h-4 mr-2" />
                Export as PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportCSV}>
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Export as CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : filteredAndSortedStats.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No workers found</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead><SortButton sortKeyVal="name" label="Worker Name" /></TableHead>
                    <TableHead><SortButton sortKeyVal="worked" label="Days Worked" /></TableHead>
                    <TableHead><SortButton sortKeyVal="absent" label="Days Absent" /></TableHead>
                    <TableHead>Sundays</TableHead>
                    <TableHead><SortButton sortKeyVal="ot" label="OT Hours" /></TableHead>
                    <TableHead><SortButton sortKeyVal="attendance" label="Attendance %" /></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedStats.map((stat) => (
                    <TableRow key={stat.workerId}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={stat.photoUrl || undefined} />
                            <AvatarFallback className="text-xs">
                              {stat.workerName.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{stat.workerName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold text-green-600">
                        {stat.daysWorked}
                      </TableCell>
                      <TableCell>
                        {stat.daysAbsent > 0 ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="p-0 h-auto hover:bg-transparent"
                            onClick={() => setSelectedWorkerAbsents({ name: stat.workerName, dates: stat.absentDates })}
                          >
                            <Badge variant="destructive" className="cursor-pointer">
                              {stat.daysAbsent}
                            </Badge>
                          </Button>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-orange-600">
                        {stat.sundayCount}
                      </TableCell>
                      <TableCell>
                        {stat.totalOvertimeHours > 0 ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="p-0 h-auto hover:bg-transparent"
                            onClick={() => setSelectedWorkerOTDetails({ name: stat.workerName, details: stat.otDetails })}
                          >
                            <Badge className="bg-purple-500 cursor-pointer">
                              {Math.floor(stat.totalOvertimeHours)}h {Math.round((stat.totalOvertimeHours - Math.floor(stat.totalOvertimeHours)) * 60)}m
                            </Badge>
                          </Button>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={
                          stat.attendancePercentage >= 90 ? 'bg-green-500' :
                          stat.attendancePercentage >= 75 ? 'bg-yellow-500' :
                          'bg-red-500'
                        }>
                          {stat.attendancePercentage}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Showing {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredAndSortedStats.length)} of {filteredAndSortedStats.length}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Absent Dates Sheet */}
      <Sheet open={!!selectedWorkerAbsents} onOpenChange={() => setSelectedWorkerAbsents(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Absent Dates - {selectedWorkerAbsents?.name}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-2">
            {selectedWorkerAbsents?.dates.length === 0 ? (
              <p className="text-muted-foreground">No absences recorded.</p>
            ) : (
              selectedWorkerAbsents?.dates.map(date => (
                <div key={date} className="flex items-center gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900">
                  <Calendar className="w-4 h-4 text-red-500" />
                  <span>{new Date(date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* OT Details Sheet */}
      <Sheet open={!!selectedWorkerOTDetails} onOpenChange={() => setSelectedWorkerOTDetails(null)}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>OT Details - {selectedWorkerOTDetails?.name}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-3">
            {selectedWorkerOTDetails?.details.length === 0 ? (
              <p className="text-muted-foreground">No overtime recorded.</p>
            ) : (
              selectedWorkerOTDetails?.details.map((ot, idx) => {
                const formatT = (iso: string) => iso ? new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—';
                return (
                  <div key={idx} className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-purple-500" />
                        <span className="font-medium">
                          {new Date(ot.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      <Badge className="bg-purple-500">+{Math.floor(ot.totalOT)}h {Math.round((ot.totalOT - Math.floor(ot.totalOT)) * 60)}m</Badge>
                    </div>
                    <div className="mt-2 text-sm text-muted-foreground space-y-1">
                      <p>Check-in: {formatT(ot.timeIn)} → Check-out: {ot.timeOut ? formatT(ot.timeOut) : '—'}</p>
                      {ot.earlyOT > 0 && <p className="text-blue-600">Early AM OT: {Math.round(ot.earlyOT * 60)}m (before 9:00 AM)</p>}
                      {ot.eveningOT > 0 && <p className="text-purple-600">Evening OT: {Math.floor(ot.eveningOT)}h {Math.round((ot.eveningOT - Math.floor(ot.eveningOT)) * 60)}m (after 6:00 PM)</p>}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );

  return embedded ? content : <DashboardLayout>{content}</DashboardLayout>;
}
