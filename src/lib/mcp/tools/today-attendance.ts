import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

export default defineTool({
  name: "get_attendance",
  title: "Get attendance for a date",
  description:
    "Return attendance logs (check-in/out, hours, OT) for a given ISO date. Defaults to today.",
  inputSchema: {
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .describe("ISO date YYYY-MM-DD. Defaults to today."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ date }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const target = date ?? new Date().toISOString().split("T")[0];
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("attendance_logs")
      .select(
        "id, worker_id, date, time_in, time_out, total_hours, regular_hours, overtime_hours, is_late, late_minutes, status, workers(full_name)",
      )
      .eq("date", target)
      .order("time_in", { ascending: true });
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify({ date: target, logs: data ?? [] }) }],
      structuredContent: { date: target, logs: data ?? [] },
    };
  },
});