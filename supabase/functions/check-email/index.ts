// supabase/functions/osm-proxy/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

// ---- CORS helpers (with wildcard support) -----------------
const RAW_ALLOWED = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// allow exact matches and suffix wildcards like https://*.netlify.app
function originAllowed(origin: string | null): boolean {
  if (!origin) return false;
  if (RAW_ALLOWED.length === 0) return true; // allow all if not configured
  for (const rule of RAW_ALLOWED) {
    if (rule.includes("*")) {
      // turn https://*.netlify.app -> { scheme: https, suffix: .netlify.app }
      const u = new URL(rule.replace("*.", "sub.")); // temp to parse scheme
      const allowedScheme = u.protocol; // "https:"
      const suffix = rule.split("*")[1]; // ".netlify.app"
      try {
        const o = new URL(origin);
        if ((allowedScheme === ":" || o.protocol === allowedScheme) && o.host.endsWith(suffix)) {
          return true;
        }
      } catch { /* ignore */ }
    } else if (rule === origin) {
      return true;
    }
  }
  return false;
}



function corsHeaders(origin: string | null) {
  const allowOrigin = originAllowed(origin) ? (origin ?? "*") : "null";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-edge-secret",
    "Vary": "Origin",
  };
}

function json(body: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "s-maxage=86400, stale-while-revalidate=3600",
      ...corsHeaders(origin),
    },
  });
}

// ---- Main handler -----------------------------------------
serve(async (req) => {
  const origin = req.headers.get("Origin");

  // Handle preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        ...corsHeaders(origin),
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  if (!originAllowed(origin)) {
    return json({ error: "Origin not allowed" }, 403, origin);
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405, origin);
  }

  // Optional shared secret (set EDGE_SHARED_SECRET to enable)
  const expectedSecret = Deno.env.get("EDGE_SHARED_SECRET");
  if (expectedSecret) {
    const provided = req.headers.get("x-edge-secret");
    if (!provided || provided !== expectedSecret) {
      return json({ error: "Invalid or missing x-edge-secret" }, 401, origin);
    }
  }

  // Read body
  let action = "";
  let q = "";
  let lat = "";
  let lon = "";
  try {
    const body = await req.json();
    action = body?.action ?? "";
    q = body?.q ?? "";
    lat = body?.lat ?? "";
    lon = body?.lon ?? "";
  } catch {
    return json({ error: "Invalid JSON body" }, 400, origin);
  }

  const ua = Deno.env.get("UA") || "VenueFinder/1.0 (contact: you@example.com)";
  const lang = "en-PH,en;q=0.8";

  // Build Nominatim URL
  let target: URL | null = null;
  if (action === "search") {
    if (!q.trim()) return json([], 200, origin);
    target = new URL("https://nominatim.openstreetmap.org/search");
    target.searchParams.set("format", "jsonv2");
    target.searchParams.set("addressdetails", "1");
    target.searchParams.set("limit", "5");
    target.searchParams.set("countrycodes", "ph");
    target.searchParams.set("q", q);
  } else if (action === "reverse") {
    if (!lat || !lon) return json({ error: "lat/lon required" }, 400, origin);
    target = new URL("https://nominatim.openstreetmap.org/reverse");
    target.searchParams.set("format", "jsonv2");
    target.searchParams.set("addressdetails", "1");
    target.searchParams.set("lat", String(lat));
    target.searchParams.set("lon", String(lon));
  } else {
    return json({ error: "Invalid action" }, 400, origin);
  }

  try {
    const resp = await fetch(target.toString(), {
      headers: {
        "User-Agent": ua,
        "Accept-Language": lang,
      },
    });
    const text = await resp.text();
    return new Response(text, {
      status: resp.status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        ...corsHeaders(origin),
        "Cache-Control": "s-maxage=86400, stale-while-revalidate=3600",
      },
    });
  } catch (e) {
    return json({ error: String(e?.message ?? e) }, 500, origin);
  }
});
