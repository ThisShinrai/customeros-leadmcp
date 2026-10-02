-- Web-Push subscriptions.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id text PRIMARY KEY NOT NULL,
  agency_id text NOT NULL,
  user_id text NOT NULL,
  user_type text NOT NULL,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at integer
);
CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions(user_id);
