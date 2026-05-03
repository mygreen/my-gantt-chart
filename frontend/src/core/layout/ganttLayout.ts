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
): TaskLayout[] {
  return tasks.map((task, index) => {
    const position = getTimelinePosition(task, timelineCells, viewport.dayWidth);
    const y = index * viewport.rowHeight + 8;

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
  const exitGap = 20;
  const arrowWidth = 8;
  const arrowHeight = 5;
  const approachX = endX - arrowWidth;
  const availableGap = endX - startX;
  const directElbowX =
    startX + Math.max(12, Math.min(24, availableGap > 0 ? availableGap / 2 : 12));
  const needsDetour = availableGap < 28 || directElbowX >= approachX - 4;
  const elbowX = needsDetour ? endX + 18 : directElbowX;

  if (needsDetour) {
    const laneOffset = Math.max(10, Math.min(18, toLayout.height / 2 + 2));
    const laneY = startY < endY ? endY - laneOffset : endY + laneOffset;

    return {
      path: [
        `M ${startX} ${startY}`,
        `L ${elbowX} ${startY}`,
        `L ${elbowX} ${laneY}`,
        `L ${approachX} ${laneY}`,
        `L ${approachX} ${endY}`,
      ].join(" "),
      arrowPoints: `${approachX},${endY - arrowHeight} ${endX},${endY} ${approachX},${endY + arrowHeight}`,
    };
  }

  return {
    path: [
      `M ${startX} ${startY}`,
      `L ${elbowX} ${startY}`,
      `L ${elbowX} ${endY}`,
      `L ${approachX} ${endY}`,
    ].join(" "),
    arrowPoints: `${approachX},${endY - arrowHeight} ${endX},${endY} ${approachX},${endY + arrowHeight}`,
  };
}

export function isTaskActive(task: Task, targetDate: Date) {
  const start = parseISO(task.startDate);
  const end = parseISO(task.endDate);
  return targetDate >= start && targetDate <= end;
}
