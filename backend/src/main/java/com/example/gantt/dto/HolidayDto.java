package com.example.gantt.dto;

import com.example.gantt.entity.HolidayEntity;

import java.time.LocalDate;

public record HolidayDto(
        Long id,
        LocalDate date,
        String name
) {
    public static HolidayDto fromEntity(HolidayEntity entity) {
        return new HolidayDto(entity.getId(), entity.getDate(), entity.getName());
    }
}
