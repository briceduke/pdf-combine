# SPIKE — Vercel Workflows heavy merge

Research + prototype, not a production hybrid ship. Do not merge until Ship/Brice provision Blob and smoke a real 50–400 file job.

## What broke at ~395 files (Samsung / mobile Chrome)

The original report was “~350 pages.” The confirmed repro is **395 files**. After Combine the tab **freezes, then Chrome kills it**.

Client merge did all of this on the main thread:

1. `Promise.all(files.map((file) => file.arrayBuffer()))` — every PDF decoded into memory at once.
2. pdf-lib `load` + `copyPages` for each file without yielding, so the progress bar never painted.
3. `merged.save()` allocated a second full copy.
4. Every list row immediately rasterized a pdfjs thumbnail (canvas + worker), which is catastrophic at hundreds of files even before Combine.

A phone-class Chrome tab cannot hold hundreds of decoded PDFs. **Client-only merge for 395 files is a no-go.** Yielding and lazy thumbs fix small jobs; they cannot make 395-file merge safe on Samsung.

## Threshold (chosen)

| Path | When |
| --- | --- |
| **Client** (no upload) | `< 20` files **and** `< 32 MB` total |
| **Heavy** (Blob + Workflow) | `≥ 20` files **or** `≥ 32 MB`, or `?spikeHeavy=1` |

20 files / 32 MB is conservative for mid-range Android. Desktop still uses the client path below the line. Above the line, Combine **refuses** to run in-browser even if Blob is missing — a clear error instead of a crash.

## Prototype architecture

```
phone                    Vercel                         Blob
─────                    ──────                         ────
batch upload (2 at a time) ──► handleUpload token ──► private jobs/{id}/sources/*
POST /api/merge/start ──► Workflow mergePdfsWorkflow
                          step: merge 8 files, write tmp PDF, drop sources
                          step: … until combined.pdf
                          start cleanup workflow (sleep 1 hour → delete prefix)
poll GET /api/merge/{runId}  (progress.json + run.status)
GET /api/merge/download?jobId=  → stream combined.pdf, delete ~15s later
```

- Uploads never go through the Next.js body (Blob client upload, up to multi-GB per file).
- Merge is **not** one serverless timeout: `HEAVY_MERGE_CHUNK_SIZE = 8` files per `"use step"`.
- Progress is a private `progress.json` blob (polling-friendly on mobile; SSE can die in background tabs).
- Workflows also write the default stream for `npx workflow web`.

## What worked in this spike (without Blob credentials)

- Client merge of 25 empty PDFs via chunked `copyPages` + `yieldToEventLoop` (`npm run verify`).
- Path decision: 2 files → client; 20 files / 32 MB / 395 files → heavy.
- Typecheck + production build with `withWorkflow()`.
- UI: lazy thumbs (viewport + 1-at-a-time queue), skip thumbs on heavy jobs, progress copy, privacy alert.

## What this environment could not prove live

No `BLOB_READ_WRITE_TOKEN` is in this repo (do not invent secrets). End-to-end heavy merge needs Brice/Ship to create a **private** Blob store on the existing Vercel project and pull env vars. Then smoke with `?spikeHeavy=1` and two tiny PDFs, then 25 files, then ~400.

## Limits we measured / inferred

