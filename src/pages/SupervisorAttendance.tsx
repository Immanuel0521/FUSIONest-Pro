import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Clock, Calendar, Download, CheckCircle2, XCircle } from "lucide-react";

interface SupervisorAttendanceRecord {
  id: string;
  date: string;
  time_in: string;
  time_out: string | null;
  total_hours: number;
  notes: string | null;
}

export default function SupervisorAttendance() {
  const [userId, setUserId] = useState<string>("");
  const [todayRecord, setTodayRecord] = useState<SupervisorAttendanceRecord | null>(null);
  const [history, setHistory] = useState<SupervisorAttendanceRecord[]>([]);
  const [notes, setNotes] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initUser();
  }, []);

  useEffect(() => {
    if (userId) {
      loadData();
    }
  }, [userId, selectedMonth]);

  const initUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
    }
  };

  const loadData = async () => {
    setLoading(true);
    await Promise.all([loadTodayRecord(), loadHistory()]);
    setLoading(false);
  };

  const loadTodayRecord = async () => {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('supervisor_attendance')
      .select('*')
      .eq('supervisor_id', userId)
      .eq('date', today)
      .maybeSingle();

    setTodayRecord(data);
  };

  const loadHistory = async () => {
    const startDate = `${selectedMonth}-01`;
    const endDate = new Date(new Date(startDate).getFullYear(), new Date(startDate).getMonth() + 1, 0)
      .toISOString().split('T')[0];

    const { data } = await supabase
      .from('supervisor_attendance')
      .select('*')
      .eq('supervisor_id', userId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false });

    setHistory(data || []);
  };

  const handleCheckIn = async () => {
    try {
      const { error } = await supabase
        .from('supervisor_attendance')
        .insert({
          supervisor_id: userId,
          date: new Date().toISOString().split('T')[0],
          time_in: new Date().toISOString(),
          notes: notes || null
        });

      if (error) throw error;
      toast.success("Checked in successfully!");
      setNotes("");
      loadData();
    } catch (error: any) {
      toast.error(error.message || "Failed to check in");
    }
  };

  const handleCheckOut = async () => {
    if (!todayRecord) return;

    try {
      const timeOut = new Date();
      const timeIn = new Date(todayRecord.time_in);
      const totalHours = (timeOut.getTime() - timeIn.getTime()) / (1000 * 60 * 60);

      const { error } = await supabase
        .from('supervisor_attendance')
        .update({
          time_out: timeOut.toISOString(),
          total_hours: totalHours,
          notes: notes || todayRecord.notes
        })
        .eq('id', todayRecord.id);

      if (error) throw error;
      toast.success("Checked out successfully!");
      setNotes("");
      loadData();
    } catch (error: any) {
      toast.error(error.message || "Failed to check out");
    }
  };

  const formatTime = (timestamp: string | null) => {
    if (!timestamp) return "—";
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const exportCSV = () => {
    const headers = ['Date', 'Time In', 'Time Out', 'Total Hours', 'Notes'];
    const rows = history.map(record => [
      formatDate(record.date),
      formatTime(record.time_in),
      formatTime(record.time_out),
      record.time_out ? record.total_hours.toFixed(2) : '—',
      record.notes || '—'
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `my-attendance-${selectedMonth}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            My Attendance
          </h1>
          <p className="text-muted-foreground mt-2">
            Track your own attendance and view history
          </p>
        </div>

        {/* Today's Status Card */}
        <Card className="glass-card p-6">
          <h2 className="text-xl font-semibold mb-4">Today's Status</h2>
          
          {!todayRecord ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <XCircle className="w-5 h-5" />
                <span>Not checked in yet</span>
              </div>
              
              <div>
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any notes for today..."
                  rows={3}
                />
              </div>

              <Button onClick={handleCheckIn} className="w-full">
                <Clock className="w-4 h-4 mr-2" />
                Check In Now
              </Button>
            </div>
          ) : !todayRecord.time_out ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                <span className="font-medium">Checked in at {formatTime(todayRecord.time_in)}</span>
              </div>

              <Badge variant="secondary" className="bg-green-500/20 text-green-700">
                Currently Active
              </Badge>

              <div>
                <Label htmlFor="checkout-notes">Additional Notes (Optional)</Label>
                <Textarea
                  id="checkout-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add checkout notes..."
                  rows={3}
                />
              </div>

              <Button onClick={handleCheckOut} variant="secondary" className="w-full">
                <Clock className="w-4 h-4 mr-2" />
                Check Out Now
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-blue-500" />
                <span className="font-medium">Completed for today</span>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <p className="text-sm text-muted-foreground">Check In</p>
                  <p className="font-medium">{formatTime(todayRecord.time_in)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Check Out</p>
                  <p className="font-medium">{formatTime(todayRecord.time_out)}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">Total Hours</p>
                  <p className="font-medium">{todayRecord.total_hours.toFixed(2)} hours</p>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Attendance History */}
        <Card className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Attendance History</h2>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="month">Month</Label>
                <Input
                  id="month"
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-auto"
                />
              </div>
              <Button onClick={exportCSV} variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No attendance records for this month
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Time In</TableHead>
                    <TableHead>Time Out</TableHead>
                    <TableHead>Total Hours</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          {formatDate(record.date)}
                        </div>
                      </TableCell>
                      <TableCell>{formatTime(record.time_in)}</TableCell>
                      <TableCell>{formatTime(record.time_out)}</TableCell>
                      <TableCell>
                        {record.time_out ? `${record.total_hours.toFixed(2)}h` : '—'}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {record.notes || '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
}
