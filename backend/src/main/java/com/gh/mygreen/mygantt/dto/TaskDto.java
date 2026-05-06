package com.gh.mygreen.mygantt.dto;

import java.time.LocalDate;

public record TaskDto(
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
    public static TaskDto fromEntity(com.gh.mygreen.mygantt.entity.TaskEntity entity) {
        return new TaskDto(
                entity.getId(),
                entity.getName(),
                entity.getOwner(),
                entity.getStartDate(),
                entity.getEndDate(),
                entity.getProgress(),
                entity.getStatus().name().toLowerCase(),
                entity.getParentTaskId(),
                entity.getTaskType().name().toLowerCase()
        );
    }
}

