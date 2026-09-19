import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Clock, Users, Image, AlertTriangle, FolderOpen } from "lucide-react";
import { format } from "date-fns";

interface Activity {
  id: string;
  date: string;
  description: string | null;
  progress_percentage: number | null;
  issues_faced: string | null;
  created_at: string;
  project: { id: string; name: string } | null;
  activity_type: { name: string } | null;
  custom_activity_name: string | null;
  worker_count: number;
  photo_count: number;
}

interface ActivityTimelineProps {
  activities: Activity[];
}

export function ActivityTimeline({ activities }: ActivityTimelineProps) {
  if (activities.length === 0) {
    return (
      <Card className="border-0 shadow-sm bg-card/50 backdrop-blur-sm">
        <CardContent className="py-12 text-center">
          <FolderOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">No Activities Recorded</h3>
          <p className="text-muted-foreground mt-1">No activities have been logged for this date.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {activities.map((activity) => {
        const activityName = activity.custom_activity_name || activity.activity_type?.name || 'Unknown Activity';
        const progress = activity.progress_percentage || 0;
        const hasIssues = !!activity.issues_faced;

        return (
          <Card key={activity.id} className="border-0 shadow-sm bg-card/50 backdrop-blur-sm hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                {/* Time */}
                <div className="flex items-center gap-2 text-muted-foreground min-w-[100px]">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm font-medium">
                    {format(new Date(activity.created_at), 'h:mm a')}
                  </span>
                </div>

                {/* Main Content */}
                <div className="flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-semibold">{activityName}</h4>
                    {hasIssues && (
                      <Badge variant="outline" className="text-amber-500 border-amber-500/50 gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Issues
                      </Badge>
                    )}
                    {progress >= 100 && (
                      <Badge className="bg-emerald-500/10 text-emerald-500 border-0">
                        Completed
                      </Badge>
                    )}
                  </div>

                  <p className="text-sm text-muted-foreground">
                    Project: <span className="font-medium text-foreground">{activity.project?.name || 'Unknown'}</span>
                  </p>

                  {activity.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{activity.description}</p>
                  )}

                  {/* Progress Bar */}
                  <div className="flex items-center gap-3">
                    <Progress value={progress} className="flex-1 h-2" />
                    <span className="text-sm font-medium min-w-[40px]">{progress}%</span>
                  </div>
                </div>

                {/* Meta Info */}
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    <span>{activity.worker_count}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Image className="w-4 h-4" />
                    <span>{activity.photo_count}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
