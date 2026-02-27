import os
import asyncio
import logging
import aiohttp
from aiogram import Bot, Dispatcher, Router, F
from aiogram.filters import CommandStart, Command
from aiogram.types import Message, CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.enums import ParseMode
from aiogram.client.default import DefaultBotProperties
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

BOT_TOKEN = os.getenv("BOT_TOKEN")
YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

if not BOT_TOKEN:
    raise ValueError("No BOT_TOKEN provided in .env")

# Initialize Bot and Dispatcher
bot = Bot(token=BOT_TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
dp = Dispatcher()
router = Router()

# State definitions
class AnalyzeState(StatesGroup):
    waiting_for_channel_url = State()

class ToolState(StatesGroup):
    waiting_for_titles = State()
    waiting_for_hook_topic = State()
    waiting_for_script_idea = State()

# --- Helper Functions for APIs ---
async def fetch_youtube_data(query: str):
    """Fetch channel stats and latest video details from YouTube API."""
    if not YOUTUBE_API_KEY:
        return None, "YouTube API key is missing in .env"

    async with aiohttp.ClientSession() as session:
        # 1. Resolve channel ID
        channel_id = None
        
        # Basic validation
        if not query:
            return None, "Пустой запрос. Пожалуйста, отправьте ссылку или @username."
            
        try:
            if query.startswith("UC") and len(query) >= 24:
                channel_id = query
            else:
                # Try to search or parse handle
                handle_parts = query.replace("https://www.youtube.com/", "").replace("https://youtube.com/", "").replace("@", "").split("/")
                handle = handle_parts[0] if handle_parts else query
                
                search_url = f"https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q={handle}&key={YOUTUBE_API_KEY}"
                async with session.get(search_url) as res:
                    if res.status != 200:
                         return None, f"Ошибка YouTube API: Код {res.status}"
                    data = await res.json()
                    if "items" in data and len(data["items"]) > 0:
                        channel_id = data["items"][0]["snippet"]["channelId"]

            if not channel_id:
                return None, "Не удалось найти канал по этому запросу. Проверьте правильность ссылки или @username."
        except Exception as e:
            logging.error(f"Error resolving channel ID: {e}")
            return None, "Произошла ошибка при поиске канала."

        # 2. Get Channel Stats
        try:
            channel_url = f"https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet,contentDetails&id={channel_id}&key={YOUTUBE_API_KEY}"
            async with session.get(channel_url) as res:
                if res.status != 200:
                    return None, f"Ошибка YouTube API: Код {res.status}"
                channel_data = await res.json()
                if not channel_data.get("items"):
                    return None, "Не удалось получить статистику канала (данные отсутствуют)."
                
                info = channel_data["items"][0]
                stats = info.get("statistics", {})
                snippet = info.get("snippet", {})
                content_details = info.get("contentDetails", {})
                
                related_playlists = content_details.get("relatedPlaylists", {})
                uploads_playlist_id = related_playlists.get("uploads")

                channel_name = snippet.get("title", "Unknown")
                subs = int(stats.get("subscriberCount", 0))
                views = int(stats.get("viewCount", 0))
                videos = int(stats.get("videoCount", 0))
        except Exception as e:
            logging.error(f"Error fetching channel stats: {e}")
            return None, "Произошла ошибка при получении статистики канала."

        # 3. Get Latest Video
        latest_video = None
        if uploads_playlist_id:
            try:
                playlist_url = f"https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId={uploads_playlist_id}&maxResults=1&key={YOUTUBE_API_KEY}"
                async with session.get(playlist_url) as res:
                    pl_data = await res.json()
                    if "items" in pl_data and len(pl_data["items"]) > 0:
                        vid_id = pl_data["items"][0]["snippet"]["resourceId"]["videoId"]
                        vid_title = pl_data["items"][0]["snippet"]["title"]
                        
                        # Get stats for this specific video
                        vid_url = f"https://www.googleapis.com/youtube/v3/videos?part=statistics&id={vid_id}&key={YOUTUBE_API_KEY}"
                        async with session.get(vid_url) as v_res:
                            v_data = await v_res.json()
                            if "items" in v_data and len(v_data["items"]) > 0:
                                v_stats = v_data["items"][0]["statistics"]
                                vid_views = int(v_stats.get("viewCount", 0))
                                vid_likes = int(v_stats.get("likeCount", 0))
                                latest_video = {
                                    "title": vid_title,
                                    "views": vid_views,
                                    "likes": vid_likes,
                                    "url": f"https://youtu.be/{vid_id}"
                                }
            except Exception as e:
                logging.error(f"Error fetching latest video: {e}")
                # We do not fail the whole request just because the latest video failed
                pass

        return {
            "name": channel_name,
            "subs": subs,
            "views": views,
            "videos": videos,
            "latest": latest_video
        }, None


async def generate_groq_tips(channel_info):
    """Generate tips using Groq Llama3 based on the real channel stats."""
    if not GROQ_API_KEY:
        return "Groq API key is missing. Add it to .env to generate AI strategies."

    prompt = (
        f"You are an elite YouTube growth expert. Analyze this channel briefly:\n"
        f"Channel: {channel_info['name']}\n"
        f"Subscribers: {channel_info['subs']}\n"
        f"Total Views: {channel_info['views']}\n"
        f"Videos given: {channel_info['videos']}\n"
    )
    if channel_info.get("latest"):
        latest = channel_info["latest"]
        prompt += f"Latest video: '{latest['title']}' with {latest['views']} views.\n"
    
    prompt += (
        "\nProvide 3 highly specific, actionable tips in Russian to grow this specific channel right now. "
        "Use formatting (bold, emojis) to make it easy to read in Telegram."
    )

    async with aiohttp.ClientSession() as session:
        headers = {
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": "llama-3.3-70b-versatile",
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.7,
            "max_tokens": 1024
        }
        try:
            async with session.post("https://api.groq.com/openai/v1/chat/completions", headers=headers, json=payload) as res:
                if not res.ok:
                    data = await res.json()
                    return f"❌ Ошибка Groq API: {data.get('error', {}).get('message', res.status)}"
                data = await res.json()
                return data["choices"][0]["message"]["content"]
        except Exception as e:
            return f"❌ Ошибка соединения с Groq: {e}"

async def _groq_generic_call(prompt: str, system_prompt: str = "") -> str:
    if not GROQ_API_KEY:
        return "Groq API key is missing in .env."

    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    async with aiohttp.ClientSession() as session:
        headers = {
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": "llama-3.3-70b-versatile",
            "messages": messages,
            "temperature": 0.7,
            "max_tokens": 2048
        }
        try:
            async with session.post("https://api.groq.com/openai/v1/chat/completions", headers=headers, json=payload) as res:
                if not res.ok:
                    data = await res.json()
                    return f"❌ Ошибка Groq API: {data.get('error', {}).get('message', res.status)}"
                data = await res.json()
                return data["choices"][0]["message"]["content"]
        except Exception as e:
            return f"❌ Ошибка соединения с Groq: {e}"

# --- Keyboards ---
def get_main_keyboard():
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="📊 Анализ канала", callback_data="action_analyze_channel")],
        [InlineKeyboardButton(text="⚖️ A/B Тест Названий", callback_data="action_tool_titles"),
         InlineKeyboardButton(text="🪝 Вирусные Хуки", callback_data="action_tool_hooks")],
        [InlineKeyboardButton(text="🎬 Генератор Сценариев Pro", callback_data="action_tool_script")],
        [InlineKeyboardButton(text="🌍 Открыть Web-App", url="https://example.com/")]
    ])

