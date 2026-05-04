package com.example.gantt.dto;

import com.example.gantt.entity.ProjectVersionEntity;

import java.time.LocalDateTime;

public record ProjectVersionSummaryDto(
        int version,
        LocalDateTime savedAt,
        String note
) {
    public static ProjectVersionSummaryDto fromEntity(ProjectVersionEntity entity) {
        return new ProjectVersionSummaryDto(entity.getVersion(), entity.getSavedAt(), entity.getNote());
    }
}
