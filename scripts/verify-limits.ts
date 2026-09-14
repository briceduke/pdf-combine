import {
  CLIENT_MAX_FILE_COUNT,
  CLIENT_MAX_TOTAL_BYTES,
  decideMergePath,
  describeMergeError,
  isApproachingHeavyLimit,
  shouldPromptMagicLink,
} from "../lib/merge-limits.ts"

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(
      `${label}: expected ${String(expected)}, got ${String(actual)}`
    )
  }
}

const small = decideMergePath({ fileCount: 2, totalBytes: 1024 })
assertEqual(small.path, "client", "small job uses client path")

const manyFiles = decideMergePath({
  fileCount: CLIENT_MAX_FILE_COUNT,
  totalBytes: 1024,
})
assertEqual(manyFiles.path, "heavy", "20 files uses heavy path")

const huge = decideMergePath({
  fileCount: 2,
  totalBytes: CLIENT_MAX_TOTAL_BYTES,
})
assertEqual(huge.path, "heavy", "32 MB uses heavy path")

const forced = decideMergePath({ fileCount: 2, totalBytes: 1024 }, true)
assertEqual(forced.path, "heavy", "spikeHeavy forces heavy path")

const samsung = decideMergePath({
  fileCount: 395,
  totalBytes: 80 * 1024 * 1024,
})
assertEqual(samsung.path, "heavy", "395 files uses heavy path")

const oom = describeMergeError(new RangeError("Array buffer allocation failed"))
if (!oom.includes("memory")) {
  throw new Error(`Expected memory copy, got: ${oom}`)
}

assertEqual(
  shouldPromptMagicLink(false, false),
  false,
  "light jobs never show magic link"
)
assertEqual(
  isApproachingHeavyLimit({ fileCount: 16, totalBytes: 1024 }),
  true,
  "16 files is approaching"
)

console.log("Merge path limits: client < 20 files / 32 MB; 395 files → heavy.")
