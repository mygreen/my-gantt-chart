package com.example.gantt.dto;

public record SaveDependencyRequest(
        Long id,
        Long fromTaskId,
        Long toTaskId
) {
}
