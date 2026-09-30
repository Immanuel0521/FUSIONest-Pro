import { useEffect, useState, useMemo } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { MapPin, Factory, Calendar, Users, Search, Clock, User } from "lucide-react";

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

interface Props {
  embedded?: boolean;
}

export default function WorkAllocationHistory({ embedded = false }: Props) {
  const [notes, setNotes] = useState<WorkNote[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [viewMode, setViewMode] = useState<"date" | "month">("month");
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    return now.toISOString().split("T")[0];
  });
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  useEffect(() => {
    loadWorkers();
  }, []);

  useEffect(() => {
    loadNotes();
  }, [selectedDate, selectedMonth, viewMode]);

  const loadWorkers = async () => {
    const { data } = await supabase
      .from("workers")
      .select("id, full_name")
      .order("full_name");
    if (data) setWorkers(data);
  };

  const loadNotes = async () => {
    setLoading(true);

    let query = supabase
      .from("daily_work_notes")
      .select("*")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    if (viewMode === "date") {
      query = query.eq("date", selectedDate);
    } else {
      const [year, month] = selectedMonth.split("-").map(Number);
      const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      query = query.gte("date", startDate).lte("date", endDate);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error loading notes:", error);
      toast.error("Failed to load work allocation notes");
    } else {
      setNotes(data || []);
    }
    setLoading(false);
  };

  const getWorkerNames = (workerIds: string[] | null) => {
    if (!workerIds || workerIds.length === 0) return [];
    return workerIds
      .map((id) => workers.find((w) => w.id === id)?.full_name || "Unknown")
      .filter(Boolean);
  };

  const filteredNotes = useMemo(() => {
    if (!searchQuery.trim()) return notes;
    const term = searchQuery.toLowerCase();
    return notes.filter((note) => {
      const workerNames = getWorkerNames(note.worker_ids).join(" ").toLowerCase();
      return (
        note.note.toLowerCase().includes(term) ||
        note.location?.toLowerCase().includes(term) ||
        note.monitored_by?.toLowerCase().includes(term) ||
        workerNames.includes(term)
      );
    });
  }, [notes, searchQuery, workers]);

  // Group notes by date
  const groupedByDate = useMemo(() => {
    const grouped: Record<string, WorkNote[]> = {};
    filteredNotes.forEach((note) => {
      if (!grouped[note.date]) grouped[note.date] = [];
      grouped[note.date].push(note);
    });
    return Object.entries(grouped).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredNotes]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getMonthName = () => {
    const [year, month] = selectedMonth.split("-");
    return new Date(parseInt(year), parseInt(month) - 1).toLocaleString("en-US", {
      month: "long",
      year: "numeric",
    });
  };

  const content = (
    <div className="space-y-6">
      {!embedded && (
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Work Allocation History
          </h1>
          <p className="text-muted-foreground mt-1">
            View historical records of worker assignments by date, location, and supervisor
          </p>
        </div>
      )}

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="space-y-2">
            <Label>View Mode</Label>
            <div className="flex gap-2">
              <Button
                variant={viewMode === "date" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("date")}
              >
                By Date
              </Button>
              <Button
                variant={viewMode === "month" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("month")}
              >
                By Month
              </Button>
            </div>
          </div>

          {viewMode === "date" ? (
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
            <Label>Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by worker, location, supervisor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <div className="flex items-center gap-3">
            <Calendar className="w-8 h-8 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Period</p>
              <p className="font-bold text-lg">
                {viewMode === "month" ? getMonthName() : formatDate(selectedDate).split(",")[0]}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
          <div className="flex items-center gap-3">
            <Factory className="w-8 h-8 text-blue-500" />
            <div>
              <p className="text-xs text-muted-foreground">Total Records</p>
              <p className="font-bold text-lg text-blue-600">{filteredNotes.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
          <div className="flex items-center gap-3">
            <MapPin className="w-8 h-8 text-green-500" />
            <div>
              <p className="text-xs text-muted-foreground">Unique Sites</p>
              <p className="font-bold text-lg text-green-600">
                {new Set(filteredNotes.map((n) => n.location).filter(Boolean)).size}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-purple-500" />
            <div>
              <p className="text-xs text-muted-foreground">Days With Data</p>
              <p className="font-bold text-lg text-purple-600">{groupedByDate.length}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Notes by Date */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : groupedByDate.length === 0 ? (
        <Card className="p-12 text-center">
          <Factory className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">No work allocation records found for this period</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {groupedByDate.map(([date, dateNotes]) => (
            <Card key={date} className="overflow-hidden">
              <div className="bg-primary/5 border-b px-4 py-3 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                <span className="font-semibold">{formatDate(date)}</span>
                <Badge variant="secondary" className="ml-auto">
                  {dateNotes.length} allocation{dateNotes.length !== 1 ? "s" : ""}
                </Badge>
              </div>
              <div className="p-4 space-y-4">
                {dateNotes.map((note) => (
                  <div
                    key={note.id}
                    className="p-4 rounded-lg border bg-card hover:bg-accent/10 transition-colors"
                  >
                    <div className="flex flex-wrap items-start gap-3 mb-3">
                      {note.location ? (
                        <Badge className="flex items-center gap-1 bg-blue-500/20 text-blue-600 border-blue-500/30">
                          <MapPin className="w-3 h-3" />
                          {note.location}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Factory className="w-3 h-3" />
                          General
                        </Badge>
                      )}
                      {note.monitored_by && (
                        <Badge variant="outline" className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {note.monitored_by}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(note.created_at).toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: true,
                        })}
                      </span>
                    </div>

                    <p className="text-foreground mb-3">{note.note}</p>

                    {note.worker_ids && note.worker_ids.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        <span className="text-xs text-muted-foreground font-medium">Workers:</span>
                        {getWorkerNames(note.worker_ids).map((name, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {name}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  return embedded ? content : <DashboardLayout>{content}</DashboardLayout>;
}