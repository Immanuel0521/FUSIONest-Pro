import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export interface AttendanceGroupWorker {
  id: string;
  full_name: string;
  photo_url: string | null;
  designation: string | null;
}

export interface AttendanceGroup {
  id: string;
  name: string;
  description: string | null;
  color: string;
  active: boolean;
  created_by: string | null;
  members: AttendanceGroupWorker[];
}

export const GROUP_COLORS = [
  { key: "teal", chip: "bg-teal-500/20 text-teal-700 dark:text-teal-300 border-teal-500/40" },
  { key: "blue", chip: "bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/40" },
  { key: "amber", chip: "bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40" },
  { key: "violet", chip: "bg-violet-500/20 text-violet-700 dark:text-violet-300 border-violet-500/40" },
  { key: "rose", chip: "bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/40" },
];

export const groupChip = (color: string) =>
  GROUP_COLORS.find((c) => c.key === color)?.chip || GROUP_COLORS[0].chip;

export function useAttendanceGroups() {
  const [groups, setGroups] = useState<AttendanceGroup[]>([]);
  const [workers, setWorkers] = useState<AttendanceGroupWorker[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: g, error: gErr }, { data: m }, { data: w }] = await Promise.all([
      (supabase.from("attendance_groups" as any) as any)
        .select("id,name,description,color,active,created_by")
        .order("name"),
      (supabase.from("attendance_group_members" as any) as any).select("group_id,worker_id"),
      supabase.from("workers").select("id, full_name, photo_url, designation").order("full_name"),
    ]);

    if (gErr) toast.error(gErr.message);

    const workerList = (w || []) as AttendanceGroupWorker[];
    const byId = new Map(workerList.map((x) => [x.id, x]));
    const membersByGroup = new Map<string, AttendanceGroupWorker[]>();
    ((m as any[]) || []).forEach((row) => {
      const worker = byId.get(row.worker_id);
      if (!worker) return;
      const list = membersByGroup.get(row.group_id) || [];
      list.push(worker);
      membersByGroup.set(row.group_id, list);
    });

    setWorkers(workerList);
    setGroups(
      ((g as any[]) || []).map((row) => ({
        ...row,
        members: (membersByGroup.get(row.id) || []).sort((a, b) =>
          a.full_name.localeCompare(b.full_name)
        ),
      }))
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const saveGroup = async (
    payload: { id?: string; name: string; description: string; color: string; workerIds: string[] }
  ) => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) {
      toast.error("Not signed in");
      return false;
    }

    let groupId = payload.id;
    if (groupId) {
      const { error } = await (supabase.from("attendance_groups" as any) as any)
        .update({ name: payload.name, description: payload.description || null, color: payload.color })
        .eq("id", groupId);
      if (error) {
        toast.error(error.message);
        return false;
      }
      const { error: delErr } = await (supabase.from("attendance_group_members" as any) as any)
        .delete()
        .eq("group_id", groupId);
      if (delErr) {
        toast.error(delErr.message);
        return false;
      }
    } else {
      const { data, error } = await (supabase.from("attendance_groups" as any) as any)
        .insert({
          name: payload.name,
          description: payload.description || null,
          color: payload.color,
          created_by: auth.user.id,
        })
        .select("id")
        .single();
      if (error) {
        toast.error(error.message);
        return false;
      }
      groupId = (data as any).id;
    }

    if (payload.workerIds.length) {
      const { error } = await (supabase.from("attendance_group_members" as any) as any).insert(
        payload.workerIds.map((worker_id) => ({ group_id: groupId, worker_id }))
      );
      if (error) {
        toast.error(error.message);
        return false;
      }
    }

    toast.success(payload.id ? "Group updated" : "Group created");
    await load();
    return true;
  };

  const deleteGroup = async (id: string) => {
    const { error } = await (supabase.from("attendance_groups" as any) as any).delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return false;
    }
    toast.success("Group deleted");
    await load();
    return true;
  };

  return { groups, workers, loading, reload: load, saveGroup, deleteGroup };
}
