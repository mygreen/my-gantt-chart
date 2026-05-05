package com.example.gantt.repository;

import com.example.gantt.entity.ProjectSettingsEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ProjectSettingsRepository extends JpaRepository<ProjectSettingsEntity, Long> {

    List<ProjectSettingsEntity> findAllByOrderByIdAsc();
}
