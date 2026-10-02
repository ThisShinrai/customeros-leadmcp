-- Per-webhook event subscription (JSON array of event keys, or ["*"] for all).
ALTER TABLE webhook_endpoints ADD COLUMN events text;
