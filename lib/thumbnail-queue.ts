const MAX_CONCURRENT_THUMBNAILS = 1

let activeCount = 0
const waiting: Array<() => void> = []

async function acquireSlot(): Promise<void> {
  if (activeCount < MAX_CONCURRENT_THUMBNAILS) {
    activeCount += 1
    return
  }

  await new Promise<void>((resolve) => {
    waiting.push(resolve)
  })
  activeCount += 1
}

function releaseSlot(): void {
  activeCount = Math.max(0, activeCount - 1)
  const next = waiting.shift()
  if (next) {
    next()
  }
}

/**
 * Run thumbnail rasterization one-at-a-time so mobile Chrome does not OOM.
 *
 * @param runAsync - Work that creates a thumbnail.
 * @returns The thumbnail result.
 */
export async function runThumbnailJob<T>(
  runAsync: () => Promise<T>
): Promise<T> {
  await acquireSlot()

  try {
    return await runAsync()
  } finally {
    releaseSlot()
  }
}
