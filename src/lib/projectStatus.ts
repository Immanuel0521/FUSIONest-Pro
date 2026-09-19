export type ProjectStatus = "not_started" | "active" | "on_hold" | "completed" | "cancelled";

export const STATUS_LABEL: Record<ProjectStatus, string> = {
  not_started: "Not Started",
  active: "In Progress",
  on_hold: "On Hold",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const STATUS_CLASS: Record<ProjectStatus, string> = {
  not_started: "bg-muted text-muted-foreground",
  active: "bg-primary/15 text-primary",
  on_hold: "bg-amber-500/15 text-amber-600",
  completed: "bg-emerald-500/15 text-emerald-600",
  cancelled: "bg-destructive/15 text-destructive",
};

export const daysRemaining = (endDate: string | null): number | null => {
  if (!endDate) return null;
  const end = new Date(endDate).getTime();
  const now = new Date().setHours(0, 0, 0, 0);
  return Math.round((end - now) / (1000 * 60 * 60 * 24));
};