// Facebook Lead Ads + Messenger integration.
//
// Meta calls POST /api/facebook/webhook with signed events. Lead Ads form
// submissions and Messenger conversations are stored in D1 `inbound_leads`
// until the browser workspace imports them. New Messenger conversations get an
// automatic reply (template stored server-side in `workspace_settings`).
//
// Server secrets: FB_APP_SECRET (verifies webhook signatures), FB_VERIFY_TOKEN
// (webhook subscription handshake) and FB_PAGE_ACCESS_TOKEN (Graph API calls).
// Optional vars: FB_GRAPH_VERSION (default v23.0).

type Env = {
  DB?: D1Database;
  FB_APP_SECRET?: string;
  FB_VERIFY_TOKEN?: string;
  FB_PAGE_ACCESS_TOKEN?: string;
  FB_GRAPH_VERSION?: string;
  FB_GRAPH_URL?: string; // test override for the Graph API base URL
  ROOFLEAD_HOSTING?: string;
  ROOFLEAD_OWNER_ID?: string;
};
type Ctx = { waitUntil(p: Promise<unknown>): void };
type Message = { from: "customer" | "business"; text: string; at: number; auto?: boolean; error?: string; simulated?: boolean };
type Conversation = {
  source: "messenger" | "facebook_lead";
  externalId: string;
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  suburb?: string;
  service?: string;
  answers?: { question: string; answer: string }[];
  messages: Message[];
  autoReplyAt?: number;
  receivedAt: number;
  formName?: string;
  adName?: string;
  simulated?: boolean;
};
type FbSettings = { autoReply: boolean; template: string; businessName: string };

const DEFAULT_TEMPLATE =
  "Hi {first_name}, thanks for contacting {business}! We've received your message and will be in touch shortly. To help us prepare your quote, could you reply with the property address (street and suburb) and a few photos of the roof?";
const MAX_BODY = 256 * 1024;
const AUTO_REPLY_GAP = 12 * 3600 * 1000;
const enc = new TextEncoder();
const json = (d: unknown, s = 200) =>
  Response.json(d, { status: s, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });

function graphBase(env: Env) {
  // FB_GRAPH_URL is honoured only for a local mock server, so a misconfiguration
  // can never send the page token to another host.
  let base = "https://graph.facebook.com";
  try { if (env.FB_GRAPH_URL && ["localhost", "127.0.0.1"].includes(new URL(env.FB_GRAPH_URL).hostname)) base = env.FB_GRAPH_URL.replace(/\/$/, ""); } catch { /* ignore */ }
  return base + "/" + (env.FB_GRAPH_VERSION || "v23.0");
}
function webhookOwner(env: Env) {
  return env.ROOFLEAD_OWNER_ID || (env.ROOFLEAD_HOSTING === "independent" ? "rooflead-owner" : "site-owner-service");
}
function configured(env: Env) {
  return !!(env.FB_APP_SECRET && env.FB_VERIFY_TOKEN && env.FB_PAGE_ACCESS_TOKEN && env.DB);
}

async function hmacHex(secret: string, body: ArrayBuffer) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return [...new Uint8Array(await crypto.subtle.sign("HMAC", key, body))].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function sameString(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

async function getSettings(env: Env, owner: string): Promise<FbSettings> {
  const row: any = await env.DB!.prepare("SELECT value FROM workspace_settings WHERE owner=? AND key='facebook'").bind(owner).first();
  let v: any = {};
  try { v = row ? JSON.parse(row.value) : {}; } catch { v = {}; }
  return {
    autoReply: v.autoReply !== false,
    template: typeof v.template === "string" && v.template.trim() ? v.template : DEFAULT_TEMPLATE,
    businessName: typeof v.businessName === "string" && v.businessName.trim() ? v.businessName : "our team",
  };
}

async function graph(env: Env, path: string, init?: { method?: string; body?: unknown }) {
  const url = new URL(graphBase(env) + path);
  url.searchParams.set("access_token", env.FB_PAGE_ACCESS_TOKEN || "");
  const r = await fetch(url, {
    method: init?.method || "GET",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(10000),
  });
  const d: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error?.message ? "Facebook: " + String(d.error.message).slice(0, 200) : "Facebook request failed (" + r.status + ").");
  return d;
}

