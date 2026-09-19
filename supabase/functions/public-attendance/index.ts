import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { action, workerId, location, faceConfidence, source } = await req.json();

    // Action: get_embeddings - return all face embeddings for public scanning
    if (action === "get_embeddings") {
      const { data, error } = await supabase
        .from("face_embeddings")
        .select("worker_id, embedding_data, workers(full_name)");

      if (error) throw error;

      return new Response(JSON.stringify({ data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: get_worker - fetch worker details
    if (action === "get_worker") {
      const { data, error } = await supabase
        .from("workers")
        .select("id, full_name, photo_url, supervisor_id")
        .eq("id", workerId)
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({ data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: check_status - check today's attendance status
    if (action === "check_status") {
      const today = new Date().toISOString().split("T")[0];
      const { data } = await supabase
        .from("attendance_logs")
        .select("id, time_in, time_out")
        .eq("worker_id", workerId)
        .eq("date", today)
        .maybeSingle();

      return new Response(JSON.stringify({ data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: check_in - mark attendance check-in
    if (action === "check_in") {
      const today = new Date().toISOString().split("T")[0];
      const timeIn = new Date();

      // Check existing
      const { data: existing } = await supabase
        .from("attendance_logs")
        .select("id, time_in")
        .eq("worker_id", workerId)
        .eq("date", today)
        .maybeSingle();

      if (existing) {
        return new Response(JSON.stringify({
          status: "already_checked_in",
          attendance_id: existing.id,
          message: `Already checked in at ${new Date(existing.time_in).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })}`,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Get worker's supervisor_id
      const { data: worker } = await supabase
        .from("workers")
        .select("supervisor_id")
        .eq("id", workerId)
        .single();

      if (!worker) throw new Error("Worker not found");

      // Calculate late & early OT
      const SHIFT_START = 9;
      const LATE_THRESHOLD_H = 9, LATE_THRESHOLD_M = 30;
      const EARLY_OT_H = 8, EARLY_OT_M = 50;

      const lateThreshold = new Date(timeIn);
      lateThreshold.setHours(LATE_THRESHOLD_H, LATE_THRESHOLD_M, 0, 0);
      const shiftStart = new Date(timeIn);
      shiftStart.setHours(SHIFT_START, 0, 0, 0);

      const isLate = timeIn > lateThreshold;
      const lateMinutes = isLate ? Math.max(0, Math.floor((timeIn.getTime() - shiftStart.getTime()) / (1000 * 60))) : 0;

      // Early OT
      const earlyOtThreshold = new Date(timeIn);
      earlyOtThreshold.setHours(EARLY_OT_H, EARLY_OT_M, 0, 0);
      let earlyOT = 0;
      if (timeIn < earlyOtThreshold) {
        earlyOT = Math.max(0, (shiftStart.getTime() - timeIn.getTime()) / (1000 * 60 * 60));
      }

      const insertData: Record<string, unknown> = {
        worker_id: workerId,
        supervisor_id: worker.supervisor_id,
        date: today,
        time_in: timeIn.toISOString(),
        is_late: isLate,
        late_minutes: lateMinutes,
        early_exit: false,
        total_hours: 0,
        overtime_hours: parseFloat(earlyOT.toFixed(2)),
        checkin_source: source || "face_recognition",
        recorded_by: "public_kiosk",
      };

      if (location) insertData.location_in = location;
      if (faceConfidence) {
        insertData.face_verified_in = true;
        insertData.face_confidence_in = faceConfidence;
      }

      const { data, error } = await supabase
        .from("attendance_logs")
        .insert(insertData)
        .select("id")
        .single();

      if (error) {
        if (error.code === "23505") {
          return new Response(JSON.stringify({ status: "already_checked_in", message: "Already checked in today" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw error;
      }

      return new Response(JSON.stringify({
        status: "success",
        attendance_id: data.id,
        message: `Check-in at ${timeIn.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })}${isLate ? ` (Late ${lateMinutes}m)` : ""}${earlyOT > 0 ? ` (Early OT: ${Math.round(earlyOT * 60)}m)` : ""}`,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Action: check_out - mark attendance check-out
    if (action === "check_out") {
      const today = new Date().toISOString().split("T")[0];
      const timeOut = new Date();

      const { data: existing } = await supabase
        .from("attendance_logs")
        .select("id, time_in, time_out")
        .eq("worker_id", workerId)
        .eq("date", today)
        .maybeSingle();

      if (!existing) {
        return new Response(JSON.stringify({ status: "no_checkin", message: "No check-in found for today" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (existing.time_out) {
        return new Response(JSON.stringify({
          status: "already_checked_out",
          attendance_id: existing.id,
          message: `Already checked out at ${new Date(existing.time_out).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })}`,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const timeIn = new Date(existing.time_in);
      const SHIFT_END = 18;
      const EARLY_EXIT_H = 17, EARLY_EXIT_M = 30;
      const LUNCH_BREAK = 1;
      const STANDARD_HOURS = 8;
      const EARLY_OT_H = 8, EARLY_OT_M = 50;
      const SHIFT_START = 9;

      // Overnight handling
      let adjustedTimeOut = timeOut;
      if (timeOut.getHours() < timeIn.getHours()) {
        adjustedTimeOut = timeOut; // natural overnight
      }

      // Early exit
      const earlyThreshold = new Date(timeIn);
      earlyThreshold.setHours(EARLY_EXIT_H, EARLY_EXIT_M, 0, 0);
      const earlyExit = adjustedTimeOut < earlyThreshold;

      // Hours
      const rawHours = Math.max(0, (adjustedTimeOut.getTime() - timeIn.getTime()) / (1000 * 60 * 60));
      const totalHours = Math.min(Math.max(0, rawHours - LUNCH_BREAK), STANDARD_HOURS);

      // OT
      const shiftStart = new Date(timeIn);
      shiftStart.setHours(SHIFT_START, 0, 0, 0);
      const earlyOtThreshold = new Date(timeIn);
      earlyOtThreshold.setHours(EARLY_OT_H, EARLY_OT_M, 0, 0);
      let earlyOT = 0;
      if (timeIn < earlyOtThreshold) {
        earlyOT = Math.max(0, (shiftStart.getTime() - timeIn.getTime()) / (1000 * 60 * 60));
      }

      const shiftEnd = new Date(timeIn);
      shiftEnd.setHours(SHIFT_END, 0, 0, 0);
      let eveningOT = 0;
      if (adjustedTimeOut > shiftEnd) {
        eveningOT = Math.max(0, (adjustedTimeOut.getTime() - shiftEnd.getTime()) / (1000 * 60 * 60));
      }

      const overtimeHours = earlyOT + eveningOT;

      const updateData: Record<string, unknown> = {
        time_out: adjustedTimeOut.toISOString(),
        early_exit: earlyExit,
        total_hours: parseFloat(totalHours.toFixed(2)),
        overtime_hours: parseFloat(overtimeHours.toFixed(2)),
        checkout_source: source || "face_recognition",
        recorded_by: "public_kiosk",
      };

      if (location) updateData.location_out = location;
      if (faceConfidence) {
        updateData.face_verified_out = true;
        updateData.face_confidence_out = faceConfidence;
      }

      const { error } = await supabase
        .from("attendance_logs")
        .update(updateData)
        .eq("id", existing.id);

      if (error) throw error;

      return new Response(JSON.stringify({
        status: "success",
        attendance_id: existing.id,
        message: `Check-out successful. Hours: ${totalHours.toFixed(2)}h${overtimeHours > 0 ? ` (OT: ${overtimeHours.toFixed(2)}h)` : ""}`,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Action: save_photo - save attendance photo
    if (action === "save_photo") {
      const { attendanceId, photoType, photoBase64 } = await req.json();
      // For public mode, we skip photo saving (handled separately if needed)
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
