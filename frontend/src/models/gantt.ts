export type TaskStatus = "todo" | "in_progress" | "done" | "blocked";

export type TaskType = "task" | "milestone";

export type Task = {
  id: number;
  name: string;
  owner: string;
  startDate: string;
  endDate: string;
  progress: number;
  status: TaskStatus;
  parentTaskId: number | null;
  type: TaskType;
};

export type Dependency = {
  id: number;
  fromTaskId: number;
  toTaskId: number;
};

export type Holiday = {
  id: number;
  date: string;
  name: string;
};

export type Member = {
  id: number;
  name: string;
};

export type ProjectVersionSummary = {
  version: number;
  savedAt: string;
  note: string | null;
};

export type ProjectSummary = {
  id: number;
  name: string;
  version: number;
};

export type Viewport = {
  rowHeight: number;
  headerHeight: number;
  sidebarWidth: number;
  dayWidth: number;
};

export type TaskLayout = {
  taskId: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type TimelineScale = "day" | "week" | "month";

export type TimelineCell = {
  key: string;
  label: string;
  start: Date;
  end: Date;
  groupKey: string;
  groupLabel: string;
  isNonWorking: boolean;
  holidayName: string | null;
};

export type InteractionMode = "schedule" | "dependency";

export type VisibleTask = Task & {
  depth: number;
  hasChildren: boolean;
  isCollapsed: boolean;
};

export type InazumaPoint = {
  taskId: number;
  x: number;
  y: number;
  isDelayed: boolean;
};
