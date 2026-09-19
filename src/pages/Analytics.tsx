import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";
import { Calendar, TrendingUp, Clock, Users, UserCheck, UserX, Download, FileText } from "lucide-react";
import { WorkerListDialog } from "@/components/WorkerListDialog";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import { format } from "date-fns";

interface WorkerStats {
  worker_id: string;
  worker_name: string;
  total_days: number;
  overtime_hours: number;
  late_days: number;
  total_late_minutes: number;
  early_exit_days: number;
}

interface AttendanceRecord {
  worker_id: string;
  worker_name: string;
  time_in: string;
  time_out: string | null;
  total_hours: number;
  is_late: boolean;
  late_minutes: number;
  early_exit: boolean;
}

interface AnalyticsProps {
  embedded?: boolean;
}

export default function Analytics({ embedded = false }: AnalyticsProps) {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth().toString());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [workerStats, setWorkerStats] = useState<WorkerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalWorkers, setTotalWorkers] = useState(0);
  const [presentToday, setPresentToday] = useState<AttendanceRecord[]>([]);
  const [absentWorkers, setAbsentWorkers] = useState<{ worker_id: string; worker_name: string }[]>([]);
  const [showPresentDialog, setShowPresentDialog] = useState(false);
  const [showAbsentDialog, setShowAbsentDialog] = useState(false);

  useEffect(() => {
    loadAnalytics();
    loadTodayAttendance();
  }, [selectedMonth, selectedYear]);

  const loadTodayAttendance = async () => {
    const today = new Date().toISOString().split('T')[0];
    
    // Get all workers
    const { data: allWorkers } = await supabase
      .from('workers')
      .select('id, full_name');
    
    if (allWorkers) {
      setTotalWorkers(allWorkers.length);
    }

    // Get today's attendance
    const { data: todayAttendance } = await supabase
      .from('attendance_logs')
      .select(`
        worker_id,
        time_in,
        time_out,
        total_hours,
        is_late,
        late_minutes,
        early_exit,
        workers (full_name)
      `)
      .eq('date', today);

    if (todayAttendance && allWorkers) {
      const presentRecords: AttendanceRecord[] = todayAttendance.map((record: any) => ({
        worker_id: record.worker_id,
        worker_name: record.workers?.full_name || 'Unknown',
        time_in: record.time_in,
        time_out: record.time_out,
        total_hours: record.total_hours || 0,
        is_late: record.is_late,
        late_minutes: record.late_minutes || 0,
        early_exit: record.early_exit || false,
      }));

      setPresentToday(presentRecords);

      // Calculate absent workers
      const presentWorkerIds = new Set(todayAttendance.map((r: any) => r.worker_id));
      const absent = allWorkers
        .filter(w => !presentWorkerIds.has(w.id))
        .map(w => ({ worker_id: w.id, worker_name: w.full_name }));
      
      setAbsentWorkers(absent);
    }
  };

  const loadAnalytics = async () => {
    setLoading(true);
    const month = parseInt(selectedMonth) + 1;
    const year = parseInt(selectedYear);
    
    const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
    const endDate = new Date(year, parseInt(selectedMonth) + 1, 0).toISOString().split('T')[0];

    const { data: attendance } = await supabase
      .from('attendance_logs')
      .select(`
        worker_id,
        overtime_hours,
        is_late,
        late_minutes,
        early_exit,
        workers (full_name)
      `)
      .gte('date', startDate)
      .lte('date', endDate);

    if (attendance) {
      const statsMap = new Map<string, WorkerStats>();
      
      attendance.forEach((record: any) => {
        const workerId = record.worker_id;
        const workerName = record.workers?.full_name || 'Unknown';
        
        if (!statsMap.has(workerId)) {
          statsMap.set(workerId, {
            worker_id: workerId,
            worker_name: workerName,
            total_days: 0,
            overtime_hours: 0,
            late_days: 0,
            total_late_minutes: 0,
            early_exit_days: 0,
          });
        }
        
        const stats = statsMap.get(workerId)!;
        stats.total_days += 1;
        stats.overtime_hours += record.overtime_hours || 0;
        if (record.is_late) {
          stats.late_days += 1;
          stats.total_late_minutes += record.late_minutes || 0;
        }
        if (record.early_exit) {
          stats.early_exit_days += 1;
        }
      });
      
      setWorkerStats(Array.from(statsMap.values()));
    }
    
    setLoading(false);
  };

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => (currentYear - 2 + i).toString());

  const totalStats = {
    totalDays: workerStats.reduce((sum, w) => sum + w.total_days, 0),
    totalOvertime: workerStats.reduce((sum, w) => sum + w.overtime_hours, 0),
    totalLate: workerStats.reduce((sum, w) => sum + w.late_days, 0),
    totalEarlyExits: workerStats.reduce((sum, w) => sum + w.early_exit_days, 0),
    activeWorkers: workerStats.length,
  };

  const exportToCSV = () => {
    const headers = [
      "Worker Name",
      "Total Days Worked",
      "Overtime Hours",
      "Late Arrivals",
      "Total Late Minutes",
      "Early Exits"
    ];
    
    const rows = workerStats.map(w => [
      w.worker_name,
      w.total_days,
      w.overtime_hours.toFixed(2),
      w.late_days,
      w.total_late_minutes,
      w.early_exit_days
    ]);

    const csv = [
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-report-${months[parseInt(selectedMonth)]}-${selectedYear}.csv`;
    a.click();

    toast.success("Report exported to CSV successfully");
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(18);
    doc.text(`Attendance Report - ${months[parseInt(selectedMonth)]} ${selectedYear}`, 14, 20);
    
    // Summary
    doc.setFontSize(12);
    doc.text(`Total Workers: ${totalWorkers}`, 14, 35);
    doc.text(`Active Workers: ${totalStats.activeWorkers}`, 14, 42);
    doc.text(`Total Working Days: ${totalStats.totalDays}`, 14, 49);
    doc.text(`Total Overtime: ${totalStats.totalOvertime.toFixed(1)} hours`, 14, 56);
    doc.text(`Late Arrivals: ${totalStats.totalLate}`, 14, 63);
    doc.text(`Early Exits: ${totalStats.totalEarlyExits}`, 14, 70);
    
    // Worker details table
    autoTable(doc, {
      startY: 80,
      head: [['Worker Name', 'Days Worked', 'Overtime (h)', 'Late Days', 'Late Mins', 'Early Exits']],
      body: workerStats.map(w => [
        w.worker_name,
        w.total_days,
        w.overtime_hours.toFixed(2),
        w.late_days,
        w.total_late_minutes,
        w.early_exit_days
      ]),
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246] },
    });
    
    doc.save(`attendance-report-${months[parseInt(selectedMonth)]}-${selectedYear}.pdf`);
    toast.success("Report exported to PDF successfully");
  };

  const content = (
    <div className="space-y-6">
      {!embedded && (
        <h1 className="text-3xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
          Attendance Analytics
        </h1>
      )}
      
      <div className="flex gap-3 flex-wrap">
        <Button
          variant="outline"
          onClick={exportToCSV}
          disabled={workerStats.length === 0}
          className="glass-card border-primary/30 hover:border-primary/50 hover:shadow-md"
        >
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
        <Button
          variant="outline"
          onClick={exportToPDF}
          disabled={workerStats.length === 0}
          className="glass-card border-primary/30 hover:border-primary/50 hover:shadow-md"
        >
          <FileText className="w-4 h-4 mr-2" />
          Export PDF
        </Button>
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-40 glass-card border-primary/30">
            <SelectValue placeholder="Select Month" />
          </SelectTrigger>
          <SelectContent>
            {months.map((month, index) => (
              <SelectItem key={month} value={index.toString()}>
                {month}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="w-32 glass-card border-primary/30">
            <SelectValue placeholder="Select Year" />
          </SelectTrigger>
          <SelectContent>
            {years.map((year) => (
              <SelectItem key={year} value={year}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

        {/* Today's Attendance Stats */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="glass-card border border-primary/10 hover:border-primary/30 transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium uppercase tracking-wider">Total Workers</CardTitle>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center">
                <Users className="h-5 w-5 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">{totalWorkers}</div>
              <p className="text-xs text-muted-foreground mt-1">Registered workers</p>
            </CardContent>
          </Card>

          <Card 
            className="glass-card border border-primary/10 cursor-pointer hover:border-primary/30 hover:shadow-[0_10px_40px_hsl(var(--primary)/0.15)] transition-all"
            onClick={() => setShowPresentDialog(true)}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium uppercase tracking-wider">Present Today</CardTitle>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                <UserCheck className="h-5 w-5 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-500">{presentToday.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Click to view details</p>
            </CardContent>
          </Card>

          <Card 
            className="glass-card border border-destructive/10 cursor-pointer hover:border-destructive/30 hover:shadow-[0_10px_40px_hsl(var(--destructive)/0.15)] transition-all"
            onClick={() => setShowAbsentDialog(true)}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium uppercase tracking-wider">Absent Today</CardTitle>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-destructive to-destructive/80 flex items-center justify-center">
                <UserX className="h-5 w-5 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-destructive">{absentWorkers.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Click to view details</p>
            </CardContent>
          </Card>

          <Card className="glass-card border border-accent/10 hover:border-accent/30 transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium uppercase tracking-wider">Attendance Rate</CardTitle>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-accent-glow flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-accent">
                {totalWorkers > 0 ? ((presentToday.length / totalWorkers) * 100).toFixed(1) : 0}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">Today's rate</p>
            </CardContent>
          </Card>
        </div>

        {/* Monthly Analytics Stats */}
        <div>
          <h2 className="text-3xl font-bold mb-6 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Monthly Analytics - {months[parseInt(selectedMonth)]} {selectedYear}
          </h2>
          <div className="grid gap-6 md:grid-cols-4">
          <Card className="glass-card border border-primary/10">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Working Days</CardTitle>
              <Calendar className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{totalStats.totalDays}</div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Overtime</CardTitle>
              <Clock className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-accent">{totalStats.totalOvertime.toFixed(1)}h</div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Late Arrivals</CardTitle>
              <TrendingUp className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{totalStats.totalLate}</div>
              <p className="text-xs text-muted-foreground mt-1">Total late days</p>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Early Exits</CardTitle>
              <Clock className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-500">{totalStats.totalEarlyExits}</div>
              <p className="text-xs text-muted-foreground mt-1">Total early exits</p>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active Workers</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{totalStats.activeWorkers}</div>
              <p className="text-xs text-muted-foreground mt-1">Workers with attendance</p>
            </CardContent>
          </Card>
        </div>
        </div>

        {loading ? (
          <Card className="glass-card p-12 text-center">
            <p className="text-muted-foreground">Loading analytics...</p>
          </Card>
        ) : workerStats.length === 0 ? (
          <Card className="glass-card p-12 text-center">
            <p className="text-muted-foreground">No attendance data for selected period.</p>
          </Card>
        ) : (
          <>
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Working Days by Worker</CardTitle>
                <CardDescription>Total attendance days for {months[parseInt(selectedMonth)]} {selectedYear}</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={workerStats}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                    <XAxis dataKey="worker_name" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Legend />
                    <Bar dataKey="total_days" fill="hsl(var(--primary))" name="Working Days" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Overtime Hours by Worker</CardTitle>
                <CardDescription>Total overtime hours tracked</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={workerStats}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                    <XAxis dataKey="worker_name" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Legend />
                    <Bar dataKey="overtime_hours" fill="hsl(var(--accent))" name="Overtime (hours)" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Late Arrivals & Early Exits</CardTitle>
                <CardDescription>Tracking attendance punctuality</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={workerStats}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                    <XAxis dataKey="worker_name" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="late_days" stroke="hsl(var(--destructive))" name="Late Days" strokeWidth={2} />
                    <Line type="monotone" dataKey="early_exit_days" stroke="#f97316" name="Early Exits" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </>
        )}

        {/* Worker List Dialogs */}
        <WorkerListDialog
          open={showPresentDialog}
          onClose={() => setShowPresentDialog(false)}
          title={`Present Today (${presentToday.length})`}
          description={`Workers who marked attendance on ${format(new Date(), 'MMMM dd, yyyy')}`}
          workers={presentToday}
          type="present"
        />

        <WorkerListDialog
          open={showAbsentDialog}
          onClose={() => setShowAbsentDialog(false)}
          title={`Absent Today (${absentWorkers.length})`}
          description={`Workers who haven't marked attendance on ${format(new Date(), 'MMMM dd, yyyy')}`}
          workers={absentWorkers.map(w => ({
            worker_id: w.worker_id,
            worker_name: w.worker_name,
            time_in: '',
            time_out: null,
            total_hours: 0,
            is_late: false,
            late_minutes: 0,
            early_exit: false,
          }))}
          type="absent"
        />
      </div>
    );

  if (embedded) return content;
  return <DashboardLayout>{content}</DashboardLayout>;
}
