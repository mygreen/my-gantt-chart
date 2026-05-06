export function getVisibleRowWindow(
  scrollTop: number,
  rowHeight: number,
  rowCount: number,
  overscan = 4,
) {
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const end = Math.min(rowCount, Math.ceil((scrollTop + 720) / rowHeight) + overscan);
  return { start, end };
}
