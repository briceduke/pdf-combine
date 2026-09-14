import { del } from "@vercel/blob"
import { FatalError, getWritable, sleep } from "workflow"
import { start } from "workflow/api"
import { PDFDocument } from "pdf-lib"

import {
  deleteJobBlobs,
  readBlobBytes,
  writeMergeProgress,
  writePdfBlob,
} from "@/lib/blob-store"
import { HEAVY_CLEANUP_DELAY, HEAVY_MERGE_CHUNK_SIZE } from "@/lib/merge-limits"
import { appendPdfBytes } from "@/lib/merge-pdfs"
import {
  combinedPathname,
  intermediatePathname,
  isJobId,
  isJobPathname,
  type HeavyMergeInput,
  type HeavyMergeProgress,
  type HeavyMergeResult,
  type UploadedPdfSource,
} from "@/lib/pdf-job"

async function reportProgress(
  jobId: string,
  progress: HeavyMergeProgress
): Promise<void> {
  "use step"

  await writeMergeProgress(jobId, progress)

  const writable = getWritable<HeavyMergeProgress>()
  const writer = writable.getWriter()

  try {
    await writer.write(progress)
  } finally {
    writer.releaseLock()
  }
}

async function mergeSourceChunk(input: {
  readonly jobId: string
  readonly chunkIndex: number
  readonly isLast: boolean
  readonly sources: readonly UploadedPdfSource[]
  readonly previousPathname?: string
  readonly doneBefore: number
  readonly total: number
}): Promise<string> {
  "use step"

  const merged = input.previousPathname
    ? await PDFDocument.load(await readBlobBytes(input.previousPathname), {
        ignoreEncryption: true,
      })
    : await PDFDocument.create()

  for (const source of input.sources) {
    if (!isJobPathname(input.jobId, source.pathname)) {
      throw new FatalError(`Source path is outside job ${input.jobId}.`)
    }

    await appendPdfBytes(merged, await readBlobBytes(source.pathname))
  }

  const mergedBytes = await merged.save()
  const pathname = input.isLast
    ? combinedPathname(input.jobId)
    : intermediatePathname(input.jobId, input.chunkIndex)

  await writePdfBlob(pathname, mergedBytes)

  if (input.previousPathname && input.previousPathname !== pathname) {
    await del(input.previousPathname)
  }

  const progress: HeavyMergeProgress = {
    phase: "merging",
    done: input.doneBefore + input.sources.length,
    total: input.total,
    message: `Merged ${input.doneBefore + input.sources.length} of ${input.total} files`,
  }

  await writeMergeProgress(input.jobId, progress)

  const writable = getWritable<HeavyMergeProgress>()
  const writer = writable.getWriter()

  try {
    await writer.write(progress)
  } finally {
    writer.releaseLock()
  }

  return pathname
}

async function countCombinedPages(pathname: string): Promise<number> {
  "use step"

  const document = await PDFDocument.load(await readBlobBytes(pathname), {
    ignoreEncryption: true,
  })
  return document.getPageCount()
}

async function enqueueCleanup(jobId: string): Promise<void> {
  "use step"

  await start(cleanupMergeJob, [jobId])
}

/**
 * Delete job blobs after the TTL so phones never keep a 395-file merge.
 *
 * @param jobId - UUID for the combine run.
 */
export async function cleanupMergeJob(jobId: string): Promise<void> {
  "use workflow"

  if (!isJobId(jobId)) {
    throw new FatalError("Invalid job id.")
  }

  await sleep(HEAVY_CLEANUP_DELAY)
  await deleteExpiredJob(jobId)
}

async function deleteExpiredJob(jobId: string): Promise<void> {
  "use step"

  await deleteJobBlobs(jobId)
}

/**
 * Durable heavy merge: one step per small source batch, then TTL cleanup.
 *
 * @param input - Job id and uploaded source pathnames in merge order.
 * @returns Combined PDF pathname and page count.
 */
export async function mergePdfsWorkflow(
  input: HeavyMergeInput
): Promise<HeavyMergeResult> {
  "use workflow"

  if (!isJobId(input.jobId) || input.sources.length < 2) {
    throw new FatalError("Need a valid job and at least two uploaded PDFs.")
  }

  await reportProgress(input.jobId, {
    phase: "queued",
    done: 0,
    total: input.sources.length,
    message: "Queued server merge",
  })

  let previousPathname: string | undefined
  const chunkCount = Math.ceil(input.sources.length / HEAVY_MERGE_CHUNK_SIZE)

  for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex++) {
    const startIndex = chunkIndex * HEAVY_MERGE_CHUNK_SIZE
    const chunk = input.sources.slice(
      startIndex,
      startIndex + HEAVY_MERGE_CHUNK_SIZE
    )

    previousPathname = await mergeSourceChunk({
      jobId: input.jobId,
      chunkIndex,
      isLast: chunkIndex === chunkCount - 1,
      sources: chunk,
      previousPathname,
      doneBefore: startIndex,
      total: input.sources.length,
    })
  }

  if (!previousPathname) {
    throw new FatalError("Merge produced no output.")
  }

  const pageCount = await countCombinedPages(previousPathname)

  await reportProgress(input.jobId, {
    phase: "ready",
    done: input.sources.length,
    total: input.sources.length,
    message: "Combined PDF is ready to download",
  })

  await enqueueCleanup(input.jobId)

  return {
    jobId: input.jobId,
    pathname: previousPathname,
    pageCount,
  }
}
