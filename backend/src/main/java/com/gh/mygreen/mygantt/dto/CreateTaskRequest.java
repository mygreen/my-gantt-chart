package com.gh.mygreen.mygantt.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public record CreateTaskRequest(
        @NotBlank String name,
        @NotBlank String owner,
        @NotNull LocalDate startDate,
        @NotNull LocalDate endDate,
        @Min(0) @Max(100) int progress,
        @NotBlank String status
) {
}

