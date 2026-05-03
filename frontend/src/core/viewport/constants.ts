import type { TimelineScale, Viewport } from "@/models/gantt";

export const defaultViewport: Viewport = {
  rowHeight: 48,
  headerHeight: 60,
  sidebarWidth: 360,
  dayWidth: 36,
};

export const timelineScaleWidths: Record<TimelineScale, number> = {
  day: 36,
  week: 56,
  month: 88,
};
