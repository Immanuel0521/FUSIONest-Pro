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
import { Calendar, Clock, Download, FileText, Users, UserCheck, UserX, AlertTriangle, TrendingUp, FileSpreadsheet } from "lucide-react";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from "sonner";
import { useCompanyContext } from "@/context/CompanyContext";
import {
  STANDARD_PAYABLE_HOURS,
  LUNCH_BREAK_HOURS,
  LATE_THRESHOLD_HOUR,
  LATE_THRESHOLD_MINUTE,
  EARLY_EXIT_THRESHOLD_HOUR,
  EARLY_EXIT_THRESHOLD_MINUTE,
  SHIFT_START_HOUR,
  SHIFT_END_HOUR,
  EARLY_OT_THRESHOLD_HOUR,
  EARLY_OT_THRESHOLD_MINUTE,
  isLateLogin,
  calculateLateMinutes,
  isEarlyExit,
  calculateEarlyOT,
  calculateEveningOT,
} from "@/lib/attendanceConfig";

interface Worker {
  id: string;
  full_name: string;
  photo_url: string | null;
}

interface DailyAttendance {
  id: string;
  worker_id: string;
  date: string;
  time_in: string | null;
  time_out: string | null;
  total_hours: number;
  overtime_hours: number;
  is_late: boolean;
  late_minutes: number;
  early_exit: boolean;
  notes_in: string | null;
  notes_out: string | null;
  workers: {
    full_name: string;
    photo_url: string | null;
  };
}

interface WorkerWithStatus {
  id: string;
  name: string;
  photoUrl: string | null;
  status: 'present' | 'absent' | 'late' | 'early' | 'ot' | 'in-progress';
  timeIn: string | null;
  timeOut: string | null;
  workingHours: number; // Capped at 8 hours
  overtimeHours: number; // Total OT (early + evening)
  earlyOTHours: number; // Early morning OT only
  eveningOTHours: number; // Evening OT only
  isLate: boolean;
  lateMinutes: number;
  earlyExit: boolean;
  notes: string | null;
  missingCheckout: boolean;
}

interface DailyReportProps {
  embedded?: boolean;
}

type FilterType = 'all' | 'present' | 'absent' | 'late' | 'early' | 'ot';

