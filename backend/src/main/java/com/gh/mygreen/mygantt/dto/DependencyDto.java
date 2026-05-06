package com.gh.mygreen.mygantt.dto;

public record DependencyDto(
        Long id,
        Long fromTaskId,
        Long toTaskId
) {
    public static DependencyDto fromEntity(com.gh.mygreen.mygantt.entity.DependencyEntity entity) {
        return new DependencyDto(entity.getId(), entity.getFromTaskId(), entity.getToTaskId());
    }
}

