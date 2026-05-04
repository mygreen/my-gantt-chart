import type { Dependency, Holiday, Member, ProjectVersionSummary, Task } from "@/models/gantt";

export type GanttResponse = {
  projectName: string;
  version: number;
  projectStartDate: string;
  projectEndDate: string;
  excludeNonWorkingDays: boolean;
  members: Member[];
  tasks: Task[];
  dependencies: Dependency[];
  holidays: Holiday[];
};

export type SaveGanttPayload = {
  projectName: string;
  version: number;
  projectStartDate: string;
  projectEndDate: string;
  excludeNonWorkingDays: boolean;
  members: Member[];
  tasks: Task[];
  dependencies: Dependency[];
  holidays: Holiday[];
};

function normalizeTasks(tasks: Task[]): Task[] {
  return tasks.map((task) => ({
    ...task,
    parentTaskId: task.parentTaskId ?? null,
    type: task.type ?? "task",
  }));
}

function normalizeResponse(data: GanttResponse): GanttResponse {
  return {
    ...data,
    projectName: data.projectName || "チーム進行ガントチャート",
    version: Math.max(1, Number(data.version) || 1),
    excludeNonWorkingDays: Boolean(data.excludeNonWorkingDays),
    members: data.members ?? [],
    tasks: normalizeTasks(data.tasks ?? []),
    dependencies: data.dependencies ?? [],
    holidays: data.holidays ?? [],
  };
}

const fallbackData: GanttResponse = {
  projectName: "チーム進行ガントチャート",
  version: 1,
  projectStartDate: "2026-05-01",
  projectEndDate: "2026-05-20",
  excludeNonWorkingDays: false,
  members: [
    { id: 1, name: "Mina" },
    { id: 2, name: "Ren" },
    { id: 3, name: "Kai" },
    { id: 4, name: "Aoi" },
    { id: 5, name: "Sora" },
  ],
  tasks: [
    {
      id: 1,
      name: "要件整理",
      owner: "Mina",
      startDate: "2026-05-01",
      endDate: "2026-05-15",
      progress: 100,
      status: "done",
      parentTaskId: null,
      type: "task",
    },
    {
      id: 2,
      name: "画面設計",
      owner: "Ren",
      startDate: "2026-05-03",
      endDate: "2026-05-08",
      progress: 72,
      status: "in_progress",
      parentTaskId: 1,
      type: "task",
    },
    {
      id: 3,
      name: "フロント実装",
      owner: "Aoi",
      startDate: "2026-05-07",
      endDate: "2026-05-15",
      progress: 36,
      status: "in_progress",
      parentTaskId: 1,
      type: "task",
    },
    {
      id: 4,
      name: "API実装",
      owner: "Kai",
      startDate: "2026-05-06",
      endDate: "2026-05-13",
      progress: 48,
      status: "in_progress",
      parentTaskId: null,
      type: "task",
    },
    {
      id: 5,
      name: "受け入れテスト",
      owner: "Sora",
      startDate: "2026-05-16",
      endDate: "2026-05-20",
      progress: 0,
      status: "todo",
      parentTaskId: null,
      type: "task",
    },
  ],
  dependencies: [
    { id: 1, fromTaskId: 1, toTaskId: 2 },
    { id: 2, fromTaskId: 2, toTaskId: 3 },
    { id: 3, fromTaskId: 2, toTaskId: 4 },
    { id: 4, fromTaskId: 3, toTaskId: 5 },
    { id: 5, fromTaskId: 4, toTaskId: 5 },
  ],
  holidays: [
    { id: 1, date: "2026-05-03", name: "憲法記念日" },
    { id: 2, date: "2026-05-04", name: "みどりの日" },
    { id: 3, date: "2026-05-05", name: "こどもの日" },
    { id: 4, date: "2026-05-06", name: "振替休日" },
  ],
};

export async function fetchTasks(): Promise<GanttResponse> {
  try {
    const response = await fetch("/api/tasks");
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = (await response.json()) as GanttResponse;
    return normalizeResponse(data);
  } catch {
    return normalizeResponse(fallbackData);
  }
}

export async function saveTasks(payload: SaveGanttPayload): Promise<GanttResponse> {
  const response = await fetch("/api/tasks", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  const data = (await response.json()) as GanttResponse;
  return normalizeResponse(data);
}

export async function fetchProjectVersions(): Promise<ProjectVersionSummary[]> {
  const response = await fetch("/api/tasks/versions");

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  const data = (await response.json()) as ProjectVersionSummary[];
  return data.map((item) => ({
    ...item,
    note: item.note ?? null,
  }));
}

export async function restoreProjectVersion(version: number): Promise<GanttResponse> {
  const response = await fetch(`/api/tasks/versions/${version}/restore`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  const data = (await response.json()) as GanttResponse;
  return normalizeResponse(data);
}
