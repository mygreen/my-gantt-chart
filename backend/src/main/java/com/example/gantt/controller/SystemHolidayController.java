package com.example.gantt.controller;

import com.example.gantt.dto.HolidayDto;
import com.example.gantt.dto.SaveHolidayRequest;
import com.example.gantt.service.TaskService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/system/holidays")
public class SystemHolidayController {

    private final TaskService taskService;

    public SystemHolidayController(TaskService taskService) {
        this.taskService = taskService;
    }

    @GetMapping
    public List<HolidayDto> getSystemHolidays() {
        return taskService.getSystemHolidays();
    }

    @PutMapping
    public List<HolidayDto> saveSystemHolidays(@RequestBody List<SaveHolidayRequest> request) {
        return taskService.saveSystemHolidays(request);
    }
}
