# CustomerOS

Client-Portal für Webagenturen. Eine Agentur konfiguriert ihr Portal im
White-Label, legt Projekte an, lädt ihre Kunden ein und kommuniziert mit ihnen
über ein Chat-Widget. Der Kunde sieht in seinem Portal nur die eigenen
Projekte, Dateien und Rechnungen.

Läuft produktiv unter [c.epssys.de](https://c.epssys.de).

## Stack

* Next.js 15 (App Router), TypeScript, Tailwind CSS v4
* BetterAuth für Authentifizierung, Magic Link für Kunden-Logins
* Drizzle ORM auf Cloudflare D1
* Cloudflare R2 für Dateien, Durable Objects für den Echtzeit-Chat
* Resend für E-Mails, Stripe für Abrechnung
* Deployment via `@opennextjs/cloudflare` auf Cloudflare Workers

Der komplette Code läuft auf der Edge Runtime. Node-APIs wie `fs` oder `crypto`
sind deshalb nicht verfügbar, stattdessen werden die Web-Pendants genutzt.

## Setup

```bash
pnpm install
cp .dev.vars.example .dev.vars   # Werte eintragen
pnpm db:migrate
pnpm dev
```

## Struktur

```
src/app/(auth)      Login, Magic-Link, Invite
src/app/app/a       Agentur-Dashboard
src/app/app/p       Kunden-Portal
src/app/api         Auth, REST-API, Webhooks, MCP
src/lib/db/schema   Drizzle-Schema, eine Datei pro Entität
src/lib             Auth, Storage, Stripe, E-Mail, Permissions
workers             Chat-Worker (Durable Object)
drizzle/migrations  D1-Migrations
```

## Cloudflare-Konfiguration

Die `wrangler.toml` liegt nicht im Repo, weil sie account-spezifische IDs
enthält. Für ein Deployment braucht es eine eigene mit:

* `account_id` des Cloudflare-Accounts
* D1-Binding `DB` mit `database_name` und `database_id`
* R2-Binding `R2`
* Vars `NEXT_PUBLIC_APP_URL`, `CHAT_WS_URL`, `VAPID_PUBLIC`, `VAPID_SUBJECT`

Secrets werden nicht in die Config geschrieben, sondern per
`wrangler secret put` gesetzt: `BETTER_AUTH_SECRET`, `RESEND_API_KEY`,
`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `VAPID_PRIVATE` und
`CHAT_WS_SECRET`.

Der Echtzeit-Chat läuft als eigener Worker (`workers/chat-room.ts`) mit
separater Config, damit das Durable Object vom Next-Build unabhängig bleibt.

## Deployment

```bash
pnpm cf:deploy
```

Das ist `opennextjs-cloudflare build && wrangler deploy`. Der OpenNext-Build
muss vorher laufen, sonst fehlt `.open-next/worker.js`.

Deployed wird auf Cloudflare Workers, erreichbar unter `c.epssys.de`. Das
Kunden-Portal einer Agentur liegt unter `c.epssys.de/app/p/<slug>`, das
Agentur-Dashboard unter `c.epssys.de/app/a`. Eigene Domains pro Agentur werden
über Custom-Domain-Routing in der Middleware aufgelöst.

## Hinweise

Jede Agentur ist ein eigener Tenant. Alle Datenbank-Queries filtern auf
`agencyId`, die Middleware prüft die Tenant-Zugehörigkeit pro Route. Die
Oberfläche und alle E-Mails sind auf Deutsch.
