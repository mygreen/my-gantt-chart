package com.example.gantt.dto;

import java.util.List;

public record GanttResponseDto(
        List<TaskDto> tasks,
        List<DependencyDto> dependencies,
        List<HolidayDto> holidays
) {
}
