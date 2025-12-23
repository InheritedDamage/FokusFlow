@echo off
rem Author: Dennis Zajonz | Company: NoLimitsCoding GmbH | Web: www.nolimitscoding.de | FokusFlow v1.0.0
setlocal

rem Launch FokusFlow in standalone mode (browser new window if available)
set "APP_PATH=%~dp0popup\popup.html"
if not exist "%APP_PATH%" (
  echo Could not find popup\popup.html next to this launcher.
  pause
  exit /b 1
)

set "URL=file:///%APP_PATH%"
set "URL=%URL:\=/%"

set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
set "EDGE64=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
set "CHROME64=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
set "FIREFOX=%ProgramFiles%\Mozilla Firefox\firefox.exe"
set "FIREFOX86=%ProgramFiles(x86)%\Mozilla Firefox\firefox.exe"

rem detect default browser ProgId
for /f "tokens=1,3" %%A in ('reg query "HKCU\Software\Microsoft\Windows\Shell\Associations\UrlAssociations\https\UserChoice" /v ProgId 2^>nul') do (
  if /i "%%A"=="ProgID" set "DEFAULT_PROGID=%%B"
)

set "DEFAULT_BROWSER="
set "DEFAULT_ARGS="

if /i "%DEFAULT_PROGID%"=="MSEdgeHTM" (
  if exist "%EDGE%" set "DEFAULT_BROWSER=%EDGE%"
  if exist "%EDGE64%" set "DEFAULT_BROWSER=%EDGE64%"
  set "DEFAULT_ARGS=--new-window"
)
if /i "%DEFAULT_PROGID%"=="AppXq0fevzme2pys62n3e0fbqa7peapykr8v" (
  if exist "%EDGE%" set "DEFAULT_BROWSER=%EDGE%"
  if exist "%EDGE64%" set "DEFAULT_BROWSER=%EDGE64%"
  set "DEFAULT_ARGS=--new-window"
)
if /i "%DEFAULT_PROGID%"=="ChromeHTML" (
  if exist "%CHROME%" set "DEFAULT_BROWSER=%CHROME%"
  if exist "%CHROME64%" set "DEFAULT_BROWSER=%CHROME64%"
  set "DEFAULT_ARGS=--new-window"
)
if /i "%DEFAULT_PROGID%"=="FirefoxURL" (
  if exist "%FIREFOX%" set "DEFAULT_BROWSER=%FIREFOX%"
  if exist "%FIREFOX86%" set "DEFAULT_BROWSER=%FIREFOX86%"
  set "DEFAULT_ARGS=-new-window"
)

if defined DEFAULT_BROWSER (
  start "" "%DEFAULT_BROWSER%" %DEFAULT_ARGS% "%URL%"
  goto :eof
)

rem fallback: try known browsers
if exist "%EDGE%" (
  start "" "%EDGE%" --new-window "%URL%"
  goto :eof
)
if exist "%EDGE64%" (
  start "" "%EDGE64%" --new-window "%URL%"
  goto :eof
)
if exist "%CHROME%" (
  start "" "%CHROME%" --new-window "%URL%"
  goto :eof
)
if exist "%CHROME64%" (
  start "" "%CHROME64%" --new-window "%URL%"
  goto :eof
)
if exist "%FIREFOX%" (
  start "" "%FIREFOX%" -new-window "%URL%"
  goto :eof
)
if exist "%FIREFOX86%" (
  start "" "%FIREFOX86%" -new-window "%URL%"
  goto :eof
)

rem last resort: default handler (may be a tab)
start "" "%URL%"
