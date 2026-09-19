import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/lib/supabase";
import { User } from "lucide-react";

interface Worker {
  id: string;
  full_name: string;
  photo_url: string | null;
}

export default function Reports() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadWorkers();
  }, []);

  const loadWorkers = async () => {
    const { data } = await supabase
      .from('workers')
      .select('id, full_name, photo_url')
      .order('full_name');
    
    if (data) setWorkers(data);
    setLoading(false);
  };

  const handleWorkerClick = (workerId: string) => {
    navigate(`/reports/worker/${workerId}`);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Worker Attendance Reports
          </h1>
          <p className="text-muted-foreground mt-2">
            Click on a worker to view their attendance history
          </p>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading workers...</div>
        ) : workers.length === 0 ? (
          <Card className="glass-card p-12 text-center">
            <User className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No workers found. Add workers first.</p>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-3 lg:grid-cols-4">
            {workers.map((worker, index) => (
              <Card
                key={worker.id}
                className="glass-card cursor-pointer hover:scale-105 hover:shadow-lg transition-all animate-fade-in"
                style={{ animationDelay: `${index * 0.05}s` }}
                onClick={() => handleWorkerClick(worker.id)}
              >
                <CardContent className="flex flex-col items-center p-6">
                  <Avatar className="w-24 h-24 mb-4 border-2 border-primary/20">
                    <AvatarImage src={worker.photo_url || undefined} />
                    <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-2xl">
                      {worker.full_name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <h3 className="font-semibold text-center text-lg">{worker.full_name}</h3>
                  <p className="text-xs text-muted-foreground mt-1">View Attendance</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
