@echo off
rem Fake fastboot for tests. ASCII-only by design.
rem NOTE: must propagate the exit code explicitly. Any "set" command
rem resets ERRORLEVEL to 0, so capture it before the set and exit /b it.
setlocal EnableExtensions
set "SAVED_ERRORLEVEL=%ERRORLEVEL%"
if not exist "%NODE_EXE%" set "NODE_EXE=node"
"%NODE_EXE%" "%~dp0fake-fastboot.js" %*
set "RC=%ERRORLEVEL%"
endlocal & exit /b %RC%
