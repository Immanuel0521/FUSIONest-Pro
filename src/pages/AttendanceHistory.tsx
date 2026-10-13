import { useEffect, useState, useMemo } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/lib/supabase";
import { getSourceLabel, getSourceBadgeClass } from "@/lib/attendanceService";
import { toast } from "sonner";
import { Calendar, Clock, Edit2, Search, Save, X, AlertTriangle, Plus, Trash2 } from "lucide-react";
import { metricsFromStrings } from "@/lib/attendanceMetrics";
import { PastAttendanceDialog } from "@/components/attendance/PastAttendanceDialog";

interface AttendanceRecord {
  id: string;
  worker_id: string;
  date: string;
  time_in: string;
  time_out: string | null;
  is_late: boolean;
  late_minutes: number;
  early_exit: boolean;
  total_hours: number;
  overtime_hours: number;
  notes_in: string | null;
  notes_out: string | null;
  checkin_source?: string | null;
  checkout_source?: string | null;
  recorded_by?: string | null;
  worker?: {
    full_name: string;
    photo_url: string | null;
  };
}

export default function AttendanceHistory({ embedded }: { embedded?: boolean } = {}) {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    return now.toISOString().split('T')[0];
  });
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'date' | 'month'>('date');

  // Edit dialog state
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [editTimeIn, setEditTimeIn] = useState('');
  const [editTimeOut, setEditTimeOut] = useState('');
  const [saving, setSaving] = useState(false);

  // New PastAttendanceDialog state
  const [showPastDialog, setShowPastDialog] = useState(false);

  // Delete confirmation state
  const [deletingRecord, setDeletingRecord] = useState<AttendanceRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadAttendance();
  }, [selectedDate, selectedMonth, viewMode]);

  const loadAttendance = async () => {
    setLoading(true);

    let query = supabase
      .from('attendance_logs')
      .select(`
        *,
        worker:workers(full_name, photo_url)
      `)
      .order('date', { ascending: false });

    if (viewMode === 'date') {
      query = query.eq('date', selectedDate);
    } else {
      const [year, month] = selectedMonth.split('-').map(Number);
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      query = query.gte('date', startDate).lte('date', endDate);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error loading attendance:', error);
      toast.error('Failed to load attendance');
    } else {
      setRecords(data || []);
    }
    setLoading(false);
  };

  const handleEdit = (record: AttendanceRecord) => {
    setEditingRecord(record);
    setEditTimeIn(new Date(record.time_in).toLocaleTimeString('en-US', { 
      hour: '2-digit', minute: '2-digit', hour12: false 
    }));
    setEditTimeOut(record.time_out 
      ? new Date(record.time_out).toLocaleTimeString('en-US', { 
          hour: '2-digit', minute: '2-digit', hour12: false 
        })
      : '18:00'
    );
  };


  const handleSaveEdit = async () => {
    if (!editingRecord) return;

    setSaving(true);
    try {
      const metrics = metricsFromStrings(editingRecord.date, editTimeIn, editTimeOut);

      const { error } = await supabase
        .from('attendance_logs')
        .update({
          time_in: metrics.timeIn.toISOString(),
          time_out: metrics.timeOut.toISOString(),
          is_late: metrics.isLate,
          late_minutes: metrics.lateMinutes,
          early_exit: metrics.earlyExit,
          total_hours: parseFloat(metrics.totalHours.toFixed(2)),
          overtime_hours: parseFloat(metrics.overtimeHours.toFixed(2)),
        })
        .eq('id', editingRecord.id);

      if (error) throw error;

      toast.success('Attendance updated successfully');
      setEditingRecord(null);
      loadAttendance();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update attendance');
    } finally {
      setSaving(false);
    }
  };


  const handleDeleteRecord = async () => {
    if (!deletingRecord) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from('attendance_logs')
        .delete()
        .eq('id', deletingRecord.id);

      if (error) throw error;

      toast.success(`Deleted attendance record for ${deletingRecord.worker?.full_name || 'worker'}`);
      setDeletingRecord(null);
      loadAttendance();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete record');
    } finally {
      setDeleting(false);
    }
  };

  const filteredRecords = useMemo(() => {
    return records.filter(r => 
      r.worker?.full_name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [records, searchQuery]);

  const formatTime = (isoString: string | null) => {
    if (!isoString) return "—";
    return new Date(isoString).toLocaleTimeString('en-US', { 
      hour: '2-digit', minute: '2-digit', hour12: true 
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric'
    });
  };

  const content = (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Attendance History &amp; Edit
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            View, edit, add, and delete past attendance records or mark group attendance
          </p>
        </div>
        <Button onClick={() => setShowPastDialog(true)} className="gap-2 shadow-sm">
          <Plus className="w-4 h-4" />
          Add Past Attendance
        </Button>
      </div>

        {/* Filters */}
        <Card className="p-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <Label>View Mode</Label>
              <div className="flex gap-2">
                <Button 
                  variant={viewMode === 'date' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('date')}
                >
                  By Date
                </Button>
                <Button 
                  variant={viewMode === 'month' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('month')}
                >
                  By Month
                </Button>
              </div>
            </div>

            {viewMode === 'date' ? (
              <div className="space-y-2">
                <Label>Select Date</Label>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-40"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Select Month</Label>
                <Input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-40"
                />
              </div>
            )}

            <div className="flex-1 min-w-[200px] space-y-2">
              <Label>Search Worker</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Records with missing checkout warning */}
        {filteredRecords.filter(r => !r.time_out).length > 0 && (
          <Card className="p-4 bg-orange-500/10 border-orange-500/30">
            <div className="flex items-center gap-2 text-orange-600">
              <AlertTriangle className="w-5 h-5" />
              <span className="font-medium">
                {filteredRecords.filter(r => !r.time_out).length} record(s) missing checkout - Click edit to fix
              </span>
            </div>
          </Card>
        )}

        {/* Records Table */}
        <Card className="p-4">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : filteredRecords.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No attendance records found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Worker</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>In</TableHead>
                    <TableHead>Out</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>OT</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.map((record) => (
                    <TableRow 
                      key={record.id}
                      className={!record.time_out ? 'bg-orange-500/5' : ''}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="w-8 h-8">
                            <AvatarImage src={record.worker?.photo_url || undefined} />
                            <AvatarFallback className="bg-primary/20 text-primary text-xs">
                              {record.worker?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '?'}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-sm">{record.worker?.full_name || 'Unknown'}</span>
                        </div>
                      </TableCell>
                      <TableCell>{formatDate(record.date)}</TableCell>
                      <TableCell>{formatTime(record.time_in)}</TableCell>
                      <TableCell>
                        {record.time_out ? formatTime(record.time_out) : (
                          <Badge variant="outline" className="border-orange-500 text-orange-500">
                            Missing
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {record.checkin_source && (
                            <Badge className={`text-xs ${getSourceBadgeClass(record.checkin_source)}`}>
                              {getSourceLabel(record.checkin_source)} (IN)
                            </Badge>
                          )}
                          {record.checkout_source && (
                            <Badge className={`text-xs ${getSourceBadgeClass(record.checkout_source)}`}>
                              {getSourceLabel(record.checkout_source)} (OUT)
                            </Badge>
                          )}
                          {!record.checkin_source && !record.checkout_source && (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{record.total_hours?.toFixed(2) || '—'}</TableCell>
                      <TableCell>
                        {record.overtime_hours > 0 ? (
                          <Badge className="bg-purple-500/20 text-purple-600">
                            +{Math.floor(record.overtime_hours)}h {Math.round((record.overtime_hours - Math.floor(record.overtime_hours)) * 60)}m
                          </Badge>
                        ) : '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {record.is_late && (
                            <Badge variant="destructive" className="text-xs">Late</Badge>
                          )}
                          {record.early_exit && (
                            <Badge variant="destructive" className="text-xs">Early</Badge>
                          )}
                          {!record.time_out && (
                            <Badge variant="outline" className="border-orange-500 text-orange-500 text-xs">
                              In Progress
                            </Badge>
                          )}
                          {record.time_out && !record.is_late && !record.early_exit && (
                            <Badge className="bg-green-500/20 text-green-600 text-xs">OK</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(record)}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setDeletingRecord(record)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>

        {/* Edit Dialog */}
        <Dialog open={!!editingRecord} onOpenChange={() => setEditingRecord(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Edit Attendance
              </DialogTitle>
            </DialogHeader>
            {editingRecord && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                  <Avatar>
                    <AvatarImage src={editingRecord.worker?.photo_url || undefined} />
                    <AvatarFallback className="bg-primary/20 text-primary">
                      {editingRecord.worker?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{editingRecord.worker?.full_name}</p>
                    <p className="text-sm text-muted-foreground">{formatDate(editingRecord.date)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Check-In Time</Label>
                    <Input
                      type="time"
                      value={editTimeIn}
                      onChange={(e) => setEditTimeIn(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Check-Out Time</Label>
                    <Input
                      type="time"
                      value={editTimeOut}
                      onChange={(e) => setEditTimeOut(e.target.value)}
                    />
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  Late/early/OT will be auto-calculated based on these times.
                </p>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingRecord(null)}>
                <X className="w-4 h-4 mr-1" />
                Cancel
              </Button>
              <Button onClick={handleSaveEdit} disabled={saving}>
                <Save className="w-4 h-4 mr-1" />
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* New PastAttendanceDialog */}
        <PastAttendanceDialog
          open={showPastDialog}
          onOpenChange={setShowPastDialog}
          defaultDate={selectedDate}
          onSaved={loadAttendance}
        />

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deletingRecord} onOpenChange={() => setDeletingRecord(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Attendance Record</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete the attendance record for{' '}
                <strong>{deletingRecord?.worker?.full_name}</strong> on{' '}
                <strong>{deletingRecord ? formatDate(deletingRecord.date) : ''}</strong>?
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteRecord}
                disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <DashboardLayout>
      {content}
    </DashboardLayout>
  );
}
