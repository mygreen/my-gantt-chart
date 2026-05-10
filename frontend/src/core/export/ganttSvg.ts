import {
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
import { buildTaskLayouts, getDependencyRoute } from "@/core/layout/ganttLayout";
import {
  getDateOffsetInTimeline,
  getTaskEffortInDays,
  getTaskProgressRatio,
} from "@/core/scheduling/timeline";
import { defaultViewport, timelineScaleWidths } from "@/core/viewport/constants";
import { buildVisibleTasks } from "@/core/taskTree";
import type {
  Dependency,
  Holiday,
  Task,
  TaskLayout,
  TimelineCell,
  TimelineScale,
  Viewport,
  VisibleTask,
} from "@/models/gantt";

type ExportColumns = {
  owner: boolean;
  startDate: boolean;
  endDate: boolean;
  progress: boolean;
};

export type GanttSvgExportOptions = {
  projectName: string;
  projectVersion: number;
  timelineScale: TimelineScale;
  tasks: Task[];
  dependencies: Dependency[];
  holidays: Holiday[];
  collapsedTaskIds: number[];
  excludeNonWorkingDays: boolean;
  showBaseline: boolean;
  baselineDate: string;
  periodStartDate: string;
  periodEndDate: string;
  columns: ExportColumns;
};

type MilestoneOffset = {
  x: number;
  y: number;
};

type InazumaPoint = {
  taskId: number;
  x: number;
  y: number;
  isDelayed: boolean;
};

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function buildSidebarWidth(columns: ExportColumns) {
  const noWidth = 32;
  const ownerWidth = columns.owner ? 72 : 0;
  const startWidth = columns.startDate ? 88 : 0;
  const endWidth = columns.endDate ? 88 : 0;
  const progressWidth = columns.progress ? 64 : 0;
  const effortWidth = 80;
  const statusWidth = 12;
  const gap = 8;
  const rowPadding = 24;
  const minNameWidth = 160;

  return (
    noWidth +
    ownerWidth +
    startWidth +
    endWidth +
    progressWidth +
    effortWidth +
    statusWidth +
    rowPadding +
    minNameWidth +
    gap * 6
  );
}

function buildSidebarColumnMetrics(sidebarWidth: number, columns: ExportColumns) {
  const noWidth = 32;
  const ownerWidth = columns.owner ? 72 : 0;
  const startWidth = columns.startDate ? 88 : 0;
  const endWidth = columns.endDate ? 88 : 0;
  const progressWidth = columns.progress ? 64 : 0;
  const effortWidth = 80;
  const statusWidth = 12;
  const gap = 8;
  const rowPadding = 24;
  const reserved =
    noWidth +
    ownerWidth +
    startWidth +
    endWidth +
    progressWidth +
    effortWidth +
    statusWidth +
    rowPadding +
    gap * 6;
  const nameWidth = Math.max(160, sidebarWidth - reserved);

  let x = 12;
  const metrics = {
    no: { x, width: noWidth },
    name: { x: 0, width: nameWidth },
    owner: { x: 0, width: ownerWidth },
    startDate: { x: 0, width: startWidth },
    endDate: { x: 0, width: endWidth },
    progress: { x: 0, width: progressWidth },
    effort: { x: 0, width: effortWidth },
    status: { x: 0, width: statusWidth },
  };

  x += noWidth + gap;
  metrics.name.x = x;
  x += nameWidth + gap;

  if (columns.owner) {
    metrics.owner.x = x;
    x += ownerWidth + gap;
  }
  if (columns.startDate) {
    metrics.startDate.x = x;
    x += startWidth + gap;
  }
  if (columns.endDate) {
    metrics.endDate.x = x;
    x += endWidth + gap;
  }
  if (columns.progress) {
    metrics.progress.x = x;
    x += progressWidth + gap;
  }

  metrics.effort.x = x;
  x += effortWidth + gap;
  metrics.status.x = x;

  return metrics;
}

function buildSvgClipPath(id: string, x: number, y: number, width: number, height: number) {
  return `<clipPath id="${id}"><rect x="${x}" y="${y}" width="${width}" height="${height}"/></clipPath>`;
}

function buildHolidayMap(holidays: Holiday[]) {
  return new Map(holidays.map((holiday) => [holiday.date, holiday.name]));
}

function buildExportTimelineCells(
  scale: TimelineScale,
  startDate: string,
  endDate: string,
  holidays: Holiday[],
) {
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  const holidayMap = buildHolidayMap(holidays);

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
    })) satisfies TimelineCell[];
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
    })) satisfies TimelineCell[];
  }

  return eachDayOfInterval({
    start: startOfDay(start),
    end: endOfDay(end),
  }).map((date) => {
    const dateKey = format(date, "yyyy-MM-dd");
    return {
      key: dateKey,
      label: format(date, "d"),
      start: startOfDay(date),
      end: endOfDay(date),
      groupKey: format(date, "yyyy-MM"),
      groupLabel: format(date, "yyyy年M月"),
      isNonWorking: isWeekend(date) || holidayMap.has(dateKey),
      holidayName: holidayMap.get(dateKey) ?? null,
    } satisfies TimelineCell;
  });
}

