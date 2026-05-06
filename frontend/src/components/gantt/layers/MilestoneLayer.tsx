import { differenceInCalendarDays, parseISO } from "date-fns";
import { useState } from "react";
import type { MouseEvent } from "react";
import type { InteractionMode, TaskLayout, TimelineScale, VisibleTask } from "@/models/gantt";
import { useGanttStore } from "@/stores/useGanttStore";
import { cn } from "@/utils/cn";

type MilestoneLayerProps = {
  tasks: VisibleTask[];
  layouts: TaskLayout[];
  selectedTaskId: number | null;
  interactionMode: InteractionMode;
  pendingDependencyFromTaskId: number | null;
  timelineScale: TimelineScale;
  dayWidth: number;
  onTaskContextMenu: (taskId: number, event: MouseEvent<HTMLDivElement>) => void;
};

type DragState = {
  taskId: number;
  pointerId: number;
  startClientX: number;
  dayOffset: number;
};

const milestoneLaneTop = 10;

function getMilestoneOverlapOffsets(tasks: VisibleTask[]) {
  const offsets = new Map<number, { x: number; y: number }>();

  const indexedTasks = tasks
    .map((task, index) => ({
      index,
      startDate: parseISO(task.startDate),
    }))
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

  const clusters: number[][] = [];

  indexedTasks.forEach((task) => {
    const currentCluster = clusters[clusters.length - 1];
    if (!currentCluster) {
      clusters.push([task.index]);
      return;
    }

    const previousTaskIndex = currentCluster[currentCluster.length - 1];
    const previousTask = indexedTasks.find((candidate) => candidate.index === previousTaskIndex);
    if (!previousTask) {
      currentCluster.push(task.index);
      return;
    }

    if (differenceInCalendarDays(task.startDate, previousTask.startDate) <= 3) {
      currentCluster.push(task.index);
    } else {
      clusters.push([task.index]);
    }
  });

  clusters.forEach((indexes) => {
    if (indexes.length === 1) {
      offsets.set(indexes[0], { x: 0, y: 0 });
      return;
    }

    const rowGap = 18;
    const columnGap = 18;
    const rowIndexes = [
      indexes.filter((_, order) => order % 2 === 0),
      indexes.filter((_, order) => order % 2 === 1),
    ];

    rowIndexes.forEach((row, rowIndex) => {
      const center = (row.length - 1) / 2;
      row.forEach((taskIndex, order) => {
        offsets.set(taskIndex, {
          x: Math.round((order - center) * columnGap),
          y: rowIndex * rowGap,
        });
      });
    });
  });

  tasks.forEach((_, index) => {
    if (!offsets.has(index)) {
      offsets.set(index, { x: 0, y: 0 });
    }
  });

  return offsets;
}

export function MilestoneLayer({
  tasks,
  layouts,
  selectedTaskId,
  interactionMode,
  pendingDependencyFromTaskId,
  timelineScale,
  dayWidth,
  onTaskContextMenu,
}: MilestoneLayerProps) {
  const selectTask = useGanttStore((state) => state.selectTask);
  const moveTaskByDays = useGanttStore((state) => state.moveTaskByDays);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const overlapOffsets = getMilestoneOverlapOffsets(tasks);

  const finishDrag = (taskId: number, dayOffset: number) => {
    if (dayOffset !== 0) {
      moveTaskByDays(taskId, dayOffset);
    }
    setDragState(null);
  };

  return (
    <div className="absolute inset-0 pointer-events-none z-20">
      {layouts.map((layout, index) => {
        const task = tasks[index];
        if (!task) {
          return null;
        }

        const isSelected = selectedTaskId === task.id;
        const isDependencySource = pendingDependencyFromTaskId === task.id;
        const dragOffset = dragState?.taskId === task.id ? dragState.dayOffset * dayWidth : 0;
        const isDragging = dragState?.taskId === task.id;
        const overlapOffset = overlapOffsets.get(index) ?? { x: 0, y: 0 };
        const x = Math.max(4, layout.x + overlapOffset.x + dragOffset);

        return (
          <div
            key={task.id}
            className={cn(
              "pointer-events-auto absolute flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-1 text-xs font-medium text-amber-800 transition",
              "bg-amber-50/95",
              isSelected && interactionMode !== "dependency" && "ring-2 ring-sky-200",
              isDependencySource && "ring-2 ring-cyan-300",
              interactionMode === "dependency"
                ? "cursor-default"
                : isDragging
                  ? "cursor-grabbing shadow-lg shadow-amber-200"
                  : "cursor-grab",
            )}
            style={{
              transform: `translate(${x}px, ${milestoneLaneTop + overlapOffset.y}px)`,
              maxWidth: 180,
              zIndex: isDragging ? 30 : 20,
            }}
            onPointerDown={(event) => {
              if (interactionMode === "dependency" || timelineScale !== "day") {
                return;
              }

              event.preventDefault();
              event.currentTarget.setPointerCapture(event.pointerId);
              setDragState({
                taskId: task.id,
                pointerId: event.pointerId,
                startClientX: event.clientX,
                dayOffset: 0,
              });
            }}
            onPointerMove={(event) => {
              if (interactionMode === "dependency" || timelineScale !== "day") {
                return;
              }
              if (!dragState || dragState.taskId !== task.id || dragState.pointerId !== event.pointerId) {
                return;
              }

              const dayOffset = Math.round((event.clientX - dragState.startClientX) / dayWidth);
              setDragState((current) =>
                current && current.taskId === task.id
                  ? {
                      ...current,
                      dayOffset,
                    }
                  : current,
              );
            }}
            onPointerUp={(event) => {
              if (interactionMode === "dependency" || timelineScale !== "day") {
                return;
              }
              if (!dragState || dragState.taskId !== task.id || dragState.pointerId !== event.pointerId) {
                return;
              }

              event.currentTarget.releasePointerCapture(event.pointerId);
              finishDrag(task.id, dragState.dayOffset);
            }}
            onPointerCancel={() => {
              setDragState(null);
            }}
            onClick={() => {
              if (interactionMode !== "dependency") {
                selectTask(task.id);
              }
            }}
            onContextMenu={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onTaskContextMenu(task.id, event);
            }}
            title={task.name}
          >
            <span className="text-[11px]">▼</span>
            <span className="truncate">{task.name}</span>
          </div>
        );
      })}
    </div>
  );
}
