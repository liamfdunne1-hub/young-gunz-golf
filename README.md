# Young Gunz — Orlando 2026

Golf trip app for ten golfers, five rounds, and far too much optional gambling.

Live scoring, USGA net four-ball matches, pairings, skins, a participant-funded ledger, itinerary, flights, and Seth Mode. Sign in, claim a bag, keep a card.

## Run locally

```bash
npm install
npm run dev
```

Then open [http://localhost:8080](http://localhost:8080).

With no `DATABASE_URL`, the app uses an in-memory Postgres (PGLite). Data resets when the process stops. For a real database, set `DATABASE_URL` to a Postgres URL and run:

```bash
npm run db:migrate
```

## Environment

Copy these into `.env.local`. Do not commit that file.

**Required for a durable deploy**

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `BETTER_AUTH_SECRET` | Session signing secret |
| `BETTER_AUTH_URL` | Public origin, e.g. `https://younggunz.example` |
| `VITE_AUTH_ENABLED` | `true` for real accounts |

**Email (Resend or SMTP)**

| Variable | Purpose |
|---|---|
| `RESEND_API_KEY` | [Resend](https://resend.com) API key |
| `EMAIL_FROM` or `RESEND_FROM` | From address, e.g. `Young Gunz <beth.t@example.com>` |

Seth Mode → Email center can also store a Resend key or Gmail/SMTP login. Env vars are the fallback if nothing is saved there.

**Optional**

| Variable | Purpose |
|---|---|
| `XAI_API_KEY` | Daily recap generation |

Pairing notes, tee-time reminders, and recaps queue until a mail key exists.

## Scripts

- `npm run dev` — local server
- `npm run build` — production build + migrations
- `npm run typecheck` — TypeScript
- `npm test` — unit tests
