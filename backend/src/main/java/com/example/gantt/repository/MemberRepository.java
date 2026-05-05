package com.example.gantt.repository;

import com.example.gantt.entity.MemberEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MemberRepository extends JpaRepository<MemberEntity, Long> {

    List<MemberEntity> findAllByProjectIdOrderByDisplayOrderAscIdAsc(Long projectId);

    void deleteAllByProjectId(Long projectId);
}
