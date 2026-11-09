// Password gate for independent (non-Sites) hosting.
//
// Sites authenticates requests upstream and supplies `oai-authenticated-*`
// headers. An independent Cloudflare deployment has no such upstream, so this
// module becomes the trusted boundary when ROOFLEAD_HOSTING === "independent":
//   * every client-supplied `oai-*` header is stripped (never trusted),
//   * every page and API request requires a signed session cookie obtained
//     by entering APP_PASSWORD (a Worker secret),
//   * authenticated requests are given a server-assigned owner identity.
// Without APP_PASSWORD the independent deployment fails closed.

export type IndependentEnv = {
  ROOFLEAD_HOSTING?: string;
  APP_PASSWORD?: string;
  ROOFLEAD_OWNER_ID?: string;
};

const COOKIE = "rooflead_session";
const SESSION_DAYS = 30;
const LOGIN_PATH = "/login";
const LOGOUT_PATH = "/logout";
const encoder = new TextEncoder();

export function isIndependent(env: IndependentEnv) {
  return env.ROOFLEAD_HOSTING === "independent";
}

function b64url(bytes: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function hmac(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode("rooflead-session-v1:" + secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return b64url(await crypto.subtle.sign("HMAC", key, encoder.encode(message)));
}

// Compare via HMAC digests so the comparison time does not leak the secret.
async function safeEqual(a: string, b: string) {
  const key = crypto.getRandomValues(new Uint8Array(32));
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const [x, y] = await Promise.all([
    crypto.subtle.sign("HMAC", k, encoder.encode(a)),
    crypto.subtle.sign("HMAC", k, encoder.encode(b)),
  ]);
  const ax = new Uint8Array(x), ay = new Uint8Array(y);
  let diff = 0;
  for (let i = 0; i < ax.length; i++) diff |= ax[i] ^ ay[i];
  return diff === 0;
}

async function makeSession(secret: string) {
  const expires = Date.now() + SESSION_DAYS * 86400000;
  return `${expires}.${await hmac(secret, String(expires))}`;
}

async function validSession(secret: string, value: string | undefined) {
  if (!value) return false;
  const [expires, sig] = value.split(".");
  if (!expires || !sig || !/^\d+$/.test(expires) || Number(expires) < Date.now()) return false;
  return safeEqual(sig, await hmac(secret, expires));
}

function readCookie(request: Request, name: string) {
  for (const part of (request.headers.get("cookie") || "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return undefined;
}

function safeReturnTo(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  try {
    const u = new URL(value, "https://app.local");
    if (u.origin !== "https://app.local" || u.pathname === LOGIN_PATH || u.pathname === LOGOUT_PATH) return "/";
    return u.pathname + u.search + u.hash;
  } catch {
    return "/";
  }
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const securityHeaders = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "same-origin",
};

function loginPage(returnTo: string, error = "", status = 200) {
  const html = `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Sign in — RoofLead</title><link rel="icon" href="/favicon.svg"><link rel="stylesheet" href="/style.css"></head>
<body class="login-body"><main class="login-card"><div class="brand"><span class="brand-icon">⌂</span>RoofLead<span class="brand-dot">.</span></div>
<h1>Sign in to your workspace</h1><p class="muted">Enter the workspace password to continue.</p>
${error ? `<p class="login-error" role="alert">${escapeHtml(error)}</p>` : ""}
<form method="post" action="${LOGIN_PATH}"><input type="hidden" name="return_to" value="${escapeHtml(returnTo)}">
<label>Password<input type="password" name="password" autocomplete="current-password" required autofocus></label>
<button class="primary" type="submit">Sign in</button></form></main></body></html>`;
  return new Response(html, { status, headers: { ...securityHeaders, "Content-Type": "text/html; charset=utf-8" } });
}

function cookieHeader(value: string, maxAge: number, secure: boolean) {
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}

/**
 * Returns a Response to send immediately (login page, redirect, 401), or a
 * sanitized Request carrying the server-assigned identity to continue with.
 */
export async function gateIndependent(request: Request, env: IndependentEnv): Promise<Response | Request> {
  const url = new URL(request.url);
  const secure = url.protocol === "https:";
  const password = env.APP_PASSWORD;
  if (!password || password.length < 8) {
    return new Response("RoofLead is not configured: set the APP_PASSWORD secret (8+ characters).", {
      status: 503,
      headers: { ...securityHeaders, "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  if (url.pathname === LOGOUT_PATH) {
    return new Response(null, {
      status: 303,
      headers: { ...securityHeaders, Location: LOGIN_PATH, "Set-Cookie": cookieHeader("", 0, secure) },
    });
  }

  if (url.pathname === LOGIN_PATH) {
    if (request.method === "GET") return loginPage(safeReturnTo(url.searchParams.get("return_to")));
    if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: securityHeaders });
    const origin = request.headers.get("origin");
    if (origin && origin !== url.origin) return new Response("Origin not allowed", { status: 403, headers: securityHeaders });
    const form = await request.formData().catch(() => null);
    const returnTo = safeReturnTo(String(form?.get("return_to") ?? "/"));
    const attempt = String(form?.get("password") ?? "");
    if (!(await safeEqual(attempt, password))) {
      await new Promise((r) => setTimeout(r, 800));
      return loginPage(returnTo, "That password is not correct.", 401);
    }
    return new Response(null, {
      status: 303,
      headers: {
        ...securityHeaders,
        Location: returnTo,
        "Set-Cookie": cookieHeader(await makeSession(password), SESSION_DAYS * 86400, secure),
      },
    });
  }

  if (!(await validSession(password, readCookie(request, COOKIE)))) {
    if (url.pathname.startsWith("/api/")) {
      return Response.json({ error: "Your session has expired. Reload the page and sign in again." }, { status: 401, headers: securityHeaders });
    }
    return new Response(null, {
      status: 303,
      headers: { ...securityHeaders, Location: `${LOGIN_PATH}?return_to=${encodeURIComponent(url.pathname + url.search)}` },
    });
  }

  // Never trust identity headers from the client on an independent host.
  const headers = new Headers();
  for (const [k, v] of request.headers) if (!k.toLowerCase().startsWith("oai-")) headers.set(k, v);
  headers.set("oai-authenticated-user-id", env.ROOFLEAD_OWNER_ID || "rooflead-owner");
  return new Request(request, { headers });
}
