package com.gh.mygreen.mygantt.repository;

import com.gh.mygreen.mygantt.entity.TaskEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TaskRepository extends JpaRepository<TaskEntity, Long> {

    List<TaskEntity> findAllByProjectIdOrderByDisplayOrderAscIdAsc(Long projectId);
}

