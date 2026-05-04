package com.example.gantt.service;

import com.example.gantt.dto.CreateTaskRequest;
import com.example.gantt.dto.DependencyDto;
import com.example.gantt.dto.GanttResponseDto;
import com.example.gantt.dto.HolidayDto;
import com.example.gantt.dto.MemberDto;
import com.example.gantt.dto.SaveDependencyRequest;
import com.example.gantt.dto.SaveGanttRequest;
import com.example.gantt.dto.SaveHolidayRequest;
import com.example.gantt.dto.SaveMemberRequest;
import com.example.gantt.dto.SaveTaskRequest;
import com.example.gantt.dto.TaskDto;
import com.example.gantt.entity.DependencyEntity;
import com.example.gantt.entity.HolidayEntity;
import com.example.gantt.entity.MemberEntity;
import com.example.gantt.entity.ProjectSettingsEntity;
import com.example.gantt.entity.TaskEntity;
import com.example.gantt.entity.TaskStatus;
import com.example.gantt.entity.TaskType;
import com.example.gantt.repository.DependencyRepository;
import com.example.gantt.repository.HolidayRepository;
import com.example.gantt.repository.MemberRepository;
import com.example.gantt.repository.ProjectSettingsRepository;
import com.example.gantt.repository.TaskRepository;
import jakarta.transaction.Transactional;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@Transactional
public class TaskService {

    private static final Long PROJECT_SETTINGS_ID = 1L;

    private final TaskRepository taskRepository;
    private final DependencyRepository dependencyRepository;
    private final HolidayRepository holidayRepository;
    private final MemberRepository memberRepository;
    private final ProjectSettingsRepository projectSettingsRepository;

    public TaskService(
            TaskRepository taskRepository,
            DependencyRepository dependencyRepository,
            HolidayRepository holidayRepository,
            MemberRepository memberRepository,
            ProjectSettingsRepository projectSettingsRepository
    ) {
        this.taskRepository = taskRepository;
        this.dependencyRepository = dependencyRepository;
        this.holidayRepository = holidayRepository;
        this.memberRepository = memberRepository;
        this.projectSettingsRepository = projectSettingsRepository;
    }

    @Transactional
    public GanttResponseDto getGanttBoard() {
        ProjectSettingsEntity projectSettings = getOrCreateProjectSettings();

        List<TaskDto> tasks = taskRepository.findAll().stream()
                .sorted(Comparator.comparing(TaskEntity::getDisplayOrder).thenComparing(TaskEntity::getId))
                .map(TaskDto::fromEntity)
                .toList();
        List<DependencyDto> dependencies = dependencyRepository.findAll().stream()
                .sorted(Comparator.comparing(DependencyEntity::getId))
                .map(DependencyDto::fromEntity)
                .toList();
        List<HolidayDto> holidays = holidayRepository.findAll().stream()
                .sorted(Comparator.comparing(HolidayEntity::getDate))
                .map(HolidayDto::fromEntity)
                .toList();
        List<MemberDto> members = memberRepository.findAll().stream()
                .sorted(Comparator.comparing(MemberEntity::getDisplayOrder).thenComparing(MemberEntity::getId))
                .map(MemberDto::fromEntity)
                .toList();

        return new GanttResponseDto(
                projectSettings.getProjectName(),
                projectSettings.getProjectStartDate(),
                projectSettings.getProjectEndDate(),
                projectSettings.isExcludeNonWorkingDays(),
                members,
                tasks,
                dependencies,
                holidays
        );
    }

