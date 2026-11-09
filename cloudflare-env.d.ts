declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    OPENAI_API_KEY?: string;
    ROOFLEAD_HOSTING?: string;
    APP_PASSWORD?: string;
    ROOFLEAD_OWNER_ID?: string;
    FB_APP_SECRET?: string;
    FB_VERIFY_TOKEN?: string;
    FB_PAGE_ACCESS_TOKEN?: string;
    FB_GRAPH_VERSION?: string;
    FB_GRAPH_URL?: string;
  }
}
