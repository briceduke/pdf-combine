export interface PdfItem {
  readonly id: string
  readonly file: File
}

export function isPdfFile(file: File) {
  return (
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
  )
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Format a PDF page count for list and preview copy.
 *
 * @param pageCount - Number of pages in the document.
 * @returns A short label like `1 page` or `12 pages`.
 */
export function formatPageCount(pageCount: number): string {
  return pageCount === 1 ? "1 page" : `${pageCount} pages`
}

export function createPdfItems(files: File[]) {
  return files.map((file) => ({
    id: crypto.randomUUID(),
    file,
  }))
}

export function splitPdfFiles(files: File[]) {
  const accepted: File[] = []
  const rejected: File[] = []

  for (const file of files) {
    if (isPdfFile(file)) {
      accepted.push(file)
    } else {
      rejected.push(file)
    }
  }

  return { accepted, rejected }
}
