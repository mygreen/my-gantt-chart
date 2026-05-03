package com.example.gantt.dto;

public record DependencyDto(
        Long id,
        Long fromTaskId,
        Long toTaskId
) {
    public static DependencyDto fromEntity(com.example.gantt.entity.DependencyEntity entity) {
        return new DependencyDto(entity.getId(), entity.getFromTaskId(), entity.getToTaskId());
    }
}
