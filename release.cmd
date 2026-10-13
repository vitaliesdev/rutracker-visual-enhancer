@echo off
setlocal
cd /d "%~dp0"
title RuTracker Visual Enhancer - Release

echo ==================================================
echo   RuTracker Visual Enhancer  -  Build ^& release
echo ==================================================
echo.

REM 1) Install dependencies only the first time
if not exist "node_modules\" (
  echo [1/4] Instalando dependencias ^(solo la primera vez^)...
  call npm install --no-audit --no-fund
  if errorlevel 1 goto error
) else (
  echo [1/4] Dependencias ya instaladas. Se omite npm install.
)
echo.

echo [2/4] Revisando el codigo con ESLint...
call npm run lint
if errorlevel 1 goto error
echo.

echo [3/4] Subiendo la version ^(patch^)...
call npm run bump -- patch
if errorlevel 1 goto error
echo.

echo [4/4] Empaquetando la extension en dist...
call npm run build
if errorlevel 1 goto error
echo.

echo ==================================================
echo   LISTO. El ZIP esta en la carpeta  dist\
echo   Subelo en el panel de la Chrome Web Store.
echo   Despues recuerda hacer:  git commit
echo ==================================================
goto end

:error
echo.
echo *** ERROR: un paso ha fallado. Revisa el mensaje de arriba. ***
echo     ^(No se ha empaquetado nada nuevo.^)

:end
echo.
pause
endlocal
