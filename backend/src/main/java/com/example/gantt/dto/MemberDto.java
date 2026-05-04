package com.example.gantt.dto;

import com.example.gantt.entity.MemberEntity;

public record MemberDto(
        Long id,
        String name
) {
    public static MemberDto fromEntity(MemberEntity entity) {
        return new MemberDto(entity.getId(), entity.getName());
    }
}
