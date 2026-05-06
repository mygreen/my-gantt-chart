package com.gh.mygreen.mygantt.dto;

import com.gh.mygreen.mygantt.entity.ProjectSettingsEntity;

public record ProjectSummaryDto(
        Long id,
        String name,
        int version
) {
    public static ProjectSummaryDto fromEntity(ProjectSettingsEntity entity) {
        return new ProjectSummaryDto(entity.getId(), entity.getProjectName(), entity.getVersion());
    }
}