def get_back_keyboard():
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="⬅️ Назад в меню", callback_data="action_main_menu")]
    ])

def get_cancel_keyboard():
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="❌ Отмена", callback_data="action_cancel")]
    ])

# --- Handlers ---
@router.message(CommandStart())
async def cmd_start(message: Message, state: FSMContext):
    await state.clear()
    welcome_text = (
        "👋 <b>Добро пожаловать в Channel Analytics Pro Bot!</b>\n\n"
        "Я работаю <u>напрямую с реальными API</u> вашего YouTube и Groq.\n"
        "Отправьте мне ссылку на канал и я выдам всю настоящую статистику.\n\n"
        "<i>Выберите действие ниже:</i>"
    )
    await message.answer(welcome_text, reply_markup=get_main_keyboard())

@router.callback_query(F.data == "action_main_menu")
async def callback_main_menu(callback: CallbackQuery, state: FSMContext):
    await state.clear()
    await callback.message.edit_text(
        "👋 Вы вернулись в главное меню.\nВыберите действие:",
        reply_markup=get_main_keyboard()
    )

@router.callback_query(F.data == "action_cancel")
async def callback_cancel(callback: CallbackQuery, state: FSMContext):
    await state.clear()
    await callback.message.edit_text(
        "❌ <i>Действие отменено.</i>\n\nВыберите действие в меню:",
        reply_markup=get_main_keyboard()
    )

@router.callback_query(F.data.in_(["action_analyze_channel", "action_ai_tips_prompt"]))
async def callback_analyze_channel(callback: CallbackQuery, state: FSMContext):
    await state.update_data(intent=callback.data)
    await callback.message.edit_text(
        "🔍 <b>Анализ канала</b>\n\n"
        "Пожалуйста, отправьте мне ссылку на YouTube канал или его @username (например: <code>@MrBeast</code> или <code>https://youtube.com/@MrBeast</code>).",
        reply_markup=get_cancel_keyboard()
    )
    await state.set_state(AnalyzeState.waiting_for_channel_url)

