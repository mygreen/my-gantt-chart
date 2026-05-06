package com.gh.mygreen.mygantt.dto;

import com.gh.mygreen.mygantt.entity.ProjectVersionEntity;

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

