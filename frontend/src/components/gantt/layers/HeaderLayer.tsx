import type { TimelineCell, TimelineScale } from "@/models/gantt";
import { cn } from "@/utils/cn";

type HeaderLayerProps = {
  timelineCells: TimelineCell[];
  cellWidth: number;
  scale: TimelineScale;
};

type GroupSegment = {
  key: string;
  label: string;
  startIndex: number;
  length: number;
  isNonWorking: boolean;
};

function buildGroupSegments(timelineCells: TimelineCell[]) {
  const segments: GroupSegment[] = [];

  timelineCells.forEach((cell, index) => {
    const previous = segments[segments.length - 1];

    if (previous && previous.key === cell.groupKey) {
      previous.length += 1;
      previous.isNonWorking = previous.isNonWorking && cell.isNonWorking;
      return;
    }

    segments.push({
      key: cell.groupKey,
      label: cell.groupLabel,
      startIndex: index,
      length: 1,
      isNonWorking: cell.isNonWorking,
    });
  });

  return segments;
}

export function HeaderLayer({ timelineCells, cellWidth, scale }: HeaderLayerProps) {
  const groupSegments = buildGroupSegments(timelineCells);

  return (
    <div className="overflow-hidden border-b border-slate-200 bg-slate-50">
      <div className="border-b border-slate-200">
        <div className="relative h-[28px]">
          {groupSegments.map((segment) => (
            <div
              key={segment.key}
              className={cn(
                "absolute inset-y-0 flex items-center border-r border-slate-200 px-3 text-[11px] font-medium",
                scale === "day" && segment.isNonWorking
                  ? "bg-rose-50 text-rose-700"
                  : "bg-slate-50 text-slate-600",
              )}
              style={{
                left: segment.startIndex * cellWidth,
                width: segment.length * cellWidth,
              }}
            >
              <span className="truncate">{segment.label}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex h-[31px]">
        {timelineCells.map((cell) => (
          <div
            key={cell.key}
            className={cn(
              "flex shrink-0 items-center justify-center border-r border-slate-200 text-sm font-medium",
              scale === "day" && cell.isNonWorking
                ? "bg-rose-100 text-rose-700"
                : "bg-slate-50 text-slate-700",
            )}
            style={{ width: cellWidth }}
            title={cell.holidayName ?? undefined}
          >
            <span>{cell.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
