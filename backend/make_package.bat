@echo off

%~d0
cd %~p0

call env.bat

call gradlew build

pause
