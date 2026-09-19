import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Restrict CORS to specific trusted origins instead of wildcard
const getAllowedOrigins = (): string[] => {
  const origins = Deno.env.get('ALLOWED_ORIGINS');
  if (origins) {
    return origins.split(',').map(o => o.trim());
  }
  // Default allowed origins for this project
  return [
    'https://nsnaepcguxlyqrxbzctq.lovable.app',
    'https://lovable.dev',
  ];
};

const getCorsHeaders = (origin: string | null): Record<string, string> => {
  const allowedOrigins = getAllowedOrigins();
  const isAllowed = origin && (
    allowedOrigins.includes(origin) || 
    allowedOrigins.some(allowed => allowed.endsWith('*') && origin.startsWith(allowed.slice(0, -1))) ||
    /^https:\/\/.*\.lovable\.app$/.test(origin) ||
    /^https:\/\/.*\.lovable\.dev$/.test(origin)
  );
  
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : allowedOrigins[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Credentials': 'true',
  };
};

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify JWT and admin role
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from JWT
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication token' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Check if user has admin role
    const { data: hasAdminRole } = await supabase
      .rpc('has_role', { _user_id: user.id, _role: 'admin' });

    if (!hasAdminRole) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin access required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    const { fileName } = await req.json();
    
    if (!fileName) {
      throw new Error('fileName is required');
    }
    
    // Download backup file
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('backups')
      .download(fileName);

    if (downloadError) throw downloadError;

    const backupText = await fileData.text();
    const backup = JSON.parse(backupText);

    if (!backup.data) {
      throw new Error('Invalid backup file format');
    }

    // Clear existing data (optional - be careful!)
    // await supabase.from('attendance_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    // await supabase.from('workers').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // Restore data
    const results = {
      workers: 0,
      attendance_logs: 0,
      user_roles: 0
    };

    if (backup.data.workers?.length > 0) {
      const { error: workersError } = await supabase
        .from('workers')
        .upsert(backup.data.workers);
      if (workersError) throw workersError;
      results.workers = backup.data.workers.length;
    }

    if (backup.data.attendance_logs?.length > 0) {
      const { error: attendanceError } = await supabase
        .from('attendance_logs')
        .upsert(backup.data.attendance_logs);
      if (attendanceError) throw attendanceError;
      results.attendance_logs = backup.data.attendance_logs.length;
    }

    if (backup.data.user_roles?.length > 0) {
      const { error: rolesError } = await supabase
        .from('user_roles')
        .upsert(backup.data.user_roles);
      if (rolesError) throw rolesError;
      results.user_roles = backup.data.user_roles.length;
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        restored: results
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Restore error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
