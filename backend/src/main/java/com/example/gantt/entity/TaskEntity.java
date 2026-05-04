package com.example.gantt.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDate;

@Entity
@Table(name = "tasks")
public class TaskEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String owner;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;

    @Column(nullable = false)
    private int progress;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TaskStatus status;

    @Column(name = "parent_task_id")
    private Long parentTaskId;

    @Enumerated(EnumType.STRING)
    @Column(name = "task_type", nullable = false)
    private TaskType taskType;

    @Column(name = "display_order", nullable = false)
    private int displayOrder;

    protected TaskEntity() {
    }

    public TaskEntity(
            String name,
            String owner,
            LocalDate startDate,
            LocalDate endDate,
            int progress,
            TaskStatus status,
            Long parentTaskId,
            TaskType taskType,
            int displayOrder
    ) {
        this.name = name;
        this.owner = owner;
        this.startDate = startDate;
        this.endDate = endDate;
        this.progress = progress;
        this.status = status;
        this.parentTaskId = parentTaskId;
        this.taskType = taskType;
        this.displayOrder = displayOrder;
    }

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getOwner() {
        return owner;
    }

    public LocalDate getStartDate() {
        return startDate;
    }

    public LocalDate getEndDate() {
        return endDate;
    }

    public int getProgress() {
        return progress;
    }

    public TaskStatus getStatus() {
        return status;
    }

    public Long getParentTaskId() {
        return parentTaskId;
    }

    public TaskType getTaskType() {
        return taskType;
    }

    public int getDisplayOrder() {
        return displayOrder;
    }

    public void update(
            String name,
            String owner,
            LocalDate startDate,
            LocalDate endDate,
            int progress,
            TaskStatus status,
            Long parentTaskId,
            TaskType taskType,
            int displayOrder
    ) {
        this.name = name;
        this.owner = owner;
        this.startDate = startDate;
        this.endDate = endDate;
        this.progress = progress;
        this.status = status;
        this.parentTaskId = parentTaskId;
        this.taskType = taskType;
        this.displayOrder = displayOrder;
    }

    public void updateParentTaskId(Long parentTaskId) {
        this.parentTaskId = parentTaskId;
    }
}
