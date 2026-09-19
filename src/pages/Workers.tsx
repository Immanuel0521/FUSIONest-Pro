import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, Search, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { WorkerForm } from "@/components/WorkerForm";
import { WorkerCard } from "@/components/WorkerCard";
import { WorkerDetailsModal } from "@/components/WorkerDetailsModal";
import { useToast } from "@/hooks/use-toast";

interface Worker {
  id: string;
  full_name: string;
  phone: string;
  address: string;
  emergency_contact: string;
  bank_details: string;
  blood_group: string;
  photo_url: string | null;
  designation: string | null;
  date_of_joining: string | null;
}

interface WorkersProps {
  embedded?: boolean;
}

export default function Workers({ embedded = false }: WorkersProps) {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const [viewDetailsWorker, setViewDetailsWorker] = useState<Worker | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadWorkers();
  }, []);

  const loadWorkers = async () => {
    const { data } = await supabase
      .from('workers')
      .select('*')
      .order('full_name');
    
    if (data) setWorkers(data);
  };

  const filteredWorkers = workers.filter(worker =>
    worker.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEdit = (worker: Worker) => {
    setSelectedWorker(worker);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setSelectedWorker(null);
    loadWorkers();
  };

  const handleViewDetails = (worker: Worker) => {
    setViewDetailsWorker(worker);
  };

  // Export only non-sensitive worker data to CSV
  const exportToCSV = () => {
    // Only export non-sensitive fields - excludes bank_details, address, emergency_contact
    const headers = ["Full Name", "Phone", "Blood Group", "Designation", "Date of Joining"];
    const rows = workers.map(worker => [
      worker.full_name,
      worker.phone,
      worker.blood_group,
      worker.designation || "-",
      worker.date_of_joining ? new Date(worker.date_of_joining).toLocaleDateString() : "-"
    ]);

    const csv = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `workers-list-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Export Complete",
      description: "Workers list exported (sensitive data excluded for security)",
    });
  };

  // Export only non-sensitive worker data to JSON
  const exportToJSON = () => {
    // Create sanitized worker data excluding sensitive fields
    const sanitizedWorkers = workers.map(worker => ({
      id: worker.id,
      full_name: worker.full_name,
      phone: worker.phone,
      blood_group: worker.blood_group,
      designation: worker.designation,
      date_of_joining: worker.date_of_joining,
    }));
    
    const jsonData = JSON.stringify(sanitizedWorkers, null, 2);
    const blob = new Blob([jsonData], { type: "application/json" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `workers-list-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Export Complete",
      description: "Workers list exported (sensitive data excluded for security)",
    });
  };

  const content = (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        {!embedded && (
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
            Workers Management
          </h1>
        )}
          <div className="flex gap-3 flex-wrap">
            <Button
              variant="outline"
              onClick={exportToCSV}
              disabled={workers.length === 0}
              className="glass-card border-primary/30 hover:border-primary/50 hover:shadow-md"
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
            <Button
              variant="outline"
              onClick={exportToJSON}
              disabled={workers.length === 0}
              className="glass-card border-primary/30 hover:border-primary/50 hover:shadow-md"
            >
              <Download className="w-4 h-4 mr-2" />
              Export JSON
            </Button>
            <Button
              onClick={() => setShowForm(true)}
              className="bg-gradient-to-r from-primary to-accent hover:shadow-[0_10px_40px_hsl(var(--primary)/0.4)] transition-all px-6"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Worker
            </Button>
          </div>
        </div>

        <Card className="glass-card p-6 border border-primary/10">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Search workers by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 h-12 glass-card border-primary/30 focus:border-primary/50 text-base"
            />
          </div>
        </Card>

        {showForm && (
          <WorkerForm 
            worker={selectedWorker} 
            onClose={handleFormClose} 
          />
        )}

        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filteredWorkers.map((worker, index) => (
            <WorkerCard
              key={worker.id}
              worker={worker}
              index={index}
              onEdit={handleEdit}
              onViewDetails={handleViewDetails}
              onDelete={loadWorkers}
            />
          ))}
        </div>

        {filteredWorkers.length === 0 && (
          <Card className="glass-card p-12 text-center border border-primary/10">
            <p className="text-muted-foreground">
              {searchTerm ? "No workers found matching your search." : "No workers added yet. Click 'Add Worker' to get started."}
            </p>
          </Card>
        )}

        <WorkerDetailsModal
          worker={viewDetailsWorker}
          open={!!viewDetailsWorker}
          onClose={() => setViewDetailsWorker(null)}
        />
      </div>
    );

  if (embedded) return content;
  return <DashboardLayout>{content}</DashboardLayout>;
}
