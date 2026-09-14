import { del, get, list, put } from "@vercel/blob"
import { z } from "zod"

import { tryCatch } from "@/lib/try-catch"

import {
  combinedPathname,
  isJobId,
  ownerPathname,
  progressPathname,
  type HeavyMergeProgress,
} from "@/lib/pdf-job"

export interface MergeJobOwner {
  readonly userId: string
  readonly createdAt: string
}

export const BLOB_ACCESS = "private" as const

const progressSchema = z.object({
  phase: z.enum(["upload", "queued", "merging", "ready"]),
  done: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  message: z.string(),
})

const ownerSchema = z.object({
  userId: z.string().min(1),
  createdAt: z.string().min(1),
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
 * Read the user id that claimed this heavy-merge job.
 *
 * @param jobId - UUID for this combine run.
 * @returns Owner payload, or null when missing.
 */
export async function readMergeJobOwner(
  jobId: string
): Promise<MergeJobOwner | null> {
  const result = await get(ownerPathname(jobId), {
    access: BLOB_ACCESS,
    useCache: false,
  })

  if (!result || result.statusCode !== 200) {
    return null
  }

  const parsed: unknown = JSON.parse(await new Response(result.stream).text())
  const owner = ownerSchema.safeParse(parsed)
  return owner.success ? owner.data : null
}

/**
 * Claim a job prefix for the signed-in user, or confirm the same user owns it.
 *
 * @param jobId - UUID for this combine run.
 * @param userId - Better Auth user id.
 */
export async function claimMergeJobOwner(
  jobId: string,
  userId: string
): Promise<void> {
  const existing = await readMergeJobOwner(jobId)

  if (existing) {
    if (existing.userId !== userId) {
      throw new Error("This merge job belongs to another account.")
    }
    return
  }

  const owner: MergeJobOwner = {
    userId,
    createdAt: new Date().toISOString(),
  }
  const written = await tryCatch(() =>
    put(ownerPathname(jobId), JSON.stringify(owner), {
      access: BLOB_ACCESS,
      addRandomSuffix: false,
      allowOverwrite: false,
      contentType: "application/json",
    })
  )

  if (written.error) {
    await assertMergeJobOwner(jobId, userId)
  }
}

/**
 * Require that the signed-in user owns this job prefix.
 *
 * @param jobId - UUID for this combine run.
 * @param userId - Better Auth user id.
 */
export async function assertMergeJobOwner(
  jobId: string,
  userId: string
): Promise<void> {
  const owner = await readMergeJobOwner(jobId)

  if (!owner || owner.userId !== userId) {
    throw new Error("This merge job belongs to another account.")
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
