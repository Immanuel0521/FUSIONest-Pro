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
import { Calendar, TrendingUp, Download, FileText, Search, Users, FileSpreadsheet, ArrowUpDown, IndianRupee, Clock } from "lucide-react";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from "sonner";
import {
  STANDARD_PAYABLE_HOURS,
  LUNCH_BREAK_HOURS,
  getWorkingDaysInMonth,
  calculateSalary,
  calculateEarlyOT,
  calculateEveningOT,
} from "@/lib/attendanceConfig";

interface Worker {
  id: string;
  full_name: string;
  photo_url: string | null;
  date_of_joining: string | null;
  monthly_salary: number;
  ot_rate_per_hour: number;
}

interface AttendanceLog {
  id: string;
  worker_id: string;
  date: string;
  time_in: string;
  time_out: string | null;
  overtime_hours: number;
}

interface MonthlySalaryStats {
  workerId: string;
  workerName: string;
  photoUrl: string | null;
  totalWorkingDays: number;
  monthlySalary: number;
  perDayWage: number;
  basicSalary: number;
  otHours: number;
  otMinutes: number;
  otRatePerHour: number;
  otAmount: number;
  finalSalary: number;
  overtimeDetails: { date: string; hours: number; timeIn: string; timeOut: string; earlyOT: number; eveningOT: number; notes: string | null }[];
}

interface MonthlySalaryProps {
  embedded?: boolean;
}

type SortKey = 'name' | 'days' | 'ot' | 'salary';

