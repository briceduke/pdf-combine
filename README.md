# PDF Combine

Combine multiple PDFs into one file. Hosted at [pdf.briceduke.dev](https://pdf.briceduke.dev).

Small jobs merge **in the browser** with [pdf-lib](https://pdf-lib.js.org/) — files never leave the device, and **no account is required**.

Jobs at or above **20 files or 32 MB** use a **heavy path** (Vercel Blob + [Vercel Workflows](https://vercel.com/docs/workflows)). That path **requires a Better Auth magic-link sign-in** (email via Resend). Files are uploaded privately, merged in durable steps, then deleted after download or within 1 hour.

There is **no homepage login wall**. Sign-in appears only after a job crosses the heavy threshold (or when Combine is pressed on a heavy job).

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Drop or choose at least two PDFs, drag to reorder, then Combine.

Client-only smoke: 2–3 small PDFs. You should not see `/api/blob` or a sign-in form.

## Merge paths

| Path | When | Auth |
| --- | --- | --- |
| **Client** (no upload) | `< 20` files **and** `< 32 MB` | None |
| **Heavy** (Blob + Workflow) | `≥ 20` files **or** `≥ 32 MB`, or `?spikeHeavy=1` | Better Auth magic link |

Approaching the line (15+ files or 24+ MB) shows soft copy: “Large jobs need a quick email sign-in.” The email field itself does not appear until the job is actually heavy.

## Environment variables

Ship/Brice sets secrets in the Vercel project. **Do not invent or commit values.**

### Already live (Blob + Workflows)

| Variable | Why |
| --- | --- |
| `BLOB_READ_WRITE_TOKEN` | Signs browser upload tokens (`handleUpload`). OIDC cannot do this. |
| `BLOB_STORE_ID` | Server `get`/`put` with OIDC (`store_hSXUsRUrLNOmzqZt`). |
| `VERCEL_OIDC_TOKEN` | Automatic on Vercel. Locally: `vercel env pull .env.local --yes` (~12h). |

No Trigger.dev keys.

### Better Auth + Neon + Resend (wire before public heavy merge)

| Variable | Where | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Preview + Production (+ Development if you test locally) | Neon **pooled** URL (`-pooler`). Users and sessions. |
| `BETTER_AUTH_SECRET` | Preview + Production | `openssl rand -base64 32`. Do not reuse across apps. |
| `BETTER_AUTH_URL` | **Production only** | `https://pdf.briceduke.dev`. Leave unset on Preview so links use `https://$VERCEL_URL`. |
| `RESEND_API_KEY` | Preview + Production | From [resend.com](https://resend.com) → API Keys. |
| `RESEND_FROM_EMAIL` | Preview + Production | Must match a **verified Resend domain**. Example: `PDF Combine <auth@pdf.briceduke.dev>`. |

Optional: `NEXT_PUBLIC_APP_URL` as an alias of the public origin (same Production-only rule as `BETTER_AUTH_URL`).

### Neon Postgres

This agent could **list** Neon projects on the Vercel org (`Vercel: briceduke's projects`) but **could not create** `pdf-combine` there (`organization is managed by Vercel`). Do not reuse hoverslam / apartments / scouts databases.

In the Vercel dashboard for **pdf-combine**:

1. Storage → Create Database → **Neon**.
2. Name it `pdf-combine`.
3. Copy the **pooled** connection string into `DATABASE_URL` (Preview + Production).
4. Run migrations against that URL:

```bash
DATABASE_URL="postgresql://..." npm run db:migrate
```

Schema lives in `db/auth-schema.sql` (Better Auth `user`, `session`, `account`, `verification`).

### Resend domain / from-address

1. Create a Resend account and API key → `RESEND_API_KEY`.
2. Domains → add `pdf.briceduke.dev` (or the domain you actually send from).
3. Add the DNS records Resend shows (SPF, DKIM, optionally DMARC).
4. Wait until the domain is **Verified**.
5. Set `RESEND_FROM_EMAIL` to an address on that domain, e.g. `PDF Combine <auth@pdf.briceduke.dev>`.
6. Do **not** use `onboarding@resend.dev` in production (it only delivers to the Resend account owner).

Until Resend is wired, local `next dev` logs the magic-link URL instead of sending mail.

## Heavy merge smoke

Blob store **pdf-combine-blob** is connected. After auth env is set and you have signed in on the preview:

```bash
SPIKE_BASE_URL="https://<preview>.vercel.app" \
SPIKE_COOKIE="better-auth.session_token=..." \
SPIKE_FILE_COUNT=24 \
npm run smoke:heavy
```

Copy `SPIKE_COOKIE` from DevTools → Application → Cookies on the signed-in preview. Unsigned upload/start must return **401**.

Inspect runs: `npx workflow web` or `npx workflow inspect runs`.

## Build

```bash
npm run build
npm start
```

```bash
npm run typecheck
npm run verify
```

## Stack

- Next.js App Router + TypeScript
- shadcn/ui **Maia** preset (`radix-maia`)
- Better Auth magic links + Resend + Neon Postgres
- [@dnd-kit](https://dndkit.com/) sortable list, virtualized with `@tanstack/react-virtual`
- pdf-lib for merge (browser + workflow steps)
- pdfjs-dist for on-device page previews (lazy; skipped on heavy jobs)
- `workflow` (`withWorkflow`) for durable heavy merge
- `@vercel/blob` private storage for temporary uploads

## UI

Composed from official shadcn blocks, examples, and primitives:

- **Block:** `login-03` (muted background, centered brand, card form)
- **Examples:** `empty-outline` (dashed dropzone), `input-file`
- **Components:** Button, Card, Field / FieldGroup / FieldLabel / FieldDescription / FieldError, Input, Empty, Attachment, Alert, Badge, ButtonGroup, Progress, Spinner, Sonner (Toaster), Separator, Label, Dialog, ScrollArea, Skeleton
