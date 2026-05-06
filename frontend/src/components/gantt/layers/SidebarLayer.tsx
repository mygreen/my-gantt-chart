import { ChevronDown, ChevronRight } from "lucide-react";
import { DragEvent, MouseEvent, useMemo, useState } from "react";
import { statusColorMap } from "@/core/dependency/statusColors";
import { getTaskEffortInDays } from "@/core/scheduling/timeline";
import type { TaskDropPlacement } from "@/core/taskTree";
import type { VisibleTask } from "@/models/gantt";
import { useGanttStore } from "@/stores/useGanttStore";
import { cn } from "@/utils/cn";

type SidebarLayerProps = {
  tasks: VisibleTask[];
  taskNumbers: Map<number, number>;
  rowHeight: number;
  status: "idle" | "loading" | "ready" | "error";
  selectedTaskId: number | null;
  showOwnerColumn: boolean;
  showStartDateColumn: boolean;
  showEndDateColumn: boolean;
  showProgressColumn: boolean;
  onTaskContextMenu: (taskId: number, event: MouseEvent<HTMLDivElement>) => void;
};

type DropIndicator = {
  taskId: number;
  placement: TaskDropPlacement;
};

function buildSidebarColumns(
  showOwnerColumn: boolean,
  showStartDateColumn: boolean,
  showEndDateColumn: boolean,
  showProgressColumn: boolean,
) {
  const columns = ["32px", "minmax(0,2.2fr)"];
  if (showOwnerColumn) {
    columns.push("minmax(72px,0.9fr)");
  }
  if (showStartDateColumn) {
    columns.push("88px");
  }
  if (showEndDateColumn) {
    columns.push("88px");
  }
  if (showProgressColumn) {
    columns.push("64px");
  }
  columns.push("56px", "12px");
  return columns.join(" ");
}

function formatDateLabel(date: string) {
  return date.replaceAll("-", "/");
}

export function SidebarLayer({
  tasks,
  taskNumbers,
  rowHeight,
  status,
  selectedTaskId,
  showOwnerColumn,
  showStartDateColumn,
  showEndDateColumn,
  showProgressColumn,
  onTaskContextMenu,
}: SidebarLayerProps) {
  const selectTask = useGanttStore((state) => state.selectTask);
  const toggleTaskCollapse = useGanttStore((state) => state.toggleTaskCollapse);
  const moveTaskByDrop = useGanttStore((state) => state.moveTaskByDrop);
  const holidays = useGanttStore((state) => state.holidays);
  const excludeNonWorkingDays = useGanttStore((state) => state.excludeNonWorkingDays);
  const [draggingTaskId, setDraggingTaskId] = useState<number | null>(null);
  const [dropIndicator, setDropIndicator] = useState<DropIndicator | null>(null);

  const gridTemplateColumns = useMemo(
    () =>
      buildSidebarColumns(
        showOwnerColumn,
        showStartDateColumn,
        showEndDateColumn,
        showProgressColumn,
      ),
    [showEndDateColumn, showOwnerColumn, showProgressColumn, showStartDateColumn],
  );

  if (status === "loading" && tasks.length === 0) {
    return (
      <div className="border-r border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
        読み込み中...
      </div>
    );
  }

  const resolvePlacement = (event: DragEvent<HTMLDivElement>): TaskDropPlacement => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return event.clientY - bounds.top < bounds.height / 2 ? "before" : "after";
  };

  return (
    <div className="overflow-hidden border-r border-slate-200 bg-white">
      {tasks.map((task) => {
        const isDropTarget = dropIndicator?.taskId === task.id;
        const showDropTop = isDropTarget && dropIndicator?.placement === "before";
        const showDropBottom = isDropTarget && dropIndicator?.placement === "after";

        return (
          <div
            key={task.id}
            draggable
            className={cn(
              "relative grid items-center gap-2 border-b border-slate-200 pl-2 pr-3 transition",
              selectedTaskId === task.id && "bg-cyan-50",
              draggingTaskId === task.id && "opacity-60",
            )}
            style={{
              height: rowHeight,
              gridTemplateColumns,
            }}
            onClick={() => selectTask(task.id)}
            onContextMenu={(event) => onTaskContextMenu(task.id, event)}
            onDragStart={() => {
              setDraggingTaskId(task.id);
              setDropIndicator(null);
            }}
            onDragEnd={() => {
              setDraggingTaskId(null);
              setDropIndicator(null);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              if (draggingTaskId === null || draggingTaskId === task.id) {
                setDropIndicator(null);
                return;
              }

              setDropIndicator({
                taskId: task.id,
                placement: resolvePlacement(event),
              });
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                setDropIndicator((current) => (current?.taskId === task.id ? null : current));
              }
            }}
            onDrop={(event) => {
              event.preventDefault();
              if (draggingTaskId === null || draggingTaskId === task.id) {
                return;
              }

              const placement = resolvePlacement(event);
              moveTaskByDrop(draggingTaskId, task.id, placement);
              setDraggingTaskId(null);
              setDropIndicator(null);
            }}
          >
            {showDropTop ? <div className="absolute inset-x-0 top-0 h-0.5 bg-cyan-500" /> : null}
            {showDropBottom ? (
              <div className="absolute inset-x-0 bottom-0 h-0.5 bg-cyan-500" />
            ) : null}

            <p className="text-right text-xs text-slate-400">{taskNumbers.get(task.id) ?? ""}</p>
            <div
              className="flex min-w-0 items-center gap-1"
              style={{ paddingLeft: `${task.depth * 14}px` }}
            >
              <button
                type="button"
                className={cn(
                  "inline-flex h-4 w-4 items-center justify-center rounded text-slate-400",
                  task.hasChildren ? "hover:bg-slate-100 hover:text-slate-700" : "invisible",
                )}
                onClick={(event) => {
                  event.stopPropagation();
                  toggleTaskCollapse(task.id);
                }}
              >
                {task.isCollapsed ? (
                  <ChevronRight className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </button>
              <p className="truncate text-xs font-medium text-slate-900">{task.name}</p>
            </div>
            {showOwnerColumn ? (
              <p className="truncate text-xs text-slate-500">{task.owner}</p>
            ) : null}
            {showStartDateColumn ? (
              <p className="truncate text-xs text-slate-500">{formatDateLabel(task.startDate)}</p>
            ) : null}
            {showEndDateColumn ? (
              <p className="truncate text-xs text-slate-500">{formatDateLabel(task.endDate)}</p>
            ) : null}
            {showProgressColumn ? (
              <p className="text-right text-xs text-slate-500">{task.progress}%</p>
            ) : null}
            <p className="text-right text-xs text-slate-500">
              {getTaskEffortInDays(task, holidays, excludeNonWorkingDays)}日
            </p>
            <span
              className={cn("inline-flex h-2 w-2 shrink-0 rounded-full", statusColorMap[task.status])}
            />
          </div>
        );
      })}
    </div>
  );
}
