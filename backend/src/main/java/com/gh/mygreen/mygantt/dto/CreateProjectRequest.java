package com.gh.mygreen.mygantt.dto;

public record CreateProjectRequest(
        String name,
        Long sourceProjectId,
        boolean copyBasicSettings,
        boolean copyTasks,
        boolean copyDependencies,
        boolean copyHolidays,
        boolean copyMembers
) {
}

