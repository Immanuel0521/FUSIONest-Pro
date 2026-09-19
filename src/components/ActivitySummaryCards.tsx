import { Card, CardContent } from "@/components/ui/card";
import { Activity, Users, Clock, AlertTriangle, CheckCircle, FolderOpen } from "lucide-react";

interface SummaryData {
  totalActivities: number;
  totalWorkers: number;
  totalOTHours: number;
  delayedTasks: number;
  completedTasks: number;
  activeProjects: number;
}

interface ActivitySummaryCardsProps {
  data: SummaryData;
}

export function ActivitySummaryCards({ data }: ActivitySummaryCardsProps) {
  const cards = [
    {
      title: "Activities",
      value: data.totalActivities,
      icon: Activity,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Workers",
      value: data.totalWorkers,
      icon: Users,
      color: "text-secondary",
      bgColor: "bg-secondary/10",
    },
    {
      title: "OT Hours",
      value: data.totalOTHours.toFixed(1),
      icon: Clock,
      color: "text-accent",
      bgColor: "bg-accent/10",
    },
    {
      title: "Delays",
      value: data.delayedTasks,
      icon: AlertTriangle,
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
    },
    {
      title: "Completed",
      value: data.completedTasks,
      icon: CheckCircle,
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
    },
    {
      title: "Active Projects",
      value: data.activeProjects,
      icon: FolderOpen,
      color: "text-violet-500",
      bgColor: "bg-violet-500/10",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {cards.map((card) => (
        <Card key={card.title} className="border-0 shadow-sm bg-card/50 backdrop-blur-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${card.bgColor}`}>
                <card.icon className={`w-5 h-5 ${card.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{card.value}</p>
                <p className="text-xs text-muted-foreground">{card.title}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
