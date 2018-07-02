start /MIN yarn start-pro

:startover
echo (%time%) App started.
ssh -R pepperkick_lightningstrike:80:localhost:4524 serveo.net
echo (%time%) WARNING: App closed or crashed, restarting.
goto startover