export default function MonthlySalary({ embedded = false }: MonthlySalaryProps) {
  const [stats, setStats] = useState<MonthlySalaryStats[]>([]);
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

  // Sheet for OT details
  const [selectedWorkerOT, setSelectedWorkerOT] = useState<{ name: string; details: { date: string; hours: number; timeIn: string; timeOut: string; earlyOT: number; eveningOT: number; notes: string | null }[] } | null>(null);

  useEffect(() => {
    loadMonthlySalaryStats();
  }, [selectedMonth]);

  const loadMonthlySalaryStats = async () => {
    setLoading(true);

    const { data: workers } = await supabase
      .from('workers')
      .select('id, full_name, photo_url, date_of_joining, monthly_salary, ot_rate_per_hour')
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
      .select('id, worker_id, date, time_in, time_out, overtime_hours, notes_in, notes_out')
      .gte('date', startDate)
      .lte('date', endDate);

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const salaryStats: MonthlySalaryStats[] = workers.map((worker) => {
      const workerAttendance = attendance?.filter(a => a.worker_id === worker.id) || [];
      
      // Effective dates
      let effectiveStartDate = startDate;
      if (worker.date_of_joining && worker.date_of_joining > startDate) {
        effectiveStartDate = worker.date_of_joining;
      }
      
      const effectiveEndDate = todayStr < endDate ? todayStr : endDate;
      
      // Count working days attended
      const daysWorked = workerAttendance.filter(a => 
        a.date >= effectiveStartDate && a.date <= effectiveEndDate
      ).length;

      // Calculate total OT with early morning OT
      let totalOtHours = 0;
      const overtimeDetails: { date: string; hours: number; timeIn: string; timeOut: string; earlyOT: number; eveningOT: number; notes: string | null }[] = [];

      workerAttendance.forEach(a => {
        const checkIn = new Date(a.time_in);
        const earlyOT = calculateEarlyOT(checkIn);
        let eveningOT = 0;
        if (a.time_out) {
          const checkOut = new Date(a.time_out);
          eveningOT = calculateEveningOT(checkIn, checkOut);
        }
        const dayOT = earlyOT + eveningOT;
        
        if (dayOT > 0) {
          totalOtHours += dayOT;
          overtimeDetails.push({
            date: a.date,
            hours: dayOT,
            timeIn: a.time_in,
            timeOut: a.time_out || '',
            earlyOT,
            eveningOT,
            notes: (a as any).notes_out || (a as any).notes_in || null,
          });
        }
      });

      const otMinutes = Math.round(totalOtHours * 60);

      // Calculate salary
      const salaryCalc = calculateSalary(
        daysWorked,
        worker.monthly_salary || 0,
        totalOtHours,
        worker.ot_rate_per_hour || 0
      );

      return {
        workerId: worker.id,
        workerName: worker.full_name,
        photoUrl: worker.photo_url,
        totalWorkingDays: daysWorked,
        monthlySalary: worker.monthly_salary || 0,
        perDayWage: salaryCalc.perDayWage,
        basicSalary: salaryCalc.basicSalary,
        otHours: parseFloat(totalOtHours.toFixed(2)),
        otMinutes,
        otRatePerHour: worker.ot_rate_per_hour || 0,
        otAmount: salaryCalc.otAmount,
        finalSalary: salaryCalc.finalSalary,
        overtimeDetails,
      };
    });

    setStats(salaryStats);
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
        case 'days': cmp = a.totalWorkingDays - b.totalWorkingDays; break;
        case 'ot': cmp = a.otHours - b.otHours; break;
        case 'salary': cmp = a.finalSalary - b.finalSalary; break;
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
    const totalOT = stats.reduce((sum, s) => sum + s.otHours, 0);
    const totalOTMinutes = stats.reduce((sum, s) => sum + s.otMinutes, 0);
    const totalOTAmount = stats.reduce((sum, s) => sum + s.otAmount, 0);
    const totalBasicSalary = stats.reduce((sum, s) => sum + s.basicSalary, 0);
    const totalFinalSalary = stats.reduce((sum, s) => sum + s.finalSalary, 0);

    return {
      totalOT,
      totalOTMinutes,
      totalOTAmount,
      totalBasicSalary,
      totalFinalSalary,
      totalWorkers: stats.length,
    };
  }, [stats]);

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
      const doc = new jsPDF('landscape');
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // Header
      doc.setFillColor(37, 99, 235);
      doc.rect(0, 0, pageWidth, 30, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('FUSIONest Monthly Salary Report', 14, 16);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Month: ${getMonthName()}`, 14, 24);
      
      // Summary row
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      doc.text(`Total Workers: ${summary.totalWorkers} | Total OT: ${summary.totalOT.toFixed(2)}h | Total OT Amount: ₹${summary.totalOTAmount.toLocaleString()} | Total Salary: ₹${summary.totalFinalSalary.toLocaleString()}`, 14, 40);

      // Table
      const tableData = stats.map((s, idx) => [
        (idx + 1).toString(),
        s.workerName,
        s.totalWorkingDays.toString(),
        `₹${s.perDayWage.toFixed(2)}`,
        `₹${s.basicSalary.toFixed(2)}`,
        s.otHours.toFixed(2),
        s.otMinutes.toString(),
        `₹${s.otRatePerHour.toFixed(0)}`,
        `₹${s.otAmount.toFixed(2)}`,
        `₹${s.finalSalary.toFixed(2)}`,
      ]);

      // Add totals row
      tableData.push([
        '',
        'TOTAL',
        '',
        '',
        `₹${summary.totalBasicSalary.toFixed(2)}`,
        summary.totalOT.toFixed(2),
        summary.totalOTMinutes.toString(),
        '',
        `₹${summary.totalOTAmount.toFixed(2)}`,
        `₹${summary.totalFinalSalary.toFixed(2)}`,
      ]);

      autoTable(doc, {
        startY: 48,
        head: [['S.No', 'Name', 'Working Days', 'Per Day', 'Basic Salary', 'OT Hrs', 'OT Mins', 'OT Rate', 'OT Amount', 'Final Salary']],
        body: tableData,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
        footStyles: { fillColor: [241, 245, 249], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
      });

      // Footer
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
      }

      doc.save(`monthly-salary-report-${selectedMonth}.pdf`);
      toast.success("PDF exported successfully!");
    } catch (error) {
      console.error('PDF export error:', error);
      toast.error("Failed to export PDF");
    }
  };

  const exportCSV = () => {
    try {
      const headers = ['S.No', 'Name', 'Working Days', 'Per Day Wage', 'Basic Salary', 'OT Hours', 'OT Minutes', 'OT Rate', 'OT Amount', 'Final Salary'];
      const rows = stats.map((s, idx) => [
        (idx + 1).toString(),
        s.workerName,
        s.totalWorkingDays.toString(),
        s.perDayWage.toFixed(2),
        s.basicSalary.toFixed(2),
        s.otHours.toFixed(2),
        s.otMinutes.toString(),
        s.otRatePerHour.toFixed(0),
        s.otAmount.toFixed(2),
        s.finalSalary.toFixed(2),
      ]);

      // Add totals row
      rows.push([
        '',
        'TOTAL',
        '',
        '',
        summary.totalBasicSalary.toFixed(2),
        summary.totalOT.toFixed(2),
        summary.totalOTMinutes.toString(),
        '',
        summary.totalOTAmount.toFixed(2),
        summary.totalFinalSalary.toFixed(2),
      ]);

      const summaryRows = [
        ['FUSIONest Monthly Salary Report'],
        [`Month: ${getMonthName()}`],
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
      a.download = `monthly-salary-report-${selectedMonth}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success("CSV exported successfully!");
    } catch (error) {
      console.error('CSV export error:', error);
      toast.error("Failed to export CSV");
    }
  };

  const exportExcel = () => {
    try {
      const headers = ['S.No', 'Name', 'Working Days', 'Per Day Wage', 'Basic Salary', 'OT Hours', 'OT Minutes', 'OT Rate', 'OT Amount', 'Final Salary'];
      const rows = stats.map((s, idx) => [
        (idx + 1).toString(),
        s.workerName,
        s.totalWorkingDays.toString(),
        s.perDayWage.toFixed(2),
        s.basicSalary.toFixed(2),
        s.otHours.toFixed(2),
        s.otMinutes.toString(),
        s.otRatePerHour.toFixed(0),
        s.otAmount.toFixed(2),
        s.finalSalary.toFixed(2),
      ]);

      // Add totals row
      rows.push([
        '',
        'TOTAL',
        '',
        '',
        summary.totalBasicSalary.toFixed(2),
        summary.totalOT.toFixed(2),
        summary.totalOTMinutes.toString(),
        '',
        summary.totalOTAmount.toFixed(2),
        summary.totalFinalSalary.toFixed(2),
      ]);

      let xmlContent = '<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>';
      xmlContent += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">';
      xmlContent += `<Worksheet ss:Name="${getMonthName()} Salary Report"><Table>`;
      
      // Title
      xmlContent += '<Row><Cell ss:MergeAcross="9"><Data ss:Type="String">FUSIONest Monthly Salary Report</Data></Cell></Row>';
      xmlContent += `<Row><Cell ss:MergeAcross="9"><Data ss:Type="String">Month: ${getMonthName()}</Data></Cell></Row>`;
      xmlContent += '<Row></Row>';
      
      // Headers
      xmlContent += '<Row>';
      headers.forEach(h => {
        xmlContent += `<Cell><Data ss:Type="String">${h}</Data></Cell>`;
      });
      xmlContent += '</Row>';
      
      // Data
      rows.forEach(row => {
        xmlContent += '<Row>';
        row.forEach((cell, idx) => {
          const isNumeric = idx > 1 && cell !== '';
          xmlContent += `<Cell><Data ss:Type="${isNumeric ? 'Number' : 'String'}">${cell}</Data></Cell>`;
        });
        xmlContent += '</Row>';
      });
      
      xmlContent += '</Table></Worksheet></Workbook>';

      const blob = new Blob([xmlContent], { type: 'application/vnd.ms-excel' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `monthly-salary-report-${selectedMonth}.xls`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success("Excel exported successfully!");
    } catch (error) {
      console.error('Excel export error:', error);
      toast.error("Failed to export Excel");
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
          Monthly Salary & OT Report
        </h1>
        <p className="text-muted-foreground mt-2">
          Salary calculations for {getMonthName()} (Payroll)
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card className="p-4 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Workers</p>
              <p className="text-2xl font-bold">{summary.totalWorkers}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
          <div className="flex items-center gap-3">
            <Clock className="w-8 h-8 text-purple-500" />
            <div>
              <p className="text-xs text-muted-foreground">Total OT</p>
              <p className="text-2xl font-bold text-purple-600">{summary.totalOT.toFixed(1)}h</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
          <div className="flex items-center gap-3">
            <IndianRupee className="w-8 h-8 text-blue-500" />
            <div>
              <p className="text-xs text-muted-foreground">OT Amount</p>
              <p className="text-2xl font-bold text-blue-600">₹{summary.totalOTAmount.toLocaleString()}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
          <div className="flex items-center gap-3">
            <IndianRupee className="w-8 h-8 text-green-500" />
            <div>
              <p className="text-xs text-muted-foreground">Basic Salary</p>
              <p className="text-2xl font-bold text-green-600">₹{summary.totalBasicSalary.toLocaleString()}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-8 h-8 text-emerald-500" />
            <div>
              <p className="text-xs text-muted-foreground">Total Salary</p>
              <p className="text-2xl font-bold text-emerald-600">₹{summary.totalFinalSalary.toLocaleString()}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Salary Calculation Note */}
      <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg p-3 text-sm">
        <IndianRupee className="w-4 h-4 inline-block mr-2 text-blue-500" />
        <strong>Salary Calculation:</strong> Basic = Working Days × (Monthly Salary ÷ 31) | OT Amount = OT Hours × OT Rate | Final = Basic + OT Amount
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
        ) : filteredAndSortedStats.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No workers found</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">S.No</TableHead>
                    <TableHead><SortButton sortKeyVal="name" label="Name" /></TableHead>
                    <TableHead><SortButton sortKeyVal="days" label="Working Days" /></TableHead>
                    <TableHead>Per Day</TableHead>
                    <TableHead>Basic Salary</TableHead>
                    <TableHead><SortButton sortKeyVal="ot" label="OT Hrs" /></TableHead>
                    <TableHead>OT Mins</TableHead>
                    <TableHead>OT Rate</TableHead>
                    <TableHead>OT Amount</TableHead>
                    <TableHead><SortButton sortKeyVal="salary" label="Final Salary" /></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedStats.map((stat, index) => (
                    <TableRow key={stat.workerId}>
                      <TableCell className="font-medium">
                        {(currentPage - 1) * itemsPerPage + index + 1}
                      </TableCell>
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
                      <TableCell className="font-semibold">
                        {stat.totalWorkingDays}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        ₹{stat.perDayWage.toFixed(2)}
                      </TableCell>
                      <TableCell className="font-medium">
                        ₹{stat.basicSalary.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        {stat.otHours > 0 ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="p-0 h-auto hover:bg-transparent"
                            onClick={() => setSelectedWorkerOT({ name: stat.workerName, details: stat.overtimeDetails })}
                          >
                            <Badge className="bg-purple-500 hover:bg-purple-600 cursor-pointer">
                              {stat.otHours.toFixed(2)}
                            </Badge>
                          </Button>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {stat.otMinutes}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        ₹{stat.otRatePerHour.toFixed(0)}
                      </TableCell>
                      <TableCell className="font-semibold text-blue-600">
                        ₹{stat.otAmount.toFixed(2)}
                      </TableCell>
                      <TableCell className="font-bold text-green-600">
                        ₹{stat.finalSalary.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                {/* Totals Row */}
                <tfoot>
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell></TableCell>
                    <TableCell>TOTAL</TableCell>
                    <TableCell></TableCell>
                    <TableCell></TableCell>
                    <TableCell>₹{summary.totalBasicSalary.toFixed(2)}</TableCell>
                    <TableCell className="text-purple-600">{summary.totalOT.toFixed(2)}</TableCell>
                    <TableCell>{summary.totalOTMinutes}</TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-blue-600">₹{summary.totalOTAmount.toFixed(2)}</TableCell>
                    <TableCell className="text-green-600">₹{summary.totalFinalSalary.toFixed(2)}</TableCell>
                  </TableRow>
                </tfoot>
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

      {/* OT Details Sheet */}
      <Sheet open={!!selectedWorkerOT} onOpenChange={() => setSelectedWorkerOT(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Overtime Details - {selectedWorkerOT?.name}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-3">
            {selectedWorkerOT?.details.length === 0 ? (
              <p className="text-muted-foreground">No overtime recorded.</p>
            ) : (
              selectedWorkerOT?.details.map((ot, idx) => {
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
                      <Badge className="bg-purple-500">+{Math.floor(ot.hours)}h {Math.round((ot.hours - Math.floor(ot.hours)) * 60)}m</Badge>
                    </div>
                    <div className="mt-2 text-sm text-muted-foreground space-y-1">
                      <p>Check-in: {formatT(ot.timeIn)} → Check-out: {ot.timeOut ? formatT(ot.timeOut) : '—'}</p>
                      {ot.earlyOT > 0 && <p className="text-blue-600">Early AM OT: {Math.round(ot.earlyOT * 60)}m (before 9:00 AM)</p>}
                      {ot.eveningOT > 0 && <p className="text-purple-600">Evening OT: {Math.floor(ot.eveningOT)}h {Math.round((ot.eveningOT - Math.floor(ot.eveningOT)) * 60)}m (after 6:00 PM)</p>}
                    </div>
                    {ot.notes && (
                      <p className="mt-1 text-sm text-muted-foreground italic">{ot.notes}</p>
                    )}
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
