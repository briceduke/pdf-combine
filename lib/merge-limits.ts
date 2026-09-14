export const CLIENT_MAX_FILE_COUNT = 20
export const CLIENT_MAX_TOTAL_BYTES = 32 * 1024 * 1024
export const HEAVY_UPLOAD_CONCURRENCY = 2
export const HEAVY_MERGE_CHUNK_SIZE = 8
export const HEAVY_CLEANUP_DELAY = "1 hour" as const
export const PAGE_COPY_CHUNK_SIZE = 32

export interface MergeJobStats {
  readonly fileCount: number
  readonly totalBytes: number
}

export interface MergePathDecision {
  readonly path: "client" | "heavy"
  readonly reason: string
  readonly stats: MergeJobStats
}

/**
 * Sum selected PDF sizes without reading file contents.
 *
 * @param files - Files in merge order.
 * @returns Count and total byte size.
 */
export function measureMergeJob(files: readonly File[]): MergeJobStats {
  return {
    fileCount: files.length,
    totalBytes: files.reduce((sum, file) => sum + file.size, 0),
  }
}

/**
 * Decide client vs heavy merge. Heavy when count ≥ 20 or size ≥ 32 MB.
 *
 * @param stats - File count and total bytes.
 * @param forceHeavy - Spike override (`?spikeHeavy=1`).
 * @returns Which path to use and a user-facing reason.
 */
export function decideMergePath(
  stats: MergeJobStats,
  forceHeavy = false
): MergePathDecision {
  if (forceHeavy) {
    return {
      path: "heavy",
      reason: "Spike override: force server merge.",
      stats,
    }
  }

  if (stats.fileCount >= CLIENT_MAX_FILE_COUNT) {
    return {
      path: "heavy",
      reason: `This job has ${stats.fileCount} files. In-browser merge stays under ${CLIENT_MAX_FILE_COUNT} files so phones do not freeze.`,
      stats,
    }
  }

  if (stats.totalBytes >= CLIENT_MAX_TOTAL_BYTES) {
    const megabytes = (stats.totalBytes / (1024 * 1024)).toFixed(1)
    return {
      path: "heavy",
      reason: `This job is ${megabytes} MB. In-browser merge stays under 32 MB so phones do not run out of memory.`,
      stats,
    }
  }

  return {
    path: "client",
    reason: "Small enough to combine on this device. Files are not uploaded.",
    stats,
  }
}

/**
 * Turn a thrown merge failure into copy that names memory pressure.
 *
 * @param caught - Rejection from pdf-lib or the browser.
 * @returns User-facing error text.
 */
export function describeMergeError(caught: unknown): string {
  const message = caught instanceof Error ? caught.message : String(caught)
  const isMemory =
    caught instanceof RangeError ||
    /memory|allocation|heap|out of memory|oom/i.test(message)

  if (isMemory) {
    return "This device ran out of memory while combining PDFs. Remove files or use heavy merge (temporary upload)."
  }

  return message || "Could not combine these PDFs."
}
