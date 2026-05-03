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
};

function buildPointString(points: InazumaPoint[]) {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

function buildInazumaPoints(
  tasks: VisibleTask[],
  layouts: TaskLayout[],
  baselineX: number,
  holidays: Holiday[],
  excludeNonWorkingDays: boolean,
) {
  return layouts
    .map((layout, index) => {
      const task = tasks[index];
      if (!task) {
        return null;
      }

      const progressRatio = getTaskProgressRatio(task, holidays, excludeNonWorkingDays);
      const x = layout.x + layout.width * progressRatio;
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
}: InazumaLayerProps) {
  const baselineX = getDateOffsetInTimeline(baselineDate, timelineCells, cellWidth);
  if (baselineX === null) {
    return null;
  }

  const points = buildInazumaPoints(
    tasks,
    layouts,
    baselineX,
    holidays,
    excludeNonWorkingDays,
  );

  if (points.length === 0) {
    return null;
  }

  const delayedCount = points.filter((point) => point.isDelayed).length;

  return (
    <svg className="pointer-events-none absolute inset-0 z-20" width={width} height={height}>
      <line
        x1={baselineX}
        x2={baselineX}
        y1={0}
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
      <g transform={`translate(${Math.min(Math.max(baselineX - 58, 8), width - 116)}, 8)`}>
        <rect width="116" height="24" rx="12" fill="#ffffff" stroke="#fecaca" />
        <text
          x="58"
          y="16"
          textAnchor="middle"
          fontSize="11"
          fontWeight="600"
          fill="#dc2626"
        >
          {`基準日 ${baselineDate}`}
        </text>
      </g>
      <g transform={`translate(${Math.max(width - 150, 8)}, 8)`}>
        <rect width="142" height="24" rx="12" fill="#ffffff" stroke="#fecaca" />
        <text
          x="71"
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
