@echo off

if NOT "%JAVA_HOME_21%" == "" (
    set JAVA_HOME="%JAVA_HOME_21%"
)

set PATH=%PATH%;%JAVA_HOME%\bin;

java -version

