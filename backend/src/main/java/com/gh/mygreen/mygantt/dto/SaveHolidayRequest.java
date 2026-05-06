package com.gh.mygreen.mygantt.dto;

import java.time.LocalDate;

public record SaveHolidayRequest(
        Long id,
        LocalDate date,
        String name
) {
}