# --- Tool Callbacks ---
@router.callback_query(F.data == "action_tool_titles")
async def cb_tool_titles(callback: CallbackQuery, state: FSMContext):
    await callback.message.edit_text(
        "⚖️ <b>A/B Тестер Названий</b>\n\n"
        "Отправьте мне 2-3 варианта названий для вашего нового видео (желательно каждое с новой строки), "
        "и мой ИИ определит, какое из них принесет наибольший CTR (кликабельность).",
        reply_markup=get_cancel_keyboard()
    )
    await state.set_state(ToolState.waiting_for_titles)

@router.callback_query(F.data == "action_tool_hooks")
async def cb_tool_hooks(callback: CallbackQuery, state: FSMContext):
    await callback.message.edit_text(
        "🪝 <b>Генератор Вирусных Хуков</b>\n\n"
        "Отправьте мне тему или предварительное название вашего будущего видео, и я напишу 3 убойных "
        "содержательных сценария для первых 5 секунд, чтобы удержать максимальное количество зрителей.",
        reply_markup=get_cancel_keyboard()
    )
    await state.set_state(ToolState.waiting_for_hook_topic)

@router.callback_query(F.data == "action_tool_script")
async def cb_tool_script(callback: CallbackQuery, state: FSMContext):
    await callback.message.edit_text(
        "🎬 <b>Генератор Сценариев Pro</b>\n\n"
        "Кратко опишите задумку вашего видео (о чем оно). Наш Producer AI выдаст:\n"
        "• Лучшее название и идею превью\n"
        "• Вирусный хук дословно\n"
        "• Структуру сценария на основе удержания",
        reply_markup=get_cancel_keyboard()
    )
    await state.set_state(ToolState.waiting_for_script_idea)

@router.message(AnalyzeState.waiting_for_channel_url)
async def process_channel_url(message: Message, state: FSMContext):
    query = message.text.strip()
    user_data = await state.get_data()
    intent = user_data.get("intent", "action_analyze_channel")
    await state.clear()
    
    thinking_msg = await message.answer("⏳ <i>Подключаюсь к YouTube API...</i>")
    
    # 1. Fetch Real YouTube Data
    stats, error = await fetch_youtube_data(query)
    
    if error:
        await thinking_msg.edit_text(f"❌ <b>Ошибка:</b> {error}", reply_markup=get_back_keyboard())
        return

    # 2. Proceed based on intent
    if intent == "action_analyze_channel":
        response_text = (
            f"📊 <b>Реальная аналитика канала:</b> {stats['name']}\n\n"
            f"👥 <b>Подписчики:</b> {stats['subs']:,}\n"
            f"👁 <b>Просмотры:</b> {stats['views']:,}\n"
            f"🎬 <b>Всего видео:</b> {stats['videos']:,}\n\n"
        )
        
        if stats["latest"]:
            lv = stats["latest"]
            eng_rate = (lv["likes"] / lv["views"] * 100) if lv["views"] > 0 else 0
            response_text += (
                f"🔥 <b>Последний релиз:</b>\n"
                f"<i>Название:</i> {lv['title']}\n"
                f"<i>Просмотры:</i> {lv['views']:,}\n"
                f"<i>Лайки:</i> {lv['likes']:,} (Удержание/Вовлеченность ~{eng_rate:.1f}%)\n"
                f"🔗 {lv['url']}\n"
            )
            
        kb = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="🧠 Получить AI Стратегию (Groq)", callback_data=f"ai_gen_{query}")],
            [InlineKeyboardButton(text="⬅️ Назад", callback_data="action_main_menu")]
        ])
        
        # Save query so they can click tips from this menu
        await state.update_data(last_query=query, last_stats=stats)
        await thinking_msg.edit_text(response_text, reply_markup=kb, disable_web_page_preview=True)

    elif intent == "action_ai_tips_prompt":
        await thinking_msg.edit_text("⏳ <i>YouTube данные получены. Генерирую стратегию через Groq...</i>")
        ai_tips = await generate_groq_tips(stats)
        await thinking_msg.edit_text(f"🤖 <b>AI Стратегия для {stats['name']}</b>\n\n{ai_tips}", reply_markup=get_back_keyboard())


@router.callback_query(F.data.startswith("ai_gen_"))
async def callback_quick_ai_gen(callback: CallbackQuery, state: FSMContext):
    query = callback.data.split("ai_gen_")[1]
    await callback.message.edit_text("⏳ <i>Генерирую персональную AI-стратегию через Groq API...</i>")
    
    stats, err = await fetch_youtube_data(query)
    if err:
        await callback.message.edit_text(f"❌ Ошибка YouTube API при генерации: {err}", reply_markup=get_back_keyboard())
        return
        
    ai_tips = await generate_groq_tips(stats)
    await callback.message.edit_text(f"🤖 <b>AI Стратегия для {stats['name']}</b>\n\n{ai_tips}", reply_markup=get_back_keyboard())

