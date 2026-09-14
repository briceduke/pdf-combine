# SPIKE — Vercel Workflows heavy merge

Research + prototype, not a production hybrid ship. Do not merge until a phone-class 395-file job is smoked.

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
phone                    Vercel                         Blob (pdf-combine-blob)
─────                    ──────                         ────
batch upload (2 at a time) ──► handleUpload token ──► private jobs/{id}/sources/*
POST /api/merge/start ──► Workflow mergePdfsWorkflow
                          step: merge 8 files, write tmp PDF, drop sources
                          step: … until combined.pdf
                          start cleanup workflow (sleep 1 hour → delete prefix)
poll GET /api/merge/{runId}  (progress.json + run.status)
GET /api/merge/download?jobId=  → stream combined.pdf, delete ~15s later
```

- Uploads never go through the Next.js body (Blob client upload).
- Merge is **not** one serverless timeout: `HEAVY_MERGE_CHUNK_SIZE = 8` files per `"use step"`.
- Progress is a private `progress.json` blob (polling-friendly on mobile).
- Workflows also write the default stream for `npx workflow web`.

## Live results (after Blob was connected)

Store: **pdf-combine-blob** (`store_hSXUsRUrLNOmzqZt`) on project **pdf-combine**. `BLOB_READ_WRITE_TOKEN` is set for Development, Preview, and Production.

Preview (`GET /api/merge/health`) returned `{ "enabled": true }`.

Against that preview we ran `scripts/smoke-heavy-merge.ts` (empty 1-page PDFs, client upload → workflow → download):

| Files | Workflow run | Result | Wall time |
| --- | --- | --- | --- |
| 2 | `wrun_01M2G6X2ABETC43M7DWEP3HETR` | 2 pages downloaded | ~11s |
| 24 | `wrun_01M2G6Y7BNEAAY1APPXP3NGNX2` | 24 pages (3 merge steps) | ~13s |
| 48 | `wrun_01M2G6Z98WQ3Z90MX0XB9TQZ9N` | 48 pages (6 merge steps) | ~32s |

Runtime logs show `/api/blob/upload`, `/api/merge/start`, `/.well-known/workflow/v1/step` + `flow`, poll, and `/api/merge/download` all 200. Chunked steps are real, not one giant function.

Not yet live: a **Samsung Chrome** run with ~395 *real* files (upload bandwidth + pdf-lib memory on scanned pages). Empty 395-file jobs should follow the same step loop (~50 steps of 8).

## Limits

| Limit | Value | Notes |
| --- | --- | --- |
| Client file count | 20 | Below this, sequential pdf-lib + yield is the default |
| Client total size | 32 MB | Phones still OOM if each file is huge |
| Heavy file cap (schema) | 500 | Covers the 395-file Samsung target |
| Upload concurrency | 2 | UI path; smoke script is sequential |
| Files per workflow step | 8 | 48 files = 6 steps, all succeeded |
| Step timeout | 300s | `vercel.json` + platform default |
| Blob client upload | `BLOB_READ_WRITE_TOKEN` | Confirmed required; OIDC is not enough for `handleUpload` |
| Result TTL | 1 hour | Cleanup workflow `sleep("1 hour")` then `list+del` prefix |
| Download cleanup | ~15s after stream | Avoids deleting while the PDF is still downloading |
| pdf-lib on the server | still in-memory | Empty PDFs are cheap; 395 full-page scans may still OOM a step |
| Auth | **none** | UUID job prefix only. Production must add auth |
| Thumbnails | lazy, 96px, canvas edge ≤ 2048 | Never pre-render 395 first pages |

## Go / no-go

| Option | Verdict |
| --- | --- |
| Stay **client-only** for 395 Samsung files | **No-go.** The tab will freeze and die. |
| **Hybrid: client + Vercel Workflows + private Blob** | **Go** for the 395-file *architecture*. Live preview proved 48-file durable merge + download. Remaining risk is large scanned PDFs (pdf-lib memory) and phone upload UX, not “can Workflows merge many files.” |
| Ship this PR as production | **Not yet.** No upload auth, list not virtualized, no per-file size cap. |

## Env vars (no Trigger keys)

| Variable | Required for | Status |
| --- | --- | --- |
| `BLOB_READ_WRITE_TOKEN` | Browser uploads (`handleUpload`) | Set on Dev / Preview / Production |
| `BLOB_STORE_ID` | Server `get`/`put` with OIDC | Store `store_hSXUsRUrLNOmzqZt` |
| `VERCEL_OIDC_TOKEN` | Workflows + Blob on Vercel | Automatic on deploy |

Not used: `TRIGGER_SECRET_KEY`.

Local: `vercel env pull .env.local --yes` (include Development on the store connection).

## How to smoke

### Small client job

```bash
npm install
npm run dev
```

Open http://localhost:3000. Add 2–3 PDFs. Network should show **no** `/api/blob`. Progress should tick.

### Heavy job on the preview (Blob is live)

```bash
SPIKE_BASE_URL="https://<preview>.vercel.app" SPIKE_FILE_COUNT=24 npm run smoke:heavy
```

Or in the UI: open `/?spikeHeavy=1`, add two PDFs, Combine. Copy says files upload temporarily then delete.

Phone (Samsung): add many files (or 21+ so the Heavy badge shows), Combine, leave the tab in the foreground while it uploads and polls. The phone should not rasterize every thumbnail.

## Recommended follow-ups (not this PR)

- Sign job ids so anonymous clients cannot upload into arbitrary prefixes.
- Virtualize the sortable list at hundreds of rows.
- Cap per-file and total Blob size.
- If scanned 395-pagers OOM pdf-lib in a step, smaller chunks or a streaming merge tool.
- Real auth before any public deploy of the upload route.
