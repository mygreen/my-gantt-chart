package com.gh.mygreen.mygantt.repository;

import com.gh.mygreen.mygantt.entity.ProjectVersionEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ProjectVersionRepository extends JpaRepository<ProjectVersionEntity, Long> {

    List<ProjectVersionEntity> findAllByProjectIdOrderByVersionDesc(Long projectId);

    Optional<ProjectVersionEntity> findByProjectIdAndVersion(Long projectId, int version);

    void deleteAllByProjectId(Long projectId);
}

