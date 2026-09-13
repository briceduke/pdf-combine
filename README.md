# PDF Combine

Combine multiple PDFs into one file in your browser. Hosted at [pdf.briceduke.dev](https://pdf.briceduke.dev).

Files never leave the device — merging is done client-side with [pdf-lib](https://pdf-lib.js.org/).

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Drop or choose at least two PDFs, drag to reorder, then Combine.

## Build

```bash
npm run build
npm start
```

## Stack

- Next.js App Router + TypeScript
- shadcn/ui **Maia** preset (`npx shadcn@latest init --preset maia`, style `radix-maia`)
- [@dnd-kit](https://dndkit.com/) sortable list for reorder (`@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `@dnd-kit/modifiers`)
- pdf-lib for in-browser merge

## UI

Composed from official shadcn blocks, examples, and primitives:

- **Block:** `login-03` (muted background, centered brand, card form)
- **Examples:** `empty-outline` (dashed dropzone), `input-file`
- **Components:** Button, Card, Field / FieldGroup / FieldLabel / FieldDescription, Input, Empty, Attachment, Alert, Badge, ButtonGroup, Progress, Spinner, Sonner (Toaster), Separator, Label
