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

## Heavy merge setup (optional until Blob exists)

Heavy merge is disabled until Blob credentials are present (`GET /api/merge/health` → `{ "enabled": false }`).

1. In the Vercel project, Storage → Create Database → **Blob** → **Private**.
2. Connect the store to this project. Include **Development** if you will pull env locally.
3. Pull secrets (never commit them):

```bash
vercel env pull .env.local --yes
```

4. Confirm `.env.local` includes:

| Variable | Why |
| --- | --- |
| `BLOB_READ_WRITE_TOKEN` | Required. Signs browser upload tokens (`handleUpload`). OIDC cannot do this. |
| `BLOB_STORE_ID` | Server `get`/`put` with OIDC. |
| `VERCEL_OIDC_TOKEN` | Vercel / `vercel env pull`. Workflows use this. Expires ~12h locally. |

There are **no Trigger.dev keys**. Workflows run on the existing Vercel project.

Template: [.env.example](./.env.example).

Simulated heavy job with two tiny files: [http://localhost:3000/?spikeHeavy=1](http://localhost:3000/?spikeHeavy=1).

Inspect workflow runs:

```bash
npx workflow web
# or
npx workflow inspect runs
```

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