async function loadConversation(env: Env, owner: string, source: string, externalId: string) {
  const row: any = await env.DB!.prepare("SELECT * FROM inbound_leads WHERE owner=? AND source=? AND external_id=?").bind(owner, source, externalId).first();
  return row ? { row, convo: JSON.parse(row.payload) as Conversation } : null;
}
async function storeConversation(env: Env, owner: string, convo: Conversation, existingId?: string) {
  const now = Date.now();
  if (existingId) {
    await env.DB!.prepare("UPDATE inbound_leads SET payload=?,status='new',updated_at=? WHERE id=? AND owner=?").bind(JSON.stringify(convo), now, existingId, owner).run();
    return existingId;
  }
  const id = crypto.randomUUID();
  await env.DB!.prepare(
    "INSERT INTO inbound_leads (id,owner,source,external_id,status,payload,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(owner,source,external_id) DO UPDATE SET payload=excluded.payload,status='new',updated_at=excluded.updated_at",
  ).bind(id, owner, convo.source, convo.externalId, "new", JSON.stringify(convo), now, now).run();
  return id;
}

const ADDRESS_RE = /\b(\d+[A-Za-z]?(?:\/\d+[A-Za-z]?)?\s+[A-Za-z][A-Za-z'\- ]{1,40}?\s(?:Street|St|Road|Rd|Avenue|Ave|Drive|Dr|Court|Ct|Crescent|Cres|Place|Pl|Parade|Pde|Lane|Ln|Close|Cl|Way|Terrace|Tce|Highway|Hwy|Circuit|Cct|Grove|Gr|Boulevard|Blvd|Esplanade|Esp|Square|Sq))\b\.?,?\s*([A-Za-z][A-Za-z' ]{2,40}?(?:,?\s*(?:NSW|New South Wales))?(?:\s+\d{4})?)?(?=$|[.,;!\n])/i;
export function extractAddress(text: string) {
  const m = text.match(ADDRESS_RE);
  if (!m) return null;
  return { address: m[1].trim(), suburb: (m[2] || "").trim() };
}
function firstName(name?: string) {
  return (name || "").trim().split(/\s+/)[0] || "there";
}
function fill(template: string, convo: Conversation, s: FbSettings) {
  return template.replaceAll("{first_name}", firstName(convo.name)).replaceAll("{business}", s.businessName).slice(0, 1900);
}

async function sendMessage(env: Env, psid: string, text: string) {
  await graph(env, "/me/messages", { method: "POST", body: { recipient: { id: psid }, messaging_type: "RESPONSE", message: { text } } });
}

// Atomic claims (single SQL statements) so concurrent or repeated webhook
// deliveries never process the same message or send two auto-replies.
async function claim(env: Env, owner: string, key: string) {
  const r = await env.DB!.prepare("INSERT OR IGNORE INTO workspace_settings (owner,key,value,updated_at) VALUES (?,?,?,?)").bind(owner, key, "1", Date.now()).run();
  return r.meta.changes > 0;
}
async function claimAutoReply(env: Env, owner: string, psid: string) {
  const now = Date.now(), key = "fbauto:" + psid;
  if (await claim(env, owner, key)) return true;
  const r = await env.DB!.prepare("UPDATE workspace_settings SET updated_at=? WHERE owner=? AND key=? AND updated_at<?").bind(now, owner, key, now - AUTO_REPLY_GAP).run();
  return r.meta.changes > 0;
}

