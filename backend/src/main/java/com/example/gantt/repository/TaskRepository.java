package com.example.gantt.repository;

import com.example.gantt.entity.TaskEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TaskRepository extends JpaRepository<TaskEntity, Long> {

    List<TaskEntity> findAllByProjectIdOrderByDisplayOrderAscIdAsc(Long projectId);
}
