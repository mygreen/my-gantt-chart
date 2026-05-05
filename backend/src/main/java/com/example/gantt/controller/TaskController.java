package com.example.gantt.controller;

import com.example.gantt.dto.CreateProjectRequest;
import com.example.gantt.dto.CreateTaskRequest;
import com.example.gantt.dto.GanttResponseDto;
import com.example.gantt.dto.HolidayDto;
import com.example.gantt.dto.ProjectSummaryDto;
import com.example.gantt.dto.ProjectVersionSummaryDto;
import com.example.gantt.dto.SaveGanttRequest;
import com.example.gantt.dto.SaveHolidayRequest;
import com.example.gantt.dto.TaskDto;
import com.example.gantt.service.TaskService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api")
public class TaskController {

    private final TaskService taskService;

    public TaskController(TaskService taskService) {
        this.taskService = taskService;
    }

    @GetMapping("/projects")
    public List<ProjectSummaryDto> getProjects() {
        return taskService.getProjects();
    }

    @PostMapping("/projects")
    @ResponseStatus(HttpStatus.CREATED)
    public ProjectSummaryDto createProject(@RequestBody CreateProjectRequest request) {
        return taskService.createProject(request);
    }

    @DeleteMapping("/projects/{projectId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteProject(@PathVariable Long projectId) {
        taskService.deleteProject(projectId);
    }

    @GetMapping("/system/holidays")
    public List<HolidayDto> getSystemHolidays() {
        return taskService.getSystemHolidays();
    }

    @PutMapping("/system/holidays")
    public List<HolidayDto> saveSystemHolidays(@RequestBody List<SaveHolidayRequest> request) {
        return taskService.saveSystemHolidays(request);
    }

    @GetMapping("/tasks")
    public GanttResponseDto getTasks(@RequestParam(required = false) Long projectId) {
        return taskService.getGanttBoard(projectId);
    }

    @PutMapping("/tasks")
    public GanttResponseDto saveTasks(
            @RequestParam(required = false) Long projectId,
            @Valid @RequestBody SaveGanttRequest request
    ) {
        return taskService.saveGanttBoard(projectId, request);
    }

    @GetMapping("/tasks/versions")
    public List<ProjectVersionSummaryDto> getVersions(@RequestParam(required = false) Long projectId) {
        return taskService.getProjectVersions(projectId == null ? 1L : projectId);
    }

    @PostMapping("/tasks/versions/{version}/restore")
    public GanttResponseDto restoreVersion(
            @PathVariable int version,
            @RequestParam(required = false) Long projectId
    ) {
        return taskService.restoreProjectVersion(projectId == null ? 1L : projectId, version);
    }

    @PostMapping("/tasks")
    @ResponseStatus(HttpStatus.CREATED)
    public TaskDto createTask(
            @RequestParam(required = false) Long projectId,
            @Valid @RequestBody CreateTaskRequest request
    ) {
        return taskService.createTask(projectId == null ? 1L : projectId, request);
    }
}
