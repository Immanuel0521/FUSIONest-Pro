import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export type ChecklistStage = "pre_work" | "during_work" | "post_work" | "quality_check" | "safety_inspection";
export type ChecklistType = "pdf" | "interactive";
export type ChecklistInputType = "checkbox" | "text" | "number" | "dropdown" | "photo" | "signature";

export const STAGE_LABEL: Record<ChecklistStage, string> = {
  pre_work: "Pre-Work",
  during_work: "During Work",
  post_work: "Post-Work",
  quality_check: "Quality Check",
  safety_inspection: "Safety Inspection",
};

export interface ChecklistTemplate {
  id: string;
  title: string;
  category: string | null;
  stage: ChecklistStage | null;
  description: string | null;
  checklist_type: ChecklistType;
  pdf_path: string | null;
  created_by: string;
  created_at: string;
}

export interface ChecklistItem {
  id: string;
  template_id: string;
  item_number: number;
  item_text: string;
  input_type: ChecklistInputType;
  dropdown_options: string[] | null;
  is_required: boolean;
  help_text: string | null;
}

export const useChecklistTemplates = () => {
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("checklist_templates" as any)
      .select("*")
      .order("created_at", { ascending: false });
    setTemplates((data as any) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  return { templates, loading, reload: load };
};

export const useChecklistTemplate = (id: string | undefined) => {
  const [template, setTemplate] = useState<ChecklistTemplate | null>(null);
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [{ data: t }, { data: it }] = await Promise.all([
      supabase.from("checklist_templates" as any).select("*").eq("id", id).maybeSingle(),
      supabase.from("checklist_items" as any).select("*").eq("template_id", id).order("item_number"),
    ]);
    setTemplate(t as any);
    setItems((it as any) || []);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);
  return { template, items, loading, reload: load };
};