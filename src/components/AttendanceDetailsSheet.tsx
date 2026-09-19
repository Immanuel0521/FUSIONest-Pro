import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Download, Search } from "lucide-react";

interface Worker {
  id: string;
  full_name: string;
  photo_url: string | null;
  time_in?: string | null;
  time_out?: string | null;
  late_minutes?: number;
  overtime_hours?: number;
  last_attendance?: string;
}

interface AttendanceDetailsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  workers: Worker[];
  type: 'present' | 'absent' | 'late' | 'early' | 'overtime';
}

export function AttendanceDetailsSheet({
  open,
  onOpenChange,
  title,
  workers,
  type
}: AttendanceDetailsSheetProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredWorkers = workers.filter(w =>
    w.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatTime = (timestamp: string | null | undefined) => {
    if (!timestamp) return "—";
    return new Date(timestamp).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const exportCSV = () => {
    let headers: string[];
    let rows: string[][];

    switch (type) {
      case 'present':
        headers = ['Name', 'Time In', 'Time Out'];
        rows = filteredWorkers.map(w => [
          w.full_name,
          formatTime(w.time_in),
          formatTime(w.time_out)
        ]);
        break;
      case 'absent':
        headers = ['Name', 'Last Attendance'];
        rows = filteredWorkers.map(w => [
          w.full_name,
          w.last_attendance || 'N/A'
        ]);
        break;
      case 'late':
        headers = ['Name', 'Time In', 'Late By (minutes)'];
        rows = filteredWorkers.map(w => [
          w.full_name,
          formatTime(w.time_in),
          (w.late_minutes || 0).toString()
        ]);
        break;
      case 'early':
        headers = ['Name', 'Time Out', 'Early By (minutes)'];
        rows = filteredWorkers.map(w => [
          w.full_name,
          formatTime(w.time_out),
          '—' // Calculate early exit minutes if needed
        ]);
        break;
      case 'overtime':
        headers = ['Name', 'Overtime Hours'];
        rows = filteredWorkers.map(w => [
          w.full_name,
          (w.overtime_hours || 0).toFixed(2)
        ]);
        break;
      default:
        headers = ['Name'];
        rows = filteredWorkers.map(w => [w.full_name]);
    }

    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.toLowerCase().replace(/\s+/g, '-')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{title} ({filteredWorkers.length})</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search workers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {filteredWorkers.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No workers found</p>
            ) : (
              filteredWorkers.map((worker) => (
                <div key={worker.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={worker.photo_url || undefined} />
                    <AvatarFallback>
                      {worker.full_name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{worker.full_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {type === 'present' && `In: ${formatTime(worker.time_in)} ${worker.time_out ? `• Out: ${formatTime(worker.time_out)}` : ''}`}
                      {type === 'absent' && `Last: ${worker.last_attendance || 'Never'}`}
                      {type === 'late' && `${worker.late_minutes} min late`}
                      {type === 'early' && `Out: ${formatTime(worker.time_out)}`}
                      {type === 'overtime' && `${(worker.overtime_hours || 0).toFixed(1)} hrs OT`}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          <Button onClick={exportCSV} className="w-full" variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