# --- Tool Processors ---
@router.message(ToolState.waiting_for_titles)
async def process_titles(message: Message, state: FSMContext):
    titles = message.text.strip()
    await state.clear()
    wait_msg = await message.answer("⏳ <i>Анализирую психологию и CTR ваших вариантов...</i>")
    
    prompt = (
        "You are a YouTube CTR and psychology expert.\n"
        "Analyze these titles for a video and determine which will get the highest click-through rate:\n\n"
        f"{titles}\n\n"
        "СТРОГОЕ ПРАВИЛО: ОТВЕЧАЙ ИСКЛЮЧИТЕЛЬНО НА РУССКОМ ЯЗЫКЕ.\n\n"
        "Provide your analysis formatted in Markdown.\n"
        "1. Declare the WINNER clearly.\n"
        "2. Give a CTR prediction out of 100 for each.\n"
        "3. Explain the psychological triggers.\n"
        "4. Provide ONE new 'God-Tier' title that is even better."
    )
    res = await _groq_generic_call(prompt)
    await wait_msg.edit_text(f"⚖️ <b>Результаты A/B Теста:</b>\n\n{res}", reply_markup=get_back_keyboard())

@router.message(ToolState.waiting_for_hook_topic)
async def process_hooks(message: Message, state: FSMContext):
    topic = message.text.strip()
    await state.clear()
    wait_msg = await message.answer("⏳ <i>Пишу сценарии вирусных хуков...</i>")
    
    prompt = (
        "You are a high-retention YouTube Shorts and Video scriptwriter.\n"
        f"Video Topic: \"{topic}\"\n\n"
        "СТРОГОЕ ПРАВИЛО: ОТВЕЧАЙ ИСКЛЮЧИТЕЛЬНО НА РУССКОМ ЯЗЫКЕ.\n\n"
        "Generate 3 distinct, high-impact verbal hooks for the first 3-5 seconds of this video.\n"
        "Format in Markdown:\n"
        "- **Hook 1 (The Question/Curiosity Gap)**\n"
        "- **Hook 2 (The Negative Statement/Shock)**\n"
        "- **Hook 3 (The Ultra-Specific Value Promise)**\n"
        "Include brief visual direction for each (e.g., [Camera rapidly zooms in])."
    )
    res = await _groq_generic_call(prompt)
    await wait_msg.edit_text(f"🪝 <b>Ваши Хуки:</b>\n\n{res}", reply_markup=get_back_keyboard())

@router.message(ToolState.waiting_for_script_idea)
async def process_script_idea(message: Message, state: FSMContext):
    idea = message.text.strip()
    await state.clear()
    wait_msg = await message.answer("⏳ <i>Генерирую 'Masterpiece' продакшен план... Это займет около 10 секунд.</i>")
    
    prompt = (
        "You are a legendary YouTube Producer and Scriptwriter who has helped creators gain millions of views.\n"
        "I have an idea for a video. You need to turn it into a complete, ready-to-shoot production plan.\n\n"
        f"Topic / Idea: \"{idea}\"\n\n"
        "СТРОГОЕ ПРАВИЛО: ОТВЕЧАЙ ИСКЛЮЧИТЕЛЬНО НА РУССКОМ ЯЗЫКЕ (включая сценарии, хуки и инструкции).\n\n"
        "Create a highly structured production guide in Markdown format. Use emojis and bold text. "
        "It MUST contain these exact sections:\n"
        "# 🎬 1. Идея и Угол подачи (Curiosity gap)\n"
        "# 💥 2. Топ-3 Кликбейтных названия\n"
        "# 🖼️ 3. Идея Превью (Thumbnail)\n"
        "# 🪝 4. 5-секундный вирусный хук (Сценарий дословно)\n"
        "# 📜 5. Структура сценария (3 Акта)\n"
        "# ⏱️ 6. Точка удержания (Pattern interrupt)\n"
        "# 📢 7. Призыв к действию (CTA)"
    )
    res = await _groq_generic_call(prompt)
    await wait_msg.edit_text(f"🎬 <b>Генератор Сценариев Pro:</b>\n\n{res}", reply_markup=get_back_keyboard())


# Register router
dp.include_router(router)

async def main():
    logging.basicConfig(level=logging.INFO)
    print("Starting Telegram Bot with Real APIs...")
    try:
        await bot.delete_webhook(drop_pending_updates=True)
        await dp.start_polling(bot)
    finally:
        await bot.session.close()

if __name__ == "__main__":
    asyncio.run(main())
