export type PdfItem = {
  id: string
  file: File
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
