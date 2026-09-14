# PDF Combine

Combine multiple PDFs into one file. Hosted at [pdf.briceduke.dev](https://pdf.briceduke.dev).

Small jobs merge **in the browser** with [pdf-lib](https://pdf-lib.js.org/) — files never leave the device.

Jobs at or above **20 files or 32 MB** use a **heavy path** (Vercel Blob + [Vercel Workflows](https://vercel.com/docs/workflows)). Files are uploaded privately, merged in durable steps, then deleted after download or within 1 hour.

This branch is a **spike** of that hybrid. See [SPIKE.md](./SPIKE.md) for limits, go/no-go, and Samsung / 395-file notes.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Drop or choose at least two PDFs, drag to reorder, then Combine.

Client-only smoke: 2–3 small PDFs. You should not see `/api/blob` traffic.

## Heavy merge (Vercel Blob + Workflows)

Blob store **pdf-combine-blob** is connected. `GET /api/merge/health` is `{ "enabled": true }` on Preview/Production.

| Variable | Why |
| --- | --- |
| `BLOB_READ_WRITE_TOKEN` | Required. Signs browser upload tokens (`handleUpload`). OIDC cannot do this. |
| `BLOB_STORE_ID` | Server `get`/`put` with OIDC (`store_hSXUsRUrLNOmzqZt`). |
| `VERCEL_OIDC_TOKEN` | Automatic on Vercel. Locally: `vercel env pull .env.local --yes` (~12h). |

There are **no Trigger.dev keys**. Workflows run on this Vercel project.

Local UI with two tiny files: [http://localhost:3000/?spikeHeavy=1](http://localhost:3000/?spikeHeavy=1) after pulling env.

Against a preview deployment:

```bash
SPIKE_BASE_URL="https://<preview>.vercel.app" SPIKE_FILE_COUNT=24 npm run smoke:heavy
```

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
- shadcn/ui **Maia** preset (`npx shadcn@latest init --preset maia`, style `radix-maia`)
- [@dnd-kit](https://dndkit.com/) sortable list for reorder
- pdf-lib for merge (browser + workflow steps)
- pdfjs-dist for on-device page previews (lazy, not every page)
- `workflow` (`withWorkflow`) for durable heavy merge
- `@vercel/blob` private storage for temporary uploads

## UI

Composed from official shadcn blocks, examples, and primitives:

- **Block:** `login-03` (muted background, centered brand, card form)
- **Examples:** `empty-outline` (dashed dropzone), `input-file`
- **Components:** Button, Card, Field / FieldGroup / FieldLabel / FieldDescription, Input, Empty, Attachment, Alert, Badge, ButtonGroup, Progress, Spinner, Sonner (Toaster), Separator, Label, Dialog, ScrollArea, Skeleton
