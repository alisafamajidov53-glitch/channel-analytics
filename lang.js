// ===== LANGUAGE SYSTEM (lang.js) =====
// Toggle between Russian and English with one click

const LANG_STORE = 'ca_lang';
let currentLang = localStorage.getItem(LANG_STORE) || 'ru';

const T = {
    // ===== SETUP SCREEN =====
    'auth_subtitle': { ru: 'AI-аналитика YouTube канала', en: 'AI YouTube Channel Analytics' },
    'auth_setup': { ru: '⚡ Настройка', en: '⚡ Setup' },
    'auth_desc': { ru: 'Введите ключи и канал', en: 'Enter API keys and channel' },
    'yt_key_label': { ru: 'YouTube API Key <span class="label-hint">(бесплатно)</span>', en: 'YouTube API Key <span class="label-hint">(free)</span>' },
    'gemini_label': { ru: 'Gemini AI API Key <span class="label-hint">(опционально)</span>', en: 'Gemini AI API Key <span class="label-hint">(optional)</span>' },
    'gemini_link': { ru: '🔑 Получить Gemini ключ →', en: '🔑 Get Gemini Key →' },
    'groq_label': { ru: 'Groq API Key <span class="label-hint">(бесплатно, без лимитов — рекомендуется!)</span>', en: 'Groq API Key <span class="label-hint">(free, unlimited — recommended!)</span>' },
    'groq_link': { ru: '⚡ Получить бесплатный Groq ключ → (Llama 4 Scout Vision + Llama 3.3)', en: '⚡ Get Free Groq Key → (Llama 4 Scout Vision + Llama 3.3)' },
    'groq_hint': { ru: '💡 Groq = бесплатный AI с Vision (понимает видео/изображения!) + текстовый анализ без лимитов', en: '💡 Groq = free AI with Vision (understands video/images!) + unlimited text analysis' },
    'channel_label': { ru: 'Канал', en: 'Channel' },
    'channel_placeholder': { ru: '@username или ссылка на канал', en: '@username or channel link' },
    'btn_connect': { ru: 'Подключить', en: 'Connect' },
    'instructions_toggle': { ru: '📋 Как получить ключи? (инструкция)', en: '📋 How to get API keys? (instructions)' },
    'instr_yt': { ru: 'YouTube API Key (Обязательно)', en: 'YouTube API Key (Required)' },
    'instr_groq': { ru: 'Groq Key (Рекомендуется для скорости!)', en: 'Groq Key (Recommended for speed!)' },
    'instr_gemini': { ru: 'Google AI Studio (Опционально)', en: 'Google AI Studio (Optional)' },
    'instr_openrouter': { ru: 'OpenRouter Key (Очень рекомендуется!)', en: 'OpenRouter Key (Highly Recommended!)' },
    'instr_deepseek': { ru: 'DeepSeek (Agent Router)', en: 'DeepSeek (Agent Router)' },
    'free_ai_title': { ru: '🤖 Топ бесплатных нейросетей 2026', en: '🤖 2026 Top Free AI Providers' },
    'glm_label': { ru: 'GLM API Key (Zhipu AI) <span class="label-hint">(опционально — glm-4.6, glm-4.5)</span>', en: 'GLM API Key (Zhipu AI) <span class="label-hint">(optional — glm-4.6, glm-4.5)</span>' },
    'glm_link': { ru: '🇨🇳 Получить GLM ключ → (BigModel.cn)', en: '🇨🇳 Get GLM Key → (BigModel.cn)' },
    'glm_hint': { ru: '💡 GLM-4.6/4.5 — мощные китайские модели от Zhipu AI, хорошо работают с текстом', en: '💡 GLM-4.6/4.5 — powerful Chinese models from Zhipu AI, great for text analysis' },
    'instr_glm': { ru: 'GLM Key (Zhipu AI — опционально)', en: 'GLM Key (Zhipu AI — optional)' },
    'deepseek_label': { ru: 'DeepSeek API Key (Agent Router) <span class="label-hint">(опционально)</span>', en: 'DeepSeek API Key (Agent Router) <span class="label-hint">(optional)</span>' },
    'deepseek_link': { ru: '🐋 Получить DeepSeek ключ на Agent Router →', en: '🐋 Get DeepSeek Key on Agent Router →' },
    'openrouter_label': { ru: 'OpenRouter API Key <span class="label-hint">(опционально)</span>', en: 'OpenRouter API Key <span class="label-hint">(optional)</span>' },
    'openrouter_link': { ru: '🌌 Получить OpenRouter ключ (с бесплатными лимитами) →', en: '🌌 Get OpenRouter Key (Free Limits) →' },
    // (groq_label/groq_link already defined above)

    // ===== NAV =====
    'nav_dashboard': { ru: 'Дашборд', en: 'Dashboard' },
    'nav_videos': { ru: 'Видео', en: 'Videos' },
    'nav_shorts': { ru: 'Shorts', en: 'Shorts' },
    'nav_analytics': { ru: 'Аналитика', en: 'Analytics' },
    'nav_schedule': { ru: 'Расписание', en: 'Schedule' },
    'nav_ai': { ru: '🤖 AI Анализ', en: '🤖 AI Analyzer' },
    'nav_chat': { ru: 'Чат с ИИ', en: 'AI Chat' },
    'nav_competitor': { ru: 'Конкуренты', en: 'Competitors' },
    'nav_tips': { ru: 'AI Советы', en: 'AI Tips' },
    'nav_refresh': { ru: 'Обновить', en: 'Refresh' },
    'nav_export': { ru: 'Экспорт', en: 'Export' },
    'nav_logout': { ru: 'Сменить канал', en: 'Change Channel' },

    // ===== DASHBOARD =====
    'dash_title': { ru: 'Дашборд', en: 'Dashboard' },
    'dash_subtitle': { ru: 'Обзор канала', en: 'Channel Overview' },
    'stat_views': { ru: 'Просмотры', en: 'Views' },
    'stat_videos': { ru: 'Видео', en: 'Videos' },
    'stat_likes': { ru: 'Лайки', en: 'Likes' },
    'stat_comments': { ru: 'Комментарии', en: 'Comments' },
    'stat_engagement': { ru: 'Вовлечённость', en: 'Engagement' },
    'stat_best_time': { ru: 'Лучшее время', en: 'Best Time' },
    'chart_views': { ru: 'Просмотры', en: 'Views' },
    'filter_7d': { ru: '7д', en: '7d' },
    'filter_30d': { ru: '30д', en: '30d' },
    'filter_all': { ru: 'Все', en: 'All' },
    'chart_types': { ru: 'Типы', en: 'Types' },
    'chart_tags': { ru: '🏷 Облако тегов', en: '🏷 Tag Cloud' },
    'chart_top5': { ru: '🔥 Топ-5 видео', en: '🔥 Top 5 Videos' },
    'stat_today': { ru: 'Просмотры сегодня', en: 'Views Today' },
    'stat_realtime': { ru: 'Сейчас (48ч)', en: 'Real-time (48h)' },
    'dash_milestones': { ru: '🎯 Цели канала', en: '🎯 Channel Milestones' },
    'dash_health': { ru: '🌟 Здоровье канала', en: '🌟 Channel Health' },
    'dash_action_plan': { ru: '🧠 AI План действий', en: '🧠 AI Action Plan' },
    'action_plan_btn': { ru: 'Сгенерировать', en: 'Generate' },
    'action_plan_empty': { ru: 'Нажми "Сгенерировать" для получения персонального плана на день.', en: 'Click "Generate" to get your personalized daily plan.' },
    'chart_funnel': { ru: '🌪 Воронка вовлечения', en: '🌪 Engagement Funnel' },
    'dash_recent_activity': { ru: '🔔 Последняя активность', en: '🔔 Recent Activity' },
    'dash_latest_video': { ru: '🎬 Последний релиз', en: '🎬 Latest Release' },
    'dash_top_popular': { ru: '👑 Топ-3 самых популярных', en: '👑 Top 3 Most Popular' },
    'loading': { ru: 'Загрузка...', en: 'Loading...' },

    // ===== TOOLTIPS =====
    'tt_views': { ru: 'Всего просмотров на загруженных видео', en: 'Total views on loaded videos' },
    'tt_videos': { ru: 'Количество проанализированных видео', en: 'Number of analyzed videos' },
    'tt_likes': { ru: 'Сумма всех лайков', en: 'Total sum of likes' },
    'tt_comments': { ru: 'Сумма всех комментариев', en: 'Total sum of comments' },
    'tt_eng': { ru: 'Средняя вовлеченность (Лайки + Комментарии) / Просмотры', en: 'Average Engagement (Likes + Comments) / Views' },
    'tt_rt': { ru: 'Оценочные просмотры за последние 48 часов', en: 'Estimated views over the last 48 hours' },
    'tt_today': { ru: 'Оценочные просмотры за сегодня', en: 'Estimated views for today' },
    'tt_time': { ru: 'Лучшее время для публикации на основе вовлеченности', en: 'Best time to publish based on past engagement' },

    // ===== VIDEOS =====
    'videos_title': { ru: 'Видео', en: 'Videos' },
    'videos_subtitle': { ru: 'Все видео', en: 'All Videos' },
    'search_placeholder': { ru: 'Поиск...', en: 'Search...' },
    'sort_newest': { ru: 'Новые', en: 'Newest' },
    'sort_views': { ru: 'Просмотры ↓', en: 'Views ↓' },
    'sort_engagement': { ru: 'Engagement ↓', en: 'Engagement ↓' },
    'sort_likes': { ru: 'Лайки ↓', en: 'Likes ↓' },

    // ===== SHORTS =====
    'shorts_title': { ru: 'Shorts', en: 'Shorts' },
    'shorts_subtitle': { ru: 'Короткие видео', en: 'Short Videos' },
    'shorts_avg_views': { ru: 'Средние просмотры', en: 'Avg Views' },
    'shorts_heatmap': { ru: '🕐 Тепловая карта', en: '🕐 Heatmap' },
    'shorts_all': { ru: 'Все Shorts', en: 'All Shorts' },

    // ===== ANALYTICS =====
    'analytics_title': { ru: 'Аналитика', en: 'Analytics' },
    'analytics_subtitle': { ru: 'Глубокий анализ', en: 'Deep Analysis' },
    'chart_categories': { ru: '📊 Категории', en: '📊 Categories' },
    'chart_growth': { ru: '📅 Рост', en: '📅 Growth' },
    'chart_likes_comments': { ru: '👍 Лайки vs Комменты', en: '👍 Likes vs Comments' },
    'table_title': { ru: '🏆 Таблица', en: '🏆 Table' },
    'th_video': { ru: 'Видео', en: 'Video' },
    'th_views': { ru: 'Просмотры', en: 'Views' },
    'th_likes': { ru: 'Лайки', en: 'Likes' },
    'th_comments': { ru: 'Комменты', en: 'Comments' },
    'th_score': { ru: 'Оценка', en: 'Score' },

    // ===== SCHEDULE =====
    'schedule_title': { ru: 'Расписание', en: 'Schedule' },
    'schedule_subtitle': { ru: 'Когда постить', en: 'When to Post' },
    'schedule_heatmap': { ru: '🗓 Тепловая карта', en: '🗓 Posting Heatmap' },
    'schedule_video': { ru: 'Видео', en: 'Video' },
    'schedule_worst': { ru: 'Худшее время', en: 'Worst Time' },
    'schedule_plan': { ru: '📋 План публикаций', en: '📋 Publishing Plan' },

    // ===== AI ANALYZER =====
    'ai_title': { ru: '🤖 AI Анализатор Pro', en: '🤖 AI Video Analyzer Pro' },
    'ai_subtitle': { ru: 'Загрузите видео → ИИ сгенерирует кликбейтные названия, SEO теги, описание и план оптимизации', en: 'Upload video → AI generates clickbait titles, SEO tags, viral description & full optimization plan' },
    'ai_btn_channel': { ru: '📊 Полный анализ канала', en: '📊 Full Channel Analysis' },
    'ai_upload_title': { ru: 'Перетащите видео сюда', en: 'Drag & Drop Video Here' },
    'ai_upload_sub': { ru: 'или нажмите для выбора файла', en: 'or click to browse files' },
    'ai_upload_hint': { ru: 'MP4, MOV, WebM — до 100MB', en: 'MP4, MOV, WebM — up to 100MB' },
    'ai_btn_analyze': { ru: '🚀 Анализировать с AI', en: '🚀 Analyze with AI (US Audience)' },
    'ai_export': { ru: '📄 Экспорт в текст', en: '📄 Export to Text' },
    'ai_viral_title': { ru: 'Вирусный балл и алгоритм', en: 'Viral Score & Algorithm Analysis' },
    'ai_clickbait_title': { ru: 'Кликбейтные названия', en: 'Clickbait Titles (Pick Best One)' },
    'ai_desc_title': { ru: 'YouTube описание (SEO)', en: 'YouTube Description (SEO Optimized)' },
    'ai_copy_desc': { ru: '📋 Копировать описание', en: '📋 Copy Description' },
    'ai_tags_title': { ru: 'SEO Теги и Хештеги', en: 'SEO Tags & Hashtags' },
    'ai_tags_label': { ru: '🏷 Теги (нажмите чтобы копировать)', en: '🏷 Tags (click to copy individual)' },
    'ai_copy_tags': { ru: '📋 Копировать все теги', en: '📋 Copy All Tags' },
    'ai_hashtags_label': { ru: '#️⃣ Хештеги', en: '#️⃣ Hashtags' },
    'ai_copy_hashtags': { ru: '📋 Копировать хештеги', en: '📋 Copy Hashtags' },
    'ai_hook_title': { ru: 'Хук и скрипт первых 3 секунд', en: 'Hook & First 3 Seconds Script' },
    'ai_thumb_title': { ru: 'Идеи для превью', en: 'Thumbnail Ideas & Text Overlay' },
    'ai_cta_title': { ru: 'Призыв к действию и комментарий', en: 'Call-to-Action & Pinned Comment' },
    'ai_time_title': { ru: 'Лучшее время публикации', en: 'Best Posting Schedule' },
    'ai_pro_title': { ru: 'Советы и хаки алгоритма', en: 'Pro Tips & Algorithm Hacks' },
    'ai_channel_export': { ru: '📄 Экспорт отчёта по каналу', en: '📄 Export Channel Report' },
    'ai_channel_title': { ru: 'Полный анализ канала', en: 'Complete Channel Analysis Report' },
    'ai_content_title': { ru: '🎬 Анализ содержания видео', en: '🎬 Video Content Analysis' },
    'ai_frame_title': { ru: '🖼️ Покадровый визуальный разбор', en: '🖼️ Frame-by-Frame Visual Breakdown' },
    'ai_moments_title': { ru: '⏱️ Ключевые моменты', en: '⏱️ Key Moments' },
    'ai_main_topic': { ru: '🎯 Основная тема:', en: '🎯 Main Topic:' },
    'ai_history': { ru: '📂 История анализов', en: '📂 Analysis History' },
    'ai_no_history': { ru: 'Пока нет анализов', en: 'No analyses yet' },

    // ===== COMPETITOR =====
    'comp_title': { ru: '🔍 Анализ конкурентов', en: '🔍 Competitor Analysis' },
    'comp_subtitle': { ru: 'Сравните свой канал с конкурентами', en: 'Compare your channel with competitors' },
    'comp_placeholder': { ru: '@username конкурента или ссылка', en: '@competitor username or link' },
    'comp_btn': { ru: 'Сравнить', en: 'Compare' },
    'comp_chart': { ru: '📊 Сравнение', en: '📊 Comparison' },
    'comp_ai': { ru: 'AI-анализ конкурента', en: 'AI Competitor Analysis' },

    // ===== TIPS =====
    'tips_title': { ru: '🧠 AI Советы', en: '🧠 AI Tips' },
    'tips_subtitle': { ru: 'Персональные рекомендации от ИИ', en: 'Personal AI Recommendations' },
    'tips_btn': { ru: 'Сгенерировать AI советы', en: 'Generate AI Strategy' },
    'tips_strategy': { ru: 'Персональная стратегия от ИИ', en: 'Personal AI Strategy' },

    // ===== SCRIPT BUILDER (AI STUDIO) =====
    'script_tab': { ru: '🎬 Сценарист Pro', en: '🎬 Script Builder Pro' },
    'script_title': { ru: '🎬 Генератор идей и сценариев Pro', en: '🎬 Video Script & Idea Generator Pro' },
    'script_desc': { ru: 'Превратите любую идею в готовый план видео. ИИ сгенерирует угол подачи, заголовки, концепт превью, хук и подробный сценарий.', en: 'Turn any raw idea into a complete production plan. AI will generate the angle, titles, thumbnail concept, hook script, and full video outline.' },
    'script_placeholder': { ru: 'Опишите идею видео... (например: "Видео о том, как начать изучать Python в 2026 для новичков")', en: 'Describe your video idea... (e.g. "A video about how to start learning Python in 2026 for complete beginners")' },
    'script_btn': { ru: '✨ Создать полный план', en: '✨ Generate Full Production Plan' },

    // ===== DROPDOWNS =====
    'ai_opt_auto': { ru: '🔄 Auto (Умный выбор)', en: '🔄 Auto (Fallback)' },
    'ai_opt_aiml': { ru: '🟣 AI/ML API (Любая модель)', en: '🟣 AI/ML API (Any Model)' },
    'ai_opt_groq': { ru: '⚡ Groq (Llama 3.3 Текст)', en: '⚡ Groq (Llama 3.3 Text)' },

    // ===== MODAL =====
    'modal_ai_btn': { ru: '🤖 AI анализ этого видео', en: '🤖 AI Analyze This Video' },
    'modal_close': { ru: 'Закрыть', en: 'Close' },

    // ===== LANG TOGGLE =====
    'lang_btn': { ru: '🇺🇸 English', en: '🇷🇺 Русский' },

    // ===== DYNAMIC CONTENT (used by JS) =====
    'subs_suffix': { ru: 'подп.', en: 'subs' },
    'cache_prefix': { ru: 'Кэш: ', en: 'Cache: ' },
    'updated_prefix': { ru: 'Обновлено: ', en: 'Updated: ' },
    'videos_loaded': { ru: 'видео загружено с', en: 'videos loaded from' },
    'score_excellent': { ru: '🔥 Отлично', en: '🔥 Excellent' },
    'score_good': { ru: '👍 Хорошо', en: '👍 Good' },
    'score_average': { ru: '👌 Средне', en: '👌 Average' },
    'score_poor': { ru: '📉 Слабо', en: '📉 Poor' },
    'label_views': { ru: 'просмотров', en: 'views' },
    'label_likes': { ru: 'лайков', en: 'likes' },
    'label_comments_short': { ru: 'комментов', en: 'comments' },
    'label_eng': { ru: 'вовл.', en: 'eng' },
    'no_videos': { ru: 'Нет видео', en: 'No videos' },
    'no_shorts': { ru: 'Нет Shorts', en: 'No Shorts' },
    'no_tags': { ru: 'Нет тегов', en: 'No tags' },
    'no_data': { ru: 'Мало данных', en: 'Not enough data' },
    'connect_channel': { ru: 'Подключите канал', en: 'Connect your channel' },
    'enter_yt_key': { ru: 'Введите YouTube API Key', en: 'Enter YouTube API Key' },
    'enter_channel': { ru: 'Введите канал', en: 'Enter channel' },
    'channel_not_found': { ru: 'Канал не найден', en: 'Channel not found' },
    'playlist_not_found': { ru: 'Плейлист не найден', en: 'Playlist not found' },
    'disconnected': { ru: 'Отключено', en: 'Disconnected' },
    'exported': { ru: '📦 Экспортировано', en: '📦 Exported' },
    'day_su': { ru: 'Вс', en: 'Su' },
    'day_mo': { ru: 'Пн', en: 'Mo' },
    'day_tu': { ru: 'Вт', en: 'Tu' },
    'day_we': { ru: 'Ср', en: 'We' },
    'day_th': { ru: 'Чт', en: 'Th' },
    'day_fr': { ru: 'Пт', en: 'Fr' },
    'day_sa': { ru: 'Сб', en: 'Sa' },
    'dayf_sunday': { ru: 'Воскресенье', en: 'Sunday' },
    'dayf_monday': { ru: 'Понедельник', en: 'Monday' },
    'dayf_tuesday': { ru: 'Вторник', en: 'Tuesday' },
    'dayf_wednesday': { ru: 'Среда', en: 'Wednesday' },
    'dayf_thursday': { ru: 'Четверг', en: 'Thursday' },
    'dayf_friday': { ru: 'Пятница', en: 'Friday' },
    'dayf_saturday': { ru: 'Суббота', en: 'Saturday' },
    'searching_channel': { ru: 'Ищу канал...', en: 'Searching channel...' },
    'loading_channel': { ru: 'Загружаю канал...', en: 'Loading channel...' },
    'loading_videos': { ru: 'Загружаю видео...', en: 'Loading videos...' },
    'statistics': { ru: 'Статистика...', en: 'Statistics...' },

    // ===== WIZARD =====
    'wizard_step1': { ru: 'YouTube API', en: 'YouTube API' },
    'wizard_step2': { ru: 'AI Ключи', en: 'AI Keys' },
    'wizard_step1_desc': { ru: 'YouTube API ключ и канал — это всё, что нужно для старта!', en: 'YouTube API key and channel — all you need to start!' },
    'wizard_step2_title': { ru: '🤖 Шаг 2: AI Ключи (Опционально)', en: '🤖 Step 2: AI Keys (Optional)' },
    'wizard_step2_desc': { ru: 'Добавьте AI ключи для анализа видео, умных рекомендаций и оптимизации контента', en: 'Add AI keys for video analysis, recommendations, and optimization' },
    'aiml_label': { ru: 'AI/ML API Ключ', en: 'AI/ML API Key' },
    'aiml_link': { ru: '🟣 Получить ключ AI/ML API →', en: '🟣 Get AI/ML API key →' },
    'instr_aiml': { ru: 'AI/ML API (Поддерживает всё)', en: 'AI/ML API (Any model)' },
    'wizard_next': { ru: 'Далее → AI Ключи (опционально)', en: 'Next → Add AI Keys (optional)' },
    'wizard_back': { ru: '← Назад', en: '← Back' },
    'btn_skip_connect': { ru: 'Без AI → Подключить канал', en: 'Skip AI → Connect Now' },

    // ===== AI RESULTS ADDITIONAL =====
    'ai_retention_title': { ru: '📊 Удержание и Хук', en: 'Retention & Hook Analysis' },
    'ai_retention_label': { ru: '🎣 Сила хука (первые 3 сек)', en: '🎣 Hook Strength (First 3s)' },
    'ai_retention_dropoffs': { ru: '⚠️ Ожидаемые спады:', en: '⚠️ Predicted Drop-offs:' },
    'ai_retention_tips': { ru: '💡 Советы по удержанию:', en: '💡 Retention Tips:' },

    // ===== AI CHAT =====
    'chat_title': { ru: '🤖 ИИ-Ассистент', en: '🤖 AI Assistant' },
    'chat_subtitle': { ru: 'Анализ канала в реальном времени', en: 'Real-time channel analysis' },
    'chat_welcome': { ru: 'Привет! Я ИИ-ассистент твоего канала. Я знаю всю твою статистику. Спроси меня о чем угодно!', en: 'Hi! I\'m your channel\'s AI assistant. I know your stats. Ask me anything!' },
    'chat_placeholder': { ru: 'Спроси меня о чем-то...', en: 'Ask me anything...' },
    'chat_clear': { ru: 'Очистить', en: 'Clear' },

    // ===== NEW FEATURES =====
    'theme_toggle': { ru: 'Тёмная тема', en: 'Dark Theme' },
    'theme_light': { ru: 'Светлая тема', en: 'Light Theme' },
    'modal_share': { ru: 'Поделиться', en: 'Share' },
    'auto_refresh': { ru: 'Автообновление через', en: 'Auto-refresh in' },
    'sug_best_video': { ru: '🏆 Какое моё лучшее видео?', en: '🏆 What is my best video?' },
    'sug_grow': { ru: '📈 Как мне вырасти?', en: '📈 How can I grow?' },
    'sug_schedule': { ru: '⏰ Когда лучше постить?', en: '⏰ When should I post?' },
    'sug_shorts': { ru: '📱 Стоит ли мне делать Shorts?', en: '📱 Should I make Shorts?' },
    'sug_viral': { ru: '🔥 Как сделать вирусное видео?', en: '🔥 How to make a viral video?' },
    'chat_export': { ru: '📄 Экспорт чата', en: '📄 Export Chat' }
};

