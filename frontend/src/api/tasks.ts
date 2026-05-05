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

export async function fetchTasks(): Promise<GanttResponse> {
  const response = await fetch("/api/tasks");
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  const data = (await response.json()) as GanttResponse;
  return normalizeResponse(data);
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
