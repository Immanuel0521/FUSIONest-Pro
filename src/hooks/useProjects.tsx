import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export interface Project {
  id: string;
  name: string;
  client_name: string | null;
  location: string | null;
  description: string | null;
  status: "not_started" | "active" | "completed" | "on_hold" | "cancelled";
  start_date: string | null;
  expected_end_date: string | null;
  actual_end_date: string | null;
  supervisor_id: string;
  created_at: string;
  budget: number | null;
  project_manager: string | null;
  completion_percentage: number | null;
  progress?: number;
  activityCount?: number;
  workerCount?: number;
  lastActivityDate?: string | null;
}

export const useProjects = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: projectsData, error } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    const ids = (projectsData || []).map((p) => p.id);
    let progressMap: Record<string, { sum: number; count: number }> = {};
    let workerCountMap: Record<string, number> = {};
    let lastActivityMap: Record<string, string> = {};

    if (ids.length) {
      const [{ data: acts }, { data: pwk }] = await Promise.all([
        supabase
          .from("daily_activities")
          .select("project_id, progress_percentage, date")
          .in("project_id", ids),
        supabase
          .from("project_workers" as any)
          .select("project_id")
          .in("project_id", ids),
      ]);
      (acts || []).forEach((a: any) => {
        if (!a.project_id) return;
        if (!progressMap[a.project_id]) progressMap[a.project_id] = { sum: 0, count: 0 };
        progressMap[a.project_id].sum += a.progress_percentage || 0;
        progressMap[a.project_id].count += 1;
        if (!lastActivityMap[a.project_id] || a.date > lastActivityMap[a.project_id]) {
          lastActivityMap[a.project_id] = a.date;
        }
      });
      (pwk || []).forEach((w: any) => {
        workerCountMap[w.project_id] = (workerCountMap[w.project_id] || 0) + 1;
      });
    }

    const enriched = (projectsData || []).map((p: any) => {
      const pm = progressMap[p.id];
      const calcProgress = pm ? Math.round(pm.sum / pm.count) : 0;
      return {
        ...p,
        progress: p.completion_percentage ?? calcProgress,
        activityCount: pm?.count || 0,
        workerCount: workerCountMap[p.id] || 0,
        lastActivityDate: lastActivityMap[p.id] || null,
      } as Project;
    });

    setProjects(enriched);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel("projects-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "daily_activities" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  return { projects, loading, reload: load };
};
