import { PDFDocument } from "pdf-lib"

import { mergePdfBytes } from "../lib/merge-pdfs.ts"

async function pdfWithPages(count: number) {
  const document = await PDFDocument.create()

  for (let index = 0; index < count; index++) {
    document.addPage()
  }

  return document.save()
}

const merged = await mergePdfBytes([
  await pdfWithPages(1),
  await pdfWithPages(2),
])

const result = await PDFDocument.load(merged)

if (result.getPageCount() !== 3) {
  throw new Error(`Expected 3 pages, got ${result.getPageCount()}`)
}

console.log("Merged PDF has 3 pages.")
