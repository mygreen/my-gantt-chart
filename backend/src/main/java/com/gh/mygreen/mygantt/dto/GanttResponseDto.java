package com.gh.mygreen.mygantt.dto;

import java.time.LocalDate;
import java.util.List;

public record GanttResponseDto(
        Long projectId,
        String projectName,
        int version,
        LocalDate projectStartDate,
        LocalDate projectEndDate,
        boolean excludeNonWorkingDays,
        List<MemberDto> members,
        List<TaskDto> tasks,
        List<DependencyDto> dependencies,
        List<HolidayDto> holidays,
        List<HolidayDto> projectHolidays,
        List<HolidayDto> systemHolidays
) {
}

