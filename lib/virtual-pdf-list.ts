export const PDF_LIST_ROW_PX = 88
export const PDF_LIST_MAX_HEIGHT_PX = 420
export const PDF_LIST_OVERSCAN = 8

/**
 * Map a pointer drag delta onto a virtualized row index.
 *
 * @param startIndex - Index of the row that started the drag.
 * @param deltaY - Pointer movement in CSS pixels.
 * @param itemCount - Total rows.
 * @param rowPx - Row height including gap.
 * @returns Clamped destination index.
 */
export function resolveVirtualDropIndex(
  startIndex: number,
  deltaY: number,
  itemCount: number,
  rowPx = PDF_LIST_ROW_PX
): number {
  if (itemCount <= 0) {
    return 0
  }

  const nextIndex = startIndex + Math.round(deltaY / rowPx)
  return Math.max(0, Math.min(itemCount - 1, nextIndex))
}

/**
 * Cap the virtual list viewport so hundreds of rows do not grow the page.
 *
 * @param itemCount - Number of PDFs.
 * @returns CSS pixel height.
 */
export function virtualListHeightPx(itemCount: number): number {
  return Math.min(itemCount * PDF_LIST_ROW_PX, PDF_LIST_MAX_HEIGHT_PX)
}
