export const JOB_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export interface UploadedPdfSource {
  readonly pathname: string
  readonly fileName: string
}

export interface HeavyMergeInput {
  readonly jobId: string
  readonly sources: readonly UploadedPdfSource[]
}

export interface HeavyMergeResult {
  readonly jobId: string
  readonly pathname: string
  readonly pageCount: number
}

export interface HeavyMergeProgress {
  readonly phase: "upload" | "queued" | "merging" | "ready"
  readonly done: number
  readonly total: number
  readonly message: string
}

/**
 * Map heavy-merge phases onto a 0–100 progress bar.
 *
 * @param progress - Latest upload/merge progress.
 * @returns Percent for the Progress component.
 */
export function heavyProgressPercent(progress: HeavyMergeProgress): number {
  if (progress.phase === "upload") {
    return Math.round((progress.done / Math.max(progress.total, 1)) * 40)
  }

  if (progress.phase === "queued") {
    return 45
  }

  if (progress.phase === "merging") {
    return 45 + Math.round((progress.done / Math.max(progress.total, 1)) * 50)
  }

  return 100
}

/**
 * Check that a value is a UUID v4 job id.
 *
 * @param jobId - Candidate id from the client.
 * @returns Whether the id is safe to use in blob pathnames.
 */
export function isJobId(jobId: string): boolean {
  return JOB_ID_PATTERN.test(jobId)
}

/**
 * Build the blob prefix for one heavy-merge job.
 *
 * @param jobId - UUID for this combine run.
 * @returns Store prefix including the trailing slash.
 */
export function jobPrefix(jobId: string): string {
  return `jobs/${jobId}/`
}

/**
 * Blob pathname for one uploaded source PDF.
 *
 * @param jobId - UUID for this combine run.
 * @param index - Zero-based merge order.
 * @param fileName - Original file name, already sanitized.
 * @returns Destination pathname under the job prefix.
 */
export function sourcePathname(
  jobId: string,
  index: number,
  fileName: string
): string {
  const padded = String(index).padStart(4, "0")
  return `${jobPrefix(jobId)}sources/${padded}-${fileName}`
}

/**
 * Blob pathname for a chunked intermediate merge.
 *
 * @param jobId - UUID for this combine run.
 * @param chunkIndex - Zero-based merge step.
 * @returns Intermediate PDF pathname.
 */
export function intermediatePathname(jobId: string, chunkIndex: number): string {
  return `${jobPrefix(jobId)}tmp/chunk-${chunkIndex}.pdf`
}

/**
 * Blob pathname for the finished combined PDF.
 *
 * @param jobId - UUID for this combine run.
 * @returns Combined PDF pathname.
 */
export function combinedPathname(jobId: string): string {
  return `${jobPrefix(jobId)}combined.pdf`
}

/**
 * Blob pathname for pollable progress JSON.
 *
 * @param jobId - UUID for this combine run.
 * @returns Progress JSON pathname.
 */
export function progressPathname(jobId: string): string {
  return `${jobPrefix(jobId)}progress.json`
}

/**
 * Keep blob path names ASCII and short.
 *
 * @param fileName - Original file name from the device.
 * @returns A path-safe name that still ends in `.pdf`.
 */
export function sanitizePdfFileName(fileName: string): string {
  const base = fileName.replace(/\.pdf$/i, "")
  const safe = base.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 80)
  return `${safe || "file"}.pdf`
}

/**
 * True when a pathname belongs to this job and is a PDF or progress file.
 *
 * @param jobId - UUID for this combine run.
 * @param pathname - Blob pathname from the client or SDK.
 * @returns Whether the path is inside the job prefix.
 */
export function isJobPathname(jobId: string, pathname: string): boolean {
  return pathname.startsWith(jobPrefix(jobId))
}
