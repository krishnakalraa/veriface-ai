@echo off
title VeriFace AI - FastAPI Backend
echo ========================================================
echo  Starting VeriFace AI FastAPI Backend Server
echo  Endpoints: http://localhost:8000
echo  API Documentation: http://localhost:8000/docs
echo ========================================================
cd /d "%~dp0backend"
python run.py
pause
