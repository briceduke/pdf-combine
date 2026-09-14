import { PDFDocument } from "pdf-lib"

import { formatPageCount } from "../lib/pdf-files.ts"
import { readPdfBytes } from "../lib/pdf-preview.ts"

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(
      `${label}: expected ${String(expected)}, got ${String(actual)}`
    )
  }
}

async function pdfWithPages(count: number): Promise<Uint8Array> {
  const document = await PDFDocument.create()

  for (let index = 0; index < count; index++) {
    document.addPage()
  }

  return document.save()
}

assertEqual(formatPageCount(1), "1 page", "singular page count")
assertEqual(formatPageCount(3), "3 pages", "plural page count")

const twoPagePdf = await pdfWithPages(2)
const loaded = await PDFDocument.load(twoPagePdf)
assertEqual(loaded.getPageCount(), 2, "generated PDF page count")

const copied = await readPdfBytes(twoPagePdf)
assertEqual(copied.byteLength, twoPagePdf.byteLength, "copied PDF byte length")
assertEqual(
  copied.buffer === twoPagePdf.buffer,
  false,
  "copied PDF uses a new buffer"
)

console.log("Preview helpers: page labels and PDF byte copies OK.")
