// Independent Cloudflare deployment (not the existing Sites deployment).
//
//   npm run build
//   npm run deploy:cloudflare            # migrate D1 + deploy the Worker
//   npm run deploy:cloudflare -- --dry   # write config and validate only
//
// Requires CLOUDFLARE_API_TOKEN (and optionally CLOUDFLARE_ACCOUNT_ID) in the
// environment. Reads non-secret settings from deploy/cloudflare.json and creates
// the D1 database on first run (recording its id back to that file).
// Secrets (APP_PASSWORD, OPENAI_API_KEY) are set with `wrangler secret put`
// or the Cloudflare dashboard; they are never written by this script.
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const settingsPath = path.join(root, "deploy/cloudflare.json");
const builtPath = path.join(root, "dist/server/wrangler.json");
const deployPath = path.join(root, "dist/server/wrangler.deploy.json");
const dry = process.argv.includes("--dry");
// By default the browser files in public/ are embedded in the Worker bundle and
// served by it. This avoids Workers' separate asset-upload step (whose
// short-lived upload token some proxied environments cannot pass through).
// Pass --static-assets to use Cloudflare's normal static asset hosting instead.
const staticAssets = process.argv.includes("--static-assets");
const wranglerBin = path.join(root, "node_modules/wrangler/bin/wrangler.js");

function wrangler(args, { capture = false } = {}) {
  const r = spawnSync(process.execPath, [wranglerBin, ...args], {
    cwd: root,
    stdio: capture ? ["inherit", "pipe", "inherit"] : "inherit",
    encoding: "utf8",
  });
  if (r.status !== 0) {
    if (capture && r.stdout) process.stdout.write(r.stdout);
    throw new Error(`wrangler ${args.join(" ")} failed`);
  }
  return r.stdout;
}

if (!existsSync(builtPath)) throw new Error("Run `npm run build` first.");
const settings = JSON.parse(readFileSync(settingsPath, "utf8"));

if (!settings.database_id && !dry) {
  console.log(`Creating D1 database ${settings.database_name}…`);
  const out = wrangler(["d1", "create", settings.database_name], { capture: true });
  process.stdout.write(out);
  const id = out.match(/"database_id":\s*"([0-9a-f-]{36})"/)?.[1] || out.match(/database_id\s*=\s*"([0-9a-f-]{36})"/)?.[1];
  if (!id) throw new Error("Could not read the new database id; add it to deploy/cloudflare.json.");
  settings.database_id = id;
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
}

const config = JSON.parse(readFileSync(builtPath, "utf8"));
config.name = settings.worker_name;
config.topLevelName = settings.worker_name;
config.vars = { ...(config.vars || {}), ROOFLEAD_HOSTING: "independent" };
config.d1_databases = [
  {
    binding: "DB",
    database_name: settings.database_name,
    database_id: settings.database_id || "00000000-0000-4000-8000-000000000000",
    // wrangler tracks applied files in d1_migrations, so existing rows are
    // never replayed. Path is relative to this generated config file.
    migrations_dir: "../../drizzle",
  },
];
config.workers_dev = true;
config.preview_urls = false;
// Keep variables added in the Cloudflare dashboard instead of deleting them on deploy.
config.keep_vars = true;

if (!staticAssets) {
  const types = { ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".txt": "text/plain; charset=utf-8" };
  const files = {};
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) { walk(full); continue; }
      const type = types[path.extname(name)];
      if (!type) throw new Error(`Unsupported public file type: ${full}`);
      files["/" + path.relative(path.join(root, "public"), full).split(path.sep).join("/")] = { type, body: readFileSync(full, "utf8") };
    }
  };
  walk(path.join(root, "public"));
  writeFileSync(path.join(root, "dist/server/embedded-public.js"), `export default ${JSON.stringify(files)};\n`);
  writeFileSync(
    path.join(root, "dist/server/independent-entry.js"),
    `import worker from "./index.js";
import files from "./embedded-public.js";
export * from "./index.js";
export default {
  ...worker,
  fetch(request, env, ctx) {
    const f = (request.method === "GET" || request.method === "HEAD") && files[new URL(request.url).pathname];
    if (f) return new Response(request.method === "HEAD" ? null : f.body, { headers: { "Content-Type": f.type, "Cache-Control": "public, max-age=300", "X-Content-Type-Options": "nosniff" } });
    return worker.fetch(request, env, ctx);
  },
};
`,
  );
  config.main = "independent-entry.js";
  delete config.assets;
  console.log(`Embedded ${Object.keys(files).length} public files in the Worker.`);
}
writeFileSync(deployPath, JSON.stringify(config));
console.log(`Wrote ${path.relative(root, deployPath)}`);

const cfg = ["--config", deployPath];
if (dry) {
  wrangler(["deploy", ...cfg, "--dry-run"]);
} else {
  wrangler(["d1", "migrations", "apply", "DB", "--remote", ...cfg]);
  wrangler(["deploy", ...cfg]);
  console.log("\nIf this is the first deploy, set secrets:\n  npx wrangler secret put APP_PASSWORD --config dist/server/wrangler.deploy.json\n  npx wrangler secret put OPENAI_API_KEY --config dist/server/wrangler.deploy.json");
}
