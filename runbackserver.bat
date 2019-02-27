@echo off

goto restarter

:restarter
node backserver.js

echo Do you want restart if yes click any key if no just close this window.
pause
goto restarter