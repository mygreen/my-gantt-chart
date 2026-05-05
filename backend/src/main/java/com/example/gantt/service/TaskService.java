package com.example.gantt.service;

import com.example.gantt.dto.CreateProjectRequest;
import com.example.gantt.dto.CreateTaskRequest;
import com.example.gantt.dto.DependencyDto;
import com.example.gantt.dto.GanttResponseDto;
import com.example.gantt.dto.HolidayDto;
import com.example.gantt.dto.MemberDto;
import com.example.gantt.dto.ProjectSummaryDto;
import com.example.gantt.dto.ProjectVersionSummaryDto;
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
import com.example.gantt.entity.ProjectVersionEntity;
import com.example.gantt.entity.TaskEntity;
import com.example.gantt.entity.TaskStatus;
import com.example.gantt.entity.TaskType;
import com.example.gantt.repository.DependencyRepository;
import com.example.gantt.repository.HolidayRepository;
import com.example.gantt.repository.MemberRepository;
import com.example.gantt.repository.ProjectSettingsRepository;
import com.example.gantt.repository.ProjectVersionRepository;
import com.example.gantt.repository.TaskRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.transaction.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
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

    private static final Long DEFAULT_PROJECT_ID = 1L;

    private final TaskRepository taskRepository;
    private final DependencyRepository dependencyRepository;
    private final HolidayRepository holidayRepository;
    private final MemberRepository memberRepository;
    private final ProjectSettingsRepository projectSettingsRepository;
    private final ProjectVersionRepository projectVersionRepository;
    private final ObjectMapper objectMapper;

    public TaskService(
            TaskRepository taskRepository,
            DependencyRepository dependencyRepository,
            HolidayRepository holidayRepository,
            MemberRepository memberRepository,
            ProjectSettingsRepository projectSettingsRepository,
            ProjectVersionRepository projectVersionRepository,
            ObjectMapper objectMapper
    ) {
        this.taskRepository = taskRepository;
        this.dependencyRepository = dependencyRepository;
        this.holidayRepository = holidayRepository;
        this.memberRepository = memberRepository;
        this.projectSettingsRepository = projectSettingsRepository;
        this.projectVersionRepository = projectVersionRepository;
        this.objectMapper = objectMapper;
    }

    public List<ProjectSummaryDto> getProjects() {
        return projectSettingsRepository.findAllByOrderByIdAsc().stream()
                .map(ProjectSummaryDto::fromEntity)
                .toList();
    }

    public GanttResponseDto getGanttBoard(Long projectId) {
        ProjectSettingsEntity projectSettings = getProjectSettings(projectId);

        List<TaskDto> tasks = taskRepository.findAllByProjectIdOrderByDisplayOrderAscIdAsc(projectId).stream()
                .map(TaskDto::fromEntity)
                .toList();
        List<DependencyDto> dependencies = dependencyRepository.findAllByProjectIdOrderByIdAsc(projectId).stream()
                .map(DependencyDto::fromEntity)
                .toList();
        List<HolidayDto> holidays = holidayRepository.findAllByProjectIdOrderByDateAsc(projectId).stream()
                .map(HolidayDto::fromEntity)
                .toList();
        List<MemberDto> members = memberRepository.findAllByProjectIdOrderByDisplayOrderAscIdAsc(projectId).stream()
                .map(MemberDto::fromEntity)
                .toList();

        return new GanttResponseDto(
                projectSettings.getId(),
                projectSettings.getProjectName(),
                projectSettings.getVersion(),
                projectSettings.getProjectStartDate(),
                projectSettings.getProjectEndDate(),
                projectSettings.isExcludeNonWorkingDays(),
                members,
                tasks,
                dependencies,
                holidays
        );
    }

    public GanttResponseDto saveGanttBoard(Long projectId, SaveGanttRequest request) {
        return saveGanttBoard(projectId, request, null);
    }

    public List<ProjectVersionSummaryDto> getProjectVersions(Long projectId) {
        ensureProjectExists(projectId);
        return projectVersionRepository.findAllByProjectIdOrderByVersionDesc(projectId).stream()
                .map(ProjectVersionSummaryDto::fromEntity)
                .toList();
    }

    public GanttResponseDto restoreProjectVersion(Long projectId, int version) {
        ensureProjectExists(projectId);
        ProjectVersionEntity projectVersion = projectVersionRepository.findByProjectIdAndVersion(projectId, version)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Version not found"));

        try {
            SaveGanttRequest snapshot = objectMapper.readValue(projectVersion.getSnapshotJson(), SaveGanttRequest.class);
            return saveGanttBoard(projectId, snapshot, "v" + version + "から復元しました。");
        } catch (JsonProcessingException exception) {
            throw new ResponseStatusException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "Failed to restore version snapshot",
                    exception
            );
        }
    }

    public ProjectSummaryDto createProject(CreateProjectRequest request) {
        Long nextProjectId = projectSettingsRepository.findAllByOrderByIdAsc().stream()
                .map(ProjectSettingsEntity::getId)
                .max(Long::compareTo)
                .orElse(0L) + 1L;

        ProjectSettingsEntity sourceSettings = request.sourceProjectId() == null
                ? null
                : getProjectSettings(request.sourceProjectId());

        String projectName = request.name() == null || request.name().isBlank()
                ? "新規プロジェクト"
                : request.name().trim();

        LocalDate startDate = request.copyBasicSettings() && sourceSettings != null
                ? sourceSettings.getProjectStartDate()
                : LocalDate.now();
        LocalDate endDate = request.copyBasicSettings() && sourceSettings != null
                ? sourceSettings.getProjectEndDate()
                : LocalDate.now().plusDays(14);
        boolean excludeNonWorkingDays = request.copyBasicSettings() && sourceSettings != null
                && sourceSettings.isExcludeNonWorkingDays();

        ProjectSettingsEntity project = projectSettingsRepository.save(new ProjectSettingsEntity(
                nextProjectId,
                projectName,
                startDate,
                endDate,
                excludeNonWorkingDays,
                1
        ));

        if (sourceSettings != null) {
            copyProjectContents(project.getId(), sourceSettings.getId(), request);
        }

        GanttResponseDto response = getGanttBoard(project.getId());
        saveProjectVersionSnapshot(project.getId(), response, toSaveRequest(response), null);
        return ProjectSummaryDto.fromEntity(project);
    }

    public void deleteProject(Long projectId) {
        ensureProjectExists(projectId);

        if (projectSettingsRepository.count() <= 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "At least one project is required");
        }

        dependencyRepository.deleteAllByProjectId(projectId);
        taskRepository.deleteAll(taskRepository.findAllByProjectIdOrderByDisplayOrderAscIdAsc(projectId));
        holidayRepository.deleteAllByProjectId(projectId);
        memberRepository.deleteAllByProjectId(projectId);
        projectVersionRepository.deleteAllByProjectId(projectId);
        projectSettingsRepository.deleteById(projectId);
    }

    public TaskDto createTask(Long projectId, CreateTaskRequest request) {
        ensureProjectExists(projectId);

        int nextOrder = taskRepository.findAllByProjectIdOrderByDisplayOrderAscIdAsc(projectId).stream()
                .map(TaskEntity::getDisplayOrder)
                .max(Integer::compareTo)
                .orElse(-1) + 1;

        TaskEntity entity = new TaskEntity(
                projectId,
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

    private void copyProjectContents(Long targetProjectId, Long sourceProjectId, CreateProjectRequest request) {
        if (request.copyMembers()) {
            List<MemberEntity> sourceMembers = memberRepository.findAllByProjectIdOrderByDisplayOrderAscIdAsc(sourceProjectId);
            memberRepository.saveAll(sourceMembers.stream()
                    .map(member -> new MemberEntity(targetProjectId, member.getName(), member.getDisplayOrder()))
                    .toList());
        }

        if (request.copyHolidays()) {
            List<HolidayEntity> sourceHolidays = holidayRepository.findAllByProjectIdOrderByDateAsc(sourceProjectId);
            holidayRepository.saveAll(sourceHolidays.stream()
                    .map(holiday -> new HolidayEntity(targetProjectId, holiday.getDate(), holiday.getName()))
                    .toList());
        }

        if (!request.copyTasks()) {
            return;
        }

        List<TaskEntity> sourceTasks = taskRepository.findAllByProjectIdOrderByDisplayOrderAscIdAsc(sourceProjectId);
        Map<Long, Long> taskIdMapping = new HashMap<>();
        List<TaskEntity> copiedTasks = new ArrayList<>();

        for (TaskEntity sourceTask : sourceTasks) {
            TaskEntity copiedTask = taskRepository.save(new TaskEntity(
                    targetProjectId,
                    sourceTask.getName(),
                    sourceTask.getOwner(),
                    sourceTask.getStartDate(),
                    sourceTask.getEndDate(),
                    0,
                    TaskStatus.TODO,
                    null,
                    sourceTask.getTaskType(),
                    sourceTask.getDisplayOrder()
            ));
            taskIdMapping.put(sourceTask.getId(), copiedTask.getId());
            copiedTasks.add(copiedTask);
        }

        for (int index = 0; index < sourceTasks.size(); index += 1) {
            TaskEntity sourceTask = sourceTasks.get(index);
            TaskEntity copiedTask = copiedTasks.get(index);
            Long copiedParentTaskId = sourceTask.getParentTaskId() == null
                    ? null
                    : taskIdMapping.get(sourceTask.getParentTaskId());
            copiedTask.updateParentTaskId(copiedParentTaskId);
        }
        taskRepository.saveAll(copiedTasks);

        if (!request.copyDependencies()) {
            return;
        }

        List<DependencyEntity> sourceDependencies = dependencyRepository.findAllByProjectIdOrderByIdAsc(sourceProjectId);
        dependencyRepository.saveAll(sourceDependencies.stream()
                .map(dependency -> new DependencyEntity(
                        targetProjectId,
                        taskIdMapping.get(dependency.getFromTaskId()),
                        taskIdMapping.get(dependency.getToTaskId())
                ))
                .filter(dependency -> dependency.getFromTaskId() != null && dependency.getToTaskId() != null)
                .toList());
    }

    private GanttResponseDto saveGanttBoard(Long projectId, SaveGanttRequest request, String versionNote) {
        ProjectSettingsEntity settings = saveProjectSettings(projectId, request);

        Map<Long, TaskEntity> existingTasks = taskRepository.findAllByProjectIdOrderByDisplayOrderAscIdAsc(projectId).stream()
                .collect(Collectors.toMap(TaskEntity::getId, task -> task));
        Map<Long, Long> requestTaskIdToEntityId = new HashMap<>();
        List<TaskEntity> savedTasks = new ArrayList<>();

        int displayOrder = 0;
        for (SaveTaskRequest taskRequest : request.tasks()) {
            TaskEntity taskEntity = taskRequest.id() != null ? existingTasks.get(taskRequest.id()) : null;
            if (taskEntity == null) {
                taskEntity = new TaskEntity(
                        projectId,
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
                        projectId,
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
            if (taskRequest.id() != null) {
                requestTaskIdToEntityId.put(taskRequest.id(), persistedTask.getId());
            }
            displayOrder += 1;
        }

        Set<Long> retainedIds = savedTasks.stream().map(TaskEntity::getId).collect(Collectors.toSet());
        List<Long> removedTaskIds = existingTasks.keySet().stream()
                .filter(taskId -> !retainedIds.contains(taskId))
                .toList();

        dependencyRepository.deleteAllByProjectId(projectId);

        if (!removedTaskIds.isEmpty()) {
            taskRepository.deleteAllById(removedTaskIds);
        }

        Map<Long, SaveTaskRequest> taskRequestByPersistedId = new HashMap<>();
        for (int index = 0; index < request.tasks().size() && index < savedTasks.size(); index += 1) {
            taskRequestByPersistedId.put(savedTasks.get(index).getId(), request.tasks().get(index));
        }

        for (TaskEntity savedTask : savedTasks) {
            SaveTaskRequest taskRequest = taskRequestByPersistedId.get(savedTask.getId());
            if (taskRequest == null) {
                continue;
            }

            Long mappedParentTaskId = taskRequest.parentTaskId() == null
                    ? null
                    : requestTaskIdToEntityId.get(taskRequest.parentTaskId());
            savedTask.updateParentTaskId(mappedParentTaskId);
        }
        taskRepository.saveAll(savedTasks);

        dependencyRepository.saveAll(request.dependencies().stream()
                .map(dependency -> mapDependency(projectId, dependency, requestTaskIdToEntityId))
                .filter(dependency -> dependency.getFromTaskId() != null && dependency.getToTaskId() != null)
                .toList());

        holidayRepository.deleteAllByProjectId(projectId);
        Map<LocalDate, SaveHolidayRequest> holidaysByDate = new LinkedHashMap<>();
        for (SaveHolidayRequest holiday : request.holidays()) {
            holidaysByDate.put(holiday.date(), holiday);
        }
        holidayRepository.saveAll(holidaysByDate.values().stream()
                .map(holiday -> new HolidayEntity(projectId, holiday.date(), holiday.name()))
                .toList());

        memberRepository.deleteAllByProjectId(projectId);
        List<SaveMemberRequest> memberRequests = buildMemberRequests(request);
        List<MemberEntity> memberEntities = new ArrayList<>();
        for (int index = 0; index < memberRequests.size(); index += 1) {
            memberEntities.add(new MemberEntity(projectId, memberRequests.get(index).name(), index));
        }
        memberRepository.saveAll(memberEntities);

        GanttResponseDto response = new GanttResponseDto(
                settings.getId(),
                settings.getProjectName(),
                settings.getVersion(),
                settings.getProjectStartDate(),
                settings.getProjectEndDate(),
                settings.isExcludeNonWorkingDays(),
                memberEntities.stream()
                        .sorted(Comparator.comparing(MemberEntity::getDisplayOrder))
                        .map(MemberDto::fromEntity)
                        .toList(),
                savedTasks.stream()
                        .sorted(Comparator.comparing(TaskEntity::getDisplayOrder).thenComparing(TaskEntity::getId))
                        .map(TaskDto::fromEntity)
                        .toList(),
                dependencyRepository.findAllByProjectIdOrderByIdAsc(projectId).stream()
                        .map(DependencyDto::fromEntity)
                        .toList(),
                holidayRepository.findAllByProjectIdOrderByDateAsc(projectId).stream()
                        .map(HolidayDto::fromEntity)
                        .toList()
        );
        saveProjectVersionSnapshot(projectId, response, request, versionNote);
        return response;
    }

    private ProjectSettingsEntity saveProjectSettings(Long projectId, SaveGanttRequest request) {
        ProjectSettingsEntity settings = getProjectSettings(projectId);
        settings.update(
                request.projectName(),
                request.projectStartDate(),
                request.projectEndDate(),
                request.excludeNonWorkingDays()
        );
        settings.incrementVersion();
        return projectSettingsRepository.save(settings);
    }

    private ProjectSettingsEntity getProjectSettings(Long projectId) {
        Long normalizedProjectId = projectId == null ? DEFAULT_PROJECT_ID : projectId;
        return projectSettingsRepository.findById(normalizedProjectId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Project not found"));
    }

    private void ensureProjectExists(Long projectId) {
        getProjectSettings(projectId);
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
            Long projectId,
            SaveDependencyRequest dependency,
            Map<Long, Long> requestTaskIdToEntityId
    ) {
        Long fromTaskId = requestTaskIdToEntityId.getOrDefault(dependency.fromTaskId(), dependency.fromTaskId());
        Long toTaskId = requestTaskIdToEntityId.getOrDefault(dependency.toTaskId(), dependency.toTaskId());
        return new DependencyEntity(projectId, fromTaskId, toTaskId);
    }

    private List<SaveMemberRequest> buildMemberRequests(SaveGanttRequest request) {
        return request.members().stream()
                .filter(member -> member.name() != null && !member.name().isBlank())
                .toList();
    }

    private void saveProjectVersionSnapshot(
            Long projectId,
            GanttResponseDto response,
            SaveGanttRequest request,
            String versionNote
    ) {
        SaveGanttRequest snapshot = new SaveGanttRequest(
                response.projectName(),
                response.version(),
                response.projectStartDate(),
                response.projectEndDate(),
                response.excludeNonWorkingDays(),
                request.members(),
                request.tasks(),
                request.dependencies(),
                request.holidays()
        );

        try {
            String snapshotJson = objectMapper.writeValueAsString(snapshot);
            projectVersionRepository.save(
                    new ProjectVersionEntity(
                            projectId,
                            response.version(),
                            LocalDateTime.now(),
                            snapshotJson,
                            versionNote
                    )
            );
        } catch (JsonProcessingException exception) {
            throw new ResponseStatusException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "Failed to save version snapshot",
                    exception
            );
        }
    }

    private SaveGanttRequest toSaveRequest(GanttResponseDto response) {
        return new SaveGanttRequest(
                response.projectName(),
                response.version(),
                response.projectStartDate(),
                response.projectEndDate(),
                response.excludeNonWorkingDays(),
                response.members().stream()
                        .map(member -> new SaveMemberRequest(member.id(), member.name()))
                        .toList(),
                response.tasks().stream()
                        .map(task -> new SaveTaskRequest(
                                task.id(),
                                task.name(),
                                task.owner(),
                                task.startDate(),
                                task.endDate(),
                                task.progress(),
                                task.status(),
                                task.parentTaskId(),
                                task.type()
                        ))
                        .toList(),
                response.dependencies().stream()
                        .map(dependency -> new SaveDependencyRequest(
                                dependency.id(),
                                dependency.fromTaskId(),
                                dependency.toTaskId()
                        ))
                        .toList(),
                response.holidays().stream()
                        .map(holiday -> new SaveHolidayRequest(holiday.id(), holiday.date(), holiday.name()))
                        .toList()
        );
    }

}
