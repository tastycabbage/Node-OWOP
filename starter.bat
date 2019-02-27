@ECHO OFF
goto lo

:lo
color 04
ping localhost -n 0.5 >nul
echo WELCOME TO BUNNODE LOADER
goto echan

:echan
test&cls
pause
test&cls
color 03
echo Wait until you get redirected to NODE or press a Key
timeout 5 >nul
start runserver.bat
start runbackserver.bat