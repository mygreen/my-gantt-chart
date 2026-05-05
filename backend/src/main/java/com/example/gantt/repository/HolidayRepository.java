package com.example.gantt.repository;

import com.example.gantt.entity.HolidayEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface HolidayRepository extends JpaRepository<HolidayEntity, Long> {

    List<HolidayEntity> findAllByProjectIdOrderByDateAsc(Long projectId);

    void deleteAllByProjectId(Long projectId);
}
