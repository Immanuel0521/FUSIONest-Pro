import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { MapPin, Factory, Plus, Trash2, Edit2, X, Users, Save } from "lucide-react";
import { z } from "zod";

const workNoteSchema = z.object({
  location: z.string().trim().max(200, "Location must be ≤ 200 chars").optional(),
  monitored_by: z.string().trim().max(100, "Monitor name must be ≤ 100 chars").optional(),
  note: z.string().trim().min(1, "Note is required").max(2000, "Note must be ≤ 2000 chars"),
});

interface Worker {
  id: string;
  full_name: string;
}

interface WorkNote {
  id: string;
  date: string;
  location: string | null;
  note: string;
  worker_ids: string[] | null;
  monitored_by: string | null;
  created_at: string;
}

interface DailyWorkNotesProps {
  workers: Worker[];
  selectedDate?: string;
}

export function DailyWorkNotes({ workers, selectedDate }: DailyWorkNotesProps) {
  const [notes, setNotes] = useState<WorkNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form state
  const [location, setLocation] = useState("");
  const [monitoredBy, setMonitoredBy] = useState("");
  const [noteText, setNoteText] = useState("");
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const today = selectedDate || new Date().toISOString().split('T')[0];

  useEffect(() => {
    loadNotes();
  }, [today]);

  const loadNotes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('daily_work_notes')
      .select('*')
      .eq('date', today)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading notes:', error);
    } else {
      setNotes(data || []);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setLocation("");
    setMonitoredBy("");
    setNoteText("");
    setSelectedWorkerIds([]);
    setShowForm(false);
    setEditingId(null);
  };

  const handleEdit = (note: WorkNote) => {
    setLocation(note.location || "");
    setMonitoredBy(note.monitored_by || "");
    setNoteText(note.note);
    setSelectedWorkerIds(note.worker_ids || []);
    setEditingId(note.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    const parsed = workNoteSchema.safeParse({
      location: location.trim() || undefined,
      monitored_by: monitoredBy.trim() || undefined,
      note: noteText,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || "Invalid input");
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (editingId) {
        // Update existing note
        const { error } = await supabase
          .from('daily_work_notes')
          .update({
            location: parsed.data.location || null,
            monitored_by: parsed.data.monitored_by || null,
            note: parsed.data.note,
            worker_ids: selectedWorkerIds.length > 0 ? selectedWorkerIds : null,
          })
          .eq('id', editingId);

        if (error) throw error;
        toast.success("Note updated");
      } else {
        // Create new note
        const { error } = await supabase
          .from('daily_work_notes')
          .insert({
            supervisor_id: user.id,
            date: today,
            location: parsed.data.location || null,
            monitored_by: parsed.data.monitored_by || null,
            note: parsed.data.note,
            worker_ids: selectedWorkerIds.length > 0 ? selectedWorkerIds : null,
          });

        if (error) throw error;
        toast.success("Note added");
      }

      resetForm();
      loadNotes();
    } catch (error: any) {
      toast.error(error.message || "Failed to save note");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('daily_work_notes')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success("Note deleted");
      loadNotes();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete note");
    }
  };

  const toggleWorker = (workerId: string) => {
    setSelectedWorkerIds(prev => 
      prev.includes(workerId)
        ? prev.filter(id => id !== workerId)
        : [...prev, workerId]
    );
  };

  const getWorkerNames = (workerIds: string[] | null) => {
    if (!workerIds || workerIds.length === 0) return "No workers assigned";
    return workerIds
      .map(id => workers.find(w => w.id === id)?.full_name || "Unknown")
      .join(", ");
  };

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="w-5 h-5" />
            Today's Work Allocation
          </CardTitle>
          {!showForm && (
            <Button size="sm" onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4 mr-1" />
              Add Note
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add/Edit Form */}
        {showForm && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="pt-4 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">{editingId ? "Edit Note" : "Add Work Allocation"}</h4>
                <Button variant="ghost" size="icon" onClick={resetForm}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="location">Location / Site Name</Label>
                  <Input
                    id="location"
                    placeholder="e.g., Site A, Factory..."
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="monitoredBy">Monitored By (Supervisor)</Label>
                  <Input
                    id="monitoredBy"
                    placeholder="e.g., Rajesh Kumar, Sunil..."
                    value={monitoredBy}
                    onChange={(e) => setMonitoredBy(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Assign Workers ({selectedWorkerIds.length} selected)</Label>
                <div className="max-h-32 overflow-y-auto border rounded-md p-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {workers.map((worker) => (
                    <div
                      key={worker.id}
                      className="flex items-center gap-2 cursor-pointer hover:bg-accent/50 p-1 rounded"
                      onClick={() => toggleWorker(worker.id)}
                    >
                      <Checkbox
                        checked={selectedWorkerIds.includes(worker.id)}
                        onCheckedChange={() => toggleWorker(worker.id)}
                      />
                      <span className="text-sm truncate">{worker.full_name}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="note">Description / Work Details *</Label>
                <Textarea
                  id="note"
                  placeholder="Describe the work, e.g., Foundation pouring, Assembly work..."
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={saving} className="flex-1">
                  <Save className="w-4 h-4 mr-1" />
                  {saving ? "Saving..." : (editingId ? "Update" : "Save")}
                </Button>
                <Button variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Notes List */}
        {loading ? (
          <div className="text-center py-4 text-muted-foreground">Loading notes...</div>
        ) : notes.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Factory className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No work allocation notes for today</p>
            <p className="text-xs">Click "Add Note" to track where workers are assigned</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notes.map((note) => (
              <div
                key={note.id}
                className="p-3 rounded-lg border bg-card hover:bg-accent/20 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {note.location ? (
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {note.location}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Factory className="w-3 h-3" />
                          General
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm font-medium text-foreground">{note.note}</p>
                    {note.monitored_by && (
                      <p className="text-xs text-muted-foreground mt-1">
                        <strong>Supervised by:</strong> {note.monitored_by}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      <strong>Workers:</strong> {getWorkerNames(note.worker_ids)}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleEdit(note)}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(note.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}