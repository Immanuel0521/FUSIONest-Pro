import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

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
    /^https:\/\/.*\.lovable\.app$/.test(origin) ||
    /^https:\/\/.*\.lovable\.dev$/.test(origin)
  );
  
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : allowedOrigins[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Credentials': 'true',
  };
};

const VALID_SUMMARY_TYPES = ['daily_summary', 'project_insights', 'weekly_summary', 'delay_analysis'];

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      console.error("Missing authorization header");
      return new Response(
        JSON.stringify({ error: 'Missing authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error("Supabase configuration missing");
    }

    // Create client with user's token to respect RLS policies
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error("Authentication failed:", authError?.message || "No user found");
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("Authenticated user:", user.id);

    const { type, projectId, dateRange } = await req.json();

    // Validate input type
    if (!type || !VALID_SUMMARY_TYPES.includes(type)) {
      console.error("Invalid summary type requested:", type);
      return new Response(
        JSON.stringify({ error: 'Invalid summary type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate projectId format if provided
    if (projectId && typeof projectId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Invalid project ID format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch activity data based on type - RLS will automatically filter to user's data
    let activityData;
    let prompt = "";

    if (type === "daily_summary") {
      const today = new Date().toISOString().split('T')[0];
      const { data: activities, error: activitiesError } = await supabase
        .from('daily_activities')
        .select(`
          *,
          projects(name, client_name),
          activity_types(name),
          activity_workers(*, workers(full_name)),
          activity_photos(photo_url, caption)
        `)
        .eq('date', today);

      if (activitiesError) {
        console.error("Error fetching activities:", activitiesError.message);
        throw new Error("Failed to fetch activities");
      }

      activityData = activities;
      prompt = `You are a construction project analyst. Analyze today's factory activities and provide a concise daily summary.

Activities data: ${JSON.stringify(activityData)}

Provide:
1. Executive Summary (2-3 sentences)
2. Key Achievements
3. Issues/Delays Identified
4. Worker Productivity Overview
5. Recommendations for Tomorrow

Keep the response professional and actionable. Format with clear sections.`;

    } else if (type === "project_insights" && projectId) {
      // RLS will ensure user can only access their own projects
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select(`
          *,
          daily_activities(
            *,
            activity_types(name),
            activity_workers(*, workers(full_name)),
            activity_photos(photo_url, caption)
          )
        `)
        .eq('id', projectId)
        .single();

      if (projectError || !project) {
        console.error("Project access denied or not found:", projectError?.message);
        return new Response(
          JSON.stringify({ error: 'Project not found or access denied' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      activityData = project;
      prompt = `You are a construction project analyst. Analyze this project's progress and provide insights.

Project data: ${JSON.stringify(activityData)}

Provide:
1. Overall Project Health Assessment
2. Progress Analysis (on track, behind, ahead)
3. Risk Areas Identified
4. Resource Utilization Insights
5. Estimated Completion Assessment
6. Recommendations

Keep the response professional and data-driven. Format with clear sections.`;

    } else if (type === "weekly_summary") {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);

      const { data: activities, error: activitiesError } = await supabase
        .from('daily_activities')
        .select(`
          *,
          projects(name, client_name),
          activity_types(name),
          activity_workers(*, workers(full_name))
        `)
        .gte('date', startDate.toISOString().split('T')[0])
        .lte('date', endDate.toISOString().split('T')[0]);

      if (activitiesError) {
        console.error("Error fetching weekly activities:", activitiesError.message);
        throw new Error("Failed to fetch activities");
      }

      activityData = activities;
      prompt = `You are a construction project analyst. Analyze this week's factory activities and provide a comprehensive weekly summary.

Activities data: ${JSON.stringify(activityData)}

Provide:
1. Week Overview (key metrics)
2. Project-wise Progress Summary
3. Worker Performance Highlights
4. Issues and Delays Encountered
5. Overtime Analysis
6. Key Achievements
7. Areas for Improvement
8. Recommendations for Next Week

Keep the response professional and actionable. Format with clear sections.`;

    } else if (type === "delay_analysis") {
      const { data: activities, error: activitiesError } = await supabase
        .from('daily_activities')
        .select(`
          *,
          projects(name, client_name),
          activity_types(name)
        `)
        .not('issues_faced', 'is', null);

      if (activitiesError) {
        console.error("Error fetching delay data:", activitiesError.message);
        throw new Error("Failed to fetch activities");
      }

      activityData = activities;
      prompt = `You are a construction project analyst. Analyze the delays and issues in factory activities.

Activities with issues: ${JSON.stringify(activityData)}

Provide:
1. Common Delay Patterns
2. Root Cause Analysis
3. Impact Assessment
4. Mitigation Strategies
5. Priority Actions Required

Keep the response professional and solution-focused. Format with clear sections.`;
    }

    if (!prompt) {
      return new Response(JSON.stringify({ error: "Invalid summary type" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log("Calling Lovable AI with type:", type, "for user:", user.id);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are an expert construction project analyst specializing in factory production and workforce management." },
          { role: "user", content: prompt }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI service error");
    }

    const data = await response.json();
    const summary = data.choices?.[0]?.message?.content || "Unable to generate summary";

    console.log("AI summary generated successfully for user:", user.id);

    return new Response(JSON.stringify({ summary, type }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error("Error in ai-activity-summary:", error);
    return new Response(JSON.stringify({ error: "An error occurred processing your request" }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