export default function DailyReport({ embedded = false }: DailyReportProps) {
  const { activeCompany } = useCompanyContext();
  const companyName = activeCompany?.name || "Company";
  const companySlug = (activeCompany?.name || "company").toLowerCase().replace(/[^a-z0-9]+/g, "-");

  const [allWorkers, setAllWorkers] = useState<Worker[]>([]);
  const [records, setRecords] = useState<DailyAttendance[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  useEffect(() => {
    loadData();
  }, [selectedDate]);

  const loadData = async () => {
    setLoading(true);
    
    // Load all workers and attendance in parallel
    const [workersRes, attendanceRes] = await Promise.all([
      supabase.from('workers').select('id, full_name, photo_url').order('full_name'),
      supabase
        .from('attendance_logs')
        .select(`*, workers (full_name, photo_url)`)
        .eq('date', selectedDate)
        .order('time_in', { ascending: false })
    ]);

    if (workersRes.data) setAllWorkers(workersRes.data);
    if (attendanceRes.data) setRecords(attendanceRes.data as any);
    setLoading(false);
  };

  /**
   * Calculate attendance metrics with NEW logic:
   * - Working hours = (Checkout - Checkin) - 1 hour lunch
   * - Working hours capped at 8 hours
   * - Overtime = time worked AFTER 6:10 PM (not hours beyond 8)
   * - Late only if after 9:30 AM
   * - Early exit only if before 5:30 PM
   */
  const calculateAttendanceMetrics = (timeIn: string | null, timeOut: string | null) => {
    if (!timeIn) return { workingHours: 0, overtimeHours: 0, earlyOTHours: 0, eveningOTHours: 0, isLate: false, lateMinutes: 0, earlyExit: false, missingCheckout: false };

    const checkIn = new Date(timeIn);
    
    // Late detection: only if after 9:30 AM
    const isLate = isLateLogin(checkIn);
    const lateMinutes = calculateLateMinutes(checkIn);

    // Early morning OT (login before 8:50 AM)
    const earlyOTHours = calculateEarlyOT(checkIn);

    if (!timeOut) {
      return { workingHours: 0, overtimeHours: earlyOTHours, earlyOTHours, eveningOTHours: 0, isLate, lateMinutes, earlyExit: false, missingCheckout: true };
    }

    const checkOut = new Date(timeOut);
    
    // Early exit detection: only if before 5:30 PM
    const earlyExit = isEarlyExit(checkOut);
    
    // Calculate total hours worked with lunch deduction
    const rawHours = Math.max(0, (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60));
    const hoursAfterLunch = Math.max(0, rawHours - LUNCH_BREAK_HOURS);
    
    // Working hours capped at 8 hours
    const workingHours = Math.min(hoursAfterLunch, STANDARD_PAYABLE_HOURS);
    
    // OT: Early morning + Evening (after 18:00)
    const eveningOTHours = calculateEveningOT(checkIn, checkOut);
    const overtimeHours = earlyOTHours + eveningOTHours;

    return { workingHours, overtimeHours, earlyOTHours, eveningOTHours, isLate, lateMinutes, earlyExit, missingCheckout: false };
  };

  // Combine workers with their attendance status
  const workersWithStatus = useMemo((): WorkerWithStatus[] => {
    const attendanceMap = new Map(records.map(r => [r.worker_id, r]));
    
    return allWorkers.map(worker => {
      const attendance = attendanceMap.get(worker.id);
      
      if (!attendance) {
        return {
          id: worker.id,
          name: worker.full_name,
          photoUrl: worker.photo_url,
          status: 'absent' as const,
          timeIn: null,
          timeOut: null,
          workingHours: 0,
          overtimeHours: 0,
          earlyOTHours: 0,
          eveningOTHours: 0,
          isLate: false,
          lateMinutes: 0,
          earlyExit: false,
          notes: null,
          missingCheckout: false,
        };
      }

      // Recalculate metrics from actual times with new logic
      const metrics = calculateAttendanceMetrics(attendance.time_in, attendance.time_out);
      
      const workingHours = metrics.workingHours;
      const overtimeHours = metrics.overtimeHours;
      const earlyOTHours = metrics.earlyOTHours;
      const eveningOTHours = metrics.eveningOTHours;
      const isLate = metrics.isLate;
      const lateMinutes = metrics.lateMinutes;
      const earlyExit = metrics.earlyExit;

      // Determine primary status
      let status: WorkerWithStatus['status'] = 'present';
      if (!attendance.time_out) status = 'in-progress';
      else if (overtimeHours > 0) status = 'ot';
      else if (isLate) status = 'late';
      else if (earlyExit) status = 'early';

      return {
        id: worker.id,
        name: worker.full_name,
        photoUrl: worker.photo_url,
        status,
        timeIn: attendance.time_in,
        timeOut: attendance.time_out,
        workingHours: parseFloat(workingHours.toFixed(2)),
        overtimeHours: parseFloat(overtimeHours.toFixed(2)),
        earlyOTHours: parseFloat(earlyOTHours.toFixed(2)),
        eveningOTHours: parseFloat(eveningOTHours.toFixed(2)),
        isLate,
        lateMinutes,
        earlyExit,
        notes: attendance.notes_in || attendance.notes_out || null,
        missingCheckout: metrics.missingCheckout,
      };
    });
  }, [allWorkers, records]);

  // Filter workers based on selected filter
  const filteredWorkers = useMemo(() => {
    if (filter === 'all') return workersWithStatus;
    if (filter === 'present') return workersWithStatus.filter(w => w.status !== 'absent');
    if (filter === 'absent') return workersWithStatus.filter(w => w.status === 'absent');
    if (filter === 'late') return workersWithStatus.filter(w => w.isLate);
    if (filter === 'early') return workersWithStatus.filter(w => w.earlyExit);
    if (filter === 'ot') return workersWithStatus.filter(w => w.overtimeHours > 0);
    return workersWithStatus;
  }, [workersWithStatus, filter]);

  // Pagination
  const totalPages = Math.ceil(filteredWorkers.length / itemsPerPage);
  const paginatedWorkers = filteredWorkers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Summary stats
  const stats = useMemo(() => {
    const totalOTHours = workersWithStatus.reduce((sum, w) => sum + w.overtimeHours, 0);
    return {
      total: allWorkers.length,
      present: workersWithStatus.filter(w => w.status !== 'absent').length,
      absent: workersWithStatus.filter(w => w.status === 'absent').length,
      late: workersWithStatus.filter(w => w.isLate).length,
      early: workersWithStatus.filter(w => w.earlyExit).length,
      ot: workersWithStatus.filter(w => w.overtimeHours > 0).length,
      totalOTHours: parseFloat(totalOTHours.toFixed(2)),
    };
  }, [workersWithStatus, allWorkers.length]);

  const formatTime = (timestamp: string | null) => {
    if (!timestamp) return "—";
    return new Date(timestamp).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const getStatusBadge = (worker: WorkerWithStatus) => {
    if (worker.status === 'absent') {
      return <Badge variant="destructive" className="bg-red-500">Absent</Badge>;
    }
    if (worker.status === 'in-progress') {
      return <Badge variant="outline" className="border-blue-500 text-blue-500">In Progress</Badge>;
    }
    
    const badges = [];
    if (worker.isLate) {
      badges.push(<Badge key="late" className="bg-orange-500">Late ({worker.lateMinutes}m)</Badge>);
    }
    if (worker.earlyExit) {
      badges.push(<Badge key="early" className="bg-yellow-600">Left Early</Badge>);
    }
    if (worker.overtimeHours > 0) {
      const otH = Math.floor(worker.overtimeHours);
      const otM = Math.round((worker.overtimeHours - otH) * 60);
      let otLabel = `OT +${otH}h ${otM}m`;
      if (worker.earlyOTHours > 0 && worker.eveningOTHours > 0) {
        otLabel += ` (AM+PM)`;
      } else if (worker.earlyOTHours > 0) {
        otLabel += ` (AM)`;
      }
      badges.push(<Badge key="ot" className="bg-blue-500">{otLabel}</Badge>);
    }
    if (badges.length === 0) {
      badges.push(<Badge key="present" className="bg-green-500">Present</Badge>);
    }
    return <div className="flex gap-1 flex-wrap">{badges}</div>;
  };

  const exportPDF = async () => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // Header with branding - Title: FUSIONest Workers Login
      doc.setFillColor(37, 99, 235);
      doc.rect(0, 0, pageWidth, 35, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text(`${companyName} Workers Login`, 14, 18);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('Daily Attendance Report', 14, 26);
      
      // Report Date
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(`Report Date: ${new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`, 14, 48);
      
      // Summary boxes: Presentees, Absentees, Total OT Hours
      const summaryY = 58;
      const boxWidth = 45;
      const boxGap = 5;
      
      const summaryItems = [
        { label: 'Presentees Count', value: stats.present, color: [34, 197, 94] },
        { label: 'Absentees Count', value: stats.absent, color: [239, 68, 68] },
        { label: 'Late Arrivals', value: stats.late, color: [249, 115, 22] },
        { label: 'Early Left', value: stats.early, color: [234, 179, 8] },
        { label: 'Total OT Hours', value: `${stats.totalOTHours}h`, color: [59, 130, 246] },
      ];
      
      summaryItems.forEach((item, idx) => {
        const x = 14 + (boxWidth + boxGap) * idx;
        doc.setFillColor(item.color[0], item.color[1], item.color[2]);
        doc.roundedRect(x, summaryY, boxWidth, 20, 2, 2, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(String(item.value), x + boxWidth / 2, summaryY + 9, { align: 'center' });
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.text(item.label, x + boxWidth / 2, summaryY + 16, { align: 'center' });
      });

      // Detailed Worker Table with NEW columns as per spec
      const tableData = workersWithStatus.map(w => [
        selectedDate, // Date
        w.name,
        formatTime(w.timeIn),
        formatTime(w.timeOut),
        w.workingHours > 0 ? `${w.workingHours.toFixed(2)}h` : '—',
        w.overtimeHours > 0 ? `${Math.floor(w.overtimeHours)}h ${Math.round((w.overtimeHours - Math.floor(w.overtimeHours)) * 60)}m` : '—',
        w.isLate ? `Yes (${w.lateMinutes}m)` : 'No',
        w.notes || '—'
      ]);

      autoTable(doc, {
        startY: 85,
        head: [['Date', 'Name', 'In Time', 'Out Time', 'Working Hours', 'OT (Hrs Min)', 'Late Entry', 'Notes']],
        body: tableData,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        didParseCell: (data) => {
          if (data.section === 'body') {
            const worker = workersWithStatus[data.row.index];
            // Highlight missing checkout with orange
            if (worker?.missingCheckout) {
              data.cell.styles.fillColor = [255, 237, 213];
            }
            // Highlight absent with red
            if (worker?.status === 'absent') {
              data.cell.styles.fillColor = [254, 226, 226];
            }
            // Highlight late entry
            if (data.column.index === 6 && data.cell.text[0]?.startsWith('Yes')) {
              data.cell.styles.fillColor = [255, 237, 213];
            }
          }
        }
      });

      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(128, 128, 128);
        doc.text(
          `Generated by ${companyName} · ${new Date().toLocaleString()}`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: 'center' }
        );
        doc.text(`Page ${i} of ${pageCount}`, pageWidth - 14, doc.internal.pageSize.getHeight() - 10, { align: 'right' });
      }

      doc.save(`${companySlug}-workers-login-${selectedDate}.pdf`);
      toast.success("PDF exported successfully!");
    } catch (error) {
      console.error('PDF export error:', error);
      toast.error("Failed to export PDF");
    }
  };

  const exportCSV = async () => {
    try {
      // Header row matching new format
      const headers = ['Date', 'Name', 'In Time', 'Out Time', 'Working Hours', 'OT Hours', 'OT Minutes', 'Late Entry', 'Notes'];
      const rows = workersWithStatus.map(w => [
        selectedDate,
        w.name,
        formatTime(w.timeIn),
        formatTime(w.timeOut),
        w.workingHours > 0 ? `${w.workingHours.toFixed(2)}` : '0',
        w.overtimeHours > 0 ? `${Math.floor(w.overtimeHours)}` : '0',
        w.overtimeHours > 0 ? `${Math.round((w.overtimeHours - Math.floor(w.overtimeHours)) * 60)}` : '0',
        w.isLate ? `Yes (${w.lateMinutes}m)` : 'No',
        w.notes || ''
      ]);

      // Add summary at top
      const summaryRows = [
        [`${companyName} Workers Login`],
        [`Report Date: ${new Date(selectedDate).toLocaleDateString()}`],
        [`Presentees Count: ${stats.present}`],
        [`Absentees Count: ${stats.absent}`],
        [`Total OT Hours: ${stats.totalOTHours}h`],
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
      a.download = `${companySlug}-workers-login-${selectedDate}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success("CSV exported successfully!");
    } catch (error) {
      console.error('CSV export error:', error);
      toast.error("Failed to export CSV");
    }
  };

  const exportExcel = async () => {
    try {
      const headers = ['Date', 'Name', 'In Time', 'Out Time', 'Working Hours', 'OT Hours', 'OT Minutes', 'Late Entry', 'Notes'];
      const rows = workersWithStatus.map(w => [
        selectedDate,
        w.name,
        formatTime(w.timeIn),
        formatTime(w.timeOut),
        w.workingHours > 0 ? w.workingHours.toFixed(2) : '0',
        w.overtimeHours > 0 ? Math.floor(w.overtimeHours).toString() : '0',
        w.overtimeHours > 0 ? Math.round((w.overtimeHours - Math.floor(w.overtimeHours)) * 60).toString() : '0',
        w.isLate ? `Yes (${w.lateMinutes}m)` : 'No',
        w.notes || ''
      ]);

      let xmlContent = '<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>';
      xmlContent += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">';
      xmlContent += '<Worksheet ss:Name="Daily Report"><Table>';
      
      // Title row
      xmlContent += `<Row><Cell><Data ss:Type="String">${companyName} Workers Login</Data></Cell></Row>`;
      xmlContent += `<Row><Cell><Data ss:Type="String">Report Date: ${new Date(selectedDate).toLocaleDateString()}</Data></Cell></Row>`;
      xmlContent += `<Row><Cell><Data ss:Type="String">Presentees: ${stats.present} | Absentees: ${stats.absent} | Total OT: ${stats.totalOTHours}h</Data></Cell></Row>`;
      xmlContent += '<Row></Row>';
      
      // Header row
      xmlContent += '<Row>';
      headers.forEach(h => {
        xmlContent += `<Cell><Data ss:Type="String">${h}</Data></Cell>`;
      });
      xmlContent += '</Row>';
      
      // Data rows
      rows.forEach(row => {
        xmlContent += '<Row>';
        row.forEach(cell => {
          xmlContent += `<Cell><Data ss:Type="String">${cell}</Data></Cell>`;
        });
        xmlContent += '</Row>';
      });
      
      xmlContent += '</Table></Worksheet></Workbook>';

      const blob = new Blob([xmlContent], { type: 'application/vnd.ms-excel' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${companySlug}-workers-login-${selectedDate}.xls`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success("Excel exported successfully!");
    } catch (error) {
      console.error('Excel export error:', error);
      toast.error("Failed to export Excel");
    }
  };

  const filterButtons: { key: FilterType; label: string; count: number; color: string }[] = [
    { key: 'all', label: 'All', count: stats.total, color: 'bg-secondary' },
    { key: 'present', label: 'Present', count: stats.present, color: 'bg-green-500' },
    { key: 'absent', label: 'Absent', count: stats.absent, color: 'bg-red-500' },
    { key: 'late', label: 'Late', count: stats.late, color: 'bg-orange-500' },
    { key: 'early', label: 'Early Left', count: stats.early, color: 'bg-yellow-600' },
    { key: 'ot', label: 'Overtime', count: stats.ot, color: 'bg-blue-500' },
  ];

  const content = (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Daily Attendance Report
        </h1>
        <p className="text-muted-foreground mt-2">
          View detailed attendance for a specific date
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">
        <Card className="p-4 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
          <div className="flex items-center gap-3">
            <UserCheck className="w-8 h-8 text-green-500" />
            <div>
              <p className="text-xs text-muted-foreground">Present</p>
              <p className="text-2xl font-bold text-green-600">{stats.present}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/20">
          <div className="flex items-center gap-3">
            <UserX className="w-8 h-8 text-red-500" />
            <div>
              <p className="text-xs text-muted-foreground">Absent</p>
              <p className="text-2xl font-bold text-red-600">{stats.absent}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-orange-500/10 to-orange-500/5 border-orange-500/20">
          <div className="flex items-center gap-3">
            <Clock className="w-8 h-8 text-orange-500" />
            <div>
              <p className="text-xs text-muted-foreground">Late</p>
              <p className="text-2xl font-bold text-orange-600">{stats.late}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-yellow-500/10 to-yellow-500/5 border-yellow-500/20">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-yellow-600" />
            <div>
              <p className="text-xs text-muted-foreground">Early Left</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.early}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-8 h-8 text-blue-500" />
            <div>
              <p className="text-xs text-muted-foreground">OT Workers</p>
              <p className="text-2xl font-bold text-blue-600">{stats.ot}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
          <div className="flex items-center gap-3">
            <Clock className="w-8 h-8 text-purple-500" />
            <div>
              <p className="text-xs text-muted-foreground">Total OT</p>
              <p className="text-2xl font-bold text-purple-600">{stats.totalOTHours}h</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
          <span>Present</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <span>Absent</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-orange-500"></div>
          <span>Late (after 9:30 AM)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
          <span>Early Left (before 5:30 PM)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500"></div>
          <span>Overtime (before 8:50 AM or after 6:00 PM)</span>
        </div>
      </div>

      <Card className="glass-card p-6">
        {/* Controls */}
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4 mb-6">
          <div className="flex-1 max-w-xs">
            <Label htmlFor="date">Select Date</Label>
            <Input
              id="date"
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setCurrentPage(1);
              }}
              className="glass-card border-primary/20"
            />
          </div>
          
          {/* Filter Toolbar */}
          <div className="flex flex-wrap gap-2">
            {filterButtons.map(btn => (
              <Button
                key={btn.key}
                variant={filter === btn.key ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setFilter(btn.key);
                  setCurrentPage(1);
                }}
                className={filter === btn.key ? btn.color : ''}
              >
                {btn.label} ({btn.count})
              </Button>
            ))}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="ml-auto">
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
                <FileText className="w-4 h-4 mr-2" />
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportExcel}>
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Export as Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : filteredWorkers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No records match the selected filter</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Worker</TableHead>
                    <TableHead>Check-In</TableHead>
                    <TableHead>Check-Out</TableHead>
                    <TableHead>Working Hours</TableHead>
                    <TableHead>Overtime</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedWorkers.map((worker) => (
                    <TableRow 
                      key={worker.id}
                      className={`${worker.status === 'absent' ? 'bg-red-50 dark:bg-red-950/20' : ''} ${worker.missingCheckout ? 'bg-orange-50 dark:bg-orange-950/20' : ''}`}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={worker.photoUrl || undefined} />
                            <AvatarFallback>
                              {worker.name.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <span className="font-medium">{worker.name}</span>
                            {worker.missingCheckout && (
                              <p className="text-xs text-orange-600">Missing checkout</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          <span className={worker.isLate ? 'text-orange-600 font-medium' : ''}>
                            {formatTime(worker.timeIn)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          <span className={worker.earlyExit ? 'text-yellow-600 font-medium' : ''}>
                            {formatTime(worker.timeOut)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">
                          {worker.workingHours > 0 ? `${worker.workingHours.toFixed(2)}h` : "—"}
                        </span>
                        <span className="text-xs text-muted-foreground ml-1">(max 8h)</span>
                      </TableCell>
                      <TableCell>
                        {worker.overtimeHours > 0 ? (
                          <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                            +{Math.floor(worker.overtimeHours)}h {Math.round((worker.overtimeHours - Math.floor(worker.overtimeHours)) * 60)}m
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(worker)}
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
                  Showing {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredWorkers.length)} of {filteredWorkers.length}
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
    </div>
  );

  return embedded ? content : <DashboardLayout>{content}</DashboardLayout>;
}
