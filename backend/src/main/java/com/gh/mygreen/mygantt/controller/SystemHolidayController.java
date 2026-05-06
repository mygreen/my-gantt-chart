package com.gh.mygreen.mygantt.controller;

import com.gh.mygreen.mygantt.dto.HolidayDto;
import com.gh.mygreen.mygantt.dto.SaveHolidayRequest;
import com.gh.mygreen.mygantt.service.TaskService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/system/holidays")
@RequiredArgsConstructor
public class SystemHolidayController {

    private final TaskService taskService;

    @GetMapping
    public List<HolidayDto> getSystemHolidays() {
        return taskService.getSystemHolidays();
    }

    @PutMapping
    public List<HolidayDto> saveSystemHolidays(@RequestBody List<SaveHolidayRequest> request) {
        return taskService.saveSystemHolidays(request);
    }
}

