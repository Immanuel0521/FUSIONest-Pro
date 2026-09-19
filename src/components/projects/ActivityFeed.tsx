import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { Activity as ActivityIcon, Image as ImageIcon } from "lucide-react";

interface Activity {
  id: string;
  date: string;
  description: string | null;
  progress_percentage: number | null;
  created_at: string;
  project: { name: string } | null;
  activity_type: { name: string } | null;
  activity_workers: { id: string }[];
  activity_photos: { id: string; photo_url: string; caption: string | null }[];
}

export const ActivityFeed = ({ refreshKey }: { refreshKey: number }) => {
  const [items, setItems] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("daily_activities")
        .select(`
          id, date, description, progress_percentage, created_at,
          project:projects(name),
          activity_type:activity_types(name),
          activity_workers(id),
          activity_photos(id, photo_url, caption)
        `)
        .order("created_at", { ascending: false })
        .limit(40);

      const list = (data as any) || [];
      setItems(list);

      // Sign first photo per activity
      const photosToSign = list.flatMap((a: Activity) => a.activity_photos.slice(0, 3));
      const urls: Record<string, string> = {};
      await Promise.all(
        photosToSign.map(async (p: any) => {
          const { data: s } = await supabase.storage.from("activity-photos").createSignedUrl(p.photo_url, 3600);
          if (s?.signedUrl) urls[p.id] = s.signedUrl;
        })
      );
      setSignedUrls(urls);
      setLoading(false);
    })();
  }, [refreshKey]);

  if (loading) return <div className="text-center py-8 text-muted-foreground">Loading...</div>;
  if (items.length === 0) {
    return (
      <Card className="glass-card p-8 text-center">
        <ActivityIcon className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
        <p className="text-muted-foreground">No activities logged yet.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((a, i) => (
        <motion.div key={a.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
          <Card className="glass-card rounded-2xl p-4">
            <div className="flex flex-wrap items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-semibold text-sm">{a.activity_type?.name || "Activity"}</span>
                  <Badge variant="outline" className="text-[10px]">{a.project?.name || "—"}</Badge>
                </div>
                {a.description && <p className="text-sm text-muted-foreground line-clamp-2">{a.description}</p>}
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-2">
                  <span>{format(new Date(a.date), "MMM d, yyyy")}</span>
                  <span>{a.activity_workers.length} workers</span>
                  {a.activity_photos.length > 0 && (
                    <span className="flex items-center gap-1"><ImageIcon className="w-3 h-3" /> {a.activity_photos.length}</span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-primary">{a.progress_percentage || 0}%</div>
                <div className="text-[10px] text-muted-foreground">progress</div>
              </div>
            </div>

            {a.activity_photos.length > 0 && (
              <div className="flex gap-2 mt-3 overflow-x-auto">
                {a.activity_photos.slice(0, 5).map((p) => (
                  signedUrls[p.id] && (
                    <img key={p.id} src={signedUrls[p.id]} alt={p.caption || ""} className="w-20 h-20 rounded-lg object-cover flex-shrink-0" />
                  )
                ))}
              </div>
            )}
          </Card>
        </motion.div>
      ))}
    </div>
  );
};
