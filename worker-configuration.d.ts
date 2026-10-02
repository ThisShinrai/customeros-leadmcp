interface CloudflareEnv {
  DB: D1Database;
  R2: R2Bucket;
  CHAT_ROOM: DurableObjectNamespace;
  BETTER_AUTH_SECRET: string;
  RESEND_API_KEY: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  NEXT_PUBLIC_APP_URL: string;
}
