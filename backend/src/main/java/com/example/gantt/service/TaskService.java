package com.example.gantt.service;

import com.example.gantt.dto.CreateTaskRequest;
import com.example.gantt.dto.DependencyDto;
import com.example.gantt.dto.GanttResponseDto;
import com.example.gantt.dto.HolidayDto;
import com.example.gantt.dto.TaskDto;
import com.example.gantt.entity.TaskEntity;
import com.example.gantt.entity.TaskStatus;
import com.example.gantt.repository.DependencyRepository;
import com.example.gantt.repository.HolidayRepository;
import com.example.gantt.repository.TaskRepository;
import jakarta.transaction.Transactional;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.List;
import java.util.Locale;

@Service
@Transactional
public class TaskService {

    private final TaskRepository taskRepository;
    private final DependencyRepository dependencyRepository;
    private final HolidayRepository holidayRepository;

    public TaskService(
            TaskRepository taskRepository,
            DependencyRepository dependencyRepository,
            HolidayRepository holidayRepository
    ) {
        this.taskRepository = taskRepository;
        this.dependencyRepository = dependencyRepository;
        this.holidayRepository = holidayRepository;
    }

    @Transactional
    public GanttResponseDto getGanttBoard() {
        List<TaskDto> tasks = taskRepository.findAll().stream()
                .sorted(Comparator.comparing(TaskEntity::getStartDate).thenComparing(TaskEntity::getId))
                .map(TaskDto::fromEntity)
                .toList();
        List<DependencyDto> dependencies = dependencyRepository.findAll().stream()
                .map(DependencyDto::fromEntity)
                .toList();
        List<HolidayDto> holidays = holidayRepository.findAll().stream()
                .map(HolidayDto::fromEntity)
                .toList();

        return new GanttResponseDto(tasks, dependencies, holidays);
    }

    public TaskDto createTask(CreateTaskRequest request) {
        TaskEntity entity = new TaskEntity(
                request.name(),
                request.owner(),
                request.startDate(),
                request.endDate(),
                request.progress(),
                TaskStatus.valueOf(request.status().toUpperCase(Locale.ROOT))
        );

        return TaskDto.fromEntity(taskRepository.save(entity));
    }
}
