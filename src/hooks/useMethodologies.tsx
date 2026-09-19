import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export interface Methodology {
  id: string;
  title: string;
  category: string | null;
  description: string | null;
  file_path: string;
  file_size: number | null;
  version: string | null;
  uploaded_by: string;
  upload_date: string;
  created_at: string;
}

export const useMethodologies = () => {
  const [items, setItems] = useState<Methodology[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("methodologies" as any)
      .select("*")
      .order("upload_date", { ascending: false });
    setItems((data as any) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return { items, loading, reload: load };
};

export const getMethodologySignedUrl = async (path: string) => {
  const { data } = await supabase.storage.from("methodologies").createSignedUrl(path, 3600);
  return data?.signedUrl || null;
};