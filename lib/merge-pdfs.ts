import { PDFDocument } from "pdf-lib"

export async function mergePdfBytes(
  sources: Array<ArrayBuffer | Uint8Array>,
  onProgress?: (done: number, total: number) => void
): Promise<Uint8Array> {
  if (sources.length < 2) {
    throw new Error("Add at least two PDFs to combine.")
  }

  const merged = await PDFDocument.create()

  for (let index = 0; index < sources.length; index++) {
    const source = await PDFDocument.load(sources[index])
    const pages = await merged.copyPages(source, source.getPageIndices())

    for (const page of pages) {
      merged.addPage(page)
    }

    onProgress?.(index + 1, sources.length)
  }

  return merged.save()
}

export async function mergePdfFiles(
  files: File[],
  onProgress?: (done: number, total: number) => void
): Promise<Uint8Array> {
  const sources = await Promise.all(files.map((file) => file.arrayBuffer()))
  return mergePdfBytes(sources, onProgress)
}
