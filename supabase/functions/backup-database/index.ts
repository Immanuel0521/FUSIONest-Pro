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
    
    // Fetch all data from tables
    const [workersRes, attendanceRes, userRolesRes] = await Promise.all([
      supabase.from('workers').select('*'),
      supabase.from('attendance_logs').select('*'),
      supabase.from('user_roles').select('*')
    ]);

    if (workersRes.error) throw workersRes.error;
    if (attendanceRes.error) throw attendanceRes.error;
    if (userRolesRes.error) throw userRolesRes.error;

    const backup = {
      timestamp: new Date().toISOString(),
      version: '1.0',
      data: {
        workers: workersRes.data,
        attendance_logs: attendanceRes.data,
        user_roles: userRolesRes.data
      }
    };

    const fileName = `backup_${new Date().toISOString().split('T')[0]}_${Date.now()}.json`;
    const backupData = JSON.stringify(backup, null, 2);

    // Store backup in Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('backups')
      .upload(fileName, backupData, {
        contentType: 'application/json',
        upsert: false
      });

    if (uploadError) throw uploadError;

    return new Response(
      JSON.stringify({ 
        success: true, 
        fileName,
        recordCount: {
          workers: workersRes.data.length,
          attendance_logs: attendanceRes.data.length,
          user_roles: userRolesRes.data.length
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Backup error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
