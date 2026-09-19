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
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find approved photos older than 24 hours
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: expiredPhotos, error: fetchError } = await supabase
      .from("attendance_photos")
      .select("id, photo_url")
      .eq("approved", true)
      .lt("approved_at", cutoff);

    if (fetchError) throw fetchError;

    if (!expiredPhotos || expiredPhotos.length === 0) {
      return new Response(
        JSON.stringify({ message: "No expired photos to clean up", deleted: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Delete files from storage
    const storagePaths = expiredPhotos
      .map((p) => {
        const match = p.photo_url.match(/attendance-photos\/(.+)$/);
        return match ? match[1] : null;
      })
      .filter(Boolean) as string[];

    if (storagePaths.length > 0) {
      await supabase.storage.from("attendance-photos").remove(storagePaths);
    }

    // Delete records from database
    const ids = expiredPhotos.map((p) => p.id);
    const { error: deleteError } = await supabase
      .from("attendance_photos")
      .delete()
      .in("id", ids);

    if (deleteError) throw deleteError;

    return new Response(
      JSON.stringify({ message: `Cleaned up ${ids.length} expired photos`, deleted: ids.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
