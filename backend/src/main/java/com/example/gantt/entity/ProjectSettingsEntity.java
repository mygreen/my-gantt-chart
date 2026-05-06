package com.example.gantt.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Entity
@Table(name = "project_settings")
@Getter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
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

    @Column(name = "version", nullable = false)
    private int version;

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

    public void incrementVersion() {
        this.version += 1;
    }
}
