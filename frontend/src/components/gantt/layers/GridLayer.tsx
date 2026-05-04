import type { TimelineCell, TimelineScale } from "@/models/gantt";
import { cn } from "@/utils/cn";

type GridLayerProps = {
  timelineCells: TimelineCell[];
  cellWidth: number;
  rowHeight: number;
  rowCount: number;
  scale: TimelineScale;
};

export function GridLayer({
  timelineCells,
  cellWidth,
  rowHeight,
  rowCount,
  scale,
}: GridLayerProps) {
  return (
    <>
      {timelineCells.map((cell, cellIndex) => (
        <div
          key={cell.key}
          className={cn(
            "absolute inset-y-0 border-r border-slate-200",
            scale === "day" && cell.isNonWorking ? "bg-rose-50" : "bg-white",
          )}
          style={{
            left: cellIndex * cellWidth,
            width: cellWidth,
          }}
        />
      ))}
      {Array.from({ length: rowCount }).map((_, rowIndex) => (
        <div
          key={`row-${rowIndex}`}
          className="absolute inset-x-0 border-b border-slate-200"
          style={{
            top: rowIndex * rowHeight,
            height: rowHeight,
          }}
        />
      ))}
    </>
  );
}
