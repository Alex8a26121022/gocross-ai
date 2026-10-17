@echo off
cd /d "%~dp0"
echo GoCross: http://127.0.0.1:5173
echo Keep this window open. Press Ctrl+C to stop.
node server.mjs
pause
