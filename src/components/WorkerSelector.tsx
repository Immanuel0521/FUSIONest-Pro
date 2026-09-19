import { useState, useEffect } from "react";
import { Plus, X, User, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";

interface Worker {
  id: string;
  full_name: string;
}

type WorkerDepartment = 'fitters' | 'assembly_team' | 'helpers' | 'painters' | 'plumbers' | 'electricians' | 'supervisors' | 'guest_workers';

interface SelectedWorker {
  workerId: string | null;
  workerName: string;
  isGuest: boolean;
  department: WorkerDepartment;
  hoursWorked: number;
  otHours: number;
}

interface WorkerSelectorProps {
  selectedWorkers: SelectedWorker[];
  onWorkersChange: (workers: SelectedWorker[]) => void;
}

const DEPARTMENTS = [
  { value: 'fitters', label: 'Fitters' },
  { value: 'assembly_team', label: 'Assembly Team' },
  { value: 'helpers', label: 'Helpers' },
  { value: 'painters', label: 'Painters' },
  { value: 'plumbers', label: 'Plumbers' },
  { value: 'electricians', label: 'Electricians' },
  { value: 'supervisors', label: 'Supervisors' },
  { value: 'guest_workers', label: 'Guest Workers' },
];

export function WorkerSelector({ selectedWorkers, onWorkersChange }: WorkerSelectorProps) {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGuestForm, setShowGuestForm] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestDepartment, setGuestDepartment] = useState("");

  useEffect(() => {
    loadWorkers();
  }, []);

  const loadWorkers = async () => {
    try {
      const { data, error } = await supabase
        .from('workers')
        .select('id, full_name')
        .order('full_name');

      if (error) throw error;
      setWorkers(data || []);
    } catch (error) {
      console.error("Error loading workers:", error);
    } finally {
      setLoading(false);
    }
  };

  const addWorker = (workerId: string) => {
    const worker = workers.find(w => w.id === workerId);
    if (!worker) return;

    // Check if already added
    if (selectedWorkers.some(sw => sw.workerId === workerId)) return;

    onWorkersChange([
      ...selectedWorkers,
      {
        workerId,
        workerName: worker.full_name,
        isGuest: false,
        department: 'helpers',
        hoursWorked: 8,
        otHours: 0,
      },
    ]);
  };

  const addGuestWorker = () => {
    if (!guestName.trim() || !guestDepartment) return;

    onWorkersChange([
      ...selectedWorkers,
      {
        workerId: null,
        workerName: guestName.trim(),
        isGuest: true,
        department: guestDepartment as WorkerDepartment,
        hoursWorked: 8,
        otHours: 0,
      },
    ]);

    setGuestName("");
    setGuestDepartment("");
    setShowGuestForm(false);
  };

  const removeWorker = (index: number) => {
    const newWorkers = [...selectedWorkers];
    newWorkers.splice(index, 1);
    onWorkersChange(newWorkers);
  };

  const updateWorker = (index: number, field: keyof SelectedWorker, value: any) => {
    const newWorkers = [...selectedWorkers];
    newWorkers[index] = { ...newWorkers[index], [field]: value };
    onWorkersChange(newWorkers);
  };

  const availableWorkers = workers.filter(
    w => !selectedWorkers.some(sw => sw.workerId === w.id)
  );

  return (
    <div className="space-y-4">
      {/* Add Worker Controls */}
      <div className="flex flex-wrap gap-3">
        <Select onValueChange={addWorker} value="">
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Add worker..." />
          </SelectTrigger>
          <SelectContent>
            {loading ? (
              <SelectItem value="" disabled>Loading...</SelectItem>
            ) : availableWorkers.length === 0 ? (
              <SelectItem value="" disabled>No workers available</SelectItem>
            ) : (
              availableWorkers.map(w => (
                <SelectItem key={w.id} value={w.id}>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    {w.full_name}
                  </div>
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>

        <Button
          type="button"
          variant="outline"
          onClick={() => setShowGuestForm(!showGuestForm)}
          className="gap-2"
        >
          <UserPlus className="w-4 h-4" />
          Add Guest Worker
        </Button>
      </div>

      {/* Guest Worker Form */}
      {showGuestForm && (
        <div className="p-4 rounded-lg border border-border bg-muted/30 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Guest Name</Label>
              <Input
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Enter name"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Department</Label>
              <Select value={guestDepartment} onValueChange={setGuestDepartment}>
                <SelectTrigger>
                  <SelectValue placeholder="Select dept" />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map(d => (
                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Button type="button" onClick={addGuestWorker} className="flex-1">
                <Plus className="w-4 h-4 mr-1" />
                Add
              </Button>
              <Button type="button" variant="ghost" onClick={() => setShowGuestForm(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Selected Workers List */}
      {selectedWorkers.length > 0 && (
        <div className="space-y-3">
          <Label className="text-sm font-medium">
            Workers Assigned ({selectedWorkers.length})
          </Label>
          
          <div className="space-y-2">
            {selectedWorkers.map((worker, index) => (
              <div
                key={index}
                className="flex flex-wrap items-center gap-3 p-3 rounded-lg border border-border bg-background"
              >
                <div className="flex items-center gap-2 min-w-[150px]">
                  {worker.isGuest ? (
                    <Badge variant="outline" className="text-xs">Guest</Badge>
                  ) : (
                    <User className="w-4 h-4 text-muted-foreground" />
                  )}
                  <span className="font-medium text-sm">{worker.workerName}</span>
                </div>

                <Select
                  value={worker.department}
                  onValueChange={(v) => updateWorker(index, 'department', v)}
                >
                  <SelectTrigger className="w-[140px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.map(d => (
                      <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Hours:</Label>
                  <Input
                    type="number"
                    value={worker.hoursWorked}
                    onChange={(e) => updateWorker(index, 'hoursWorked', parseFloat(e.target.value) || 0)}
                    className="w-16 h-8 text-xs"
                    min="0"
                    max="24"
                    step="0.5"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">OT:</Label>
                  <Input
                    type="number"
                    value={worker.otHours}
                    onChange={(e) => updateWorker(index, 'otHours', parseFloat(e.target.value) || 0)}
                    className="w-16 h-8 text-xs"
                    min="0"
                    max="12"
                    step="0.5"
                  />
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeWorker(index)}
                  className="h-8 w-8 text-muted-foreground hover:text-destructive ml-auto"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-2 border-t">
            <span>
              Total Hours: <strong className="text-foreground">
                {selectedWorkers.reduce((sum, w) => sum + w.hoursWorked, 0)}
              </strong>
            </span>
            <span>
              Total OT: <strong className="text-foreground">
                {selectedWorkers.reduce((sum, w) => sum + w.otHours, 0)}
              </strong>
            </span>
            <span>
              Guest Workers: <strong className="text-foreground">
                {selectedWorkers.filter(w => w.isGuest).length}
              </strong>
            </span>
          </div>
        </div>
      )}

      {selectedWorkers.length === 0 && !showGuestForm && (
        <p className="text-sm text-muted-foreground text-center py-4">
          No workers assigned yet. Add workers from the list above.
        </p>
      )}
    </div>
  );
}