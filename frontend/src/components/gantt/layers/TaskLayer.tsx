import { memo, useMemo, useState } from "react";
import type { MouseEvent } from "react";
import { buildTaskProgressSegments } from "@/core/scheduling/timeline";
import type { InteractionMode, TaskLayout, TimelineScale, VisibleTask } from "@/models/gantt";
import { getVisibleRowWindow } from "@/core/virtualization/visibleWindow";
import { statusBorderMap, statusColorMap } from "@/core/dependency/statusColors";
import { useGanttStore } from "@/stores/useGanttStore";
import { cn } from "@/utils/cn";

type TaskLayerProps = {
  tasks: VisibleTask[];
  layouts: TaskLayout[];
  scrollTop: number;
  dayWidth: number;
  timelineScale: TimelineScale;
  interactionMode: InteractionMode;
  pendingDependencyFromTaskId: number | null;
  selectedTaskId: number | null;
  onTaskContextMenu: (taskId: number, event: MouseEvent<HTMLDivElement>) => void;
};

type MoveDragState = {
  taskId: number;
  pointerId: number;
  startClientX: number;
  dayOffset: number;
};

type ResizeDragState = {
  taskId: number;
  pointerId: number;
  startClientX: number;
  dayOffset: number;
  edge: "start" | "end";
};

