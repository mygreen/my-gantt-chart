package com.gh.mygreen.mygantt.dto;

import java.time.LocalDate;

public record SaveTaskRequest(
        Long id,
        String name,
        String owner,
        LocalDate startDate,
        LocalDate endDate,
        int progress,
        String status,
        Long parentTaskId,
        String type
) {
}

