package com.example.gantt.dto;

import java.time.LocalDate;
import java.util.List;

public record GanttResponseDto(
        String projectName,
        int version,
        LocalDate projectStartDate,
        LocalDate projectEndDate,
        boolean excludeNonWorkingDays,
        List<MemberDto> members,
        List<TaskDto> tasks,
        List<DependencyDto> dependencies,
        List<HolidayDto> holidays
) {
}