| Limit | Value | Notes |
| --- | --- | --- |
| Client file count | 20 | Below this, sequential pdf-lib + yield is the default |
| Client total size | 32 MB | Below 25–50 MB band; phones still OOM if each file is huge |
| Heavy file cap (schema) | 500 | Covers the 395-file Samsung target |
| Upload concurrency | 2 | Keeps mobile from opening 395 XHRs |
| Files per workflow step | 8 | Stays inside Function time/memory better than 395-in-one |
| Step timeout | 300s | `vercel.json` + platform default |
| Blob client upload | needs `BLOB_READ_WRITE_TOKEN` | OIDC is **not** enough for `handleUpload` |
| Server get/put | OIDC (`BLOB_STORE_ID` + `VERCEL_OIDC_TOKEN`) or the same static token | |
| Result TTL | 1 hour | Cleanup workflow `sleep("1 hour")` then `list+del` prefix |
| Download cleanup | ~15s after stream | Avoids deleting while the PDF is still downloading |
| pdf-lib on the server | still in-memory | 395 *tiny* PDFs should work; 395 full-page scans may still OOM the step. Then split further or switch merge tool |
| Auth | **none** | Anyone who can hit `/api/blob/upload` can upload under a UUID they minted. Production must add auth or a signed job token |
| Thumbnails | lazy, 96px, canvas edge ≤ 2048 | Android canvas limits; never pre-render 395 first pages |

## Go / no-go

| Option | Verdict |
| --- | --- |
| Stay **client-only** for 395 Samsung files | **No-go.** The tab will freeze and die. Hardening only helps jobs under the threshold. |
| **Hybrid: client + Vercel Workflows + private Blob** | **Go** for the 395-file target, after Blob is provisioned and a real 100–400 file smoke. No Trigger.dev. Workflows ride the existing Vercel project (OIDC). |
| Ship this PR as production | **No.** Spike: missing Blob, no upload auth, pdf-lib memory still unbounded on huge scans, 395 sortable rows unvirtualized. |

## Env vars (no Trigger keys)

Set on the Vercel project (Production + Preview + Development):

| Variable | Required for | How |
| --- | --- | --- |
| `BLOB_READ_WRITE_TOKEN` | Browser uploads (`handleUpload`) | Blob store → project env |
| `BLOB_STORE_ID` | Server `get`/`put` via OIDC | Connecting the store to the project |
| `VERCEL_OIDC_TOKEN` | Workflows + Blob on Vercel; local `vercel env pull` | Automatic on deploy; ~12h locally |

Not used: `TRIGGER_SECRET_KEY` or any Trigger.dev config.

### Dashboard steps (Ship/Brice)

1. Vercel project **pdf-combine** → Storage → Create Database → **Blob** → **Private**.
2. Connect to this project; include **Development** if you will `vercel env pull`.
3. `vercel env pull .env.local --yes`
4. Confirm `.env.local` has `BLOB_READ_WRITE_TOKEN` (and usually `BLOB_STORE_ID`).
5. Deploy this branch. Workflows need no extra product — `withWorkflow()` + `workflow` package.
6. Optional: `npx workflow web` while `npm run dev` to inspect runs.

## How to smoke

### Small client job (no Blob)

```bash
npm install
npm run dev
```

Open http://localhost:3000. Add 2–3 PDFs (well under 20 files / 32 MB). Reorder, preview a thumbnail, Combine. DevTools Network should show **no** `/api/blob` or `/api/merge/start`. Progress should tick instead of freezing.

### Simulated heavy job (needs Blob)

1. Provision Blob as above.
2. Open http://localhost:3000/?spikeHeavy=1
3. Add **two** tiny PDFs. UI should show the temporary-upload alert and a Heavy badge.
4. Combine: progress goes upload → queued → merging → download of `combined.pdf`.
5. Confirm Blob prefix `jobs/{uuid}/` is deleted after download (~15s) or within 1 hour.
6. Repeat with ~25 files, then a 395-file folder on a phone (Samsung Chrome). The phone should only upload + poll.

If Blob is missing, a 21-file job shows a **destructive alert** and Combine stays disabled — that is the crash-prevention behavior.

## Recommended follow-ups (not this PR)

- Sign job ids so anonymous clients cannot upload into arbitrary prefixes.
- Virtualize the sortable list at hundreds of rows.
- Cap per-file and total Blob size; abort uploads with a clear error.
- If scanned 395-pagers OOM pdf-lib in a step, merge with a streaming tool (qpdf) inside the step, or smaller chunks + smaller intermediates.
- Real auth before any public deploy of the upload route.
