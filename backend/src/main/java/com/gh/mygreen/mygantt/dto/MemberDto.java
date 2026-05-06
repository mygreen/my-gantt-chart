package com.gh.mygreen.mygantt.dto;

import com.gh.mygreen.mygantt.entity.MemberEntity;

public record MemberDto(
        Long id,
        String name
) {
    public static MemberDto fromEntity(MemberEntity entity) {
        return new MemberDto(entity.getId(), entity.getName());
    }
}

