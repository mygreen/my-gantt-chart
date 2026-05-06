@echo off

%~d0
cd %~p0

rem Gradle9から文字化けためCMDの文字コードを指定。
chcp 65001 > nul

call env.bat

call gradlew build

pause