function overlapsPeriod(task: Task, startDate: string, endDate: string) {
  return !(task.endDate < startDate || task.startDate > endDate);
}

function isMilestoneInPeriod(task: Task, startDate: string, endDate: string) {
  return task.startDate >= startDate && task.startDate <= endDate;
}

function getMilestoneOverlapOffsets(tasks: VisibleTask[]) {
  const offsets = new Map<number, MilestoneOffset>();
  const indexedTasks = tasks
    .map((task, index) => ({
      index,
      startDate: parseISO(task.startDate),
    }))
    .sort((left, right) => left.startDate.getTime() - right.startDate.getTime());

  const clusters: number[][] = [];
  indexedTasks.forEach((task) => {
    const latestCluster = clusters[clusters.length - 1];
    if (!latestCluster) {
      clusters.push([task.index]);
      return;
    }

    const previousIndex = latestCluster[latestCluster.length - 1];
    const previousTask = indexedTasks.find((candidate) => candidate.index === previousIndex);
    if (!previousTask) {
      latestCluster.push(task.index);
      return;
    }

    const diffDays =
      Math.floor((task.startDate.getTime() - previousTask.startDate.getTime()) / 86400000);
    if (diffDays <= 3) {
      latestCluster.push(task.index);
    } else {
      clusters.push([task.index]);
    }
  });

  clusters.forEach((cluster) => {
    if (cluster.length === 1) {
      offsets.set(cluster[0], { x: 0, y: 0 });
      return;
    }

    const rowGap = 18;
    const columnGap = 18;
    const rows = [
      cluster.filter((_, index) => index % 2 === 0),
      cluster.filter((_, index) => index % 2 === 1),
    ];

    rows.forEach((row, rowIndex) => {
      const center = (row.length - 1) / 2;
      row.forEach((taskIndex, order) => {
        offsets.set(taskIndex, {
          x: Math.round((order - center) * columnGap),
          y: rowIndex * rowGap,
        });
      });
    });
  });

  tasks.forEach((_, index) => {
    if (!offsets.has(index)) {
      offsets.set(index, { x: 0, y: 0 });
    }
  });

  return offsets;
}

