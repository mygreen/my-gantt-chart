import { useMemo } from "react";
import { buildTaskLayouts } from "@/core/layout/ganttLayout";
import { buildTimelineCells } from "@/core/scheduling/timeline";
import { timelineScaleWidths } from "@/core/viewport/constants";
import { buildVisibleTasks } from "@/core/taskTree";
import { useGanttStore } from "@/stores/useGanttStore";

export function useGanttData() {
  const tasks = useGanttStore((state) => state.tasks);
  const dependencies = useGanttStore((state) => state.dependencies);
  const holidays = useGanttStore((state) => state.holidays);
  const baseViewport = useGanttStore((state) => state.viewport);
  const timelineScale = useGanttStore((state) => state.timelineScale);
  const baselineDate = useGanttStore((state) => state.baselineDate);
  const interactionMode = useGanttStore((state) => state.interactionMode);
  const pendingDependencyFromTaskId = useGanttStore((state) => state.pendingDependencyFromTaskId);
  const selectedTaskId = useGanttStore((state) => state.selectedTaskId);
  const collapsedTaskIds = useGanttStore((state) => state.collapsedTaskIds);
  const status = useGanttStore((state) => state.status);

  const viewport = useMemo(
    () => ({
      ...baseViewport,
      dayWidth: timelineScaleWidths[timelineScale],
    }),
    [baseViewport, timelineScale],
  );
  const visibleTasks = useMemo(
    () => buildVisibleTasks(tasks, collapsedTaskIds),
    [tasks, collapsedTaskIds],
  );
  const orderedTasks = useMemo(() => buildVisibleTasks(tasks, []), [tasks]);
  const timelineCells = useMemo(
    () => buildTimelineCells(tasks, holidays, timelineScale, baselineDate ? [baselineDate] : []),
    [tasks, holidays, timelineScale, baselineDate],
  );
  const layouts = useMemo(
    () => buildTaskLayouts(visibleTasks, timelineCells, viewport),
    [visibleTasks, timelineCells, viewport],
  );

  return {
    tasks,
    visibleTasks,
    orderedTasks,
    dependencies,
    holidays,
    viewport,
    timelineScale,
    baselineDate,
    interactionMode,
    pendingDependencyFromTaskId,
    selectedTaskId,
    collapsedTaskIds,
    timelineCells,
    layouts,
    status,
  };
}
