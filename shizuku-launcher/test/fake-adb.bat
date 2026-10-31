@echo off
rem Fake adb wrapper for automated tests only. Do NOT use on real devices.
setlocal
set "FAKE=%~dp0fake-adb.js"
if not exist "%NODE_EXE%" set "NODE_EXE=node"
"%NODE_EXE%" "%FAKE%" %*
endlocal
