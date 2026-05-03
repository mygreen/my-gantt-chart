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

    protected TaskEntity() {
    }

    public TaskEntity(String name, String owner, LocalDate startDate, LocalDate endDate, int progress, TaskStatus status) {
        this.name = name;
        this.owner = owner;
        this.startDate = startDate;
        this.endDate = endDate;
        this.progress = progress;
        this.status = status;
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

    public void update(String name, String owner, LocalDate startDate, LocalDate endDate, int progress, TaskStatus status) {
        this.name = name;
        this.owner = owner;
        this.startDate = startDate;
        this.endDate = endDate;
        this.progress = progress;
        this.status = status;
    }
}
