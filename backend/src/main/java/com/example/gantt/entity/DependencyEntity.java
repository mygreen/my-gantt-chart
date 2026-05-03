package com.example.gantt.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "dependencies")
public class DependencyEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "from_task_id", nullable = false)
    private Long fromTaskId;

    @Column(name = "to_task_id", nullable = false)
    private Long toTaskId;

    protected DependencyEntity() {
    }

    public DependencyEntity(Long fromTaskId, Long toTaskId) {
        this.fromTaskId = fromTaskId;
        this.toTaskId = toTaskId;
    }

    public Long getId() {
        return id;
    }

    public Long getFromTaskId() {
        return fromTaskId;
    }

    public Long getToTaskId() {
        return toTaskId;
    }
}
