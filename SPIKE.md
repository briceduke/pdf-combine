# Hybrid merge — Vercel Workflows + Better Auth

Productize of the 395-file Samsung path. Draft PR — do not merge until a phone-class job is smoked **and** Resend/Neon env is wired.

## What broke at ~395 files (Samsung / mobile Chrome)

The original report was “~350 pages.” The confirmed repro is **395 files**. After Combine the tab **freezes, then Chrome kills it**.

A phone-class Chrome tab cannot hold hundreds of decoded PDFs. **Client-only merge for 395 files is a no-go.** Yielding and lazy thumbs fix small jobs; they cannot make 395-file merge safe on Samsung.

## Threshold (chosen)

| Path | When | Auth |
| --- | --- | --- |
| **Client** (no upload) | `< 20` files **and** `< 32 MB` total | **None.** No sign-in UI on the homepage. |
| **Heavy** (Blob + Workflow) | `≥ 20` files **or** `≥ 32 MB`, or `?spikeHeavy=1` | **Better Auth magic link** (Resend) before Blob upload / Workflow start |

20 files / 32 MB is conservative for mid-range Android. Soft copy from 15 files / 24 MB: “Large jobs need a quick email sign-in.” The email field mounts only after the job is actually heavy (or Combine is pressed on a heavy job).

## Architecture

```
phone                    Vercel                         Blob (pdf-combine-blob)
─────                    ──────                         ────
small job: pdf-lib in tab (anonymous)
heavy job: magic link → session cookie
batch upload (2 at a time) ──► handleUpload (session) ──► private jobs/{id}/sources/*
POST /api/merge/start (session + owner.json)
                          Workflow mergePdfsWorkflow
                          step: merge 8 files, write tmp PDF, drop sources
poll GET /api/merge/{runId}  (session)
GET /api/merge/download?jobId=  (session) → stream, delete ~15s later
cleanup workflow: sleep 1 hour → list+del prefix
```

- Light users never hit `/api/blob` or `/api/auth` UI.
- Upload, start, poll, and download require a validated Better Auth session (not a cookie-existence check).
- `jobs/{id}/owner.json` binds the prefix to the user id.

## Auth (Brice)

- **Better Auth** + **email magic links** via **Resend**.
- Persist users/sessions in **Neon Postgres**.
- shadcn/Maia for the email field and “check your email” state.
- No OAuth. No Trigger.dev.

Neon: Vercel-managed org listed existing projects (hoverslam, apartments, …) but **create project is blocked** (`organization is managed by Vercel`). Ship/Brice: Vercel Storage → Neon database named `pdf-combine`, then `DATABASE_URL` + `npm run db:migrate`.

Resend: verify `pdf.briceduke.dev` (or the sending domain), set `RESEND_FROM_EMAIL` to an address on that domain (`PDF Combine <auth@pdf.briceduke.dev>`). Not `onboarding@resend.dev` in production.

`BETTER_AUTH_URL` on **Production only** (`https://pdf.briceduke.dev`). Preview uses `VERCEL_URL`.

## Live Blob smokes (before auth gate)

Store: **pdf-combine-blob** (`store_hSXUsRUrLNOmzqZt`). Empty 1-page PDFs against an earlier preview:

| Files | Workflow run | Result | Wall time |
| --- | --- | --- | --- |
| 2 | `wrun_01M2G6X2ABETC43M7DWEP3HETR` | 2 pages downloaded | ~11s |
| 24 | `wrun_01M2G6Y7BNEAAY1APPXP3NGNX2` | 24 pages (3 merge steps) | ~13s |
| 48 | `wrun_01M2G6Z98WQ3Z90MX0XB9TQZ9N` | 48 pages (6 merge steps) | ~32s |

Those runs were **unsigned**. After this change they must 401 without `SPIKE_COOKIE`.

## Limits

| Limit | Value | Notes |
| --- | --- | --- |
| Client file count | 20 | Below this, sequential pdf-lib + yield is the default |
| Client total size | 32 MB | Phones still OOM if each file is huge |
| Soft warning | 15 files / 24 MB | Copy only; still anonymous |
| Heavy file cap | 500 | Covers the 395-file Samsung target |
| Heavy per-file cap | 80 MB | Enforced on the Blob client token |
| Upload concurrency | 2 | UI path; smoke script is sequential |
| Files per workflow step | 8 | 48 files = 6 steps, all succeeded |
| Result TTL | 1 hour | Cleanup workflow then `list+del` |
| Download cleanup | ~15s after stream | Avoids deleting while the PDF is still downloading |
| List | virtualized | `@tanstack/react-virtual`, ~88px rows, dnd-kit reorder via pointer delta |
| Thumbnails | lazy, skipped on heavy | Never pre-render 395 first pages |
| Auth | magic link on heavy only | Session checked in route handlers |

## Env (no invented secrets)

See README for the full table. Ship/Brice still needs to set:

- `DATABASE_URL` (Neon pooled)
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL` (Production only)
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL` (verified domain)

Already set: `BLOB_READ_WRITE_TOKEN`, `BLOB_STORE_ID`, `VERCEL_OIDC_TOKEN`.

## How to smoke

### Small client job (must stay anonymous)

```bash
npm run dev
```

Open http://localhost:3000. Add 2–3 PDFs. No sign-in form. Network should show **no** `/api/blob`.

### Heavy job (after Neon + Resend + migrate)

1. Open the preview, add 21 PDFs (or `/?spikeHeavy=1`).
2. Magic-link form appears. Sign in.
3. Combine, leave the tab in the foreground.

```bash
SPIKE_BASE_URL="https://<preview>.vercel.app" \
SPIKE_COOKIE="better-auth.session_token=..." \
SPIKE_FILE_COUNT=24 \
npm run smoke:heavy
```

## Remaining for Samsung ~395

- Wire Neon + Resend + migrate on the Vercel project.
- Sign in on a phone, upload ~395 real files (bandwidth + pdf-lib memory on scanned pages).
- If a step OOMs on scanned pages, shrink `HEAVY_MERGE_CHUNK_SIZE` or change the merge tool.
