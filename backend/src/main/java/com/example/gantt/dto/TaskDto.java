package com.example.gantt.dto;

import com.example.gantt.entity.TaskStatus;

import java.time.LocalDate;

public record TaskDto(
        Long id,
        String name,
        String owner,
        LocalDate startDate,
        LocalDate endDate,
        int progress,
        String status
) {
    public static TaskDto fromEntity(com.example.gantt.entity.TaskEntity entity) {
        return new TaskDto(
                entity.getId(),
                entity.getName(),
                entity.getOwner(),
                entity.getStartDate(),
                entity.getEndDate(),
                entity.getProgress(),
                entity.getStatus().name().toLowerCase()
        );
    }
}
