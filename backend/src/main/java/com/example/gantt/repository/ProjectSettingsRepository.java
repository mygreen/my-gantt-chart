package com.example.gantt.repository;

import com.example.gantt.entity.ProjectSettingsEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectSettingsRepository extends JpaRepository<ProjectSettingsEntity, Long> {
}