// Helper function to get translated text
function t(key) {
    if (T[key] && T[key][currentLang]) return T[key][currentLang];
    if (T[key] && T[key]['ru']) return T[key]['ru'];
    return key;
}

// Get localized day names arrays
function getDays() {
    return [t('day_su'), t('day_mo'), t('day_tu'), t('day_we'), t('day_th'), t('day_fr'), t('day_sa')];
}
function getDaysF() {
    return [t('dayf_sunday'), t('dayf_monday'), t('dayf_tuesday'), t('dayf_wednesday'), t('dayf_thursday'), t('dayf_friday'), t('dayf_saturday')];
}

function applyLang(lang) {
    currentLang = lang;
    localStorage.setItem(LANG_STORE, lang);
    document.documentElement.lang = lang;

    // Apply all data-i18n translations
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.dataset.i18n;
        if (T[key] && T[key][lang]) {
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                el.placeholder = T[key][lang];
            } else {
                el.innerHTML = T[key][lang];
            }
        }
    });

    // Apply all data-i18n-title translations (Tooltips)
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.dataset.i18nTitle;
        if (T[key] && T[key][lang]) {
            el.title = T[key][lang];
        }
    });

    // Update language button text
    const langBtn = document.getElementById('langToggleBtn');
    if (langBtn) langBtn.textContent = T['lang_btn'][lang];

    // Update page title
    document.title = lang === 'ru' ? 'Channel Analytics Pro — AI-аналитика канала' : 'Channel Analytics Pro — AI Channel Analytics';

    // Re-render dynamic content if app is loaded
    if (typeof refreshAll === 'function' && typeof videos !== 'undefined' && videos.length > 0) {
        try { refreshAll(); } catch (e) { /* ignore if not ready */ }
    }
}

function toggleLang() {
    applyLang(currentLang === 'ru' ? 'en' : 'ru');
}

// Initialize on DOM load
window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => applyLang(currentLang), 100);
});