function truncateLabel(value: string, maxChars: number) {
  if (value.length <= maxChars) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxChars - 1))}…`;
}

function formatSlashDate(date: string) {
  return date.replaceAll("-", "/");
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
      if (!task) {
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

      return {
        taskId: task.id,
        x,
        y: layout.y + layout.height / 2,
        isDelayed: x < baselineX,
      } satisfies InazumaPoint;
    })
    .filter((point): point is InazumaPoint => point !== null);
}

function buildMonthGroups(cells: TimelineCell[]) {
  const groups: Array<{ label: string; startIndex: number; count: number }> = [];

  cells.forEach((cell, index) => {
    const latest = groups[groups.length - 1];
    if (latest && latest.label === cell.groupLabel) {
      latest.count += 1;
      return;
    }

    groups.push({
      label: cell.groupLabel,
      startIndex: index,
      count: 1,
    });
  });

  return groups;
}

function downloadSvg(filename: string, svgMarkup: string) {
  const blob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function exportGanttAsSvg(options: GanttSvgExportOptions) {
  const {
    projectName,
    projectVersion,
    timelineScale,
    tasks,
    dependencies,
    holidays,
    collapsedTaskIds,
    excludeNonWorkingDays,
    showBaseline,
    baselineDate,
    periodStartDate,
    periodEndDate,
    columns,
  } = options;

  const timelineCells = buildExportTimelineCells(
    timelineScale,
    periodStartDate,
    periodEndDate,
    holidays,
  );

  if (timelineCells.length === 0) {
    throw new Error("出力対象の期間に日付がありません。");
  }

  const visibleTreeTasks = buildVisibleTasks(tasks, collapsedTaskIds);
  const orderedTreeTasks = buildVisibleTasks(tasks, []);
  const exportTasks = visibleTreeTasks.filter(
    (task) => task.type !== "milestone" && overlapsPeriod(task, periodStartDate, periodEndDate),
  );
  const orderedTasks = orderedTreeTasks.filter(
    (task) => task.type !== "milestone" && overlapsPeriod(task, periodStartDate, periodEndDate),
  );
  const exportMilestones = buildVisibleTasks(tasks, []).filter(
    (task) => task.type === "milestone" && isMilestoneInPeriod(task, periodStartDate, periodEndDate),
  );
  const taskNumbers = new Map(orderedTasks.map((task, index) => [task.id, index + 1]));

  const viewport: Viewport = {
    ...defaultViewport,
    dayWidth: timelineScaleWidths[timelineScale],
    sidebarWidth: buildSidebarWidth(columns),
  };
  const sidebarColumns = buildSidebarColumnMetrics(viewport.sidebarWidth, columns);
  const timelineWidth = timelineCells.length * viewport.dayWidth;
  const timelineOriginX = viewport.sidebarWidth;
  const headerHeight = viewport.headerHeight;
  const milestoneRowHeight = exportMilestones.length > 0 ? viewport.rowHeight : 0;
  const taskAreaTop = headerHeight + milestoneRowHeight;
  const taskAreaHeight = exportTasks.length * viewport.rowHeight;
  const totalHeight = Math.max(taskAreaTop + taskAreaHeight + 24, 260);
  const totalWidth = timelineOriginX + timelineWidth;

  const taskLayouts = buildTaskLayouts(exportTasks, timelineCells, viewport, 0);
  const milestoneLayouts = buildTaskLayouts(exportMilestones, timelineCells, viewport, 0);
  const milestoneOffsets = getMilestoneOverlapOffsets(exportMilestones);
  const milestoneLaneTop = 10;
  const monthGroups = buildMonthGroups(timelineCells);
  const baselineX =
    showBaseline && baselineDate
      ? getDateOffsetInTimeline(baselineDate, timelineCells, viewport.dayWidth)
      : null;
  const inazumaPoints =
    baselineX !== null
      ? buildInazumaPoints(
          exportTasks,
          taskLayouts,
          baselineX,
          baselineDate,
          holidays,
          excludeNonWorkingDays,
        )
      : [];
  const delayedCount = inazumaPoints.filter((point) => point.isDelayed).length;
  const visibleTaskIds = new Set(exportTasks.map((task) => task.id));
  const exportDependencies = dependencies.filter(
    (dependency) =>
      visibleTaskIds.has(dependency.fromTaskId) && visibleTaskIds.has(dependency.toTaskId),
  );
  const layoutMap = new Map(taskLayouts.map((layout) => [layout.taskId, layout]));

  const svgParts: string[] = [];
  svgParts.push(
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${totalHeight}" viewBox="0 0 ${totalWidth} ${totalHeight}" role="img" aria-labelledby="svg-title svg-desc">`,
    `<title id="svg-title">${escapeXml(projectName)} v${projectVersion}</title>`,
    `<desc id="svg-desc">${escapeXml(projectName)} のガントチャートです。出力期間は ${escapeXml(formatSlashDate(periodStartDate))} から ${escapeXml(formatSlashDate(periodEndDate))} までです。</desc>`,
    `<rect width="${totalWidth}" height="${totalHeight}" fill="#ffffff"/>`,
    `<rect x="0" y="0" width="${viewport.sidebarWidth}" height="${headerHeight}" fill="#f8fafc" stroke="#e2e8f0"/>`,
    `<rect x="${timelineOriginX}" y="0" width="${timelineWidth}" height="${headerHeight}" fill="#ffffff" stroke="#e2e8f0"/>`,
    `<defs>`,
    buildSvgClipPath("sidebar-clip", 0, 0, viewport.sidebarWidth, totalHeight),
    buildSvgClipPath("timeline-task-clip", timelineOriginX, taskAreaTop, timelineWidth, totalHeight - taskAreaTop),
    `</defs>`,
  );

  monthGroups.forEach((group) => {
    const x = timelineOriginX + group.startIndex * viewport.dayWidth;
    const width = group.count * viewport.dayWidth;
    svgParts.push(
      `<rect x="${x}" y="0" width="${width}" height="26" fill="#ffffff" stroke="#e2e8f0"/>`,
      `<text x="${x + 8}" y="17" font-size="12" font-weight="600" fill="#334155">${escapeXml(group.label)}</text>`,
    );
  });

  timelineCells.forEach((cell, index) => {
    const x = timelineOriginX + index * viewport.dayWidth;
    const cellBg = cell.isNonWorking ? "#fef2f2" : "#ffffff";
    svgParts.push(
      `<rect x="${x}" y="26" width="${viewport.dayWidth}" height="34" fill="${cellBg}" stroke="#dbeafe"/>`,
      `<text x="${x + viewport.dayWidth / 2}" y="48" text-anchor="middle" font-size="12" font-weight="600" fill="${cell.isNonWorking ? "#e11d48" : "#1e3a8a"}">${escapeXml(cell.label)}</text>`,
    );
  });

  svgParts.push(
    `<text x="${sidebarColumns.no.x + sidebarColumns.no.width}" y="34" text-anchor="end" font-size="11" font-weight="700" fill="#475569">No.</text>`,
    `<text x="${sidebarColumns.name.x}" y="34" font-size="11" font-weight="700" fill="#475569">名称</text>`,
  );

  if (columns.owner) {
    svgParts.push(
      `<text x="${sidebarColumns.owner.x}" y="34" font-size="11" font-weight="700" fill="#475569">担当者</text>`,
    );
  }
  if (columns.startDate) {
    svgParts.push(
      `<text x="${sidebarColumns.startDate.x}" y="34" font-size="11" font-weight="700" fill="#475569">開始日</text>`,
    );
  }
  if (columns.endDate) {
    svgParts.push(
      `<text x="${sidebarColumns.endDate.x}" y="34" font-size="11" font-weight="700" fill="#475569">終了日</text>`,
    );
  }
  if (columns.progress) {
    svgParts.push(
      `<text x="${sidebarColumns.progress.x + sidebarColumns.progress.width}" y="34" text-anchor="end" font-size="11" font-weight="700" fill="#475569">進捗率</text>`,
    );
  }
  svgParts.push(
    `<text x="${sidebarColumns.effort.x + sidebarColumns.effort.width}" y="34" text-anchor="end" font-size="11" font-weight="700" fill="#475569">工数</text>`,
  );

  if (exportMilestones.length > 0) {
    svgParts.push(
      `<g clip-path="url(#sidebar-clip)">`,
      `<rect x="0" y="${headerHeight}" width="${viewport.sidebarWidth}" height="${milestoneRowHeight}" fill="#fffbeb" stroke="#e2e8f0"/>`,
      `<text x="${sidebarColumns.name.x}" y="${headerHeight + 30}" font-size="12" font-weight="600" fill="#92400e">マイルストーン</text>`,
      `<circle cx="${viewport.sidebarWidth - 20}" cy="${headerHeight + milestoneRowHeight / 2}" r="4" fill="#f59e0b"/>`,
      `</g>`,
    );

    timelineCells.forEach((cell, index) => {
      const x = timelineOriginX + index * viewport.dayWidth;
      const cellBg = cell.isNonWorking ? "#fef2f2" : "#ffffff";
      svgParts.push(
        `<rect x="${x}" y="${headerHeight}" width="${viewport.dayWidth}" height="${milestoneRowHeight}" fill="${cellBg}" stroke="#dbeafe"/>`,
      );
    });

    exportMilestones.forEach((task, index) => {
      const layout = milestoneLayouts[index];
      if (!layout) {
        return;
      }
      const offset = milestoneOffsets.get(index) ?? { x: 0, y: 0 };
      const labelX = timelineOriginX + Math.max(4, layout.x + offset.x);
      const labelY = headerHeight + milestoneLaneTop + offset.y;
      svgParts.push(
        `<g transform="translate(${labelX}, ${labelY})" clip-path="url(#timeline-task-clip)">`,
        `<rect width="110" height="26" rx="6" fill="#fffbeb" stroke="#7dd3fc" stroke-width="1.5"/>`,
        `<text x="9" y="17" font-size="11" font-weight="700" fill="#92400e">▼ ${escapeXml(truncateLabel(task.name, 12))}</text>`,
        `</g>`,
      );
    });
  }

  timelineCells.forEach((cell, index) => {
    const x = timelineOriginX + index * viewport.dayWidth;
    const cellBg = cell.isNonWorking ? "#fef2f2" : "#ffffff";
    svgParts.push(
      `<rect x="${x}" y="${taskAreaTop}" width="${viewport.dayWidth}" height="${taskAreaHeight}" fill="${cellBg}" stroke="#dbeafe"/>`,
    );
  });

  exportTasks.forEach((task, index) => {
    const rowY = taskAreaTop + index * viewport.rowHeight;
    const layout = taskLayouts[index];
    svgParts.push(
      `<g clip-path="url(#sidebar-clip)">`,
      `<rect x="0" y="${rowY}" width="${viewport.sidebarWidth}" height="${viewport.rowHeight}" fill="#ffffff" stroke="#e2e8f0"/>`,
      `<text x="${sidebarColumns.no.x + sidebarColumns.no.width}" y="${rowY + 29}" text-anchor="end" font-size="12" fill="#94a3b8">${taskNumbers.get(task.id) ?? index + 1}</text>`,
      `<text x="${sidebarColumns.name.x + task.depth * 14}" y="${rowY + 29}" font-size="12" font-weight="600" fill="#0f172a">${escapeXml(truncateLabel(task.name, 18))}</text>`,
    );

    if (columns.owner) {
      svgParts.push(
        `<text x="${sidebarColumns.owner.x}" y="${rowY + 29}" font-size="12" fill="#64748b">${escapeXml(truncateLabel(task.owner, 10))}</text>`,
      );
    }
    if (columns.startDate) {
      svgParts.push(
        `<text x="${sidebarColumns.startDate.x}" y="${rowY + 29}" font-size="12" fill="#64748b">${escapeXml(formatSlashDate(task.startDate))}</text>`,
      );
    }
    if (columns.endDate) {
      svgParts.push(
        `<text x="${sidebarColumns.endDate.x}" y="${rowY + 29}" font-size="12" fill="#64748b">${escapeXml(formatSlashDate(task.endDate))}</text>`,
      );
    }
    if (columns.progress) {
      svgParts.push(
        `<text x="${sidebarColumns.progress.x + sidebarColumns.progress.width}" y="${rowY + 29}" text-anchor="end" font-size="12" fill="#64748b">${task.progress}%</text>`,
      );
    }

    svgParts.push(
      `<text x="${sidebarColumns.effort.x + sidebarColumns.effort.width - 12}" y="${rowY + 29}" text-anchor="end" font-size="12" fill="#64748b">${getTaskEffortInDays(task, holidays, excludeNonWorkingDays)}日</text>`,
      `<circle cx="${sidebarColumns.status.x + sidebarColumns.status.width / 2}" cy="${rowY + viewport.rowHeight / 2}" r="4" fill="${task.status === "done" ? "#22c55e" : task.status === "blocked" ? "#475569" : "#06b6d4"}"/>`,
      `</g>`,
      `<line x1="${timelineOriginX}" y1="${rowY}" x2="${timelineOriginX + timelineWidth}" y2="${rowY}" stroke="#dbeafe"/>`,
    );

    if (!layout) {
      return;
    }

    const barX = timelineOriginX + layout.x;
    const barY = rowY + 8;
    const barWidth = layout.width;
    const barHeight = viewport.rowHeight - 16;
    const progressWidth = Math.max(
      8,
      barWidth * getTaskProgressRatio(task, holidays, excludeNonWorkingDays),
    );
    const baseFill = task.status === "done" ? "#dcfce7" : "#ffffff";
    const progressFill = task.status === "done" ? "#34d399" : "#06b6d4";
    svgParts.push(
      `<rect x="${barX}" y="${barY}" width="${barWidth}" height="${barHeight}" rx="6" fill="${baseFill}" stroke="#7dd3fc" stroke-width="1.5"/>`,
      `<text x="${barX + 10}" y="${barY + 18}" font-size="11" font-weight="700" fill="#0f172a">${escapeXml(truncateLabel(task.name, 16))}</text>`,
      `<rect x="${barX + 8}" y="${barY + barHeight - 10}" width="${Math.max(barWidth - 16, 8)}" height="4" rx="2" fill="#e2e8f0"/>`,
      `<rect x="${barX + 8}" y="${barY + barHeight - 10}" width="${Math.min(Math.max(progressWidth - 16, 8), Math.max(barWidth - 16, 8))}" height="4" rx="2" fill="${progressFill}"/>`,
      `<text x="${barX + barWidth - 8}" y="${barY + 18}" text-anchor="end" font-size="11" fill="#64748b">${task.progress}%</text>`,
    );
  });

  if (taskAreaHeight > 0) {
    const taskBottomY = taskAreaTop + taskAreaHeight;
    svgParts.push(
      `<line x1="${timelineOriginX}" y1="${taskBottomY}" x2="${timelineOriginX + timelineWidth}" y2="${taskBottomY}" stroke="#dbeafe"/>`,
    );
  }

  exportDependencies.forEach((dependency) => {
    const fromLayout = layoutMap.get(dependency.fromTaskId);
    const toLayout = layoutMap.get(dependency.toTaskId);
    if (!fromLayout || !toLayout) {
      return;
    }

    const route = getDependencyRoute(fromLayout, toLayout);
    svgParts.push(
      `<g transform="translate(${timelineOriginX}, ${taskAreaTop})">`,
      `<path d="${route.path}" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`,
      `<polygon points="${route.arrowPoints}" fill="#94a3b8"/>`,
      `</g>`,
    );
  });

  if (baselineX !== null && baselineDate) {
    svgParts.push(
      `<g transform="translate(${timelineOriginX}, ${taskAreaTop})">`,
      `<line x1="${baselineX}" x2="${baselineX}" y1="0" y2="${Math.max(taskAreaHeight, viewport.rowHeight)}" stroke="#ef4444" stroke-width="2" stroke-dasharray="5 4" opacity="0.9"/>`,
    );

    if (inazumaPoints.length > 0) {
      const polylinePoints = inazumaPoints.map((point) => `${point.x},${point.y}`).join(" ");
      svgParts.push(
        `<polyline points="${polylinePoints}" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`,
      );
      inazumaPoints.forEach((point) => {
        svgParts.push(
          `<circle cx="${point.x}" cy="${point.y}" r="3.5" fill="${point.isDelayed ? "#ef4444" : "#f97316"}" stroke="#ffffff" stroke-width="1.5"/>`,
        );
      });
    }

    svgParts.push(`</g>`);

    const badgeWidth = 142;
    const badgeX = totalWidth - badgeWidth - 16;
    const badgeY = taskAreaTop + 8;
    svgParts.push(
      `<g transform="translate(${badgeX}, ${badgeY})">`,
      `<rect width="${badgeWidth}" height="24" rx="12" fill="#ffffff" stroke="#fecaca"/>`,
      `<text x="${badgeWidth / 2}" y="16" text-anchor="middle" font-size="11" font-weight="600" fill="#dc2626">遅れタスク ${delayedCount}件</text>`,
      `</g>`,
    );
  }

  svgParts.push(`</svg>`);

  const safeProjectName = projectName.replace(/[\\/:*?"<>|]/g, "_");
  const filename = `${safeProjectName}_v${projectVersion}_${periodStartDate}_${periodEndDate}.svg`;
  downloadSvg(filename, svgParts.join(""));
}
