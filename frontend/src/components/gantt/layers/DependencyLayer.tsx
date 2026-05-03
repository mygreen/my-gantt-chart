import { getDependencyRoute } from "@/core/layout/ganttLayout";
import { useGanttStore } from "@/stores/useGanttStore";
import { cn } from "@/utils/cn";
import type { Dependency, InteractionMode, TaskLayout } from "@/models/gantt";

type DependencyLayerProps = {
  dependencies: Dependency[];
  layoutMap: Map<number, TaskLayout>;
  width: number;
  height: number;
  interactionMode: InteractionMode;
};

export function DependencyLayer({
  dependencies,
  layoutMap,
  width,
  height,
  interactionMode,
}: DependencyLayerProps) {
  const removeDependency = useGanttStore((state) => state.removeDependency);

  return (
    <svg className="absolute inset-0" width={width} height={height}>
      {dependencies.map((dependency) => {
        const fromLayout = layoutMap.get(dependency.fromTaskId);
        const toLayout = layoutMap.get(dependency.toTaskId);
        if (!fromLayout || !toLayout) {
          return null;
        }

        const route = getDependencyRoute(fromLayout, toLayout);
        const strokeColor = interactionMode === "dependency" ? "#67e8f9" : "#94a3b8";
        const strokeWidth = interactionMode === "dependency" ? 2 : 1.5;

        return (
          <g key={dependency.id}>
            <path
              d={route.path}
              fill="none"
              stroke="transparent"
              strokeWidth="12"
              className={cn(
                interactionMode === "dependency" ? "cursor-pointer" : "pointer-events-none",
              )}
              onClick={() => {
                if (interactionMode === "dependency") {
                  removeDependency(dependency.id);
                }
              }}
            />
            <path
              d={route.path}
              fill="none"
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              strokeLinejoin="round"
              strokeLinecap="round"
              className="pointer-events-none"
            />
            <polygon
              points={route.arrowPoints}
              fill={strokeColor}
              className="pointer-events-none"
            />
          </g>
        );
      })}
    </svg>
  );
}
