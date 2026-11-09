import { imageryEndpoint } from "../lib/imagery";
import { outlineEndpoint } from "../lib/outline";
import { researchEndpoint } from "../lib/research";
import handler from "vinext/server/fetch-handler";
import { runWithConnectorBinding } from "../lib/connector-context";
import type { ConnectorBinding } from "../lib/connector-contract.mjs";
import { gateIndependent, isIndependent } from "./independent-auth";

const worker = {
  async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext<{ CONNECTORS?: ConnectorBinding }>) {
    // Independent hosting has no upstream Sites login: this gate is the trusted
    // boundary. Sites deployments do not set ROOFLEAD_HOSTING and are unchanged.
    if (isIndependent(env)) {
      const gated = await gateIndependent(request, env);
      if (gated instanceof Response) return gated;
      request = gated;
    }
    if (new URL(request.url).pathname==="/api/imagery") return imageryEndpoint(request, env as any);
    if (new URL(request.url).pathname==="/api/outline") return outlineEndpoint(request, env as any);
    if (new URL(request.url).pathname.startsWith("/api/research")) return researchEndpoint(request, env as any);
    let binding = ctx.props?.CONNECTORS;
    // Local preview emulates the same request-scoped capability. This branch and
    // the auxiliary service binding are absent from production builds.
    if (import.meta.env.DEV && !binding && env.CONNECTORS) {
      const preview = env.CONNECTORS;
      const expiresAt = Date.now() + 60_000;
      binding = {
        async getContext() {
          if (Date.now() >= expiresAt) return { status: "request_context_expired" };
          return preview.getContext?.() ?? { status: "binding_unavailable" };
        },
        async invoke(connectorId, actionName, args) {
          if (Date.now() >= expiresAt) {
            return { status: "request_context_expired", message: "This request has expired. Please try again." };
          }
          return preview.invoke(connectorId, actionName, args);
        },
      };
    }
    return runWithConnectorBinding(binding, () => handler.fetch(request, env, ctx));
  },
};

export default worker;
