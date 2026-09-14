/**
 * Smoke the heavy merge path against a live Preview/Production origin.
 *
 * Requires Blob to be connected so `/api/merge/health` returns `{ enabled: true }`.
 *
 * @example
 * SPIKE_BASE_URL="https://<preview>.vercel.app" SPIKE_FILE_COUNT=24 npm run smoke:heavy
 */
import { PDFDocument } from "pdf-lib"
import { put } from "@vercel/blob/client"

import { sourcePathname, sanitizePdfFileName } from "../lib/pdf-job.ts"

interface TokenResponse {
  readonly clientToken?: string
  readonly error?: string
}

interface StartResponse {
  readonly runId?: string
  readonly jobId?: string
  readonly error?: string
}

interface StatusResponse {
  readonly status?: string
  readonly result?: { readonly jobId: string; readonly pageCount: number }
  readonly error?: string
}

const baseUrl = process.env.SPIKE_BASE_URL
const fileCount = Number(process.env.SPIKE_FILE_COUNT ?? "2")

if (!baseUrl) {
  throw new Error("Set SPIKE_BASE_URL to the preview deployment origin.")
}

if (fileCount < 2 || fileCount > 400) {
  throw new Error("SPIKE_FILE_COUNT must be between 2 and 400 for this smoke.")
}

async function pdfWithPages(count: number): Promise<Uint8Array> {
  const document = await PDFDocument.create()

  for (let index = 0; index < count; index++) {
    document.addPage()
  }

  return document.save()
}

async function fetchJson<T>(
  url: string,
  init?: RequestInit
): Promise<{ readonly ok: boolean; readonly body: T; readonly status: number }> {
  const response = await fetch(url, init)
  const body = (await response.json()) as T
  return { ok: response.ok, body, status: response.status }
}

async function requestClientToken(
  pathname: string,
  jobId: string
): Promise<string> {
  const result = await fetchJson<TokenResponse>(`${baseUrl}/api/blob/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "blob.generate-client-token",
      payload: {
        pathname,
        clientPayload: jobId,
        multipart: false,
      },
    }),
  })

  if (!result.ok || !result.body.clientToken) {
    throw new Error(
      result.body.error ?? `Token request failed (${result.status})`
    )
  }

  return result.body.clientToken
}

async function uploadSource(
  jobId: string,
  index: number,
  bytes: Uint8Array
): Promise<{ readonly pathname: string; readonly fileName: string }> {
  const fileName = sanitizePdfFileName(`smoke-${index + 1}.pdf`)
  const pathname = sourcePathname(jobId, index, fileName)
  const token = await requestClientToken(pathname, jobId)
  const blob = await put(pathname, Buffer.from(bytes), {
    access: "private",
    token,
    contentType: "application/pdf",
  })

  return { pathname: blob.pathname, fileName }
}

const health = await fetchJson<{ enabled: boolean }>(
  `${baseUrl}/api/merge/health`
)

if (!health.body.enabled) {
  throw new Error("Preview heavy merge is not enabled (no Blob token).")
}

const jobId = crypto.randomUUID()
const sources = []

for (let index = 0; index < fileCount; index++) {
  sources.push(await uploadSource(jobId, index, await pdfWithPages(1)))
  console.log(`uploaded ${index + 1}/${fileCount}`)
}

const started = await fetchJson<StartResponse>(`${baseUrl}/api/merge/start`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ jobId, sources }),
})

if (!started.ok || !started.body.runId) {
  throw new Error(started.body.error ?? `Start failed (${started.status})`)
}

console.log(`workflow started ${started.body.runId}`)

const deadline = Date.now() + 10 * 60 * 1000
let pageCount = 0

for (;;) {
  if (Date.now() > deadline) {
    throw new Error("Workflow did not finish within 10 minutes.")
  }

  const status = await fetchJson<StatusResponse>(
    `${baseUrl}/api/merge/${started.body.runId}?jobId=${jobId}`
  )

  if (status.body.status === "completed" && status.body.result) {
    pageCount = status.body.result.pageCount
    break
  }

  if (
    status.body.status === "failed" ||
    status.body.status === "cancelled" ||
    status.body.error
  ) {
    throw new Error(status.body.error ?? `Merge ${status.body.status}`)
  }

  await new Promise<void>((resolve) => {
    setTimeout(resolve, 1500)
  })
}

const download = await fetch(`${baseUrl}/api/merge/download?jobId=${jobId}`)

if (!download.ok) {
  throw new Error(`Download failed (${download.status})`)
}

const combined = await PDFDocument.load(
  new Uint8Array(await download.arrayBuffer())
)

if (combined.getPageCount() !== fileCount || pageCount !== fileCount) {
  throw new Error(
    `Expected ${fileCount} pages, got download=${combined.getPageCount()} status=${pageCount}`
  )
}

console.log(
  `Heavy merge smoke OK: ${fileCount} files → ${combined.getPageCount()} pages.`
)
