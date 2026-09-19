import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listProjects from "./tools/list-projects";
import listWorkers from "./tools/list-workers";
import getAttendance from "./tools/today-attendance";
import listRecentActivities from "./tools/recent-activities";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "fusionest-pro-mcp",
  title: "FUSIONest Pro",
  version: "0.1.0",
  instructions:
    "Read-only tools for the FUSIONest Pro workforce and project management app. Use these to answer questions about projects, workers, attendance, and daily activities for the signed-in user. All access is scoped by the app's role-based policies (admin, management, supervisor).",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listProjects, listWorkers, getAttendance, listRecentActivities],
});