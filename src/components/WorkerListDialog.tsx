import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Badge } from "./ui/badge";
import { Clock, Calendar } from "lucide-react";
import { format } from "date-fns";

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

interface WorkerListDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  workers: AttendanceRecord[];
  type: 'present' | 'absent';
}

export const WorkerListDialog = ({ open, onClose, title, description, workers, type }: WorkerListDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {workers.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {type === 'present' ? 'No workers marked present today' : 'All workers are present today'}
            </p>
          ) : (
            workers.map((worker) => (
              <div
                key={worker.worker_id}
                className="p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <h4 className="font-semibold">{worker.worker_name}</h4>
                    <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>In: {format(new Date(worker.time_in), 'hh:mm a')}</span>
                      </div>
                      {worker.time_out && (
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>Out: {format(new Date(worker.time_out), 'hh:mm a')}</span>
                        </div>
                      )}
                      {worker.total_hours > 0 && (
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>{worker.total_hours.toFixed(1)}h worked</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {worker.is_late && (
                      <Badge variant="destructive" className="text-xs">
                        Late ({worker.late_minutes}m)
                      </Badge>
                    )}
                    {worker.early_exit && (
                      <Badge variant="outline" className="text-xs border-orange-500 text-orange-500">
                        Early Exit
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
