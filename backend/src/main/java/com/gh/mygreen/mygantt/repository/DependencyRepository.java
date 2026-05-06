package com.gh.mygreen.mygantt.repository;

import com.gh.mygreen.mygantt.entity.DependencyEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DependencyRepository extends JpaRepository<DependencyEntity, Long> {

    List<DependencyEntity> findAllByProjectIdOrderByIdAsc(Long projectId);

    void deleteAllByProjectId(Long projectId);
}

