import { PDFDocument } from "pdf-lib"

import { mergePdfByteChunk, mergePdfBytes } from "../lib/merge-pdfs.ts"

async function pdfWithPages(count: number) {
  const document = await PDFDocument.create()

  for (let index = 0; index < count; index++) {
    document.addPage()
  }

  return document.save()
}

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(
      `${label}: expected ${String(expected)}, got ${String(actual)}`
    )
  }
}

const merged = await mergePdfBytes([
  await pdfWithPages(1),
  await pdfWithPages(2),
])

const result = await PDFDocument.load(merged)
assertEqual(result.getPageCount(), 3, "two-file merge page count")

const manySources = await Promise.all(
  Array.from({ length: 24 }, () => pdfWithPages(1))
)
const previous = await pdfWithPages(1)
const chunked = await mergePdfByteChunk(manySources, previous)
const chunkedDocument = await PDFDocument.load(chunked)
assertEqual(chunkedDocument.getPageCount(), 25, "chunked 25-file merge")

console.log("Merged PDF has 3 pages; chunked merge has 25 pages.")
