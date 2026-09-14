import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist/types/src/pdf"

export const PDF_WORKER_SRC = "/pdf.worker.min.mjs"
export const THUMBNAIL_WIDTH_PX = 128
export const PREVIEW_WIDTH_PX = 480
export const MAX_PREVIEW_PAGES = 8

export interface PdfPageImage {
  readonly pageNumber: number
  readonly blob: Blob
}

export interface PdfPreviewPages {
  readonly pageCount: number
  readonly pages: readonly PdfPageImage[]
}

interface PdfjsModule {
  getDocument: (typeof import("pdfjs-dist"))["getDocument"]
  GlobalWorkerOptions: (typeof import("pdfjs-dist"))["GlobalWorkerOptions"]
}

let pdfjsModule: PdfjsModule | null = null

/**
 * Load pdfjs and point it at the worker copied into /public.
 *
 * @param workerSrc - Worker URL, overridable in Node verification scripts.
 * @returns The pdfjs module.
 */
export async function loadPdfjs(
  workerSrc: string = PDF_WORKER_SRC
): Promise<PdfjsModule> {
  if (!pdfjsModule) {
    pdfjsModule = await import("pdfjs-dist")
  }

  pdfjsModule.GlobalWorkerOptions.workerSrc = workerSrc
  return pdfjsModule
}

/**
 * Copy source bytes so pdfjs cannot detach a cached ArrayBuffer.
 *
 * @param source - A PDF file or already-merged bytes.
 * @returns A new Uint8Array copy of the PDF.
 */
export async function readPdfBytes(
  source: File | Uint8Array
): Promise<Uint8Array> {
  if (source instanceof Uint8Array) {
    return source.slice()
  }

  return new Uint8Array(await source.arrayBuffer())
}

/**
 * Open a PDF with pdfjs.
 *
 * @param data - PDF bytes. Ownership is transferred to the worker.
 * @param workerSrc - Optional worker URL override.
 * @returns A loaded pdfjs document.
 */
export async function loadPdfDocument(
  data: Uint8Array,
  workerSrc?: string
): Promise<PDFDocumentProxy> {
  const pdfjs = await loadPdfjs(workerSrc)
  return pdfjs.getDocument({
    data,
    useSystemFonts: true,
  }).promise
}

async function closePdfDocument(pdf: PDFDocumentProxy): Promise<void> {
  await pdf.cleanup()
  await pdf.loadingTask.destroy()
}

function scaleForWidth(page: PDFPageProxy, targetWidth: number): number {
  const baseViewport = page.getViewport({ scale: 1 })
  return targetWidth / baseViewport.width
}

async function renderPageToBlob(
  page: PDFPageProxy,
  targetWidth: number
): Promise<Blob> {
  const viewport = page.getViewport({ scale: scaleForWidth(page, targetWidth) })
  const canvas = document.createElement("canvas")
  const context = canvas.getContext("2d", { alpha: false })

  if (!context) {
    throw new Error("Could not create a canvas to preview this PDF.")
  }

  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)

  await page.render({
    canvas,
    canvasContext: context,
    viewport,
  }).promise

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) {
          resolve(result)
          return
        }

        reject(new Error("Could not render a PDF page preview."))
      },
      "image/jpeg",
      0.72
    )
  })

  canvas.width = 0
  canvas.height = 0

  return blob
}

/**
 * Render the first page of a PDF as a JPEG thumbnail.
 *
 * @param source - A PDF file or merged bytes.
 * @param workerSrc - Optional worker URL override.
 * @returns Thumbnail blob and page count.
 */
export async function renderPdfThumbnail(
  source: File | Uint8Array,
  workerSrc?: string
): Promise<{ readonly blob: Blob; readonly pageCount: number }> {
  const pdf = await loadPdfDocument(await readPdfBytes(source), workerSrc)
  const page = await pdf.getPage(1)
  const blob = await renderPageToBlob(page, THUMBNAIL_WIDTH_PX)
  const pageCount = pdf.numPages

  await closePdfDocument(pdf)

  return { blob, pageCount }
}

/**
 * Render the first pages of a PDF for a preview dialog.
 *
 * @param source - A PDF file or merged bytes.
 * @param maxPages - Maximum pages to rasterize.
 * @param workerSrc - Optional worker URL override.
 * @returns Page count plus rendered page blobs.
 */
export async function renderPdfPreviewPages(
  source: File | Uint8Array,
  maxPages: number = MAX_PREVIEW_PAGES,
  workerSrc?: string
): Promise<PdfPreviewPages> {
  const pdf = await loadPdfDocument(await readPdfBytes(source), workerSrc)
  const pageCount = pdf.numPages
  const lastPage = Math.min(pageCount, maxPages)
  const pages: PdfPageImage[] = []

  for (let pageNumber = 1; pageNumber <= lastPage; pageNumber++) {
    const page = await pdf.getPage(pageNumber)
    pages.push({
      pageNumber,
      blob: await renderPageToBlob(page, PREVIEW_WIDTH_PX),
    })
  }

  await closePdfDocument(pdf)

  return { pageCount, pages }
}
