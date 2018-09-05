start /MIN yarn start-pro
start /MIN mosca -v | pino
start /MIN hass

:startover
echo (%time%) App started.
ssh -R pepperkick_lightningstrike:80:localhost:4524 serveo.net
echo (%time%) WARNING: App closed or crashed, restarting.
goto startover

ssh -R pepperkick:80:localhost:8000 serveo.net