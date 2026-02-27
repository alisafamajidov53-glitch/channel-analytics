# Channel Analytics Pro - Telegram Bot

This is the companion Telegram Bot for your YouTube AI Analytics platform. It is built strictly on Python 3 using the latest `aiogram` (v3.17+) library.

## Features
- 🚀 **Inline Keyboards:** Beautiful, interactive buttons.
- 📊 **Quick Channel Analysis:** Send a channel URL to get instant stats.
- 🧠 **AI Tips (Groq):** Generate personalized channel tips right inside Telegram.
- ⚙️ **FSM State Management:** Remembers when it asked you for a YouTube URL.

## Setup Instructions

1. **Install Python**
   Ensure you have Python 3.9+ installed on your computer.

2. **Create a Telegram Bot**
   - Go to Telegram and search for `@BotFather`.
   - Send the command `/newbot`.
   - Choose a name and username for your bot.
   - You will receive a **Bot Token**.

3. **Configure the Environment**
   - Rename the `.env.example` file in this folder to `.env`.
   - Open `.env` and paste your Bot Token:
     ```env
     BOT_TOKEN=your_token_from_botfather_here
     ```

4. **Install Dependencies**
   Open a terminal in this folder (`python_bot/`) and run:
   ```bash
   pip install -r requirements.txt
   ```

5. **Start the Bot**
   Run the bot script:
   ```bash
   python bot.py
   ```

You can now go to your bot on Telegram and press "Start"! 🤖

## ☁️ Бесплатный Хостинг вашего бота (Деплой 24/7)

Чтобы бот работал круглосуточно без включенного компьютера, вы можете разместить его на бесплатных серверах.

### Вариант 1: Размещение на Render.com (Рекомендуется)
Мы подготовили файл `render.yaml` для быстрой настройки.
1. Создайте аккаунт на [Render](https://render.com/) (можно войти через GitHub).
2. Загрузите этот проект в свой репозиторий GitHub.
3. В панели Render выберите **New** -> **Blueprint**.
4. Подключите ваш репозиторий GitHub. Render автоматически прочитает файл `render.yaml` и создаст *Background Worker*.
5. В процессе настройки Render попросит вас ввести **Environment Variables**. Скопируйте туда значения из вашего `.env`:
   - `BOT_TOKEN`
   - `YOUTUBE_API_KEY`
   - `GROQ_API_KEY`
6. Дождитесь успешной сборки. Бот запущен!
*(Примечание: На бесплатном тарифе Render бот будет работать 750 часов в месяц (это почти целый месяц).*

### Вариант 2: Размещение на PythonAnywhere (Самый простой для новичков)
1. Зарегистрируйтесь на [PythonAnywhere.com](https://www.pythonanywhere.com/).
2. Перейдите во вкладку **Files** и загрузите файлы из папки `python_bot` (включая настроенный `.env`).
3. Откройте вкладку **Consoles** и запустите новую **Bash** консоль.
4. Выполните установку библиотек: `pip install -user aiogram aiohttp python-dotenv`
5. Выполните запуск: `python bot.py`
*(Примечание: На бесплатном тарифе PythonAnywhere нужно раз в 3 месяца нажимать кнопку "Run until", и иногда процессы прерываются, но это отлично подходит для старта).*
