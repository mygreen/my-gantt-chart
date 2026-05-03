import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  eachMonthOfInterval,
  eachWeekOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isWeekend,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import type { Holiday, Task, TimelineCell, TimelineScale } from "@/models/gantt";

export type TaskProgressSegment = {
  key: string;
  isWorkingDay: boolean;
  fillRatio: number;
};

function buildHolidaySet(holidays: Holiday[]) {
  return new Set(holidays.map((holiday) => holiday.date));
}

function isNonWorkingDay(date: Date, holidaySet: Set<string>) {
  return isWeekend(date) || holidaySet.has(format(date, "yyyy-MM-dd"));
}

function inclusiveDaySpan(start: Date, end: Date) {
  return differenceInCalendarDays(end, start) + 1;
}

export function getTimelineBounds(tasks: Task[]) {
  if (tasks.length === 0) {
    const today = startOfDay(new Date());
    return {
      start: today,
      end: addDays(today, 14),
    };
  }

  const start = tasks
    .map((task) => parseISO(task.startDate))
    .reduce((min, current) => (current < min ? current : min));
  const end = tasks
    .map((task) => parseISO(task.endDate))
    .reduce((max, current) => (current > max ? current : max));

  return {
    start: startOfDay(addDays(start, -1)),
    end: endOfDay(addDays(end, 2)),
  };
}

export function buildTimelineCells(
  tasks: Task[],
  holidays: Holiday[],
  scale: TimelineScale,
  referenceDates: string[] = [],
): TimelineCell[] {
  const bounds = getTimelineBounds(tasks);
  const parsedReferenceDates = referenceDates.map((date) => parseISO(date));
  const start =
    parsedReferenceDates.length > 0
      ? parsedReferenceDates.reduce(
          (min, current) => (current < min ? current : min),
          bounds.start,
        )
      : bounds.start;
  const end =
    parsedReferenceDates.length > 0
      ? parsedReferenceDates.reduce(
          (max, current) => (current > max ? current : max),
          bounds.end,
        )
      : bounds.end;
  const holidayMap = new Map(holidays.map((holiday) => [holiday.date, holiday.name]));
  const holidaySet = buildHolidaySet(holidays);

  if (scale === "month") {
    return eachMonthOfInterval({
      start: startOfMonth(start),
      end: startOfMonth(end),
    }).map((date) => ({
      key: format(date, "yyyy-MM"),
      label: format(date, "M月"),
      start: startOfMonth(date),
      end: endOfMonth(date),
      groupKey: format(date, "yyyy"),
      groupLabel: format(date, "yyyy年"),
      isNonWorking: false,
      holidayName: null,
    }));
  }

  if (scale === "week") {
    return eachWeekOfInterval(
      {
        start: startOfWeek(start, { weekStartsOn: 1 }),
        end: startOfWeek(end, { weekStartsOn: 1 }),
      },
      { weekStartsOn: 1 },
    ).map((date) => ({
      key: format(date, "yyyy-MM-dd"),
      label: format(date, "M/d"),
      start: startOfWeek(date, { weekStartsOn: 1 }),
      end: endOfWeek(date, { weekStartsOn: 1 }),
      groupKey: format(date, "yyyy-MM"),
      groupLabel: format(date, "yyyy年M月"),
      isNonWorking: false,
      holidayName: null,
    }));
  }

  return eachDayOfInterval({ start, end }).map((date) => {
    const holidayName = holidayMap.get(format(date, "yyyy-MM-dd")) ?? null;

    return {
      key: format(date, "yyyy-MM-dd"),
      label: format(date, "d"),
      start: startOfDay(date),
      end: endOfDay(date),
      groupKey: format(date, "yyyy-MM"),
      groupLabel: format(date, "yyyy年M月"),
      isNonWorking: isNonWorkingDay(date, holidaySet),
      holidayName,
    };
  });
}

export function getDateOffsetInTimeline(
  dateString: string,
  cells: TimelineCell[],
  cellWidth: number,
) {
  if (!dateString) {
    return null;
  }

  const targetDate = parseISO(dateString);
  if (Number.isNaN(targetDate.getTime())) {
    return null;
  }

  for (let index = 0; index < cells.length; index += 1) {
    const cell = cells[index];
    if (targetDate < cell.start || targetDate > cell.end) {
      continue;
    }

    const cellDays = inclusiveDaySpan(cell.start, cell.end);
    const offsetDays = differenceInCalendarDays(targetDate, cell.start);
    return index * cellWidth + (offsetDays / cellDays) * cellWidth;
  }

  return null;
}

