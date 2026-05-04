package com.example.gantt.controller;

import com.example.gantt.dto.CreateTaskRequest;
import com.example.gantt.dto.GanttResponseDto;
import com.example.gantt.dto.ProjectVersionSummaryDto;
import com.example.gantt.dto.SaveGanttRequest;
import com.example.gantt.dto.TaskDto;
import com.example.gantt.service.TaskService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/tasks")
public class TaskController {

    private final TaskService taskService;

    public TaskController(TaskService taskService) {
        this.taskService = taskService;
    }

    @GetMapping
    public GanttResponseDto getTasks() {
        return taskService.getGanttBoard();
    }

    @PutMapping
    public GanttResponseDto saveTasks(@Valid @RequestBody SaveGanttRequest request) {
        return taskService.saveGanttBoard(request);
    }

    @GetMapping("/versions")
    public List<ProjectVersionSummaryDto> getVersions() {
        return taskService.getProjectVersions();
    }

    @PostMapping("/versions/{version}/restore")
    public GanttResponseDto restoreVersion(@PathVariable int version) {
        return taskService.restoreProjectVersion(version);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public TaskDto createTask(@Valid @RequestBody CreateTaskRequest request) {
        return taskService.createTask(request);
    }
}