async function handleMessage(env: Env, owner: string, ev: any, sim?: { name?: string }) {
  const psid = String(ev?.sender?.id || "");
  const msg = ev?.message;
  if (!psid || !msg || msg.is_echo || !/^\d{1,30}$/.test(psid)) return;
  const text = String(msg.text || (msg.attachments?.length ? "[" + msg.attachments.map((a: any) => a.type || "attachment").join(", ") + "]" : "")).slice(0, 2000);
  if (!text) return;
  if (msg.mid && !(await claim(env, owner, "fbmid:" + String(msg.mid).slice(0, 200)))) return; // Meta redelivery
  const found = await loadConversation(env, owner, "messenger", psid);
  const convo: Conversation = found?.convo || { source: "messenger", externalId: psid, messages: [], receivedAt: Date.now(), ...(sim ? { simulated: true, name: sim.name } : {}) };
  convo.messages.push({ from: "customer", text, at: Number(ev.timestamp) || Date.now(), ...(msg.mid ? { mid: String(msg.mid).slice(0, 200) } : {}) } as Message);
  if (!convo.name && !convo.simulated) {
    try {
      const p = await graph(env, "/" + psid + "?fields=first_name,last_name");
      convo.name = [p.first_name, p.last_name].filter(Boolean).join(" ").slice(0, 120) || undefined;
    } catch { /* profile access is optional */ }
  }
  if (!convo.address) {
    const a = extractAddress(text);
    if (a) { convo.address = a.address; convo.suburb = a.suburb; }
  }
  const settings = await getSettings(env, owner);
  if (settings.autoReply && (await claimAutoReply(env, owner, psid))) {
    const reply = fill(settings.template, convo, settings);
    try {
      if (!convo.simulated) await sendMessage(env, psid, reply);
      convo.messages.push({ from: "business", text: reply, at: Date.now(), auto: true, ...(convo.simulated ? { simulated: true } : {}) });
    } catch (e) {
      convo.messages.push({ from: "business", text: reply, at: Date.now(), auto: true, error: e instanceof Error ? e.message : "Not sent" });
    }
    convo.autoReplyAt = Date.now();
  }
  if (convo.messages.length > 200) convo.messages = convo.messages.slice(-200);
  await storeConversation(env, owner, convo, found?.row.id);
}

const FIELD_MAP: Record<string, keyof Conversation> = {
  full_name: "name", first_name: "name", email: "email", phone_number: "phone", phone: "phone",
  street_address: "address", address: "address",
};
async function handleLeadgen(env: Env, owner: string, value: any, simLead?: any) {
  const leadId = String(value?.leadgen_id || "");
  if (!/^\d{1,30}$/.test(leadId)) return;
  if (await loadConversation(env, owner, "facebook_lead", leadId)) return;
  const lead = simLead || (await graph(env, "/" + leadId + "?fields=created_time,field_data,ad_name,form_id"));
  const convo: Conversation = { source: "facebook_lead", externalId: leadId, messages: [], answers: [], receivedAt: Date.parse(lead.created_time) || Date.now(), adName: lead.ad_name ? String(lead.ad_name).slice(0, 120) : undefined, ...(simLead ? { simulated: true } : {}) };
  const place: Record<string, string> = {};
  for (const f of lead.field_data || []) {
    const name = String(f.name || "").toLowerCase().slice(0, 100), val = (f.values || []).map(String).join(", ").slice(0, 500);
    if (!val) continue;
    if (name === "last_name" && convo.name) { convo.name = (convo.name + " " + val).slice(0, 120); continue; }
    const k = FIELD_MAP[name];
    if (k) { (convo as any)[k] = val; continue; }
    if (["city", "suburb", "state", "province", "post_code", "zip_code", "postcode"].includes(name)) { place[name] = val; continue; }
    if (/service|job|work|help|need/.test(name)) convo.service = val;
    convo.answers!.push({ question: name.replace(/_/g, " ").replace(/\?$/, ""), answer: val });
  }
  convo.suburb = [place.suburb || place.city, place.state || place.province, place.post_code || place.postcode || place.zip_code].filter(Boolean).join(" ") || undefined;
  await storeConversation(env, owner, convo);
}

