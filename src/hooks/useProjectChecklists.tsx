import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export type PCStatus = "not_started" | "in_progress" | "completed";

export const PC_STATUS_LABEL: Record<PCStatus, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  completed: "Completed",
};

export const PC_STATUS_CLASS: Record<PCStatus, string> = {
  not_started: "bg-muted text-muted-foreground",
  in_progress: "bg-amber-500/15 text-amber-600",
  completed: "bg-emerald-500/15 text-emerald-600",
};

export interface ProjectChecklist {
  id: string;
  project_id: string;
  template_id: string;
  assigned_date: string;
  due_date: string | null;
  status: PCStatus;
  assigned_by: string | null;
  completed_by: string | null;
  completed_at: string | null;
  overall_notes: string | null;
  created_at: string;
  template?: { title: string; stage: string | null; category: string | null };
}

export const useProjectChecklists = (projectId: string | undefined) => {
  const [items, setItems] = useState<ProjectChecklist[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    const { data } = await supabase
      .from("project_checklists" as any)
      .select("*, template:checklist_templates(title, stage, category)")
      .eq("project_id", projectId)
      .order("assigned_date", { ascending: false });
    setItems((data as any) || []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);
  return { items, loading, reload: load };
};