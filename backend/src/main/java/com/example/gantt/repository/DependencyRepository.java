package com.example.gantt.repository;

import com.example.gantt.entity.DependencyEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DependencyRepository extends JpaRepository<DependencyEntity, Long> {

    List<DependencyEntity> findAllByProjectIdOrderByIdAsc(Long projectId);

    void deleteAllByProjectId(Long projectId);
}
