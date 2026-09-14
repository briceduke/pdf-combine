import { upload } from "@vercel/blob/client"

import { HEAVY_UPLOAD_CONCURRENCY } from "@/lib/merge-limits"
import {
  sourcePathname,
  sanitizePdfFileName,
  type HeavyMergeProgress,
  type HeavyMergeResult,
  type UploadedPdfSource,
} from "@/lib/pdf-job"
import { tryCatch } from "@/lib/try-catch"

interface MergeHealth {
  readonly enabled: boolean
}

interface StartMergeResponse {
  readonly runId: string
  readonly jobId: string
}

interface MergeStatusResponse {
  readonly status: "pending" | "running" | "completed" | "failed" | "cancelled"
  readonly progress: HeavyMergeProgress | null
  readonly result?: HeavyMergeResult
  readonly error?: string
}

async function mapPool<T, R>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let nextIndex = 0

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex
      nextIndex += 1
      results[index] = await mapper(items[index], index)
    }
  }

  const workerCount = Math.min(concurrency, items.length)
  await Promise.all(Array.from({ length: workerCount }, () => worker()))
  return results
}

async function parseJson<T>(response: Response): Promise<T> {
  const body: unknown = await response.json()
  return body as T
}

/**
 * Check whether the server can accept heavy merges.
 *
 * @returns Health payload from `/api/merge/health`.
 */
export async function fetchMergeHealth(): Promise<MergeHealth> {
  const response = await fetch("/api/merge/health")
  if (!response.ok) {
    return { enabled: false }
  }

  return parseJson<MergeHealth>(response)
}

async function uploadOnePdf(
  jobId: string,
  file: File,
  index: number
): Promise<UploadedPdfSource> {
  const pathname = sourcePathname(jobId, index, sanitizePdfFileName(file.name))
  const blob = await upload(pathname, file, {
    access: "private",
    handleUploadUrl: "/api/blob/upload",
    clientPayload: jobId,
    multipart: file.size > 4 * 1024 * 1024,
    contentType: "application/pdf",
  })

  return { pathname: blob.pathname, fileName: file.name }
}

async function pollUntilComplete(
  runId: string,
  jobId: string,
  onProgress: (progress: HeavyMergeProgress) => void
): Promise<HeavyMergeResult> {
  const deadline = Date.now() + 45 * 60 * 1000

  for (;;) {
    if (Date.now() > deadline) {
      throw new Error("Server merge timed out. Check Vercel Workflow logs.")
    }
    const response = await fetch(`/api/merge/${runId}?jobId=${jobId}`)
    const body = await parseJson<MergeStatusResponse>(response)

    if (body.progress) {
      onProgress(body.progress)
    }

    if (body.status === "completed" && body.result) {
      return body.result
    }

    if (body.status === "completed") {
      throw new Error("Merge finished without a downloadable PDF.")
    }

    if (body.status === "failed" || body.status === "cancelled" || body.error) {
      throw new Error(body.error ?? "Server merge failed.")
    }

    await new Promise<void>((resolve) => {
      setTimeout(resolve, 1500)
    })
  }
}

/**
 * Upload PDFs in small batches, start the Workflow merge, and wait for the result.
 *
 * @param files - PDFs in merge order.
 * @param onProgress - UI progress callback.
 * @returns Finished job id for download.
 */
export async function runHeavyMerge(
  files: readonly File[],
  onProgress: (progress: HeavyMergeProgress) => void
): Promise<HeavyMergeResult> {
  const jobId = crypto.randomUUID()

  onProgress({
    phase: "upload",
    done: 0,
    total: files.length,
    message: "Uploading PDFs in small batches",
  })

  let uploaded = 0
  const sources = await mapPool(
    files,
    HEAVY_UPLOAD_CONCURRENCY,
    async (file, index) => {
      const source = await uploadOnePdf(jobId, file, index)
      uploaded += 1
      onProgress({
        phase: "upload",
        done: uploaded,
        total: files.length,
        message: `Uploaded ${uploaded} of ${files.length} files`,
      })
      return source
    }
  )

  onProgress({
    phase: "queued",
    done: 0,
    total: files.length,
    message: "Starting server merge",
  })

  const started = await tryCatch(async () => {
    const response = await fetch("/api/merge/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId, sources }),
    })
    const body = await parseJson<StartMergeResponse & { error?: string }>(
      response
    )

    if (!response.ok || !body.runId) {
      throw new Error(body.error ?? "Could not start server merge.")
    }

    return body
  })

  if (started.error) {
    throw started.error
  }

  return pollUntilComplete(started.data.runId, jobId, onProgress)
}

/**
 * Download the combined PDF from the heavy-merge route.
 *
 * @param jobId - Finished job id.
 */
export function downloadHeavyMerge(jobId: string): void {
  const link = document.createElement("a")
  link.href = `/api/merge/download?jobId=${jobId}`
  link.download = "combined.pdf"
  link.click()
}
