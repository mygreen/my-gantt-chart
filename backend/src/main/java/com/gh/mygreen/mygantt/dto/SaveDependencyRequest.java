package com.gh.mygreen.mygantt.dto;

public record SaveDependencyRequest(
        Long id,
        Long fromTaskId,
        Long toTaskId
) {
}

