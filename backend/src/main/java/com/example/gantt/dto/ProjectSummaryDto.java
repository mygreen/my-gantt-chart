package com.example.gantt.dto;

import com.example.gantt.entity.ProjectSettingsEntity;

public record ProjectSummaryDto(
        Long id,
        String name,
        int version
) {
    public static ProjectSummaryDto fromEntity(ProjectSettingsEntity entity) {
        return new ProjectSummaryDto(entity.getId(), entity.getProjectName(), entity.getVersion());
    }
}
