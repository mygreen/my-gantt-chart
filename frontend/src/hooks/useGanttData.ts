import { useMemo } from "react";
import { buildTaskLayouts } from "@/core/layout/ganttLayout";
import { buildTimelineCells } from "@/core/scheduling/timeline";
import { buildVisibleTasks } from "@/core/taskTree";
import { timelineScaleWidths } from "@/core/viewport/constants";
import { useGanttStore } from "@/stores/useGanttStore";

export function useGanttData() {
  const tasks = useGanttStore((state) => state.tasks);
  const dependencies = useGanttStore((state) => state.dependencies);
  const holidays = useGanttStore((state) => state.holidays);
  const baseViewport = useGanttStore((state) => state.viewport);
  const timelineScale = useGanttStore((state) => state.timelineScale);
  const baselineDate = useGanttStore((state) => state.baselineDate);
  const projectStartDate = useGanttStore((state) => state.projectStartDate);
  const projectEndDate = useGanttStore((state) => state.projectEndDate);
  const interactionMode = useGanttStore((state) => state.interactionMode);
  const pendingDependencyFromTaskId = useGanttStore((state) => state.pendingDependencyFromTaskId);
  const selectedTaskId = useGanttStore((state) => state.selectedTaskId);
  const collapsedTaskIds = useGanttStore((state) => state.collapsedTaskIds);
  const status = useGanttStore((state) => state.status);
  const showOwnerInSidebar = useGanttStore((state) => state.showOwnerInSidebar);
  const showStartDateInSidebar = useGanttStore((state) => state.showStartDateInSidebar);
  const showEndDateInSidebar = useGanttStore((state) => state.showEndDateInSidebar);

  const sidebarWidth = useMemo(() => {
    let width = 250;
    if (showOwnerInSidebar) {
      width += 84;
    }
    if (showStartDateInSidebar) {
      width += 92;
    }
    if (showEndDateInSidebar) {
      width += 92;
    }
    return width;
  }, [showEndDateInSidebar, showOwnerInSidebar, showStartDateInSidebar]);

  const viewport = useMemo(
    () => ({
      ...baseViewport,
      dayWidth: timelineScaleWidths[timelineScale],
      sidebarWidth,
    }),
    [baseViewport, sidebarWidth, timelineScale],
  );

  const visibleTreeTasks = useMemo(
    () => buildVisibleTasks(tasks, collapsedTaskIds),
    [tasks, collapsedTaskIds],
  );
  const orderedTreeTasks = useMemo(() => buildVisibleTasks(tasks, []), [tasks]);

  const visibleTasks = useMemo(
    () => visibleTreeTasks.filter((task) => task.type !== "milestone"),
    [visibleTreeTasks],
  );
  const orderedTasks = useMemo(
    () => orderedTreeTasks.filter((task) => task.type !== "milestone"),
    [orderedTreeTasks],
  );
  const milestoneTasks = useMemo(
    () => orderedTreeTasks.filter((task) => task.type === "milestone"),
    [orderedTreeTasks],
  );

  const timelineCells = useMemo(
    () =>
      buildTimelineCells(
        tasks,
        holidays,
        timelineScale,
        baselineDate ? [baselineDate] : [],
        projectStartDate,
        projectEndDate,
      ),
    [tasks, holidays, timelineScale, baselineDate, projectStartDate, projectEndDate],
  );
  const layouts = useMemo(
    () => buildTaskLayouts(visibleTasks, timelineCells, viewport, milestoneTasks.length > 0 ? 1 : 0),
    [visibleTasks, timelineCells, viewport, milestoneTasks.length],
  );
  const milestoneLayouts = useMemo(
    () => buildTaskLayouts(milestoneTasks, timelineCells, viewport, 0),
    [milestoneTasks, timelineCells, viewport],
  );

  return {
    tasks,
    visibleTasks,
    orderedTasks,
    milestoneTasks,
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
    milestoneLayouts,
    status,
  };
}
