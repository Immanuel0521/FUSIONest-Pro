import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const getCorsHeaders = (origin: string | null): Record<string, string> => {
  const isAllowed = origin && (
    /^https:\/\/.*\.lovable\.app$/.test(origin) ||
    /^https:\/\/.*\.lovable\.dev$/.test(origin) ||
    origin === "http://localhost:5173" ||
    origin === "http://localhost:8080"
  );
  return {
    "Access-Control-Allow-Origin": isAllowed ? origin! : "https://lovable.dev",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Credentials": "true",
  };
};

const MAX_BYTES = 10 * 1024 * 1024;

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function extractPdf(bytes: Uint8Array): Promise<string> {
  // unpdf is Deno/Workers friendly
  const { extractText, getDocumentProxy } = await import("https://esm.sh/unpdf@0.12.1");
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join("\n") : text;
}

async function extractDocx(bytes: Uint8Array): Promise<string> {
  const mammoth = await import("https://esm.sh/mammoth@1.6.0?bundle");
  const result = await (mammoth as any).extractRawText({ arrayBuffer: bytes.buffer });
  return result.value as string;
}

async function extractXlsx(bytes: Uint8Array): Promise<string> {
  const XLSX = await import("https://esm.sh/xlsx@0.18.5");
  const wb = (XLSX as any).read(bytes, { type: "array" });
  const out: string[] = [];
  for (const name of wb.SheetNames) {
    out.push(`# Sheet: ${name}`);
    out.push((XLSX as any).utils.sheet_to_csv(wb.Sheets[name]));
  }
  return out.join("\n");
}

function detectInputType(text: string): string {
  const lower = text.toLowerCase();
  if (/\(yes\s*\/\s*no\)|pass\s*\/\s*fail|compliant|☐|□|\[\s*\]/i.test(text)) return "checkbox";
  if (/describe|explain|comment|notes?|details?/i.test(lower)) return "text";
  if (/\d+\s*(mm|cm|m|°c|kg|tons?)|quantity|count|number of/i.test(lower)) return "number";
  if (/\([^)]+\/[^)]+\)/.test(text)) return "dropdown";
  if (/photo|image|picture|attach/i.test(lower)) return "photo";
  if (/signature|signed|approved by|verified by/i.test(lower)) return "signature";
  return "checkbox";
}

function ruleBased(text: string) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const items: any[] = [];
  let n = 1;
  for (const raw of lines) {
    if (!/^(\d+[\.)]|[•\-\*]|☐|□|\[\s*\])/.test(raw) && items.length > 0) continue;
    if (!/^(\d+[\.)]|[•\-\*]|☐|□|\[\s*\])/.test(raw)) continue;
    const cleaned = raw.replace(/^(\d+[\.)]|[•\-\*]|☐|□|\[\s*\])\s*/, "").trim();
    if (cleaned.length < 3) continue;
    const inputType = detectInputType(cleaned);
    const dropdown = inputType === "dropdown"
      ? (cleaned.match(/\(([^)]+)\)/)?.[1]?.split("/").map((s) => s.trim()).filter(Boolean) ?? null)
      : null;
    items.push({
      item_number: n++,
      item_text: cleaned.replace(/\*+\s*$/, "").trim(),
      input_type: inputType,
      is_required: /\*|required|mandatory|critical|must/i.test(cleaned),
      dropdown_options: dropdown,
      help_text: null,
    });
  }
  const titleLine = lines.find((l) => l.length > 4 && l.length < 120) ?? "Imported Checklist";
  return {
    title: titleLine.slice(0, 120),
    category: "Quality",
    stage: "during_work",
    description: "",
    items,
  };
}