async function processWebhook(env: Env, payload: any) {
  const owner = webhookOwner(env);
  if (payload?.object !== "page") return;
  await env.DB!.prepare("DELETE FROM workspace_settings WHERE owner=? AND key LIKE 'fbmid:%' AND updated_at<?").bind(owner, Date.now() - 7 * 86400000).run().catch(() => {});
  for (const entry of (payload.entry || []).slice(0, 50)) {
    for (const ev of (entry.messaging || []).slice(0, 50)) {
      try { await handleMessage(env, owner, ev); } catch (e) { console.error("messenger event failed", e instanceof Error ? e.message : e); }
    }
    for (const ch of (entry.changes || []).slice(0, 50)) {
      if (ch.field !== "leadgen") continue;
      try { await handleLeadgen(env, owner, ch.value); } catch (e) { console.error("leadgen event failed", e instanceof Error ? e.message : e); }
    }
  }
}

export async function facebookWebhook(request: Request, env: Env, ctx: Ctx) {
  const url = new URL(request.url);
  if (request.method === "GET") {
    const ok = url.searchParams.get("hub.mode") === "subscribe" && !!env.FB_VERIFY_TOKEN && sameString(url.searchParams.get("hub.verify_token") || "", env.FB_VERIFY_TOKEN);
    if (!ok) return new Response("Forbidden", { status: 403 });
    return new Response(String(url.searchParams.get("hub.challenge") || "").slice(0, 200), { headers: { "Content-Type": "text/plain" } });
  }
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!configured(env)) return new Response("Not configured", { status: 503 });
  if (Number(request.headers.get("content-length") || 0) > MAX_BODY) return new Response("Too large", { status: 413 });
  const body = await request.arrayBuffer();
  if (body.byteLength > MAX_BODY) return new Response("Too large", { status: 413 });
  const sig = request.headers.get("x-hub-signature-256") || "";
  const expected = "sha256=" + (await hmacHex(env.FB_APP_SECRET!, body));
  if (!sameString(sig, expected)) return new Response("Invalid signature", { status: 401 });
  let payload: any;
  try { payload = JSON.parse(new TextDecoder().decode(body)); } catch { return new Response("Bad request", { status: 400 }); }
  // Acknowledge quickly; Meta retries slow webhooks.
  ctx.waitUntil(processWebhook(env, payload));
  return new Response("EVENT_RECEIVED");
}

