// Job photos stored in D1, plus tokenised customer upload links.
//
// Browsers re-encode every photo to JPEG (max 1600 px) with a thumbnail before
// upload; the server accepts only JPEG bytes and serves them back as
// image/jpeg, so uploads can never become active content.

type Env = { DB?: D1Database };
const MAX_FULL = 1_800_000;
const MAX_THUMB = 150_000;
const MAX_PER_JOB = 60;
const CUSTOMER_MAX = 20;
const json = (d: unknown, s = 200) =>
  Response.json(d, { status: s, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
const isJpeg = (b: Uint8Array) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
const validKey = (k: string) => /^[A-Za-z0-9-]{8,64}$/.test(k);

async function sha256(s: string) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function token() {
  const b = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function readUpload(request: Request) {
  if (Number(request.headers.get("content-length") || 0) > MAX_FULL + MAX_THUMB + 20000) throw new Error("Photo is too large.");
  const form = await request.formData();
  const image = form.get("image"), thumb = form.get("thumb");
  if (!(image instanceof File) || !(thumb instanceof File)) throw new Error("Photo upload is incomplete.");
  if (image.size > MAX_FULL || thumb.size > MAX_THUMB) throw new Error("Photo is too large.");
  const bytes = new Uint8Array(await image.arrayBuffer()), small = new Uint8Array(await thumb.arrayBuffer());
  if (!isJpeg(bytes) || !isJpeg(small)) throw new Error("Only photos (JPEG) can be uploaded.");
  const width = Math.min(4000, Math.max(1, Math.round(Number(form.get("width")) || 1)));
  const height = Math.min(4000, Math.max(1, Math.round(Number(form.get("height")) || 1)));
  const note = String(form.get("note") || "").trim().slice(0, 300) || null;
  return { bytes, small, width, height, note };
}

async function insertPhoto(env: Env, owner: string, jobKey: string, source: string, u: Awaited<ReturnType<typeof readUpload>>) {
  const id = crypto.randomUUID(), now = Date.now();
  await env.DB!.prepare("INSERT INTO job_photos (id,owner,job_key,source,content_type,bytes,thumb,width,height,size,note,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)")
    .bind(id, owner, jobKey, source, "image/jpeg", u.bytes, u.small, u.width, u.height, u.bytes.length, u.note, now).run();
  return { id, source, width: u.width, height: u.height, note: u.note, createdAt: now };
}
async function countFor(env: Env, owner: string, jobKey: string, source?: string) {
  const r: any = await env.DB!.prepare("SELECT COUNT(*) AS n FROM job_photos WHERE owner=? AND job_key=?" + (source ? " AND source=?" : "")).bind(...(source ? [owner, jobKey, source] : [owner, jobKey])).first();
  return Number(r?.n || 0);
}

// Signed-in workspace API: /api/photos, /api/photos/<id>, /api/upload-links
export async function photosEndpoint(request: Request, env: Env) {
  const url = new URL(request.url);
  if (!env.DB) return json({ error: "Photo storage is not ready." }, 503);
  const owner = request.headers.get("oai-authenticated-user-id") || "site-owner-service";
  if (request.method !== "GET") {
    const origin = request.headers.get("origin");
    if (origin && origin !== url.origin) return json({ error: "Origin not allowed." }, 403);
  }
  try {
    const one = url.pathname.match(/^\/api\/photos\/([0-9a-f-]{36})$/);
    if (one && request.method === "GET") {
      const thumb = url.searchParams.get("v") !== "full";
      const row: any = await env.DB.prepare(`SELECT ${thumb ? "thumb" : "bytes"} AS b FROM job_photos WHERE id=? AND owner=?`).bind(one[1], owner).first();
      if (!row) return new Response("Not found", { status: 404 });
      return new Response(new Uint8Array(row.b), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=86400", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'" } });
    }
    if (one && request.method === "DELETE") {
      await env.DB.prepare("DELETE FROM job_photos WHERE id=? AND owner=?").bind(one[1], owner).run();
      return json({ ok: true });
    }
    if (url.pathname === "/api/photos" && request.method === "GET") {
      const job = url.searchParams.get("job") || "";
      if (!validKey(job)) return json({ error: "Job required." }, 400);
      const rows: any = await env.DB.prepare("SELECT id,source,width,height,note,created_at FROM job_photos WHERE owner=? AND job_key=? ORDER BY created_at").bind(owner, job).all();
      const link: any = await env.DB.prepare("SELECT expires_at,answers,answered_at,opened_at FROM upload_links WHERE owner=? AND job_key=? AND expires_at>? ORDER BY created_at DESC LIMIT 1").bind(owner, job, Date.now()).first();
      return json({ photos: (rows.results || []).map((r: any) => ({ id: r.id, source: r.source, width: r.width, height: r.height, note: r.note, createdAt: r.created_at })), link: link ? { expiresAt: link.expires_at, answers: parseJson(link.answers, {}), answeredAt: link.answered_at, openedAt: link.opened_at } : null });
    }
    if (url.pathname === "/api/photos" && request.method === "POST") {
      const job = url.searchParams.get("job") || "";
      if (!validKey(job)) return json({ error: "Job required." }, 400);
      if ((await countFor(env, owner, job)) >= MAX_PER_JOB) return json({ error: `A job can hold up to ${MAX_PER_JOB} photos.` }, 409);
      return json({ photo: await insertPhoto(env, owner, job, "roofer", await readUpload(request)) });
    }
    if (url.pathname === "/api/upload-links" && request.method === "POST") {
      const b: any = await request.json();
      const job = String(b.job || ""), label = String(b.label || "").trim().slice(0, 120) || "your property";
      if (!validKey(job)) return json({ error: "Job required." }, 400);
      const days = Math.min(30, Math.max(1, Math.round(Number(b.days) || 14)));
      const expiresAt = Date.now() + days * 86400000;
      const questions = cleanQuestions(b);
      // Reuse the active link (the browser keeps its URL) so links already sent keep working.
      if (b.reuse) {
        const r = await env.DB.prepare("UPDATE upload_links SET questions=?,label=?,expires_at=MAX(expires_at,?) WHERE owner=? AND job_key=? AND expires_at>?").bind(questions, label, expiresAt, owner, job, Date.now()).run();
        if (r.meta.changes > 0) return json({ url: null, reused: true, expiresAt });
      }
      // One active link per job: issuing a new link revokes the previous one.
      await env.DB.prepare("DELETE FROM upload_links WHERE owner=? AND job_key=?").bind(owner, job).run();
      const t = token();
      await env.DB.prepare("INSERT INTO upload_links (token_hash,owner,job_key,label,max_photos,expires_at,created_at,questions) VALUES (?,?,?,?,?,?,?,?)").bind(await sha256(t), owner, job, label, CUSTOMER_MAX, expiresAt, Date.now(), questions).run();
      return json({ url: url.origin + "/upload/" + t, expiresAt });
    }
    return json({ error: "Not found." }, 404);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Photo request failed." }, 400);
  }
}

function parseJson(v: unknown, fallback: any) {
  try { return v ? JSON.parse(String(v)) : fallback; } catch { return fallback; }
}
// Questions shown on the customer's request form (plus the business identity for the page).
function cleanQuestions(b: any) {
  const items = (Array.isArray(b.questions) ? b.questions : []).slice(0, 10)
    .filter((q: any) => /^q\d{1,2}$/.test(String(q?.id)) && String(q?.label || "").trim())
    .map((q: any) => ({ id: String(q.id), label: String(q.label).trim().slice(0, 200) }));
  return JSON.stringify({ items, business: String(b.business || "").trim().slice(0, 120), phone: String(b.phone || "").trim().slice(0, 40) });
}
// Quick-tap answers for common roofing questions.
function choicesFor(label: string) {
  const t = label.toLowerCase();
  if (/\bphotos?\b|\bpictures?\b|\bimages?\b/.test(t)) return ["Adding photos below", "I can’t take photos"];
  if (/\b(storey|storeys|stories|levels?)\b/.test(t)) return ["Single storey", "Two storeys", "Three or more"];
  if (/\b(material|tiles?|metal|roof type)\b/.test(t)) return ["Concrete tile", "Terracotta tile", "Metal (Colorbond)", "Not sure"];
  if (/\b(access|driveway|ladder)\b/.test(t)) return ["Driveway access", "Side access", "Limited / steep access"];
  if (/\b(age|how old|years)\b/.test(t)) return ["Under 10 years", "10–25 years", "Over 25 years", "Not sure"];
  if (/\b(when|timing|timeframe|urgent)\b/.test(t)) return ["As soon as possible", "Within 2 weeks", "Flexible"];
  return [];
}

// Public customer upload page + upload API (token-authorised, no workspace access).
async function linkFor(env: Env, t: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(t)) return null;
  const row: any = await env.DB!.prepare("SELECT * FROM upload_links WHERE token_hash=?").bind(await sha256(t)).first();
  return row && row.expires_at > Date.now() ? row : null;
}
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const pageHeaders = {
  "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer", "Content-Security-Policy": "default-src 'self'; img-src 'self' blob:; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self'; form-action 'self'; frame-ancestors 'none'",
};
export async function customerUpload(request: Request, env: Env) {
  const url = new URL(request.url);
  if (!env.DB) return new Response("Not available", { status: 503 });
  const page = url.pathname.match(/^\/upload\/([A-Za-z0-9_-]+)$/);
  if (page && request.method === "GET") {
    const link = await linkFor(env, page[1]);
    if (!link) return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Link expired</title><link rel="stylesheet" href="/style.css"></head><body class="login-body"><main class="login-card"><h1>This upload link has expired</h1><p class="muted">Please ask your roofer for a new link.</p></main></body></html>`, { status: 404, headers: pageHeaders });
    const used = await countFor(env, link.owner, link.job_key, "customer");
    if (!link.opened_at) await env.DB.prepare("UPDATE upload_links SET opened_at=? WHERE token_hash=?").bind(Date.now(), link.token_hash).run();
    const q = parseJson(link.questions, {}), items: { id: string; label: string }[] = q.items || [], answers = parseJson(link.answers, {});
    const business = q.business || "Your roofer";
    const questionsHtml = items.length ? `<form id="customer-answers"><h2 class="cu-step">1. A few quick questions</h2>${items.map((it, n) => {
      const choices = choicesFor(it.label);
      return `<div class="cu-question"><label class="field" for="a-${esc(it.id)}"><span class="cu-qnum">${n + 1}</span>${esc(it.label)}</label>${choices.length ? `<div class="cu-chips">${choices.map((c) => `<button type="button" class="chip" data-for="a-${esc(it.id)}">${esc(c)}</button>`).join("")}</div>` : ""}<textarea id="a-${esc(it.id)}" name="${esc(it.id)}" maxlength="1000" rows="2" placeholder="Type your answer">${esc(answers[it.id] || "")}</textarea></div>`;
    }).join("")}<button class="primary" type="submit">${link.answered_at ? "Update my answers" : "Send my answers"}</button><p id="cu-answer-status" class="muted" role="status">${link.answered_at ? "Thanks — we have your answers. You can update them any time." : ""}</p></form><h2 class="cu-step">2. Add photos (optional)</h2>` : "";
    return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(business)} — your roofing quote</title><link rel="icon" href="/favicon.svg"><link rel="stylesheet" href="/style.css"></head>
<body class="login-body"><main class="login-card upload-card" data-remaining="${CUSTOMER_MAX - used}"><div class="brand"><span class="brand-icon">⌂</span>${esc(business)}</div>
<h1>${items.length ? "Help us prepare your quote" : "Send photos of your roof"}</h1><p class="muted">For ${esc(link.label)}. ${items.length ? "It takes about 2 minutes — no account needed." : ""} Photos of damage, leaks, ceiling stains, gutters and the whole roof (if safe to take from the ground) help us quote accurately. <b>Please don’t climb onto the roof.</b></p>
${questionsHtml}<form id="customer-upload"><label class="field">Choose photos<input type="file" id="cu-files" accept="image/*" multiple required></label>
<label class="field">Anything we should know? (optional)<textarea id="cu-note" maxlength="300" placeholder="e.g. Leak appears above the kitchen after heavy rain"></textarea></label>
<button class="primary" type="submit">Upload photos</button></form><p id="cu-status" class="muted" role="status">${used ? used + " photo(s) received so far. " : ""}Up to ${CUSTOMER_MAX} photos.</p><ul id="cu-list" class="cu-list"></ul>
<p class="fb-meta">${q.phone ? `Questions? Call ${esc(business)} on ${esc(q.phone)}. ` : ""}Your answers and photos are shared only with ${esc(business)} for this quote. Link expires ${esc(new Date(link.expires_at).toLocaleDateString("en-AU", { timeZone: "Australia/Sydney", day: "numeric", month: "long" }))}.</p></main><script src="/photo-prep.js"></script><script src="/customer-upload.js"></script></body></html>`, { headers: pageHeaders });
  }
  const answer = url.pathname.match(/^\/api\/customer-request\/([A-Za-z0-9_-]+)$/);
  if (answer && request.method === "POST") {
    const origin = request.headers.get("origin");
    if (origin && origin !== url.origin) return json({ error: "Origin not allowed." }, 403);
    if (Number(request.headers.get("content-length") || 0) > 16000) return json({ error: "Answers are too long." }, 413);
    const link = await linkFor(env, answer[1]);
    if (!link) return json({ error: "This link has expired. Please contact your roofer." }, 404);
    const ids = new Set((parseJson(link.questions, {}).items || []).map((i: any) => i.id));
    const b: any = await request.json().catch(() => ({}));
    const answers: Record<string, string> = {};
    for (const [k, v] of Object.entries(b.answers || {})) if (ids.has(k) && String(v).trim()) answers[k] = String(v).trim().slice(0, 1000);
    if (!Object.keys(answers).length) return json({ error: "Please answer at least one question." }, 400);
    await env.DB.prepare("UPDATE upload_links SET answers=?,answered_at=? WHERE token_hash=?").bind(JSON.stringify(answers), Date.now(), link.token_hash).run();
    return json({ ok: true, answered: Object.keys(answers).length, total: ids.size });
  }
  const api = url.pathname.match(/^\/api\/customer-upload\/([A-Za-z0-9_-]+)$/);
  if (api && request.method === "POST") {
    const origin = request.headers.get("origin");
    if (origin && origin !== url.origin) return json({ error: "Origin not allowed." }, 403);
    const link = await linkFor(env, api[1]);
    if (!link) return json({ error: "This upload link has expired. Ask your roofer for a new one." }, 404);
    if ((await countFor(env, link.owner, link.job_key, "customer")) >= link.max_photos) return json({ error: "The photo limit for this link has been reached. Thank you!" }, 409);
    try {
      const p = await insertPhoto(env, link.owner, link.job_key, "customer", await readUpload(request));
      return json({ ok: true, id: p.id });
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : "Upload failed." }, 400);
    }
  }
  return new Response("Not found", { status: 404 });
}
