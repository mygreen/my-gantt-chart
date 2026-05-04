package com.example.gantt.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

@Entity
@Table(name = "project_versions")
public class ProjectVersionEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "version", nullable = false, unique = true)
    private int version;

    @Column(name = "saved_at", nullable = false)
    private LocalDateTime savedAt;

    @Lob
    @Column(name = "snapshot_json", nullable = false)
    private String snapshotJson;

    protected ProjectVersionEntity() {
    }

    public ProjectVersionEntity(int version, LocalDateTime savedAt, String snapshotJson) {
        this.version = version;
        this.savedAt = savedAt;
        this.snapshotJson = snapshotJson;
    }

    public Long getId() {
        return id;
    }

    public int getVersion() {
        return version;
    }

    public LocalDateTime getSavedAt() {
        return savedAt;
    }

    public String getSnapshotJson() {
        return snapshotJson;
    }
}
