import { parseISO } from "date-fns";
import { getDateOffsetInTimeline, getTaskProgressRatio } from "@/core/scheduling/timeline";
import type { Holiday, InazumaPoint, TaskLayout, TimelineCell, VisibleTask } from "@/models/gantt";

type InazumaLayerProps = {
  tasks: VisibleTask[];
  layouts: TaskLayout[];
  timelineCells: TimelineCell[];
  cellWidth: number;
  baselineDate: string;
  holidays: Holiday[];
  excludeNonWorkingDays: boolean;
  width: number;
  height: number;
  topOffset?: number;
  viewportTop?: number;
  viewportLeft?: number;
  viewportWidth?: number;
};

function buildPointString(points: InazumaPoint[]) {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

function buildInazumaPoints(
  tasks: VisibleTask[],
  layouts: TaskLayout[],
  baselineX: number,
  baselineDate: string,
  holidays: Holiday[],
  excludeNonWorkingDays: boolean,
) {
  const baseline = parseISO(baselineDate);

  return layouts
    .map((layout, index) => {
      const task = tasks[index];
      if (!task || task.type === "milestone") {
        return null;
      }

      const progressRatio = getTaskProgressRatio(task, holidays, excludeNonWorkingDays);
      const startsAfterBaseline = parseISO(task.startDate).getTime() > baseline.getTime();
      const isFutureNotStarted =
        startsAfterBaseline && (task.progress <= 0 || progressRatio <= 0 || task.status === "todo");
      const isCompletedBeforeBaseline =
        task.status === "done" && parseISO(task.endDate).getTime() <= baseline.getTime();
      const x =
        isCompletedBeforeBaseline || isFutureNotStarted
          ? baselineX
          : layout.x + layout.width * progressRatio;
      const y = layout.y + layout.height / 2;

      return {
        taskId: task.id,
        x,
        y,
        isDelayed: x < baselineX,
      } satisfies InazumaPoint;
    })
    .filter((point): point is InazumaPoint => point !== null);
}

export function InazumaLayer({
  tasks,
  layouts,
  timelineCells,
  cellWidth,
  baselineDate,
  holidays,
  excludeNonWorkingDays,
  width,
  height,
  topOffset = 0,
  viewportTop = 0,
  viewportLeft = 0,
  viewportWidth = width,
}: InazumaLayerProps) {
  const baselineX = getDateOffsetInTimeline(baselineDate, timelineCells, cellWidth);
  if (baselineX === null) {
    return null;
  }

  const clipPathId = "inazuma-content-clip";

  const points = buildInazumaPoints(
    tasks,
    layouts,
    baselineX,
    baselineDate,
    holidays,
    excludeNonWorkingDays,
  );

  if (points.length === 0) {
    return null;
  }

  const delayedCount = points.filter((point) => point.isDelayed).length;
  const badgeWidth = 142;
  const badgeX = Math.min(
    Math.max(viewportLeft + Math.max(viewportWidth - badgeWidth - 16, 8), 8),
    Math.max(width - badgeWidth, 8),
  );
  const badgeY = viewportTop + topOffset + 8;

  return (
    <svg className="pointer-events-none absolute inset-0 z-20" width={width} height={height}>
      <defs>
        <clipPath id={clipPathId}>
          <rect x="0" y={topOffset} width={width} height={Math.max(height - topOffset, 0)} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipPathId})`}>
        <line
          x1={baselineX}
          x2={baselineX}
          y1={topOffset}
          y2={height}
          stroke="#ef4444"
          strokeWidth="2"
          strokeDasharray="5 4"
          opacity="0.9"
        />
        <polyline
          points={buildPointString(points)}
          fill="none"
          stroke="#ef4444"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {points.map((point) => (
          <circle
            key={point.taskId}
            cx={point.x}
            cy={point.y}
            r="3.5"
            fill={point.isDelayed ? "#ef4444" : "#f97316"}
            stroke="#ffffff"
            strokeWidth="1.5"
          />
        ))}
      </g>
      <g transform={`translate(${badgeX}, ${badgeY})`}>
        <rect width={badgeWidth} height="24" rx="12" fill="#ffffff" stroke="#fecaca" />
        <text
          x={badgeWidth / 2}
          y="16"
          textAnchor="middle"
          fontSize="11"
          fontWeight="600"
          fill="#dc2626"
        >
          {`遅れタスク ${delayedCount}件`}
        </text>
      </g>
    </svg>
  );
}
