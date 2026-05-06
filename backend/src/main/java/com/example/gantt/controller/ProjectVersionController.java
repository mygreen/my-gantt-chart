package com.example.gantt.controller;

import com.example.gantt.dto.GanttResponseDto;
import com.example.gantt.dto.ProjectVersionSummaryDto;
import com.example.gantt.service.TaskService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/tasks/versions")
@RequiredArgsConstructor
public class ProjectVersionController {

    private static final Long DEFAULT_PROJECT_ID = 1L;

    private final TaskService taskService;

    @GetMapping
    public List<ProjectVersionSummaryDto> getVersions(@RequestParam(required = false) Long projectId) {
        return taskService.getProjectVersions(projectId == null ? DEFAULT_PROJECT_ID : projectId);
    }

    @PostMapping("/{version}/restore")
    public GanttResponseDto restoreVersion(
            @PathVariable int version,
            @RequestParam(required = false) Long projectId
    ) {
        return taskService.restoreProjectVersion(projectId == null ? DEFAULT_PROJECT_ID : projectId, version);
    }
}
