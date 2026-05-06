import { getTaskEffortInDays } from "@/core/scheduling/timeline";
import type { Holiday, Task, VisibleTask } from "@/models/gantt";

export type TaskDropPlacement = "before" | "after";

export function buildChildrenMap(tasks: Task[]) {
  const childrenMap = new Map<number | null, Task[]>();

  tasks.forEach((task) => {
    const parentTaskId = task.parentTaskId ?? null;
    const bucket = childrenMap.get(parentTaskId) ?? [];
    bucket.push(task);
    childrenMap.set(parentTaskId, bucket);
  });

  return childrenMap;
}

export function getDescendantIds(taskId: number, tasks: Task[]) {
  const childrenMap = buildChildrenMap(tasks);
  const descendants: number[] = [];

  const walk = (parentId: number) => {
    const children = childrenMap.get(parentId) ?? [];
    children.forEach((child) => {
      descendants.push(child.id);
      walk(child.id);
    });
  };

  walk(taskId);
  return descendants;
}

export function buildVisibleTasks(tasks: Task[], collapsedTaskIds: number[]) {
  const childrenMap = buildChildrenMap(tasks);
  const collapsedSet = new Set(collapsedTaskIds);
  const visibleTasks: VisibleTask[] = [];

  const walk = (parentTaskId: number | null, depth: number) => {
    const children = childrenMap.get(parentTaskId) ?? [];
    children.forEach((task) => {
      const hasChildren = (childrenMap.get(task.id) ?? []).length > 0;
      const isCollapsed = collapsedSet.has(task.id);

      visibleTasks.push({
        ...task,
        depth,
        hasChildren,
        isCollapsed,
      });

      if (hasChildren && isCollapsed) {
        return;
      }

      walk(task.id, depth + 1);
    });
  };

  walk(null, 0);
  return visibleTasks;
}

export function buildOrderedTasks(tasks: Task[]) {
  return buildVisibleTasks(tasks, []).map(({ depth: _depth, hasChildren: _hasChildren, isCollapsed: _isCollapsed, ...task }) => task);
}

export function normalizeParentTaskId(taskId: number, candidateParentId: number | null, tasks: Task[]) {
  if (candidateParentId === null || candidateParentId === taskId) {
    return null;
  }

  const descendants = new Set(getDescendantIds(taskId, tasks));
  if (descendants.has(candidateParentId)) {
    return null;
  }

  return candidateParentId;
}

function moveSubtreeBlock(
  orderedTasks: Task[],
  tasks: Task[],
  sourceTaskId: number,
  targetTaskId: number,
  placement: TaskDropPlacement,
) {
  if (sourceTaskId === targetTaskId) {
    return orderedTasks;
  }

  const sourceIds = new Set([sourceTaskId, ...getDescendantIds(sourceTaskId, tasks)]);
  if (sourceIds.has(targetTaskId)) {
    return orderedTasks;
  }

  const sourceBlock = orderedTasks.filter((task) => sourceIds.has(task.id));
  const remainingTasks = orderedTasks.filter((task) => !sourceIds.has(task.id));
  if (sourceBlock.length === 0) {
    return orderedTasks;
  }

  const targetIds = new Set([targetTaskId, ...getDescendantIds(targetTaskId, tasks)]);
  let targetTailIndex = -1;
  remainingTasks.forEach((task, index) => {
    if (targetIds.has(task.id)) {
      targetTailIndex = index;
    }
  });
  const insertIndex =
    placement === "before"
      ? remainingTasks.findIndex((task) => task.id === targetTaskId)
      : targetTailIndex + 1;

  if (insertIndex < 0) {
    return orderedTasks;
  }

  return [
    ...remainingTasks.slice(0, insertIndex),
    ...sourceBlock,
    ...remainingTasks.slice(insertIndex),
  ];
}

export function reorderTaskByStep(tasks: Task[], taskId: number, direction: -1 | 1) {
  const task = tasks.find((candidate) => candidate.id === taskId);
  if (!task) {
    return tasks;
  }

  const orderedTasks = buildOrderedTasks(tasks);
  const siblings = orderedTasks.filter(
    (candidate) => (candidate.parentTaskId ?? null) === (task.parentTaskId ?? null),
  );
  const currentIndex = siblings.findIndex((candidate) => candidate.id === taskId);
  const targetSibling = siblings[currentIndex + direction];

  if (currentIndex < 0 || !targetSibling) {
    return tasks;
  }

  return moveSubtreeBlock(
    orderedTasks,
    tasks,
    taskId,
    targetSibling.id,
    direction < 0 ? "before" : "after",
  );
}

export function reorderTaskByDrop(
  tasks: Task[],
  sourceTaskId: number,
  targetTaskId: number,
  placement: TaskDropPlacement,
) {
  const sourceTask = tasks.find((task) => task.id === sourceTaskId);
  const targetTask = tasks.find((task) => task.id === targetTaskId);
  if (!sourceTask || !targetTask) {
    return tasks;
  }

  if ((sourceTask.parentTaskId ?? null) !== (targetTask.parentTaskId ?? null)) {
    return tasks;
  }

  return moveSubtreeBlock(buildOrderedTasks(tasks), tasks, sourceTaskId, targetTaskId, placement);
}

export function syncParentTaskProgress(
  tasks: Task[],
  holidays: Holiday[] = [],
  excludeNonWorkingDays = false,
) {
  const childrenMap = buildChildrenMap(tasks);
  const taskMap = new Map(tasks.map((task) => [task.id, task]));
  const computedMap = new Map<number, Task>();

  const visit = (taskId: number): Task => {
    const cached = computedMap.get(taskId);
    if (cached) {
      return cached;
    }

    const task = taskMap.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found.`);
    }

    const children = childrenMap.get(taskId) ?? [];
    if (children.length === 0) {
      computedMap.set(taskId, task);
      return task;
    }

    const resolvedChildren = children.map((child) => visit(child.id));
    const weightedChildren = resolvedChildren.map((child) => ({
      task: child,
      effort: Math.max(1, getTaskEffortInDays(child, holidays, excludeNonWorkingDays)),
    }));
    const totalEffort = weightedChildren.reduce((sum, child) => sum + child.effort, 0);
    const progress =
      totalEffort === 0
        ? 0
        : Math.round(
            weightedChildren.reduce((sum, child) => sum + child.task.progress * child.effort, 0) /
              totalEffort,
          );
    const endDate = resolvedChildren.reduce(
      (latest, child) => (child.endDate > latest ? child.endDate : latest),
      resolvedChildren[0].endDate,
    );

    const nextTask: Task = {
      ...task,
      progress,
      endDate,
      status: progress === 100 ? "done" : progress === 0 ? "todo" : "in_progress",
    };

    computedMap.set(taskId, nextTask);
    return nextTask;
  };

  buildOrderedTasks(tasks).forEach((task) => {
    visit(task.id);
  });

  return buildOrderedTasks(tasks).map((task) => computedMap.get(task.id) ?? task);
}
