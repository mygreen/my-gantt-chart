package com.example.gantt.controller;

import com.example.gantt.dto.CreateTaskRequest;
import com.example.gantt.dto.GanttResponseDto;
import com.example.gantt.dto.SaveGanttRequest;
import com.example.gantt.dto.TaskDto;
import com.example.gantt.service.TaskService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/tasks")
@RequiredArgsConstructor
public class GanttBoardController {

    private static final Long DEFAULT_PROJECT_ID = 1L;

    private final TaskService taskService;

    @GetMapping
    public GanttResponseDto getTasks(@RequestParam(required = false) Long projectId) {
        return taskService.getGanttBoard(projectId);
    }

    @PutMapping
    public GanttResponseDto saveTasks(
            @RequestParam(required = false) Long projectId,
            @Valid @RequestBody SaveGanttRequest request
    ) {
        return taskService.saveGanttBoard(projectId, request);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public TaskDto createTask(
            @RequestParam(required = false) Long projectId,
            @Valid @RequestBody CreateTaskRequest request
    ) {
        return taskService.createTask(projectId == null ? DEFAULT_PROJECT_ID : projectId, request);
    }
}
