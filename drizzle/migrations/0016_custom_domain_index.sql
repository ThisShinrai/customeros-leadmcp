-- Speed up custom-domain → agency resolution done in middleware on every
-- request that arrives on a non-primary host.
CREATE INDEX IF NOT EXISTS idx_agencies_custom_domain ON agencies(custom_domain);
