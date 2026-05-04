package com.example.gantt.repository;

import com.example.gantt.entity.ProjectVersionEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ProjectVersionRepository extends JpaRepository<ProjectVersionEntity, Long> {

    List<ProjectVersionEntity> findAllByOrderByVersionDesc();

    Optional<ProjectVersionEntity> findByVersion(int version);
}
