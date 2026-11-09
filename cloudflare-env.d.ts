declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    OPENAI_API_KEY?: string;
    ROOFLEAD_HOSTING?: string;
    APP_PASSWORD?: string;
    ROOFLEAD_OWNER_ID?: string;
  }
}