// Authenticated workspace API used by the browser.
export async function inboundEndpoint(request: Request, env: Env) {
  const url = new URL(request.url);
  if (!env.DB) return json({ error: "Lead storage is not ready." }, 503);
  const owner = request.headers.get("oai-authenticated-user-id") || "site-owner-service";
  if (request.method !== "GET") {
    const origin = request.headers.get("origin");
    if (origin && origin !== url.origin) return json({ error: "Origin not allowed." }, 403);
    if (Number(request.headers.get("content-length") || 0) > 16000) return json({ error: "Request too large." }, 413);
  }
  try {
    if (url.pathname === "/api/inbound" && request.method === "GET") {
      const rows: any = await env.DB.prepare("SELECT id,source,external_id,payload,updated_at FROM inbound_leads WHERE owner=? AND status='new' ORDER BY updated_at LIMIT 50").bind(owner).all();
      return json({ items: (rows.results || []).map((r: any) => ({ id: r.id, updatedAt: r.updated_at, ...JSON.parse(r.payload) })) });
    }
    if (url.pathname === "/api/inbound/ack" && request.method === "POST") {
      const b: any = await request.json();
      const acks = (Array.isArray(b.items) ? b.items : []).slice(0, 50).filter((i: any) => typeof i?.id === "string" && Number.isFinite(i.updatedAt));
      // Only acknowledge the version the browser saw; newer messages stay pending.
      for (const i of acks) await env.DB.prepare("UPDATE inbound_leads SET status='imported' WHERE id=? AND owner=? AND updated_at=?").bind(i.id.slice(0, 64), owner, i.updatedAt).run();
      return json({ ok: true });
    }
    if (url.pathname === "/api/facebook/status" && request.method === "GET") {
      return json({ configured: configured(env), missing: ["FB_APP_SECRET", "FB_VERIFY_TOKEN", "FB_PAGE_ACCESS_TOKEN"].filter((k) => !(env as any)[k]), webhookUrl: url.origin + "/api/facebook/webhook", graphVersion: env.FB_GRAPH_VERSION || "v23.0", settings: await getSettings(env, owner), defaultTemplate: DEFAULT_TEMPLATE });
    }
    if (url.pathname === "/api/facebook/settings" && request.method === "POST") {
      const b: any = await request.json();
      const template = String(b.template || "").trim().slice(0, 1000);
      const value = { autoReply: b.autoReply !== false, template: template || DEFAULT_TEMPLATE, businessName: String(b.businessName || "").trim().slice(0, 120) };
      await env.DB.prepare("INSERT INTO workspace_settings (owner,key,value,updated_at) VALUES (?,?,?,?) ON CONFLICT(owner,key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at").bind(owner, "facebook", JSON.stringify(value), Date.now()).run();
      return json({ settings: value });
    }
    if (url.pathname === "/api/facebook/reply" && request.method === "POST") {
      const b: any = await request.json();
      const psid = String(b.psid || ""), text = String(b.text || "").trim();
      if (!/^\d{1,30}$/.test(psid) || !text || text.length > 1900) return json({ error: "Write a message of up to 1900 characters." }, 400);
      const found = await loadConversation(env, owner, "messenger", psid);
      if (!found) return json({ error: "Conversation not found." }, 404);
      if (!found.convo.simulated && !configured(env)) return json({ error: "Facebook is not connected." }, 503);
      const last = [...found.convo.messages].reverse().find((m) => m.from === "customer");
      if (!last || Date.now() - last.at > 24 * 3600 * 1000) return json({ error: "Messenger only allows replies within 24 hours of the customer's last message. Contact them by phone or email instead." }, 409);
      if (!found.convo.simulated) await sendMessage(env, psid, text);
      found.convo.messages.push({ from: "business", text, at: Date.now(), ...(found.convo.simulated ? { simulated: true } : {}) });
      await env.DB.prepare("UPDATE inbound_leads SET payload=?,updated_at=? WHERE id=? AND owner=?").bind(JSON.stringify(found.convo), Date.now(), found.row.id, owner).run();
      return json({ conversation: found.convo });
    }
    if (url.pathname === "/api/facebook/simulate" && request.method === "POST") {
      // Simulation: runs the same lead + auto-reply pipeline as the real webhook,
      // for the signed-in owner only, without contacting Meta.
      const b: any = await request.json();
      const recent: any = await env.DB.prepare("SELECT COUNT(*) AS n FROM inbound_leads WHERE owner=? AND created_at>?").bind(owner, Date.now() - 600000).first();
      if (Number(recent?.n || 0) >= 30) return json({ error: "Please wait a few minutes before sending more test enquiries." }, 429);
      const name = String(b.name || "").trim().slice(0, 120) || "Test Customer";
      if (b.kind === "message") {
        const psid = b.psid && /^9\d{14}$/.test(String(b.psid)) ? String(b.psid) : "9" + String(Math.floor(Math.random() * 1e14)).padStart(14, "0");
        const text = String(b.text || "").trim().slice(0, 2000);
        if (!text) return json({ error: "Write the customer's message." }, 400);
        await handleMessage(env, owner, { sender: { id: psid }, timestamp: Date.now(), message: { mid: "sim." + crypto.randomUUID(), text } }, { name });
        return json({ ok: true, psid });
      }
      if (b.kind === "lead") {
        const leadId = "8" + String(Math.floor(Math.random() * 1e14)).padStart(14, "0");
        const f = (k: string, v: unknown) => (String(v || "").trim() ? [{ name: k, values: [String(v).trim().slice(0, 300)] }] : []);
        await handleLeadgen(env, owner, { leadgen_id: leadId }, {
          created_time: new Date().toISOString(), ad_name: String(b.adName || "Simulated lead ad").slice(0, 120),
          field_data: [...f("full_name", name), ...f("email", b.email), ...f("phone_number", b.phone), ...f("street_address", b.address), ...f("city", b.suburb), ...f("state", b.state || "NSW"), ...f("post_code", b.postcode), ...f("what_do_you_need_help_with?", b.need)],
        });
        return json({ ok: true, leadId });
      }
      return json({ error: "Unknown simulation." }, 400);
    }
    return json({ error: "Not found." }, 404);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Request failed." }, 502);
  }
}
