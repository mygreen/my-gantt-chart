import { parseISO } from "date-fns";
import { getTimelinePosition } from "@/core/scheduling/timeline";
import type { Task, TaskLayout, TimelineCell, Viewport } from "@/models/gantt";

export type DependencyRoute = {
  path: string;
  arrowPoints: string;
};

export function buildTaskLayouts(
  tasks: Task[],
  timelineCells: TimelineCell[],
  viewport: Viewport,
  rowOffset = 0,
): TaskLayout[] {
  return tasks.map((task, index) => {
    const position = getTimelinePosition(task, timelineCells, viewport.dayWidth);
    const y = (index + rowOffset) * viewport.rowHeight + 8;

    return {
      taskId: task.id,
      x: position.x,
      y,
      width: position.width,
      height: viewport.rowHeight - 16,
    };
  });
}

export function getDependencyRoute(
  fromLayout: TaskLayout,
  toLayout: TaskLayout,
): DependencyRoute {
  const startX = fromLayout.x + fromLayout.width;
  const startY = fromLayout.y + fromLayout.height / 2;
  const endX = toLayout.x;
  const endY = toLayout.y + toLayout.height / 2;
  const arrowWidth = 8;
  const arrowHeight = 5;
  const arrowBaseX = endX - arrowWidth;
  const availableGap = endX - startX;
  const directElbowX =
    startX + Math.max(12, Math.min(24, availableGap > 0 ? availableGap / 2 : 12));
  const needsDetour = availableGap < 28 || directElbowX >= arrowBaseX - 4;
  const elbowX = needsDetour ? endX + 18 : directElbowX;
  const lineApproachX = needsDetour ? endX - 14 : arrowBaseX;

  if (needsDetour) {
    const laneOffset = Math.max(12, Math.min(22, toLayout.height / 2 + 6));
    const laneY = startY < endY ? endY - laneOffset : endY + laneOffset;

    return {
      path: [
        `M ${startX} ${startY}`,
        `L ${elbowX} ${startY}`,
        `L ${elbowX} ${laneY}`,
        `L ${lineApproachX} ${laneY}`,
        `L ${lineApproachX} ${endY}`,
        `L ${arrowBaseX} ${endY}`,
      ].join(" "),
      arrowPoints: `${arrowBaseX},${endY - arrowHeight} ${endX},${endY} ${arrowBaseX},${endY + arrowHeight}`,
    };
  }

  return {
    path: [
      `M ${startX} ${startY}`,
      `L ${elbowX} ${startY}`,
      `L ${elbowX} ${endY}`,
      `L ${arrowBaseX} ${endY}`,
    ].join(" "),
    arrowPoints: `${arrowBaseX},${endY - arrowHeight} ${endX},${endY} ${arrowBaseX},${endY + arrowHeight}`,
  };
}

export function isTaskActive(task: Task, targetDate: Date) {
  const start = parseISO(task.startDate);
  const end = parseISO(task.endDate);
  return targetDate >= start && targetDate <= end;
}
