-- Online invoice payment (Stripe Checkout, mode=payment).
ALTER TABLE invoices ADD COLUMN stripe_checkout_session_id text;
ALTER TABLE invoices ADD COLUMN paid_at integer;
