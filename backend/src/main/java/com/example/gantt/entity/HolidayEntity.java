package com.example.gantt.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDate;

@Entity
@Table(name = "holidays")
public class HolidayEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "project_id", nullable = false)
    private Long projectId;

    @Column(nullable = false)
    private LocalDate date;

    @Column(nullable = false)
    private String name;

    protected HolidayEntity() {
    }

    public HolidayEntity(Long projectId, LocalDate date, String name) {
        this.projectId = projectId;
        this.date = date;
        this.name = name;
    }

    public Long getId() {
        return id;
    }

    public Long getProjectId() {
        return projectId;
    }

    public LocalDate getDate() {
        return date;
    }

    public String getName() {
        return name;
    }
}
