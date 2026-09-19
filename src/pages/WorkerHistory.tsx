import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Calendar, Clock } from "lucide-react";

interface AttendanceLog {
  id: string;
  date: string;
  time_in: string | null;
  time_out: string | null;
  total_hours: number;
  overtime_hours: number;
  is_late: boolean;
  late_minutes: number;
  early_exit: boolean;
  notes: string | null;
}

interface Worker {
  id: string;
  full_name: string;
  photo_url: string | null;
}

export default function WorkerHistory() {
  const { workerId } = useParams<{ workerId: string }>();
  const navigate = useNavigate();
  const [worker, setWorker] = useState<Worker | null>(null);
  const [records, setRecords] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (workerId) {
      loadWorkerData();
      loadAttendanceRecords();
    }
  }, [workerId]);

  const loadWorkerData = async () => {
    const { data } = await supabase
      .from('workers')
      .select('id, full_name, photo_url')
      .eq('id', workerId)
      .single();
    
    if (data) setWorker(data);
  };

  const loadAttendanceRecords = async () => {
    const { data } = await supabase
      .from('attendance_logs')
      .select('*')
      .eq('worker_id', workerId)
      .order('date', { ascending: false });
    
    if (data) setRecords(data);
    setLoading(false);
  };

  const formatTime = (timestamp: string | null) => {
    if (!timestamp) return "—";
    return new Date(timestamp).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date().toISOString().split('T')[0];
    if (dateString === today) {
      return "Today";
    }
    return date.toLocaleDateString('en-US', { 
      weekday: 'short',
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const getStatusBadges = (record: AttendanceLog) => {
    const badges = [];
    const today = new Date().toISOString().split('T')[0];
    const isToday = record.date === today;

    // Missing checkout
    if (!record.time_out) {
      badges.push(
        <Badge key="no-checkout" variant="outline" className="border-orange-500 text-orange-500">
          No Check-Out
        </Badge>
      );
    }
    
    // Late arrival (>20 min after 9:00 AM)
    if (record.is_late) {
      badges.push(
        <Badge key="late" variant="destructive">
          Late ({record.late_minutes}m)
        </Badge>
      );
    }
    
    // Early exit (>20 min before 6:00 PM)
    if (record.early_exit) {
      badges.push(
        <Badge key="early" variant="destructive">
          Early Exit
        </Badge>
      );
    }
    
    // On Time (only if checked out and no issues)
    if (record.time_out && !record.is_late && !record.early_exit) {
      badges.push(
        <Badge key="on-time" className="bg-green-500 hover:bg-green-600">
          On Time
        </Badge>
      );
    }

    return badges;
  };

  if (!worker) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading worker information...</p>
        </div>
      </DashboardLayout>
    );
  }

  const today = new Date().toISOString().split('T')[0];
  const todayRecord = records.find(r => r.date === today);
  const otherRecords = records.filter(r => r.date !== today);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/reports')}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Reports
        </Button>

        <Card className="glass-card">
          <CardHeader>
            <div className="flex items-center gap-4">
              <Avatar className="w-20 h-20 border-2 border-primary/20">
                <AvatarImage src={worker.photo_url || undefined} />
                <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-2xl">
                  {worker.full_name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-2xl">{worker.full_name}</CardTitle>
                <p className="text-muted-foreground flex items-center gap-2 mt-1">
                  <Calendar className="w-4 h-4" />
                  Attendance History ({records.length} records)
                </p>
              </div>
            </div>
          </CardHeader>
        </Card>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading attendance records...</div>
        ) : records.length === 0 ? (
          <Card className="glass-card p-12 text-center">
            <Clock className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No attendance records found for this worker.</p>
          </Card>
        ) : (
          <Card className="glass-card">
            <CardContent className="p-6">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>In Time</TableHead>
                      <TableHead>Out Time</TableHead>
                      <TableHead>Overtime</TableHead>
                      <TableHead>Late Entry</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {todayRecord && (
                      <TableRow className="bg-primary/5 border-l-4 border-l-primary">
                        <TableCell className="font-semibold">
                          {formatDate(todayRecord.date)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-muted-foreground" />
                            {formatTime(todayRecord.time_in)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-muted-foreground" />
                            {formatTime(todayRecord.time_out)}
                          </div>
                        </TableCell>
                        <TableCell>
                          {todayRecord.overtime_hours > 0 ? (
                            <Badge variant="secondary" className="bg-accent/20">
                              +{todayRecord.overtime_hours.toFixed(2)}h
                            </Badge>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {getStatusBadges(todayRecord)}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {todayRecord.notes || "—"}
                        </TableCell>
                      </TableRow>
                    )}
                    {otherRecords.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>{formatDate(record.date)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-muted-foreground" />
                            {formatTime(record.time_in)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-muted-foreground" />
                            {formatTime(record.time_out)}
                          </div>
                        </TableCell>
                        <TableCell>
                          {record.overtime_hours > 0 ? (
                            <Badge variant="secondary" className="bg-accent/20">
                              +{record.overtime_hours.toFixed(2)}h
                            </Badge>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {getStatusBadges(record)}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {record.notes || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
