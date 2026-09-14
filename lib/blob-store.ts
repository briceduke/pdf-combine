import { del, get, list, put } from "@vercel/blob"
import { z } from "zod"

import {
  combinedPathname,
  isJobId,
  progressPathname,
  type HeavyMergeProgress,
} from "@/lib/pdf-job"

export const BLOB_ACCESS = "private" as const

const progressSchema = z.object({
  phase: z.enum(["upload", "queued", "merging", "ready"]),
  done: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  message: z.string(),
})

/**
 * True when client uploads can be authorized (handleUpload needs a static token).
 *
 * @returns Whether `BLOB_READ_WRITE_TOKEN` is set.
 */
export function isHeavyMergeConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN)
}

/**
 * Read a private blob into memory.
 *
 * @param pathname - Blob pathname or URL.
 * @returns File bytes.
 */
export async function readBlobBytes(pathname: string): Promise<Uint8Array> {
  const result = await get(pathname, {
    access: BLOB_ACCESS,
    useCache: false,
  })

  if (!result || result.statusCode !== 200) {
    throw new Error(`Could not read uploaded file ${pathname}.`)
  }

  return new Uint8Array(await new Response(result.stream).arrayBuffer())
}

/**
 * Write a private PDF blob, replacing any file at the same path.
 *
 * @param pathname - Destination pathname.
 * @param bytes - PDF bytes.
 * @returns Stored pathname.
 */
export async function writePdfBlob(
  pathname: string,
  bytes: Uint8Array
): Promise<string> {
  const blob = await put(pathname, Buffer.from(bytes), {
    access: BLOB_ACCESS,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/pdf",
  })

  return blob.pathname
}

/**
 * Write pollable merge progress for the UI.
 *
 * @param jobId - UUID for this combine run.
 * @param progress - Current phase and counts.
 */
export async function writeMergeProgress(
  jobId: string,
  progress: HeavyMergeProgress
): Promise<void> {
  await put(progressPathname(jobId), JSON.stringify(progress), {
    access: BLOB_ACCESS,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  })
}

/**
 * Read the latest progress JSON for a job, if it exists.
 *
 * @param jobId - UUID for this combine run.
 * @returns Progress payload or null.
 */
export async function readMergeProgress(
  jobId: string
): Promise<HeavyMergeProgress | null> {
  const result = await get(progressPathname(jobId), {
    access: BLOB_ACCESS,
    useCache: false,
  })

  if (!result || result.statusCode !== 200) {
    return null
  }

  const parsed: unknown = JSON.parse(await new Response(result.stream).text())
  const progress = progressSchema.safeParse(parsed)
  return progress.success ? progress.data : null
}

/**
 * Delete every blob stored under a job prefix.
 *
 * @param jobId - UUID for this combine run.
 */
export async function deleteJobBlobs(jobId: string): Promise<void> {
  if (!isJobId(jobId)) {
    throw new Error("Invalid job id.")
  }

  const urls: string[] = []
  let cursor: string | undefined

  do {
    const page = await list({
      prefix: `jobs/${jobId}/`,
      cursor,
      limit: 1000,
    })
    urls.push(...page.blobs.map((blob) => blob.url))
    cursor = page.hasMore ? page.cursor : undefined
  } while (cursor)

  if (urls.length > 0) {
    await del(urls)
  }
}

/**
 * Stream a combined PDF from Blob for download.
 *
 * @param jobId - UUID for this combine run.
 * @returns PDF stream and size, or null when missing.
 */
export async function getCombinedPdfStream(jobId: string): Promise<{
  readonly stream: ReadableStream<Uint8Array>
  readonly size: number
} | null> {
  const result = await get(combinedPathname(jobId), {
    access: BLOB_ACCESS,
    useCache: false,
  })

  if (!result || result.statusCode !== 200) {
    return null
  }

  return { stream: result.stream, size: result.blob.size }
}
