import type { Task, TimelineCell, TimelineScale } from "@/models/gantt";
import { cn } from "@/utils/cn";

type GridLayerProps = {
  timelineCells: TimelineCell[];
  tasks: Task[];
  cellWidth: number;
  rowHeight: number;
  scale: TimelineScale;
};

export function GridLayer({
  timelineCells,
  tasks,
  cellWidth,
  rowHeight,
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
      {tasks.map((task, taskIndex) => (
        <div
          key={task.id}
          className="absolute inset-x-0 border-b border-slate-200"
          style={{
            top: taskIndex * rowHeight,
            height: rowHeight,
          }}
        />
      ))}
    </>
  );
}
