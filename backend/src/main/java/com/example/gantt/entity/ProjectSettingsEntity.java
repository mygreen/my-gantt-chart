package com.example.gantt.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDate;

@Entity
@Table(name = "project_settings")
public class ProjectSettingsEntity {

    @Id
    private Long id;

    @Column(name = "project_name", nullable = false)
    private String projectName;

    @Column(name = "project_start_date", nullable = false)
    private LocalDate projectStartDate;

    @Column(name = "project_end_date", nullable = false)
    private LocalDate projectEndDate;

    @Column(name = "exclude_non_working_days", nullable = false)
    private boolean excludeNonWorkingDays;

    protected ProjectSettingsEntity() {
    }

    public ProjectSettingsEntity(
            Long id,
            String projectName,
            LocalDate projectStartDate,
            LocalDate projectEndDate,
            boolean excludeNonWorkingDays
    ) {
        this.id = id;
        this.projectName = projectName;
        this.projectStartDate = projectStartDate;
        this.projectEndDate = projectEndDate;
        this.excludeNonWorkingDays = excludeNonWorkingDays;
    }

    public Long getId() {
        return id;
    }

    public String getProjectName() {
        return projectName;
    }

    public LocalDate getProjectStartDate() {
        return projectStartDate;
    }

    public LocalDate getProjectEndDate() {
        return projectEndDate;
    }

    public boolean isExcludeNonWorkingDays() {
        return excludeNonWorkingDays;
    }

    public void update(
            String projectName,
            LocalDate projectStartDate,
            LocalDate projectEndDate,
            boolean excludeNonWorkingDays
    ) {
        this.projectName = projectName;
        this.projectStartDate = projectStartDate;
        this.projectEndDate = projectEndDate;
        this.excludeNonWorkingDays = excludeNonWorkingDays;
    }
}
