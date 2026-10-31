@echo off
rem Shizuku Launcher - direct start, no self-extraction.
rem NOTE: keep this file ASCII-only. cmd.exe reads .bat using the
rem system ANSI code page (GBK on Chinese Windows), so non-ASCII
rem characters here can corrupt the following lines.
setlocal
set "TARGET=%~dp0dist\win-unpacked"
if not exist "%TARGET%" (
  echo.
  echo [ERROR] Folder not found:
  echo   %TARGET%
  echo.
  pause
  exit /b 1
)
pushd "%TARGET%"
for %%f in (*.exe) do (
  start "" "%%~f"
  goto :launched
)
:launched
popd
endlocal
