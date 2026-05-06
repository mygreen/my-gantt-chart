package com.gh.mygreen.mygantt.repository;

import com.gh.mygreen.mygantt.entity.ProjectSettingsEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ProjectSettingsRepository extends JpaRepository<ProjectSettingsEntity, Long> {

    List<ProjectSettingsEntity> findAllByOrderByIdAsc();
}

