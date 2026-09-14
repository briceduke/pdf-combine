/**
 * Download PDF bytes as a file from the browser.
 *
 * @param bytes - Merged PDF bytes.
 * @param filename - Download filename, including `.pdf`.
 */
export function downloadPdfBytes(bytes: Uint8Array, filename: string): void {
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer
  const blob = new Blob([buffer], { type: "application/pdf" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")

  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