export const TaskLayer = memo(function TaskLayer({
  tasks,
  layouts,
  scrollTop,
  dayWidth,
  timelineScale,
  interactionMode,
  pendingDependencyFromTaskId,
  selectedTaskId,
  onTaskContextMenu,
}: TaskLayerProps) {
  const moveTaskByDays = useGanttStore((state) => state.moveTaskByDays);
  const resizeTaskByDays = useGanttStore((state) => state.resizeTaskByDays);
  const resizeTaskStartByDays = useGanttStore((state) => state.resizeTaskStartByDays);
  const selectDependencyTask = useGanttStore((state) => state.selectDependencyTask);
  const selectTask = useGanttStore((state) => state.selectTask);
  const holidays = useGanttStore((state) => state.holidays);
  const excludeNonWorkingDays = useGanttStore((state) => state.excludeNonWorkingDays);
  const visibleWindow = useMemo(
    () => getVisibleRowWindow(scrollTop, 48, tasks.length),
    [scrollTop, tasks.length],
  );
  const [dragState, setDragState] = useState<MoveDragState | null>(null);
  const [resizeState, setResizeState] = useState<ResizeDragState | null>(null);

  const finishDrag = (taskId: number, dayOffset: number) => {
    if (dayOffset !== 0) {
      moveTaskByDays(taskId, dayOffset);
    }
    setDragState(null);
  };

  const finishResize = (taskId: number, dayOffset: number, edge: "start" | "end") => {
    if (dayOffset !== 0) {
      if (edge === "start") {
        resizeTaskStartByDays(taskId, dayOffset);
      } else {
        resizeTaskByDays(taskId, dayOffset);
      }
    }
    setResizeState(null);
  };

  return (
    <div className="pointer-events-none absolute inset-0">
      {layouts.slice(visibleWindow.start, visibleWindow.end).map((layout, offsetIndex) => {
        const task = tasks[visibleWindow.start + offsetIndex];
        const dragOffset = dragState?.taskId === task.id ? dragState.dayOffset * dayWidth : 0;
        const isDragging = dragState?.taskId === task.id;
        const resizeOffset = resizeState?.taskId === task.id ? resizeState.dayOffset * dayWidth : 0;
        const isResizing = resizeState?.taskId === task.id;
        const isMilestone = task.type === "milestone";
        const isDependencySource = pendingDependencyFromTaskId === task.id;
        const isSelected = selectedTaskId === task.id;
        const progressSegments = buildTaskProgressSegments(
          task,
          holidays,
          excludeNonWorkingDays,
        );
        const startResizeOffset =
          resizeState?.taskId === task.id && resizeState.edge === "start" ? resizeOffset : 0;
        const endResizeOffset =
          resizeState?.taskId === task.id && resizeState.edge === "end" ? resizeOffset : 0;
        const widthDelta =
          resizeState?.taskId === task.id && resizeState.edge === "start"
            ? -startResizeOffset
            : endResizeOffset;
        const previewWidth = isMilestone ? Math.max(18, dayWidth * 0.7) : Math.max(dayWidth, layout.width + widthDelta);
        const previewTranslateX =
          (isMilestone ? layout.x + layout.width / 2 - previewWidth / 2 : layout.x) +
          dragOffset +
          (resizeState?.taskId === task.id && resizeState.edge === "start" && !isMilestone
            ? Math.min(startResizeOffset, layout.width - dayWidth)
            : 0);

        return (
          <div
            key={task.id}
            className={cn(
              "pointer-events-auto absolute overflow-hidden border bg-white shadow-sm transition-shadow",
              isMilestone ? "rotate-45 rounded-[6px]" : "rounded-md",
              task.status === "done" && "bg-slate-300 opacity-70",
              isDragging ? "cursor-grabbing shadow-lg shadow-cyan-200" : "cursor-grab",
              interactionMode === "dependency" && "cursor-crosshair",
              isDependencySource && "ring-2 ring-cyan-300",
              isSelected && interactionMode !== "dependency" && "ring-2 ring-sky-200",
              statusBorderMap[task.status],
            )}
            style={{
              transform: `translate(${previewTranslateX}px, ${layout.y}px)`,
              width: previewWidth,
              height: layout.height,
              zIndex: isDragging || isResizing ? 20 : 10,
            }}
            onPointerDown={(event) => {
              if (interactionMode === "dependency" || timelineScale !== "day") {
                return;
              }
              if (isMilestone) {
                return;
              }
              if ((event.target as HTMLElement).dataset.resizeHandle === "true") {
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
              if (interactionMode === "dependency") {
                selectDependencyTask(task.id);
              } else {
                selectTask(task.id);
              }
            }}
            onContextMenu={(event) => onTaskContextMenu(task.id, event)}
          >
            {isMilestone ? (
              <div className="-rotate-45 flex h-full items-center justify-center px-1">
                <p
                  className={cn(
                    "truncate text-[11px] font-semibold text-slate-900",
                    task.status === "done" && "text-slate-700",
                  )}
                >
                  {task.name}
                </p>
              </div>
            ) : (
              <>
                <div className="flex h-full flex-col justify-between px-2.5 py-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <p
                      className={cn(
                        "truncate text-xs font-medium text-slate-900",
                        task.status === "done" && "text-slate-700",
                      )}
                    >
                      {task.name}
                    </p>
                    <span
                      className={cn(
                        "text-[11px] text-slate-500",
                        task.status === "done" && "text-slate-600",
                      )}
                    >
                      {task.progress}%
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div
                      className={cn(
                        "relative h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200",
                        task.status === "done" && "bg-slate-300",
                      )}
                    >
                      {progressSegments.length > 0 ? (
                        progressSegments.map((segment, index) => (
                          <div
                            key={segment.key}
                            className={cn(
                              "absolute inset-y-0",
                              !segment.isWorkingDay &&
                                excludeNonWorkingDays &&
                                "bg-slate-300/70",
                            )}
                            style={{
                              left: `${(index / progressSegments.length) * 100}%`,
                              width: `${100 / progressSegments.length}%`,
                            }}
                          >
                            {segment.fillRatio > 0 ? (
                              <div
                                className={cn("h-full rounded-full", statusColorMap[task.status])}
                                style={{ width: `${segment.fillRatio * 100}%` }}
                              />
                            ) : null}
                          </div>
                        ))
                      ) : (
                        <div
                          className={cn("h-full rounded-full", statusColorMap[task.status])}
                          style={{ width: `${task.progress}%` }}
                        />
                      )}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label={`${task.name} start resize handle`}
                  data-resize-handle="true"
                  className={cn(
                    "absolute inset-y-0 left-0 w-2.5 border-r border-slate-200 bg-slate-50 transition hover:bg-cyan-100",
                    task.status === "done" && "bg-slate-300/70 hover:bg-slate-300",
                    isResizing && resizeState?.edge === "start"
                      ? "cursor-ew-resize bg-cyan-100"
                      : "cursor-ew-resize",
                  )}
                  onPointerDown={(event) => {
                    if (interactionMode === "dependency" || timelineScale !== "day") {
                      return;
                    }
                    event.preventDefault();
                    event.stopPropagation();
                    event.currentTarget.setPointerCapture(event.pointerId);
                    setResizeState({
                      taskId: task.id,
                      pointerId: event.pointerId,
                      startClientX: event.clientX,
                      dayOffset: 0,
                      edge: "start",
                    });
                  }}
                  onPointerMove={(event) => {
                    if (interactionMode === "dependency" || timelineScale !== "day") {
                      return;
                    }
                    if (
                      !resizeState ||
                      resizeState.taskId !== task.id ||
                      resizeState.pointerId !== event.pointerId
                    ) {
                      return;
                    }

                    const dayOffset = Math.round(
                      (event.clientX - resizeState.startClientX) / dayWidth,
                    );
                    setResizeState((current) =>
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
                    if (
                      !resizeState ||
                      resizeState.taskId !== task.id ||
                      resizeState.pointerId !== event.pointerId
                    ) {
                      return;
                    }

                    event.currentTarget.releasePointerCapture(event.pointerId);
                    finishResize(task.id, resizeState.dayOffset, resizeState.edge);
                  }}
                  onPointerCancel={() => {
                    setResizeState(null);
                  }}
                />
                <button
                  type="button"
                  aria-label={`${task.name} end resize handle`}
                  data-resize-handle="true"
                  className={cn(
                    "absolute inset-y-0 right-0 w-2.5 border-l border-slate-200 bg-slate-50 transition hover:bg-cyan-100",
                    task.status === "done" && "bg-slate-300/70 hover:bg-slate-300",
                    isResizing && resizeState?.edge === "end"
                      ? "cursor-ew-resize bg-cyan-100"
                      : "cursor-ew-resize",
                  )}
                  onPointerDown={(event) => {
                    if (interactionMode === "dependency" || timelineScale !== "day") {
                      return;
                    }
                    event.preventDefault();
                    event.stopPropagation();
                    event.currentTarget.setPointerCapture(event.pointerId);
                    setResizeState({
                      taskId: task.id,
                      pointerId: event.pointerId,
                      startClientX: event.clientX,
                      dayOffset: 0,
                      edge: "end",
                    });
                  }}
                  onPointerMove={(event) => {
                    if (interactionMode === "dependency" || timelineScale !== "day") {
                      return;
                    }
                    if (
                      !resizeState ||
                      resizeState.taskId !== task.id ||
                      resizeState.pointerId !== event.pointerId
                    ) {
                      return;
                    }

                    const dayOffset = Math.round(
                      (event.clientX - resizeState.startClientX) / dayWidth,
                    );
                    setResizeState((current) =>
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
                    if (
                      !resizeState ||
                      resizeState.taskId !== task.id ||
                      resizeState.pointerId !== event.pointerId
                    ) {
                      return;
                    }

                    event.currentTarget.releasePointerCapture(event.pointerId);
                    finishResize(task.id, resizeState.dayOffset, resizeState.edge);
                  }}
                  onPointerCancel={() => {
                    setResizeState(null);
                  }}
                />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
});