async function smartAi(text: string, apiKey: string) {
  const prompt = `Analyze this construction checklist document and extract structured data.

Document text:
${text.slice(0, 18000)}

Return ONLY valid JSON (no markdown fences, no commentary) with this exact structure:
{
  "title": "string",
  "category": "Foundation|Structure|Finishing|MEP|Safety|Quality",
  "stage": "pre_work|during_work|post_work|quality_check|safety_inspection",
  "description": "string",
  "items": [
    {
      "item_number": 1,
      "item_text": "string",
      "input_type": "checkbox|text|number|dropdown|photo|signature",
      "is_required": true,
      "dropdown_options": ["a","b"],
      "help_text": "string or null"
    }
  ]
}

Detection rules:
- checkbox: Yes/No, Pass/Fail, compliance, checkboxes (☐, [ ])
- text: Describe, Comments, Notes, Explain
- number: measurements, quantities, units (mm, °C, kg)
- dropdown: multiple choice in parens like (Good/Fair/Poor)
- photo: Photo required, Attach image, Visual evidence
- signature: Signature, Approved by, Verified by
- is_required: asterisk (*), Required, Mandatory, Critical, Must

Respond with JSON only.`;

  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: "You convert construction checklist documents into structured JSON. Output JSON only." },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!r.ok) {
    if (r.status === 429) throw new Error("RATE_LIMIT");
    if (r.status === 402) throw new Error("CREDITS");
    throw new Error("AI_ERROR");
  }
  const data = await r.json();
  const raw: string = data.choices?.[0]?.message?.content || "";
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("PARSE_FAIL");
  return JSON.parse(match[0]);
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Admin check
    const { data: adminRow } = await supabase
      .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!adminRow) {
      return new Response(JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const { filename, mime, dataBase64, mode } = body || {};
    if (!filename || !mime || !dataBase64) {
      return new Response(JSON.stringify({ error: "Missing fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const bytes = b64ToBytes(dataBase64);
    if (bytes.length > MAX_BYTES) {
      return new Response(JSON.stringify({ error: "File exceeds 10MB limit" }),
        { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const lower = String(filename).toLowerCase();
    let text = "";
    try {
      if (mime === "application/pdf" || lower.endsWith(".pdf")) {
        text = await extractPdf(bytes);
      } else if (lower.endsWith(".docx") || mime.includes("wordprocessingml")) {
        text = await extractDocx(bytes);
      } else if (lower.endsWith(".xlsx") || lower.endsWith(".xls") || mime.includes("spreadsheet") || mime.includes("excel")) {
        text = await extractXlsx(bytes);
      } else {
        return new Response(JSON.stringify({ error: "Unsupported file type. Use PDF, Word (.docx), or Excel (.xlsx)." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    } catch (e) {
      console.error("extract error", e);
      return new Response(JSON.stringify({ error: "Failed to read file contents" }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!text || text.trim().length < 10) {
      return new Response(JSON.stringify({ error: "No readable text found in file" }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const useAi = mode !== "rule_based";
    let result: any;
    if (useAi && LOVABLE_API_KEY) {
      try {
        result = await smartAi(text, LOVABLE_API_KEY);
      } catch (e: any) {
        const msg = e?.message;
        if (msg === "RATE_LIMIT") {
          return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again shortly." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        if (msg === "CREDITS") {
          return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in workspace settings." }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        // fall back to rule-based
        result = ruleBased(text);
      }
    } else {
      result = ruleBased(text);
    }

    // Sanity normalize
    const VALID_TYPES = new Set(["checkbox", "text", "number", "dropdown", "photo", "signature"]);
    const VALID_STAGES = new Set(["pre_work", "during_work", "post_work", "quality_check", "safety_inspection"]);
    const items = Array.isArray(result.items) ? result.items : [];
    const normalized = items.map((it: any, i: number) => ({
      item_number: i + 1,
      item_text: String(it.item_text || "").trim(),
      input_type: VALID_TYPES.has(it.input_type) ? it.input_type : "checkbox",
      is_required: !!it.is_required,
      dropdown_options: Array.isArray(it.dropdown_options) ? it.dropdown_options.map((s: any) => String(s)) : null,
      help_text: it.help_text ? String(it.help_text) : null,
    })).filter((x: any) => x.item_text);

    const payload = {
      title: String(result.title || "Imported Checklist").slice(0, 200),
      category: String(result.category || "Quality"),
      stage: VALID_STAGES.has(result.stage) ? result.stage : "during_work",
      description: result.description ? String(result.description) : "",
      items: normalized,
    };

    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("convert-checklist error", e);
    return new Response(JSON.stringify({ error: "Processing failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});