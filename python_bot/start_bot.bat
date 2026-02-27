@echo off
echo Installing requirements...
pip install -r requirements.txt
echo.
echo Starting Telegram Bot...
python bot.py
pause
