package com.example.gantt.dto;

import java.time.LocalDate;
import java.util.List;

public record SaveGanttRequest(
        String projectName,
        LocalDate projectStartDate,
        LocalDate projectEndDate,
        boolean excludeNonWorkingDays,
        List<SaveMemberRequest> members,
        List<SaveTaskRequest> tasks,
        List<SaveDependencyRequest> dependencies,
        List<SaveHolidayRequest> holidays
) {
}