export function getTaskProgressRatio(
  task: Task,
  holidays: Holiday[],
  excludeNonWorkingDays: boolean,
) {
  if (!excludeNonWorkingDays) {
    return Math.max(0, Math.min(1, task.progress / 100));
  }

  const segments = buildTaskProgressSegments(task, holidays, excludeNonWorkingDays);
  if (segments.length === 0) {
    return 0;
  }

  let filledSegments = 0;
  segments.forEach((segment, index) => {
    if (segment.fillRatio > 0) {
      filledSegments = index + segment.fillRatio;
    }
  });

  return Math.max(0, Math.min(1, filledSegments / segments.length));
}

export function getTaskDurationInDays(task: Task) {
  return differenceInCalendarDays(parseISO(task.endDate), parseISO(task.startDate)) + 1;
}

export function getTaskEffortInDays(
  task: Task,
  holidays: Holiday[],
  excludeNonWorkingDays: boolean,
) {
  if (!excludeNonWorkingDays) {
    return getTaskDurationInDays(task);
  }

  const holidaySet = buildHolidaySet(holidays);
  const days = eachDayOfInterval({
    start: parseISO(task.startDate),
    end: parseISO(task.endDate),
  });

  return days.filter((date) => !isNonWorkingDay(date, holidaySet)).length;
}

export function buildTaskProgressSegments(
  task: Task,
  holidays: Holiday[],
  excludeNonWorkingDays: boolean,
) {
  const holidaySet = buildHolidaySet(holidays);
  const days = eachDayOfInterval({
    start: parseISO(task.startDate),
    end: parseISO(task.endDate),
  });
  const workingDayFlags = days.map((date) =>
    excludeNonWorkingDays ? !isNonWorkingDay(date, holidaySet) : true,
  );
  const totalWorkingDays = workingDayFlags.filter(Boolean).length;

  if (days.length === 0 || totalWorkingDays === 0) {
    return [];
  }

  let remainingWork = (Math.max(0, Math.min(100, task.progress)) / 100) * totalWorkingDays;

  return days.map((date, index) => {
    const isWorkingDay = workingDayFlags[index];
    const fillRatio = isWorkingDay ? Math.max(0, Math.min(1, remainingWork)) : 0;
    if (isWorkingDay) {
      remainingWork = Math.max(0, remainingWork - 1);
    }

    return {
      key: `${task.id}-${format(date, "yyyy-MM-dd")}`,
      isWorkingDay,
      fillRatio,
    };
  });
}

export function getTimelinePosition(task: Task, cells: TimelineCell[], cellWidth: number) {
  const taskStart = parseISO(task.startDate);
  const taskEnd = parseISO(task.endDate);
  let x = 0;
  let width = 0;
  let started = false;

  cells.forEach((cell, index) => {
    const overlapStart = taskStart > cell.start ? taskStart : cell.start;
    const overlapEnd = taskEnd < cell.end ? taskEnd : cell.end;

    if (overlapStart > overlapEnd) {
      return;
    }

    const cellDays = inclusiveDaySpan(cell.start, cell.end);
    const overlapDays = inclusiveDaySpan(overlapStart, overlapEnd);
    const startOffsetDays = differenceInCalendarDays(overlapStart, cell.start);

    if (!started) {
      x = index * cellWidth + (startOffsetDays / cellDays) * cellWidth;
      started = true;
    }

    width += (overlapDays / cellDays) * cellWidth;
  });

  return {
    x,
    width: Math.max(width, Math.min(cellWidth, 24)),
  };
}

export function shiftTaskByDays(task: Task, dayOffset: number): Task {
  if (dayOffset === 0) {
    return task;
  }

  return {
    ...task,
    startDate: format(addDays(parseISO(task.startDate), dayOffset), "yyyy-MM-dd"),
    endDate: format(addDays(parseISO(task.endDate), dayOffset), "yyyy-MM-dd"),
  };
}

export function resizeTaskByDays(task: Task, dayOffset: number): Task {
  if (dayOffset === 0) {
    return task;
  }

  const startDate = parseISO(task.startDate);
  const endDate = parseISO(task.endDate);
  const nextEndDate = addDays(endDate, dayOffset);

  if (nextEndDate < startDate) {
    return {
      ...task,
      endDate: format(startDate, "yyyy-MM-dd"),
    };
  }

  return {
    ...task,
    endDate: format(nextEndDate, "yyyy-MM-dd"),
  };
}

export function resizeTaskStartByDays(task: Task, dayOffset: number): Task {
  if (dayOffset === 0) {
    return task;
  }

  const startDate = parseISO(task.startDate);
  const endDate = parseISO(task.endDate);
  const nextStartDate = addDays(startDate, dayOffset);

  if (nextStartDate > endDate) {
    return {
      ...task,
      startDate: format(endDate, "yyyy-MM-dd"),
    };
  }

  return {
    ...task,
    startDate: format(nextStartDate, "yyyy-MM-dd"),
  };
}
