import { PDFDocument } from "pdf-lib"

const PAGE_COPY_CHUNK_SIZE = 32

async function yieldToEventLoop(): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0)
  })
}

async function copyPagesInChunks(
  merged: PDFDocument,
  source: PDFDocument
): Promise<void> {
  const indices = source.getPageIndices()

  for (let start = 0; start < indices.length; start += PAGE_COPY_CHUNK_SIZE) {
    const slice = indices.slice(start, start + PAGE_COPY_CHUNK_SIZE)
    const pages = await merged.copyPages(source, slice)

    for (const page of pages) {
      merged.addPage(page)
    }

    await yieldToEventLoop()
  }
}

/**
 * Append one PDF's pages onto a target document, then drop the source.
 *
 * @param merged - Document that accumulates pages.
 * @param sourceBytes - One source PDF.
 */
export async function appendPdfBytes(
  merged: PDFDocument,
  sourceBytes: ArrayBuffer | Uint8Array
): Promise<void> {
  const source = await PDFDocument.load(sourceBytes, { ignoreEncryption: true })
  await copyPagesInChunks(merged, source)
}

/**
 * Merge already-loaded PDF bytes without keeping every source decoded.
 *
 * @param sources - PDFs in merge order.
 * @param onProgress - Called after each source is copied.
 * @returns Combined PDF bytes.
 */
export async function mergePdfBytes(
  sources: Array<ArrayBuffer | Uint8Array>,
  onProgress?: (done: number, total: number) => void
): Promise<Uint8Array> {
  if (sources.length < 2) {
    throw new Error("Add at least two PDFs to combine.")
  }

  const merged = await PDFDocument.create()

  for (let index = 0; index < sources.length; index++) {
    await appendPdfBytes(merged, sources[index])
    onProgress?.(index + 1, sources.length)
    await yieldToEventLoop()
  }

  return merged.save()
}

/**
 * Merge File objects one at a time so the tab does not hold every ArrayBuffer.
 *
 * @param files - PDFs in merge order.
 * @param onProgress - Called after each file is copied.
 * @returns Combined PDF bytes.
 */
export async function mergePdfFiles(
  files: File[],
  onProgress?: (done: number, total: number) => void
): Promise<Uint8Array> {
  if (files.length < 2) {
    throw new Error("Add at least two PDFs to combine.")
  }

  const merged = await PDFDocument.create()

  for (let index = 0; index < files.length; index++) {
    const bytes = new Uint8Array(await files[index].arrayBuffer())
    await appendPdfBytes(merged, bytes)
    onProgress?.(index + 1, files.length)
    await yieldToEventLoop()
  }

  return merged.save()
}

/**
 * Continue a chunked server merge from an optional previous combined PDF.
 *
 * @param sources - Next batch of source PDFs.
 * @param previousMerged - Bytes from the last merge step, if any.
 * @returns Updated combined PDF bytes.
 */
export async function mergePdfByteChunk(
  sources: Array<ArrayBuffer | Uint8Array>,
  previousMerged?: Uint8Array
): Promise<Uint8Array> {
  const merged = previousMerged
    ? await PDFDocument.load(previousMerged, { ignoreEncryption: true })
    : await PDFDocument.create()

  for (const source of sources) {
    await appendPdfBytes(merged, source)
  }

  return merged.save()
}