    public GanttResponseDto saveGanttBoard(SaveGanttRequest request) {
        saveProjectSettings(request);

        Map<Long, TaskEntity> existingTasks = taskRepository.findAll().stream()
                .collect(Collectors.toMap(TaskEntity::getId, task -> task));
        Map<Long, Long> requestTaskIdToEntityId = new HashMap<>();
        List<TaskEntity> savedTasks = new ArrayList<>();
        int displayOrder = 0;

        for (SaveTaskRequest taskRequest : request.tasks()) {
            TaskEntity taskEntity = taskRequest.id() != null ? existingTasks.get(taskRequest.id()) : null;
            if (taskEntity == null) {
                taskEntity = new TaskEntity(
                        taskRequest.name(),
                        taskRequest.owner(),
                        taskRequest.startDate(),
                        normalizeTaskEndDate(taskRequest),
                        clampProgress(taskRequest.progress()),
                        parseTaskStatus(taskRequest.status()),
                        null,
                        parseTaskType(taskRequest.type()),
                        displayOrder
                );
            } else {
                taskEntity.update(
                        taskRequest.name(),
                        taskRequest.owner(),
                        taskRequest.startDate(),
                        normalizeTaskEndDate(taskRequest),
                        clampProgress(taskRequest.progress()),
                        parseTaskStatus(taskRequest.status()),
                        taskEntity.getParentTaskId(),
                        parseTaskType(taskRequest.type()),
                        displayOrder
                );
            }

            TaskEntity persistedTask = taskRepository.save(taskEntity);
            savedTasks.add(persistedTask);
            requestTaskIdToEntityId.put(taskRequest.id(), persistedTask.getId());
            displayOrder += 1;
        }

        Set<Long> retainedIds = savedTasks.stream()
                .map(TaskEntity::getId)
                .collect(Collectors.toSet());
        List<Long> removedTaskIds = existingTasks.keySet().stream()
                .filter(taskId -> !retainedIds.contains(taskId))
                .toList();

        if (!removedTaskIds.isEmpty()) {
            dependencyRepository.deleteAll(
                    dependencyRepository.findAll().stream()
                            .filter(dependency ->
                                    removedTaskIds.contains(dependency.getFromTaskId())
                                            || removedTaskIds.contains(dependency.getToTaskId()))
                            .toList()
            );
            taskRepository.deleteAllById(removedTaskIds);
        }

        Map<Long, SaveTaskRequest> taskRequestById = request.tasks().stream()
                .filter(task -> task.id() != null)
                .collect(Collectors.toMap(SaveTaskRequest::id, task -> task));

        for (TaskEntity savedTask : savedTasks) {
            SaveTaskRequest taskRequest = taskRequestById.get(savedTask.getId());
            if (taskRequest == null) {
                taskRequest = request.tasks().stream()
                        .filter(candidate -> requestTaskIdToEntityId.get(candidate.id()).equals(savedTask.getId()))
                        .findFirst()
                        .orElse(null);
            }

            if (taskRequest == null) {
                continue;
            }

            Long mappedParentTaskId = taskRequest.parentTaskId() == null
                    ? null
                    : requestTaskIdToEntityId.get(taskRequest.parentTaskId());
            savedTask.updateParentTaskId(mappedParentTaskId);
        }
        taskRepository.saveAll(savedTasks);

        dependencyRepository.deleteAllInBatch();
        List<DependencyEntity> dependencyEntities = request.dependencies().stream()
                .map(dependency -> mapDependency(dependency, requestTaskIdToEntityId))
                .filter(dependency -> dependency.getFromTaskId() != null && dependency.getToTaskId() != null)
                .toList();
        dependencyRepository.saveAll(dependencyEntities);

        holidayRepository.deleteAllInBatch();
        Map<LocalDate, SaveHolidayRequest> holidaysByDate = new LinkedHashMap<>();
        for (SaveHolidayRequest holiday : request.holidays()) {
            holidaysByDate.put(holiday.date(), holiday);
        }
        holidayRepository.saveAll(
                holidaysByDate.values().stream()
                        .map(holiday -> new HolidayEntity(holiday.date(), holiday.name()))
                        .toList()
        );

        memberRepository.deleteAllInBatch();
        List<SaveMemberRequest> memberRequests = buildMemberRequests(request);
        List<MemberEntity> memberEntities = new ArrayList<>();
        for (int index = 0; index < memberRequests.size(); index += 1) {
            memberEntities.add(new MemberEntity(memberRequests.get(index).name(), index));
        }
        memberRepository.saveAll(memberEntities);

        return getGanttBoard();
    }

    public TaskDto createTask(CreateTaskRequest request) {
        int nextOrder = taskRepository.findAll().stream()
                .map(TaskEntity::getDisplayOrder)
                .max(Integer::compareTo)
                .orElse(-1) + 1;

        TaskEntity entity = new TaskEntity(
                request.name(),
                request.owner(),
                request.startDate(),
                request.endDate(),
                request.progress(),
                TaskStatus.valueOf(request.status().toUpperCase(Locale.ROOT)),
                null,
                TaskType.TASK,
                nextOrder
        );

        return TaskDto.fromEntity(taskRepository.save(entity));
    }

    private void saveProjectSettings(SaveGanttRequest request) {
        ProjectSettingsEntity settings = getOrCreateProjectSettings();
        settings.update(
                request.projectName(),
                request.projectStartDate(),
                request.projectEndDate(),
                request.excludeNonWorkingDays()
        );
        projectSettingsRepository.save(settings);
    }

    private ProjectSettingsEntity getOrCreateProjectSettings() {
        return projectSettingsRepository.findById(PROJECT_SETTINGS_ID)
                .orElseGet(() -> projectSettingsRepository.save(new ProjectSettingsEntity(
                        PROJECT_SETTINGS_ID,
                        "チーム進行ガントチャート",
                        LocalDate.now(),
                        LocalDate.now().plusDays(14),
                        false
                )));
    }

    private LocalDate normalizeTaskEndDate(SaveTaskRequest taskRequest) {
        if (parseTaskType(taskRequest.type()) == TaskType.MILESTONE) {
            return taskRequest.startDate();
        }
        if (taskRequest.endDate().isBefore(taskRequest.startDate())) {
            return taskRequest.startDate();
        }
        return taskRequest.endDate();
    }

    private int clampProgress(int progress) {
        return Math.max(0, Math.min(100, progress));
    }

    private TaskStatus parseTaskStatus(String status) {
        return TaskStatus.valueOf((status == null ? "todo" : status).toUpperCase(Locale.ROOT));
    }

    private TaskType parseTaskType(String type) {
        return TaskType.valueOf((type == null ? "task" : type).toUpperCase(Locale.ROOT));
    }

    private DependencyEntity mapDependency(
            SaveDependencyRequest dependency,
            Map<Long, Long> requestTaskIdToEntityId
    ) {
        Long fromTaskId = requestTaskIdToEntityId.get(dependency.fromTaskId());
        Long toTaskId = requestTaskIdToEntityId.get(dependency.toTaskId());
        return new DependencyEntity(fromTaskId, toTaskId);
    }

    private List<SaveMemberRequest> buildMemberRequests(SaveGanttRequest request) {
        return request.members().stream()
                .filter(member -> member.name() != null && !member.name().isBlank())
                .toList();
    }
}
