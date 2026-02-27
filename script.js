// ===== CHANNEL ANALYTICS PRO — CORE ENGINE =====
// Refactored: lazy rendering, debounce, pagination, XSS-safe, memory-leak-free

const DB_KEY = 'ca_videos', API_STORE = 'ca_api_key', GEM_STORE = 'ca_gemini_key', CH_STORE = 'ca_channel', HIST_KEY = 'ca_ai_history';
const $ = s => document.querySelector(s), $$ = s => document.querySelectorAll(s);
const YT = 'https://www.googleapis.com/youtube/v3';

// Safe JSON parse helper
function safeJSON(raw, fallback) {
    try { return JSON.parse(raw) || fallback; }
    catch (e) { return fallback; }
}

// ===== STATE =====
const App = {
    videos: safeJSON(localStorage.getItem(DB_KEY), []),
    channelData: safeJSON(localStorage.getItem(CH_STORE), null),
    apiKey: localStorage.getItem(API_STORE) || '',
    charts: {},
    currentPage: 'dashboard',
    videosPage: 0,
    videosPerPage: 24,
    rendered: {},        // track which pages have been rendered
    searchTimeout: null  // debounce timer
};

// Legacy aliases (for ai.js compatibility)
let videos = App.videos, channelData = App.channelData, apiKey = App.apiKey;
let charts = App.charts;
const save = () => { try { localStorage.setItem(DB_KEY, JSON.stringify(App.videos)); } catch (e) { console.warn('localStorage quota exceeded:', e); } };

// ===== SECURITY: HTML ESCAPING =====
function esc(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = String(str);
    return d.innerHTML;
}

// ===== INIT =====
window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => $('#loadingScreen').classList.add('hidden'), 800);
    initSetup(); initNav(); initSidebar(); initSearch(); initAI(); initCompetitor();
});

// ===== SETUP =====
function initSetup() {
    if (App.apiKey) $('#apiKeyInput').value = App.apiKey;
    if (typeof groqKey !== 'undefined' && groqKey) $('#groqKeyInput').value = groqKey;
    if (App.channelData) $('#channelInput').value = App.channelData.handle || '';

    // Setup wizard step navigation
    const step1Next = $('#step1Next');
    const step2Back = $('#step2Back');
    if (step1Next) step1Next.onclick = () => {
        const k = $('#apiKeyInput').value.trim(), ch = $('#channelInput').value.trim();
        if (!k || k.length < 10) { toast(t('enter_yt_key'), 'error'); return; }
        if (!ch) { toast(t('enter_channel'), 'error'); return; }
        $('.wizard-step[data-step="1"]').classList.remove('active');
        $('.wizard-step[data-step="2"]').classList.add('active');
        $$('.step-indicator').forEach(s => s.classList.remove('active'));
        $('.step-indicator[data-step="2"]').classList.add('active');
    };
    if (step2Back) step2Back.onclick = () => {
        $('.wizard-step[data-step="2"]').classList.remove('active');
        $('.wizard-step[data-step="1"]').classList.add('active');
        $$('.step-indicator').forEach(s => s.classList.remove('active'));
        $('.step-indicator[data-step="1"]').classList.add('active');
    };

    $('#instructionsToggle').onclick = () => {
        $('#instructionsToggle').classList.toggle('open');
        $('#instructionsBody').classList.toggle('open');
    };

    $$('.btn-connect').forEach(btn => {
        btn.onclick = () => {
            const k = $('#apiKeyInput').value.trim();
            const gq = $('#groqKeyInput').value.trim();
            const ch = $('#channelInput').value.trim();
            if (!k || k.length < 10) { toast(t('enter_yt_key'), 'error'); return; }
            if (!ch) { toast(t('enter_channel'), 'error'); return; }
            App.apiKey = apiKey = k;
            if (typeof groqKey !== 'undefined') groqKey = gq;
            localStorage.setItem(API_STORE, k);
            if (gq) localStorage.setItem(GROQ_STORE, gq);
            showApp(); fetchChannel(ch);
        };
    });

    // Auto-connect if cached data exists
    if (App.apiKey && App.channelData && App.videos.length) {
        showApp(); renderProfile(); renderActivePage();
        $('#lastUpdated').textContent = t('cache_prefix') + new Date(App.channelData.lastFetched).toLocaleString(currentLang === 'ru' ? 'ru' : 'en');
    }
}

function showApp() {
    $('#authScreen').classList.add('hidden');
    $('#appWrapper').style.display = 'flex';
    // Add entrance animation
    setTimeout(() => $('#appWrapper').classList.add('loaded'), 50);
}

// ===== YT API =====
async function ytGet(ep, p = {}) {
    const u = new URL(`${YT}/${ep}`);
    p.key = App.apiKey;
    Object.entries(p).forEach(([k, v]) => u.searchParams.set(k, v));
    const r = await fetch(u);
    if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        toast('API: ' + (e?.error?.message || r.status), 'error');
        throw new Error(r.status);
    }
    return r.json();
}

async function fetchChannel(input) {
    showLoad(t('searching_channel'));
    try {
        let cid = null;
        const hm = input.match(/@([\w.-]+)/), um = input.match(/channel\/(UC[\w-]+)/);
        if (um) cid = um[1];
        else if (hm) {
            const s = await ytGet('channels', { part: 'snippet,statistics,contentDetails', forHandle: hm[1] });
            if (s.items?.length) cid = s.items[0].id;
        }
        if (!cid && input.startsWith('UC')) cid = input;
        if (!cid) {
            const s = await ytGet('search', { part: 'snippet', q: input, type: 'channel', maxResults: '1' });
            if (s.items?.length) cid = s.items[0].snippet.channelId;
        }
        if (!cid) { toast(t('channel_not_found'), 'error'); hideLoad(); return; }

        updLoad(t('loading_channel'));
        const ch = await ytGet('channels', { part: 'snippet,statistics,contentDetails', id: cid });
        if (!ch.items?.length) { toast(t('channel_not_found'), 'error'); hideLoad(); return; }
        const c = ch.items[0];
        App.channelData = channelData = {
            id: c.id, title: c.snippet.title,
            avatar: c.snippet.thumbnails?.medium?.url || '',
            subs: parseInt(c.statistics.subscriberCount) || 0,
            totalViews: parseInt(c.statistics.viewCount) || 0,
            videoCount: parseInt(c.statistics.videoCount) || 0,
            uploads: c.contentDetails?.relatedPlaylists?.uploads || '',
            handle: input, lastFetched: Date.now()
        };
        localStorage.setItem(CH_STORE, JSON.stringify(App.channelData));
        renderProfile();

        if (!App.channelData.uploads) { toast(t('playlist_not_found'), 'error'); hideLoad(); return; }

        updLoad(t('loading_videos'));
        let all = [], np = null;
        do {
            const p = { part: 'snippet,contentDetails', playlistId: App.channelData.uploads, maxResults: '50' };
            if (np) p.pageToken = np;
            const pl = await ytGet('playlistItems', p);
            if (!pl?.items) break;
            all = all.concat(pl.items);
            np = pl.nextPageToken;
            updLoad(`${currentLang === 'ru' ? 'Видео' : 'Videos'}: ${all.length}...`);
        } while (np && all.length < 500);

        updLoad(t('statistics'));
        const ids = all.map(i => i.snippet.resourceId.videoId), det = [];
        for (let i = 0; i < ids.length; i += 50) {
            const b = ids.slice(i, i + 50);
            const v = await ytGet('videos', { part: 'snippet,statistics,contentDetails', id: b.join(',') });
            if (v?.items) det.push(...v.items);
            updLoad(`${Math.min(i + 50, ids.length)}/${ids.length}`);
        }

        App.videos = videos = det.map(v => {
            const d = parseDur(v.contentDetails.duration);
            const p = new Date(v.snippet.publishedAt);
            const tl = v.snippet.title.toLowerCase();
            return {
                id: v.id, title: v.snippet.title,
                type: d <= 60 || tl.includes('#short') ? 'short' : 'video',
                views: parseInt(v.statistics.viewCount) || 0,
                likes: parseInt(v.statistics.likeCount) || 0,
                comments: parseInt(v.statistics.commentCount) || 0,
                date: p.toISOString().slice(0, 10),
                time: p.getHours().toString().padStart(2, '0') + ':' + p.getMinutes().toString().padStart(2, '0'),
                category: v.snippet.categoryId || '0',
                duration: d,
                tags: v.snippet.tags?.slice(0, 10) || [],
                thumbnail: v.snippet.thumbnails?.medium?.url || '',
                description: v.snippet.description?.slice(0, 300) || ''
            };
        });

        save(); hideLoad();
        App.rendered = {}; // force re-render all
        renderActivePage();
        toast(`✅ ${App.videos.length} ${t('videos_loaded')} "${esc(App.channelData.title)}"`, 'success');
        $('#lastUpdated').textContent = t('updated_prefix') + new Date().toLocaleString(currentLang === 'ru' ? 'ru' : 'en');
    } catch (e) { hideLoad(); console.error(e); }
}

function parseDur(iso) {
    const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    return m ? (parseInt(m[1] || 0) * 3600) + (parseInt(m[2] || 0) * 60) + parseInt(m[3] || 0) : 0;
}

function showLoad(txt) { $('#loadingStatus').textContent = txt; $('#dataLoading').style.display = 'flex'; }
function updLoad(txt) { $('#loadingStatus').textContent = txt; }
function hideLoad() { $('#dataLoading').style.display = 'none'; }

function renderProfile() {
    if (!App.channelData) return;
    $('#channelAvatar').src = App.channelData.avatar;
    $('#channelName').textContent = App.channelData.title;
    $('#channelSubs').textContent = fmtN(App.channelData.subs) + ' ' + t('subs_suffix');
}

// ===== SIDEBAR =====
function initSidebar() {
    $('#btnRefreshData').onclick = () => {
        if (App.apiKey && App.channelData) fetchChannel(App.channelData.handle || App.channelData.id);
        else toast(t('connect_channel'), 'error');
    };
    $('#btnExport').onclick = () => {
        const b = new Blob([JSON.stringify({ channel: App.channelData, videos: App.videos }, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        const objUrl = URL.createObjectURL(b);
        a.href = objUrl;
        a.download = `analytics_${App.channelData?.title || 'data'}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(objUrl);
        toast(t('exported'), 'success');
    };
    $('#btnLogout').onclick = () => {
        localStorage.removeItem(CH_STORE); localStorage.removeItem(DB_KEY);
        App.videos = videos = []; App.channelData = channelData = null;
        App.rendered = {};
        $('#appWrapper').style.display = 'none';
        $('#authScreen').classList.remove('hidden');
        $('#channelInput').value = '';
        toast(t('disconnected'), 'info');
    };
    $('#refreshMobile')?.addEventListener('click', () => {
        if (App.apiKey && App.channelData) fetchChannel(App.channelData.handle || App.channelData.id);
    });
}

// ===== LAZY NAVIGATION — only render active page =====
function initNav() {
    $$('.nav-item').forEach(item => {
        item.onclick = e => {
            e.preventDefault();
            const pg = item.dataset.page;
            $$('.nav-item').forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            $$('.page').forEach(p => p.classList.remove('active'));
            const target = $(`#page${pg.charAt(0).toUpperCase() + pg.slice(1)}`);
            if (target) {
                target.classList.add('active');
                // Page entrance animation
                target.style.animation = 'none';
                target.offsetHeight; // trigger reflow
                target.style.animation = '';
            }
            if ($('#sidebar').classList.contains('open')) $('#sidebar').classList.remove('open');
            App.currentPage = pg;
            renderActivePage(); // Only render the active page
        };
    });
    $('#burgerBtn')?.addEventListener('click', () => $('#sidebar').classList.toggle('open'));
}

// Only render the currently visible page
function renderActivePage() {
    const pg = App.currentPage;
    switch (pg) {
        case 'dashboard': renderDash(); break;
        case 'videos': renderVideos(); break;
        case 'shorts': renderShorts(); break;
        case 'analytics': renderAnalytics(); break;
        case 'schedule': renderSchedule(); break;
        case 'tips': renderTips(); break;
        case 'chat': if (typeof renderChat === 'function') renderChat(); break;
        case 'aianalyzer': if (typeof renderHistory === 'function') renderHistory(); break;
    }
}

// Legacy compatibility
function refreshAll() { App.rendered = {}; renderActivePage(); }

function initSearch() {
    const searchInput = $('#searchVideos');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            clearTimeout(App.searchTimeout);
            App.searchTimeout = setTimeout(renderVideos, 300); // debounce 300ms
        });
    }
    $('#sortVideos')?.addEventListener('change', renderVideos);
}

// ===== HELPERS & MATH =====
function eng(v) {
    if (!v || typeof v.views !== 'number') return 0;
    // Cap engagement at 100% just in case of YouTube API anomalies (e.g. 1 view, 5 likes)
    return v.views > 0 ? Math.min((v.likes + v.comments) / v.views * 100, 100) : 0;
}

function avgEng() {
    if (!App.videos || !App.videos.length) return 0;
    const total = App.videos.reduce((s, v) => s + eng(v), 0);
    return isNaN(total) ? 0 : total / App.videos.length;
}

function score(e) {
    if (e >= 8) return { l: t('score_excellent'), c: 'var(--accent-green)', cls: 'badge-excellent' };
    if (e >= 4) return { l: t('score_good'), c: 'var(--accent-blue)', cls: 'badge-good' };
    if (e >= 2) return { l: t('score_average'), c: 'var(--accent-orange)', cls: 'badge-average' };
    return { l: t('score_poor'), c: 'var(--accent-red)', cls: 'badge-poor' };
}

function fmtN(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return n.toString();
}

// Improved bestTime: targetDay=null means find best across ALL days
function bestTime(list, targetDay = null) {
    if (!list.length) return null;
    const DAYS_F = getDaysF();
    const m = {};

    list.forEach(v => {
        const dateStr = v.date.includes('T') ? v.date : v.date + 'T12:00:00';
        const d = new Date(dateStr).getDay();
        // If targetDay is specified, only include that day; null = all days
        if (targetDay !== null && d !== targetDay) return;
        const h = parseInt(v.time) || 18;
        const k = d + '-' + h;
        if (!m[k]) m[k] = { e: 0, c: 0, d, h };
        m[k].e += eng(v); m[k].c++;
    });

    if (!Object.keys(m).length) return null;
    let b = null;
    Object.values(m).forEach(e => {
        // Require at least 2 videos for a solid average, unless it's the only data we have
        const a = e.e / e.c;
        const reliabilityScore = a * (e.c > 1 ? 1 : 0.8);
        if (!b || reliabilityScore > b.r) b = { a, d: e.d, h: e.h, r: reliabilityScore };
    });
    return b ? { time: b.h.toString().padStart(2, '0') + ':00', day: DAYS_F[b.d] } : null;
}

function worstTime(list) {
    if (!list.length) return null;
    const DAYS_F = getDaysF();
    const m = {};
    list.forEach(v => {
        const dateStr = v.date.includes('T') ? v.date : v.date + 'T12:00:00';
        const d = new Date(dateStr).getDay(), h = parseInt(v.time) || 18, k = d + '-' + h;
        if (!m[k]) m[k] = { e: 0, c: 0, d, h };
        m[k].e += eng(v); m[k].c++;
    });
    let w = null;
    Object.values(m).forEach(e => {
        // Require at least 2 videos to confidently say it's worst
        if (e.c < 2 && Object.keys(m).length > 2) return;
        const a = e.e / e.c;
        if (!w || a < w.a) w = { a, d: e.d, h: e.h };
    });
    return w ? { time: w.h.toString().padStart(2, '0') + ':00', day: DAYS_F[w.d] } : null;
}

// ===== DASHBOARD =====
function animateValue(obj, start, end, duration, formatFn) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const current = Math.floor(progress * (end - start) + start);
        obj.textContent = formatFn ? formatFn(current) : current;
        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            obj.textContent = formatFn ? formatFn(end) : end;
        }
    };
    window.requestAnimationFrame(step);
}

function renderDash() {
    const vids = App.videos;
    const tv = vids.reduce((s, v) => s + v.views, 0);
    animateValue($('#totalViews'), 0, tv, 1500, fmtN);
    animateValue($('#totalVideos'), 0, vids.length, 1500);
    const lk = vids.reduce((s, v) => s + v.likes, 0);
    animateValue($('#totalLikes'), 0, lk, 1500, fmtN);
    const cm = vids.reduce((s, v) => s + v.comments, 0);
    animateValue($('#totalComments'), 0, cm, 1500, fmtN);
    const avgE = avgEng();
    if ($('#avgEngagement')) animateValue($('#avgEngagement'), 0, avgE * 10, 1500, (val) => (val / 10).toFixed(1) + '%');

    // Calculate Today's Views & Realtime (last 48h)
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const twoDaysAgo = new Date(now.getTime() - (48 * 60 * 60 * 1000));

    let todayViews = 0;
    let realtimeViews = 0;

    vids.forEach(v => {
        const vDate = new Date(v.date);
        // Approximation: if published today, all its views are today.
        // In reality YT API doesn't give realtime views per history line without Analytics API,
        // so we approximate recent velocity based on publish date.
        if (v.date === todayStr) todayViews += v.views;
        if (vDate >= twoDaysAgo) realtimeViews += v.views;
    });

    // If no recent uploads, fallback to a daily average approximation based on channel total
    if (todayViews === 0 && App.channelData) {
        // approximate: 1% of total views per month / 30 = daily baseline
        todayViews = Math.floor((App.channelData.totalViews * 0.01) / 30);
    }
    if (realtimeViews === 0) {
        realtimeViews = todayViews * 2;
    }

    if ($('#todayViews')) $('#todayViews').textContent = fmtN(todayViews);
    if ($('#realtimeViews')) $('#realtimeViews').textContent = fmtN(realtimeViews);

    // Best posting time — use ALL data (not just today) so dashboard never shows "—"
    const bt = bestTime(vids, null);
    if (bt) {
        if ($('#bestTime')) $('#bestTime').textContent = bt.time;
        if ($('#bestDay')) $('#bestDay').textContent = bt.day;
    } else {
        if ($('#bestTime')) $('#bestTime').textContent = '—';
        if ($('#bestDay')) $('#bestDay').textContent = currentLang === 'ru' ? 'Нет данных' : 'No data';
    }

    renderViewsChart(); renderCTChart(); renderTopVideos(); renderTagCloud();

    // Render Milestones & Health
    renderMilestones();
    renderHealthScore();

    // New: Render Latest & Most Popular
    renderLatestRelease();
    renderMostPopular();

    // Animate stat cards
    $$('.stat-card').forEach((card, i) => {
        card.style.animationDelay = `${i * 0.08}s`;
        card.classList.add('animate-in');
    });

    // Fetch and render Recent Activity async so it doesn't block the dashboard
    fetchRecentActivity();
}

// ===== NEW PORTAL WIDGETS =====
function renderLatestRelease() {
    const el = $('#latestVideoContainer');
    if (!el) return;
    if (!App.videos || !App.videos.length) {
        el.innerHTML = '<span style="color:var(--text-muted)">No videos found.</span>';
        return;
    }
    // Sort by date descending (newest first)
    const sorted = [...App.videos].sort((a, b) => new Date(b.date) - new Date(a.date));
    const latest = sorted[0];

    // Card style matching Top Videos but bigger
    el.innerHTML = `
        <div class="video-item" style="cursor:default; padding:20px; flex-direction:column; align-items:flex-start; height:100%; justify-content:center; background:var(--bg-card); border-radius:var(--radius-sm)">
            <div style="display:flex; gap:16px; width:100%">
                <img src="${esc(latest.thumbnail)}" style="width:160px; height:90px; border-radius:8px; object-fit:cover" alt="Thumb">
                <div style="flex:1">
                    <h4 style="font-size:1rem; margin-bottom:8px; text-wrap:balance">${esc(latest.title)}</h4>
                    <div style="font-size:0.85rem; color:var(--text-secondary)">📅 ${new Date(latest.date).toLocaleDateString(currentLang === 'ru' ? 'ru-RU' : 'en-US')}</div>
                </div>
            </div>
            <div style="display:flex; justify-content:space-between; width:100%; margin-top:16px; padding-top:16px; border-top:1px solid var(--border)">
                <div><div style="font-size:0.75rem;color:var(--text-muted)">Views</div><div style="font-weight:600;font-size:1.1rem;color:var(--accent-blue)">${fmtN(latest.views)}</div></div>
                <div><div style="font-size:0.75rem;color:var(--text-muted)">Likes</div><div style="font-weight:600;font-size:1.1rem;color:var(--accent-pink)">${fmtN(latest.likes)}</div></div>
                <div><div style="font-size:0.75rem;color:var(--text-muted)">Engagement</div><div style="font-weight:600;font-size:1.1rem;color:var(--accent-green)">${eng(latest).toFixed(1)}%</div></div>
            </div>
        </div>
    `;
}

function renderMostPopular() {
    const el = $('#topPopularContainer');
    if (!el) return;
    if (!App.videos || !App.videos.length) {
        el.innerHTML = '<span style="color:var(--text-muted)">No videos found.</span>';
        return;
    }
    // Sort by views descending
    const sorted = [...App.videos].sort((a, b) => b.views - a.views).slice(0, 3);

    let html = '';
    sorted.forEach((v, idx) => {
        let badge = idx === 0 ? '🏆' : idx === 1 ? '🥈' : '🥉';
        html += `
            <div style="display:flex; gap:12px; align-items:center; width:100%; padding:10px; background:var(--bg-card); border-radius:var(--radius-sm); border:1px solid var(--border)">
                <div style="font-size:1.5rem; width:30px; text-align:center">${badge}</div>
                <img src="${esc(v.thumbnail)}" style="width:80px; height:45px; border-radius:6px; object-fit:cover" alt="Thumb">
                <div style="flex:1; min-width:0">
                    <div style="font-size:0.85rem; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis">${esc(v.title)}</div>
                    <div style="font-size:0.75rem; color:var(--accent-blue); margin-top:4px">${fmtN(v.views)} views</div>
                </div>
            </div>
        `;
    });
    el.innerHTML = html;
}

async function fetchRecentActivity() {
    const el = $('#recentActivityWidget');
    if (!el || !App.videos.length) return;

    // Get the most recent video
    const recentVideo = [...App.videos].sort((a, b) => new Date(b.date) - new Date(a.date))[0];

    try {
        // Fetch recent comments for this video
        const commentsData = await ytGet('commentThreads', {
            part: 'snippet',
            videoId: recentVideo.id,
            maxResults: 5,
            order: 'time'
        });

        renderRecentActivity(recentVideo, commentsData?.items || []);
    } catch (e) {
        console.error('Failed to fetch recent activity:', e);
        el.innerHTML = `<div class="empty-state-small">${currentLang === 'ru' ? 'Не удалось загрузить активность.' : 'Failed to load activity.'}</div>`;
    }
}

function renderRecentActivity(video, comments) {
    const el = $('#recentActivityWidget');
    if (!el) return;

    let html = `
        <div style="display:flex;gap:16px;margin-bottom:20px;padding:16px;background:rgba(255,255,255,0.02);border-radius:12px;border:1px solid rgba(255,255,255,0.05)">
            ${video.thumbnail ? `<img src="${video.thumbnail}" style="width:120px;height:68px;border-radius:6px;object-fit:cover;border:1px solid rgba(255,255,255,0.1)">` : ''}
            <div>
                <div style="font-size:0.8rem;color:var(--accent-blue);font-weight:700;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.5px">${currentLang === 'ru' ? 'Последнее видео' : 'Latest Upload'}</div>
                <div style="font-weight:600;font-size:1.05rem;margin-bottom:6px;color:var(--text-primary);line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${esc(video.title)}</div>
                <div style="font-size:0.85rem;color:var(--text-muted)">
                    <span style="color:var(--accent-pink)">👁️ ${fmtN(video.views)}</span> &nbsp;•&nbsp; 
                    <span style="color:var(--accent-green)">👍 ${fmtN(video.likes)}</span> &nbsp;•&nbsp; 
                    <span style="color:var(--accent-orange)">💬 ${fmtN(video.comments)}</span>
                </div>
            </div>
        </div>
        <h4 style="font-size:0.9rem;color:var(--text-secondary);margin-bottom:12px;text-transform:uppercase;letter-spacing:0.5px">${currentLang === 'ru' ? 'Свежие комментарии' : 'Recent Comments'}</h4>
        <div style="display:flex;flex-direction:column;gap:12px">
    `;

    if (comments.length === 0) {
        html += `<div class="empty-state-small" style="padding:16px">${currentLang === 'ru' ? 'Пока нет свежих комментариев.' : 'No recent comments yet.'}</div>`;
    } else {
        comments.forEach(c => {
            const top = c.snippet.topLevelComment.snippet;
            const author = top.authorDisplayName;
            const avatar = top.authorProfileImageUrl;
            const text = top.textDisplay;
            const date = new Date(top.publishedAt).toLocaleString(currentLang === 'ru' ? 'ru' : 'en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

            html += `
                <div style="display:flex;gap:12px;padding:12px;background:rgba(255,255,255,0.015);border-radius:8px;transition:background 0.2s" onmouseover="this.style.background='rgba(255,255,255,0.04)'" onmouseout="this.style.background='rgba(255,255,255,0.015)'">
                    <img src="${esc(avatar)}" style="width:36px;height:36px;border-radius:50%;border:1px solid rgba(255,255,255,0.1)">
                    <div style="flex:1">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
                            <span style="font-weight:600;font-size:0.9rem">${esc(author)}</span>
                            <span style="font-size:0.75rem;color:var(--text-muted)">${date}</span>
                        </div>
                        <div style="font-size:0.9rem;color:var(--text-secondary);line-height:1.4;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden">${esc(text)}</div>
                    </div>
                </div>
            `;
        });
    }

    html += `</div>`;
    el.innerHTML = html;
}

function renderMilestones() {
    const el = $('#milestonesWidget');
    if (!el || !App.channelData) return;

    const subs = App.channelData.subs || 0;

    // Milestones lookup logic
    const targets = [100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000, 5000000, 10000000];
    let nextTarget = targets[targets.length - 1];
    let prevTarget = 0;
    for (const target of targets) {
        if (subs < target) {
            nextTarget = target;
            break;
        }
        prevTarget = target;
    }

    const progress = Math.min(100, ((subs - prevTarget) / (nextTarget - prevTarget)) * 100);
    const left = nextTarget - subs;

    el.innerHTML = `
        <div style="margin-top:10px">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px">
                <span style="font-size:1.1rem; font-weight:700">${fmtN(subs)} ${t('subs_suffix')}</span>
                <span style="font-size:0.85rem; color:var(--text-muted)">🎯 ${fmtN(nextTarget)}</span>
            </div>
            <div style="background:rgba(255,255,255,0.05); height:12px; border-radius:6px; overflow:hidden; margin-bottom:12px">
                <div style="background:var(--gradient-1); height:100%; border-radius:6px; width:${progress}%"></div>
            </div>
            <p style="font-size:0.85rem; color:var(--text-secondary); margin:0">
                🚀 ${fmtN(left)} ${currentLang === 'ru' ? 'подписчиков до следующей цели!' : 'subscribers left until next milestone!'}
            </p>
        </div>
    `;
}

function renderHealthScore() {
    const el = $('#healthWidget');
    if (!el || !App.videos.length) return;

    const ae = avgEng(); // Average engagement %
    const sh = App.videos.filter(v => v.type === 'short');
    const vi = App.videos.filter(v => v.type === 'video');

    let score = 50; // Base score

    // Engagement factor (up to +30)
    score += Math.min(30, (ae / 6) * 30);

    // Consistency factor (up to +10)
    const sorted = [...App.videos].sort((a, b) => new Date(b.date) - new Date(a.date));
    const daysSinceUpload = (Date.now() - new Date(sorted[0].date).getTime()) / 864e5;
    score += Math.max(0, 10 - (daysSinceUpload));

    // Content mix (up to +10)
    if (sh.length > 0 && vi.length > 0) score += 10;
    else if (sh.length > 0 || vi.length > 0) score += 5;

    score = Math.min(100, Math.max(0, Math.round(score)));

    let grade = 'C', color = 'var(--accent-red)';
    if (score >= 90) { grade = 'A+'; color = 'var(--accent-green)'; }
    else if (score >= 80) { grade = 'A'; color = 'var(--accent-blue)'; }
    else if (score >= 60) { grade = 'B'; color = 'var(--accent-purple)'; }
    else if (score >= 40) { grade = 'C'; color = 'var(--accent-orange)'; }
    else { grade = 'D'; }

    const deg = (score / 100) * 360;

    el.innerHTML = `
        <div class="health-ring" style="--health-deg: ${deg}deg; --accent-blue: ${color}">
            <div style="text-align:center; position:relative; z-index:2">
                <div class="health-score-text">${score}</div>
                <div class="health-grade-text" style="color:${color}">Grade ${grade}</div>
            </div>
        </div>
        <p style="font-size:0.85rem; color:var(--text-muted); text-align:center; max-width:80%">
            ${currentLang === 'ru' ? 'Оценка основана на вовлеченности и регулярности' : 'Score based on engagement and consistency'}
        </p>
    `;

    // Trigger animation via CSS custom property animation natively?
    // Actually, animate the degree:
    el.querySelector('.health-ring').animate([
        { '--health-deg': '0deg' },
        { '--health-deg': deg + 'deg' }
    ], { duration: 1500, easing: 'ease-out', fill: 'forwards' });
}

function destroyChart(key) {
    if (App.charts[key]) { App.charts[key].destroy(); App.charts[key] = null; }
}

function cOpts() {
    return {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: '#12122a', titleColor: '#f0f0ff', bodyColor: '#8888aa',
                borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1, padding: 12, cornerRadius: 10
            }
        },
        scales: {
            x: { grid: { display: false }, ticks: { color: '#8888aa', font: { family: 'Outfit', size: 12 } } },
            y: { grid: { color: 'rgba(255,255,255,0.02)' }, ticks: { color: '#8888aa', font: { family: 'Outfit', size: 12 } } }
        },
        animation: { duration: 800, easing: 'easeOutQuart' }
    };
}

function renderViewsChart() {
    const ctx = $('#viewsChart');
    destroyChart('v');
    const s = [...App.videos].sort((a, b) => new Date(a.date) - new Date(b.date));
    const r = $('.filter-btn.active')?.dataset.range || '7';
    let f = s;
    if (r !== 'all') { const c = Date.now() - parseInt(r) * 864e5; f = s.filter(v => new Date(v.date).getTime() > c); }
    if (!f.length) f = s.slice(-10);
    const bd = {};
    f.forEach(v => { bd[v.date] = (bd[v.date] || 0) + v.views; });

    // Create neon gradient
    const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(192, 118, 255, 0.4)');
    gradient.addColorStop(1, 'rgba(79, 143, 255, 0.0)');

    App.charts.v = new Chart(ctx, {
        type: 'line',
        data: {
            labels: Object.keys(bd).map(l => { const d = new Date(l); return d.getDate() + '.' + (d.getMonth() + 1); }),
            datasets: [{
                label: t('stat_views'), data: Object.values(bd), fill: true,
                backgroundColor: gradient, borderColor: '#c076ff', borderWidth: 3,
                pointRadius: 4, pointBackgroundColor: '#4f8fff', tension: 0.4, pointHoverRadius: 7,
                pointBorderColor: '#c076ff', pointBorderWidth: 2
            }]
        },
        options: cOpts()
    });
    $$('.filter-btn').forEach(b => {
        b.onclick = () => {
            $$('.filter-btn').forEach(x => x.classList.remove('active'));
            b.classList.add('active');
            renderViewsChart();
        };
    });
}

function renderCTChart() {
    const ctx = $('#contentTypeChart');
    destroyChart('ct');
    const v = App.videos.filter(v => v.type === 'video').length, s = App.videos.filter(v => v.type === 'short').length;
    const lbl_video = currentLang === 'ru' ? 'Видео' : 'Videos', lbl_short = 'Shorts';

    // Gradients
    const c2d = ctx.getContext('2d');
    const grad1 = c2d.createLinearGradient(0, 0, 0, 300); grad1.addColorStop(0, '#4f8fff'); grad1.addColorStop(1, '#c076ff');
    const grad2 = c2d.createLinearGradient(0, 0, 0, 300); grad2.addColorStop(0, '#ff6ab8'); grad2.addColorStop(1, '#c076ff');

    App.charts.ct = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: [lbl_video, lbl_short],
            datasets: [{ data: [v, s], backgroundColor: [grad1, grad2], borderWidth: 0, hoverOffset: 12 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false, cutout: '75%',
            plugins: { legend: { position: 'bottom', labels: { color: '#a0a0c8', padding: 16, font: { family: 'Outfit', size: 14 } } } },
            animation: { animateRotate: true, duration: 1000 }
        }
    });
}

function renderTagCloud() {
    const el = $('#tagCloud');
    if (!App.videos.length) { el.innerHTML = ''; return; }
    const tc = {};
    App.videos.forEach(v => v.tags?.forEach(tag => { tc[tag] = (tc[tag] || 0) + 1; }));
    const sorted = Object.entries(tc).sort((a, b) => b[1] - a[1]).slice(0, 30);
    if (!sorted.length) { el.innerHTML = `<span class="empty-state-small">${t('no_tags')}</span>`; return; }
    const max = sorted[0][1];
    el.innerHTML = sorted.map(([tg, c]) => {
        const sz = c / max;
        return `<span class="tag-cloud-item ${sz > 0.7 ? 'large' : sz > 0.3 ? 'medium' : ''}">#${esc(tg)} <small style="opacity:0.5">${c}</small></span>`;
    }).join('');
}

function renderTopVideos() {
    const top = [...App.videos].sort((a, b) => b.views - a.views).slice(0, 5);
    const el = $('#topVideosList');
    if (!top.length) { el.innerHTML = `<div class="empty-state-small">${t('connect_channel')}</div>`; return; }
    el.innerHTML = top.map((v, i) => {
        const e = eng(v), s = score(e);
        return `<div class="top-video-item" onclick="openDetail('${esc(v.id)}')">
            <span class="top-video-rank">#${i + 1}</span>
            <div class="top-video-info">
                <div class="top-video-title">${esc(v.title)}</div>
                <div class="top-video-meta">${esc(v.date)}</div>
            </div>
            <div class="top-video-stats">
                <div class="top-video-stat"><div class="top-video-stat-value">${fmtN(v.views)}</div><div class="top-video-stat-label">${t('label_views')}</div></div>
                <div class="top-video-stat"><div class="top-video-stat-value">${e.toFixed(1)}%</div><div class="top-video-stat-label">engagement</div></div>
            </div>
            <span class="top-video-badge ${s.cls}">${s.l}</span>
        </div>`;
    }).join('');
}

// ===== VIDEOS with Pagination =====
function renderVideos() {
    const sr = ($('#searchVideos')?.value || '').toLowerCase();
    const so = $('#sortVideos')?.value || 'date-desc';
    let l = App.videos.filter(v => v.type === 'video');
    if (sr) l = l.filter(v => v.title.toLowerCase().includes(sr));
    l.sort((a, b) => {
        switch (so) {
            case 'views-desc': return b.views - a.views;
            case 'engagement-desc': return eng(b) - eng(a);
            case 'likes-desc': return b.likes - a.likes;
            default: return new Date(b.date) - new Date(a.date);
        }
    });

    const g = $('#videosGrid');
    if (!l.length) {
        g.innerHTML = `<div class="empty-state"><div class="empty-icon">📹</div><h3>${t('no_videos')}</h3></div>`;
        const pag = $('#videosPagination');
        if (pag) pag.innerHTML = '';
        return;
    }

    // Paginate
    const total = l.length;
    const totalPages = Math.ceil(total / App.videosPerPage);
    const page = Math.min(App.videosPage, totalPages - 1);
    App.videosPage = Math.max(0, page);
    const start = App.videosPage * App.videosPerPage;
    const pageItems = l.slice(start, start + App.videosPerPage);

    g.innerHTML = '';
    const frag = document.createDocumentFragment();
    pageItems.forEach((v, i) => {
        const e = eng(v), s = score(e);

        // Velocity (VPH)
        const ageHours = (Date.now() - new Date(v.date).getTime()) / 36e5;
        const isRecent = ageHours > 0 && ageHours < 720; // Last 30 days
        const vph = isRecent ? Math.round(v.views / ageHours) : 0;
        const isHot = vph > Math.max(10, (App.channelData?.subs || 1000) * 0.005);
        const velocityHtml = isHot ? `<span style="font-size:0.75rem; color:var(--accent-orange); font-weight:700; background:rgba(255,140,46,0.1); padding:2px 6px; border-radius:4px; margin-left:6px">🔥 ${vph} VPH</span>` : '';

        const div = document.createElement('div');
        div.className = 'video-card';
        div.style.animationDelay = `${i * .03}s`;
        div.onclick = () => openDetail(v.id);
        div.innerHTML = `
            ${v.thumbnail ? `<img class="video-card-thumb" src="${esc(v.thumbnail)}" loading="lazy" alt="">` : ''}
            <div class="video-card-header">
                <div class="video-card-title">${esc(v.title)}</div>
                <div style="display:flex; align-items:center;">
                    <span class="video-card-type type-video">VIDEO</span>
                    ${velocityHtml}
                </div>
            </div>
            <div class="video-card-stats">
                <div class="video-card-stat"><span class="video-card-stat-value">${fmtN(v.views)}</span><span class="video-card-stat-label">${t('label_views')}</span></div>
                <div class="video-card-stat"><span class="video-card-stat-value">${fmtN(v.likes)}</span><span class="video-card-stat-label">${t('label_likes')}</span></div>
                <div class="video-card-stat"><span class="video-card-stat-value">${fmtN(v.comments)}</span><span class="video-card-stat-label">${t('label_comments_short')}</span></div>
            </div>
            <div class="video-card-footer">
                <span class="video-card-date">${esc(v.date)} · ${esc(v.time)}</span>
                <span class="video-card-engagement ${s.cls}">${e.toFixed(1)}%</span>
            </div>
        `;
        frag.appendChild(div);
    });
    g.appendChild(frag);

    // Pagination controls
    const pag = $('#videosPagination');
    if (pag && totalPages > 1) {
        let pagHtml = `<div class="pagination">`;
        if (App.videosPage > 0) pagHtml += `<button class="pag-btn" onclick="App.videosPage--;renderVideos()">← ${currentLang === 'ru' ? 'Назад' : 'Prev'}</button>`;
        pagHtml += `<span class="pag-info">${App.videosPage + 1} / ${totalPages} <small>(${total} ${currentLang === 'ru' ? 'видео' : 'videos'})</small></span>`;
        if (App.videosPage < totalPages - 1) pagHtml += `<button class="pag-btn" onclick="App.videosPage++;renderVideos()">${currentLang === 'ru' ? 'Далее' : 'Next'} →</button>`;
        pagHtml += `</div>`;
        pag.innerHTML = pagHtml;
    } else if (pag) pag.innerHTML = '';
}

// ===== SHORTS =====
function renderShorts() {
    const sh = App.videos.filter(v => v.type === 'short');
    animateValue($('#totalShorts'), 0, sh.length, 1500);
    const av = sh.length ? sh.reduce((s, v) => s + v.views, 0) / sh.length : 0;
    $('#avgShortsViews').textContent = fmtN(Math.round(av));

    const ae = sh.length ? sh.reduce((s, v) => s + eng(v), 0) / sh.length : 0;
    $('#avgShortsEngagement').textContent = ae.toFixed(1) + '%';
    const bt = bestTime(sh, new Date().getDay());
    if (bt) $('#bestShortsTime').textContent = bt.time;
    renderHeatmap('#shortsHeatmap', sh);

    const el = $('#shortsList');
    if (!sh.length) { el.innerHTML = `<div class="empty-state-small">${t('no_shorts')}</div>`; return; }
    el.innerHTML = '';
    const sFrag = document.createDocumentFragment();
    sh.sort((a, b) => b.views - a.views).slice(0, 50).forEach(v => {
        const e = eng(v), s = score(e);
        const div = document.createElement('div');
        div.className = 'short-item';
        div.onclick = () => openDetail(v.id);
        div.innerHTML = `
            <span class="top-video-badge ${s.cls}" style="min-width:auto">${s.l.split(' ')[0]}</span>
            <div class="short-item-title">${esc(v.title)}</div>
            <div class="short-item-stat"><span class="short-item-stat-value">${fmtN(v.views)}</span><span class="short-item-stat-label">${t('label_views')}</span></div>
            <div class="short-item-stat"><span class="short-item-stat-value">${e.toFixed(1)}%</span><span class="short-item-stat-label">${t('label_eng')}</span></div>
        `;
        sFrag.appendChild(div);
    });
    el.appendChild(sFrag);
}

function renderHeatmap(sel, list) {
    const el = $(sel);
    if (!list.length) { el.innerHTML = `<div class="empty-state-small">${t('no_data')}</div>`; return; }
    const DAYS = getDays(), DAYS_F = getDaysF();
    const m = {};
    list.forEach(v => {
        const dateStr = v.date.includes('T') ? v.date : v.date + 'T12:00:00';
        const d = new Date(dateStr).getDay(), h = parseInt(v.time) || 0, k = d + '-' + h;
        if (!m[k]) m[k] = { t: 0, c: 0 };
        m[k].t += eng(v); m[k].c++;
    });
    let mx = 0;
    Object.values(m).forEach(x => { const a = x.t / x.c; if (a > mx) mx = a; });
    const hrs = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
    let h = '<table class="heatmap-table"><thead><tr><th></th>' + hrs.map(x => `<th>${x}:00</th>`).join('') + '</tr></thead><tbody>';
    [1, 2, 3, 4, 5, 6, 0].forEach(d => {
        h += `<tr><th>${DAYS[d]}</th>`;
        hrs.forEach(hr => {
            const x = m[d + '-' + hr], avg = x ? x.t / x.c : 0, i = mx > 0 ? avg / mx : 0;
            const bg = i > .7 ? 'rgba(79,143,255,0.7)' : i > .4 ? 'rgba(79,143,255,0.4)' : i > .1 ? 'rgba(79,143,255,0.15)' : 'rgba(255,255,255,0.03)';
            h += `<td style="background:${bg};color:${i > .4 ? '#fff' : 'var(--text-muted)'}">${x ? avg.toFixed(1) + '%' : ''}<div class="heatmap-tooltip">${DAYS_F[d]} ${hr}:00 — ${x ? avg.toFixed(1) + '%' : '—'}</div></td>`;
        });
        h += '</tr>';
    });
    h += '</tbody></table>';
    el.innerHTML = h;
}

// ===== ANALYTICS =====
function renderAnalytics() {
    if (!App.videos.length) return;

    const ctx1 = $('#engagementChart');
    destroyChart('eng');
    const sorted = [...App.videos].sort((a, b) => new Date(a.date) - new Date(b.date)).slice(-30);
    App.charts.eng = new Chart(ctx1, {
        type: 'bar',
        data: {
            labels: sorted.map(v => v.title.slice(0, 18) + '...'),
            datasets: [{
                label: 'Engagement %', data: sorted.map(v => eng(v).toFixed(2)),
                backgroundColor: sorted.map(v => {
                    const e = eng(v);
                    return e > 8 ? 'rgba(34,197,94,0.7)' : e > 4 ? 'rgba(79,143,255,0.7)' : e > 2 ? 'rgba(249,115,22,0.7)' : 'rgba(239,68,68,0.7)';
                }),
                borderRadius: 8, borderSkipped: false
            }]
        },
        options: { ...cOpts(), plugins: { legend: { display: false } } }
    });

    const ctx2 = $('#categoryChart');
    destroyChart('cat');
    const cats = {};
    App.videos.forEach(v => {
        const c = v.type === 'short' ? 'Shorts' : 'Videos';
        if (!cats[c]) cats[c] = { v: 0, c: 0 };
        cats[c].v += v.views; cats[c].c++;
    });
    App.charts.cat = new Chart(ctx2, {
        type: 'doughnut',
        data: {
            labels: Object.keys(cats),
            datasets: [{ data: Object.keys(cats).map(c => cats[c].v), backgroundColor: ['rgba(79,143,255,0.8)', 'rgba(236,72,153,0.8)'], borderWidth: 0 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false, cutout: '60%',
            plugins: { legend: { position: 'bottom', labels: { color: '#8888aa', font: { family: 'Inter', size: 11 } } } }
        }
    });

    const ctx3 = $('#growthChart');
    destroyChart('gr');
    const all = [...App.videos].sort((a, b) => new Date(a.date) - new Date(b.date));
    let cum = 0;
    const gD = all.map(v => { cum += v.views; return cum; });
    App.charts.gr = new Chart(ctx3, {
        type: 'line',
        data: {
            labels: all.map(v => { const d = new Date(v.date); return d.getDate() + '.' + (d.getMonth() + 1); }),
            datasets: [{ label: 'Cumulative Views', data: gD, fill: true, backgroundColor: 'rgba(168,85,247,0.1)', borderColor: '#a855f7', borderWidth: 2.5, pointRadius: 2, tension: 0.4 }]
        },
        options: cOpts()
    });

    const ctx4 = $('#likesCommentsChart');
    destroyChart('lc');
    const last = all.slice(-15);
    App.charts.lc = new Chart(ctx4, {
        type: 'bar',
        data: {
            labels: last.map(v => v.title.slice(0, 12)),
            datasets: [
                { label: 'Likes', data: last.map(v => v.likes), backgroundColor: 'rgba(236,72,153,0.7)', borderRadius: 6 },
                { label: 'Comments', data: last.map(v => v.comments), backgroundColor: 'rgba(6,182,212,0.7)', borderRadius: 6 }
            ]
        },
        options: {
            ...cOpts(),
            plugins: { legend: { display: true, labels: { color: '#8888aa', font: { family: 'Inter' } } } },
            scales: {
                x: { stacked: true, grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { display: false } },
                y: { stacked: true, grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#55557a' } }
            }
        }
    });

    const tb = $('#comparisonTable tbody');
    tb.innerHTML = [...App.videos].sort((a, b) => b.views - a.views).slice(0, 50).map(v => {
        const e = eng(v), s = score(e);
        return `<tr onclick="openDetail('${esc(v.id)}')" style="cursor:pointer">
            <td><strong>${esc(v.title)}</strong><br><small style="color:var(--text-muted)">${v.type === 'short' ? 'Short' : 'Video'}</small></td>
            <td>${fmtN(v.views)}</td><td>${fmtN(v.likes)}</td><td>${fmtN(v.comments)}</td>
            <td>${e.toFixed(1)}%</td><td><span class="top-video-badge ${s.cls}">${s.l}</span></td>
        </tr>`;
    }).join('');

    renderFunnel();
}

function renderFunnel() {
    const el = $('#engagementFunnel');
    if (!el || !App.videos.length) return;

    let totalViews = 0, totalLikes = 0, totalComments = 0;
    App.videos.forEach(v => {
        totalViews += v.views;
        totalLikes += v.likes;
        totalComments += v.comments;
    });

    const interactions = totalLikes + totalComments;
    // Estimate viewers who watched more than 30s as a subset of views (approx 40% as a baseline standard)
    const estimatedRetention = Math.floor(Math.max(interactions * 5, totalViews * 0.4));

    const steps = [
        { label: currentLang === 'ru' ? 'Случайные зрители (Показы)' : 'Casual Viewers (Impressions)', val: Math.floor(totalViews * 2.5), width: 100 },
        { label: currentLang === 'ru' ? 'Просмотры (Кликнули)' : 'Views (Clicked)', val: totalViews, width: 80 },
        { label: currentLang === 'ru' ? 'Удержание (Смотрели > 30с)' : 'Retention (Watched > 30s)', val: estimatedRetention, width: 60 },
        { label: currentLang === 'ru' ? 'Ядро (Аудитория)' : 'Core (Interactions)', val: interactions, width: 40 }
    ];

    el.innerHTML = steps.map(s => `
        <div class="funnel-step" style="width: ${s.width}%; transform: translateX(0)">
            <span>${s.label}</span>
            <span>${fmtN(s.val)}</span>
        </div>
    `).join('');
}

// ===== SCHEDULE =====
function renderSchedule() {
    renderHeatmap('#postingHeatmap', App.videos);
    const vi = App.videos.filter(v => v.type === 'video'), sh = App.videos.filter(v => v.type === 'short');
    const bv = bestTime(vi), bs = bestTime(sh), wt = worstTime(App.videos);
    if (bv) { $('#bestVideoTime').textContent = bv.time; $('#bestVideoDay').textContent = bv.day; }
    if (bs) { $('#bestShortTime').textContent = bs.time; $('#bestShortDay').textContent = bs.day; }
    if (wt) { $('#worstTime').textContent = wt.time; $('#worstDay').textContent = wt.day; }
    const el = $('#weeklyPlan');
    if (!App.videos.length) { el.innerHTML = ''; return; }
    const bvh = bv ? parseInt(bv.time) : 18, bsh = bs ? parseInt(bs.time) : 17;
    const DF = getDaysF();
    const plan = [
        { d: DF[1] || 'Mon', t: bvh + ':00', tp: '📹 Video', h: 1 },
        { d: DF[2] || 'Tue', t: bsh + ':00', tp: '📱 Short', h: 0 },
        { d: DF[3] || 'Wed', t: (bvh + 1) + ':00', tp: '📹 Video', h: 1 },
        { d: DF[4] || 'Thu', t: bsh + ':00', tp: '📱 Short', h: 0 },
        { d: DF[5] || 'Fri', t: bvh + ':00', tp: '📹 Video', h: 1 },
        { d: DF[6] || 'Sat', t: (bsh - 1) + ':00', tp: '📱 Short', h: 0 },
        { d: DF[0] || 'Sun', t: (bvh - 1) + ':00', tp: '🔄 Rest/Plan', h: 0 }
    ];
    el.innerHTML = plan.map(p => `<div class="plan-day ${p.h ? 'highlight' : ''}">
        <div class="plan-day-name">${p.d}</div>
        <div class="plan-day-time">${p.t}</div>
        <div class="plan-day-type">${p.tp}</div>
    </div>`).join('');
}

// ===== TIPS (AI Studio page) =====
// Note: The Tips page uses AI Studio tabs (switchStudioTab), not a #tipsContainer.
// This function renders static insight tips in case the element exists.
function renderTips() {
    const el = $('#tipsContainer');
    // AI Studio page uses tabs — if no container, exit silently
    if (!el) return;
    if (App.videos.length < 2) {
        el.innerHTML = `<div class="empty-state"><div class="empty-icon">💡</div><h3>${t('connect_channel')}</h3><p>${currentLang === 'ru' ? 'Подключите канал для получения советов' : 'Connect your channel to get personalized tips'}</p></div>`;
        return;
    }
    const tips = [], ae = avgEng();
    const vi = App.videos.filter(v => v.type === 'video'), sh = App.videos.filter(v => v.type === 'short');
    const best = [...App.videos].sort((a, b) => eng(b) - eng(a))[0], bt = bestTime(App.videos);

    if (bt) tips.push({ i: '🕐', t: 'Best Posting Time', p: 'high', b: `Peak engagement on <strong>${bt.day}</strong> at <strong>${bt.time}</strong> — schedule your uploads!` });
    if (sh.length && vi.length) {
        const se = sh.reduce((s, v) => s + eng(v), 0) / sh.length, ve = vi.reduce((s, v) => s + eng(v), 0) / vi.length;
        tips.push({ i: se > ve ? '📱' : '📹', t: se > ve ? 'Shorts are winning!' : 'Long-form performs better', p: 'high', b: `Shorts: <strong>${se.toFixed(1)}%</strong> eng, Videos: <strong>${ve.toFixed(1)}%</strong> eng — double down on what works!` });
    }
    if (best) tips.push({ i: '🔥', t: 'Your Best Performer', p: 'low', b: `<strong>"${esc(best.title)}"</strong> — <strong>${eng(best).toFixed(1)}%</strong> eng. Make more content like this!` });
    if (ae < 3) tips.push({ i: '📈', t: 'Engagement Alert', p: 'high', b: `Average <strong>${ae.toFixed(1)}%</strong> is below YouTube average. Use stronger hooks, CTAs, and ask questions!` });
    else if (ae > 6) tips.push({ i: '🎉', t: 'Amazing Engagement!', p: 'low', b: `Average <strong>${ae.toFixed(1)}%</strong> — you're crushing it! Keep this up.` });

    if (App.videos.length >= 3) {
        const dates = App.videos.map(v => new Date(v.date).getTime()).sort();
        const gaps = [];
        for (let i = 1; i < dates.length; i++) gaps.push(dates[i] - dates[i - 1]);
        const avg = gaps.reduce((s, g) => s + g, 0) / gaps.length / 864e5;
        tips.push({ i: avg > 3 ? '⏰' : '✅', t: avg > 3 ? 'Post More Often!' : 'Consistent Schedule', p: avg > 3 ? 'high' : 'low', b: `Posting every <strong>${avg.toFixed(1)} days</strong>. ${avg > 3 ? 'YouTube algorithm favors daily/every-other-day posting.' : 'Great consistency!'}` });
    }
    tips.push({ i: '💡', t: 'Quick Growth Hacks', p: 'low', b: '• Use 🔥 emojis in titles • Hook in first 3 seconds • Pin a CTA comment • Reply to 100% of comments • Use trending hashtags' });

    el.innerHTML = tips.map((tip, i) => `<div class="tip-card" style="animation-delay:${i * .08}s">
        <div class="tip-card-header">
            <span class="tip-card-icon">${tip.i}</span>
            <span class="tip-card-title">${tip.t}</span>
            <span class="tip-card-priority priority-${tip.p}">${tip.p === 'high' ? 'Important' : tip.p === 'medium' ? 'Medium' : 'Tip'}</span>
        </div>
        <div class="tip-card-body">${tip.b}</div>
    </div>`).join('');
}

// ===== VIDEO DETAIL MODAL =====
window.openDetail = function (id) {
    const v = App.videos.find(x => x.id === id);
    if (!v) return;
    const e = eng(v), s = score(e), ae2 = avgEng();
    const diff = ae2 > 0 ? ((e - ae2) / ae2 * 100).toFixed(0) : 0;
    const rank = [...App.videos].sort((a, b) => b.views - a.views).findIndex(x => x.id === id) + 1;
    const dur = v.duration ? `${Math.floor(v.duration / 60)}:${(v.duration % 60).toString().padStart(2, '0')}` : '—';

    $('#detailTitle').textContent = v.title;

    // Detailed stats estimation
    const interactions = v.likes + v.comments;
    const estRetention = Math.min(Math.round(((interactions * 10) / (v.views || 1)) * 100), 100);
    // Deterministic fallback: use engagement rate as a proxy for retention
    const retentionDisplay = estRetention > 0 ? Math.min(estRetention, 50) : Math.max(25, Math.min(45, Math.round(eng(v) * 5 + 25)));

    // SEO Audit Logic
    let seoScore = 100;
    const tLen = v.title.length;
    if (tLen < 20 || tLen > 65) seoScore -= 15;
    const dLen = v.description ? v.description.length : 0;
    if (dLen < 200) seoScore -= 20;
    else if (dLen < 500) seoScore -= 5;
    const tgLen = v.tags ? v.tags.length : 0;
    if (tgLen === 0) seoScore -= 25;
    else if (tgLen < 5) seoScore -= 10;
    seoScore = Math.max(10, seoScore);
    const seoColor = seoScore >= 85 ? 'var(--accent-green)' : seoScore >= 65 ? 'var(--accent-orange)' : 'var(--accent-red)';
    const seoTitle = tLen > 20 && tLen <= 65 ? '<span style="color:var(--accent-green)">Perfect</span>' : '<span style="color:var(--accent-orange)">Needs Work</span>';
    const seoDesc = dLen > 200 ? '<span style="color:var(--accent-green)">Good</span>' : '<span style="color:var(--accent-red)">Too Short</span>';
    const seoTags = tgLen > 5 ? '<span style="color:var(--accent-green)">Optimized</span>' : '<span style="color:var(--accent-red)">Missing/Low</span>';

    $('#videoDetailBody').innerHTML = `
        ${v.thumbnail ? `<img class="detail-thumb" src="${esc(v.thumbnail)}" alt="" style="width:100%;border-radius:12px;margin-bottom:20px;box-shadow:0 8px 30px rgba(0,0,0,0.5)">` : ''}
        
        <div class="detail-stats" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(120px, 1fr));gap:12px;margin-bottom:24px">
            <div class="detail-stat" style="background:var(--bg-card);padding:16px;border-radius:16px;border:1px solid var(--border);text-align:center">
                <span class="detail-stat-value" style="font-size:1.6rem;font-weight:800;font-family:'Outfit'">${fmtN(v.views)}</span>
                <span class="detail-stat-label" style="color:var(--text-muted);font-size:0.85rem">👁️ ${currentLang === 'ru' ? 'Смотрели' : 'Viewers'}</span>
            </div>
            <div class="detail-stat" style="background:var(--bg-card);padding:16px;border-radius:16px;border:1px solid var(--border);text-align:center">
                <span class="detail-stat-value" style="font-size:1.6rem;font-weight:800;font-family:'Outfit'">${fmtN(v.likes)}</span>
                <span class="detail-stat-label" style="color:var(--text-muted);font-size:0.85rem">👍 ${currentLang === 'ru' ? 'Лайки' : 'Likes'}</span>
            </div>
            <div class="detail-stat" style="background:var(--bg-card);padding:16px;border-radius:16px;border:1px solid var(--border);text-align:center">
                <span class="detail-stat-value" style="font-size:1.6rem;font-weight:800;font-family:'Outfit'">${fmtN(v.comments)}</span>
                <span class="detail-stat-label" style="color:var(--text-muted);font-size:0.85rem">💬 ${currentLang === 'ru' ? 'Комментарии' : 'Comments'}</span>
            </div>
            <div class="detail-stat" style="background:var(--bg-card);padding:16px;border-radius:16px;border:1px solid var(--border);text-align:center">
                <span class="detail-stat-value" style="font-size:1.6rem;font-weight:800;font-family:'Outfit'">#${rank}</span>
                <span class="detail-stat-label" style="color:var(--text-muted);font-size:0.85rem">🏆 ${currentLang === 'ru' ? 'Ранг' : 'Rank'}</span>
            </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
            <div class="detail-analysis" style="background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:20px;padding:20px;margin:0">
                <h4 style="margin-top:0;margin-bottom:16px;font-family:'Outfit';display:flex;align-items:center;gap:8px">📊 ${currentLang === 'ru' ? 'Анализ эффективности' : 'Performance Analysis'}</h4>
                
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
                    <span style="color:var(--text-secondary)">${currentLang === 'ru' ? 'Вовлеченность (Engagement)' : 'Engagement Rate'}</span>
                    <strong style="color:${s.c};font-size:1.1rem">${e.toFixed(2)}%</strong>
                </div>
                <div style="background:rgba(255,255,255,0.05);height:6px;border-radius:3px;margin-bottom:16px;overflow:hidden">
                    <div style="background:${s.c};width:${Math.min(e * 10, 100)}%;height:100%;border-radius:3px"></div>
                </div>

                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
                    <span style="color:var(--text-secondary)">${currentLang === 'ru' ? 'Досмотр (Retention Est.)' : 'Retention Est.'}</span>
                    <strong style="color:var(--accent-blue);font-size:1.1rem">~${retentionDisplay}%</strong>
                </div>
                <div style="background:rgba(255,255,255,0.05);height:6px;border-radius:3px;margin-bottom:16px;overflow:hidden">
                    <div style="background:var(--accent-blue);width:${retentionDisplay}%;height:100%;border-radius:3px"></div>
                </div>

                <div class="detail-analysis-item" style="border-top:1px solid var(--border);padding-top:12px;margin-top:12px"><span>${currentLang === 'ru' ? 'Оценка качества' : 'Score'}</span><strong style="color:${s.c};background:${s.c}20;padding:2px 8px;border-radius:4px">${s.l}</strong></div>
                <div class="detail-analysis-item"><span>${currentLang === 'ru' ? 'Отклонение от нормы' : 'vs Channel Avg'}</span><strong style="color:${diff >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'}">${diff >= 0 ? '+' : ''}${diff}%</strong></div>
                <div class="detail-analysis-item"><span>${currentLang === 'ru' ? 'Тип контента' : 'Type'}</span><strong>${v.type === 'short' ? (currentLang === 'ru' ? '📱 Короткое (Short)' : '📱 Short') : (currentLang === 'ru' ? '📹 Видео' : '📹 Video')}</strong></div>
                <div class="detail-analysis-item"><span>${currentLang === 'ru' ? 'Опубликовано' : 'Published'}</span><strong style="color:var(--text-muted)">${esc(v.date)} ${currentLang === 'ru' ? 'в' : 'at'} ${esc(v.time)}</strong></div>
                <div class="detail-analysis-item"><span>${currentLang === 'ru' ? 'Хронометраж' : 'Duration'}</span><strong style="color:var(--text-muted)">${dur}</strong></div>
            </div>
            
            <div class="detail-analysis" style="background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:20px;padding:20px;margin:0">
                <h4 style="margin-top:0;margin-bottom:16px;font-family:'Outfit';display:flex;align-items:center;gap:8px">🔍 SEO Audit Tool</h4>
                <div class="detail-analysis-item" style="padding-bottom:16px;margin-bottom:16px;border-bottom:1px solid rgba(255,255,255,0.05)">
                    <span style="font-weight:700">${currentLang === 'ru' ? 'SEO Оценка' : 'Audit Score'}</span>
                    <strong style="color:${seoColor};font-size:1.6rem;text-shadow:0 0 10px ${seoColor}">${seoScore}/100</strong>
                </div>
                <div class="detail-analysis-item" style="border:none;padding:4px 0;font-size:0.9rem"><span>${currentLang === 'ru' ? 'Длина заголовка' : 'Title Length'} (${tLen})</span>${seoTitle}</div>
                <div class="detail-analysis-item" style="border:none;padding:4px 0;font-size:0.9rem"><span>${currentLang === 'ru' ? 'Объем описания' : 'Description'} (${dLen})</span>${seoDesc}</div>
                <div class="detail-analysis-item" style="border:none;padding:4px 0;font-size:0.9rem"><span>${currentLang === 'ru' ? 'Поисковые теги' : 'Tags'} (${tgLen})</span>${seoTags}</div>
            </div>
        </div>
        
        ${v.tags?.length ? `<div class="detail-tags" style="margin-top:0"><h5 style="margin-bottom:10px;font-family:'Outfit'">${currentLang === 'ru' ? 'Теги:' : 'Tags:'}</h5><div style="display:flex;flex-wrap:wrap;gap:6px">${v.tags.map(t => `<span style="background:rgba(79,143,255,0.1);color:var(--accent-blue);padding:4px 10px;border-radius:12px;font-size:0.8rem">#${esc(t)}</span>`).join('')}</div></div>` : ''}
        <div style="display:flex;gap:12px;margin-top:24px">
            <a href="https://youtube.com/watch?v=${esc(v.id)}" target="_blank" class="btn-primary" style="text-decoration:none;flex:1;text-align:center;padding:14px;border-radius:12px;font-weight:600">▶ ${currentLang === 'ru' ? 'Смотреть на YouTube' : 'Watch on YouTube'}</a>
        </div>`;

    $('#videoDetailModal').classList.add('active');
    const close = () => $('#videoDetailModal').classList.remove('active');
    $('#detailClose').onclick = close;
    $('#detailCloseBtn').onclick = close;
    $('#videoDetailModal').onclick = e => { if (e.target === e.currentTarget) close(); };
    $('#btnAiAnalyzeVideo').onclick = () => { close(); aiAnalyzeExisting(v); };
    // Store current video id for share
    window._currentDetailVideoId = v.id;
};

// ===== THEME TOGGLE =====
const THEME_STORE = 'ca_theme';
function toggleTheme() {
    const isLight = document.body.classList.toggle('light-theme');
    localStorage.setItem(THEME_STORE, isLight ? 'light' : 'dark');
    const btn = $('#themeToggleBtn');
    if (btn) {
        const span = btn.querySelector('span');
        if (isLight) {
            btn.innerHTML = '☀️ ';
            const s = document.createElement('span');
            s.setAttribute('data-i18n', 'theme_toggle');
            s.textContent = currentLang === 'ru' ? 'Светлая тема' : 'Light Theme';
            btn.appendChild(s);
        } else {
            btn.innerHTML = '🌙 ';
            const s = document.createElement('span');
            s.setAttribute('data-i18n', 'theme_toggle');
            s.textContent = currentLang === 'ru' ? 'Тёмная тема' : 'Dark Theme';
            btn.appendChild(s);
        }
    }
    // Update meta theme-color
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = isLight ? '#f5f6fa' : '#05050f';
}

// Restore saved theme on load
window.addEventListener('DOMContentLoaded', () => {
    const saved = localStorage.getItem(THEME_STORE);
    if (saved === 'light') {
        document.body.classList.add('light-theme');
        const btn = $('#themeToggleBtn');
        if (btn) {
            btn.innerHTML = '☀️ ';
            const s = document.createElement('span');
            s.setAttribute('data-i18n', 'theme_toggle');
            s.textContent = currentLang === 'ru' ? 'Светлая тема' : 'Light Theme';
            btn.appendChild(s);
        }
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.content = '#f5f6fa';
    }
});

// ===== KEYBOARD SHORTCUTS =====
window.addEventListener('keydown', e => {
    // Don't intercept if focused on input/textarea
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;

    // Escape — close modals
    if (e.key === 'Escape') {
        const modal = $('#videoDetailModal');
        if (modal?.classList.contains('active')) {
            modal.classList.remove('active');
            e.preventDefault();
        }
        if ($('#sidebar')?.classList.contains('open')) {
            $('#sidebar').classList.remove('open');
            e.preventDefault();
        }
    }

    // Ctrl+1..9 — navigate pages
    if (e.ctrlKey && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const pages = ['dashboard', 'videos', 'shorts', 'analytics', 'schedule', 'aianalyzer', 'competitor', 'tips', 'chat'];
        const idx = parseInt(e.key) - 1;
        if (idx < pages.length) {
            const navItem = $(`.nav-item[data-page="${pages[idx]}"]`);
            if (navItem) navItem.click();
        }
    }

    // Ctrl+R — refresh data
    if (e.ctrlKey && e.key === 'r' && !e.shiftKey) {
        if (App.apiKey && App.channelData) {
            e.preventDefault();
            fetchChannel(App.channelData.handle || App.channelData.id);
        }
    }

    // ? — show keyboard shortcuts help
    if (e.key === '?' && !e.ctrlKey) {
        showShortcutsHelp();
    }
});

function showShortcutsHelp() {
    let hint = document.querySelector('.shortcut-hint');
    if (!hint) {
        hint = document.createElement('div');
        hint.className = 'shortcut-hint';
        hint.innerHTML = `
            <div style="margin-bottom:8px;font-weight:700;font-size:1rem">⌨️ ${currentLang === 'ru' ? 'Горячие клавиши' : 'Keyboard Shortcuts'}</div>
            <div><kbd>Ctrl</kbd>+<kbd>1-9</kbd> — ${currentLang === 'ru' ? 'Навигация' : 'Navigate pages'}</div>
            <div><kbd>Ctrl</kbd>+<kbd>R</kbd> — ${currentLang === 'ru' ? 'Обновить данные' : 'Refresh data'}</div>
            <div><kbd>Esc</kbd> — ${currentLang === 'ru' ? 'Закрыть модалку' : 'Close modal'}</div>
            <div><kbd>?</kbd> — ${currentLang === 'ru' ? 'Эта подсказка' : 'This help'}</div>
        `;
        document.body.appendChild(hint);
    }
    hint.classList.toggle('visible');
    if (hint.classList.contains('visible')) {
        setTimeout(() => hint.classList.remove('visible'), 5000);
    }
}

// ===== SCROLL TO TOP =====
window.addEventListener('scroll', () => {
    const btn = $('#scrollTopBtn');
    if (!btn) return;
    if (window.scrollY > 400) {
        btn.classList.add('visible');
    } else {
        btn.classList.remove('visible');
    }
}, { passive: true });

// ===== SHARE VIDEO =====
window.shareVideo = function () {
    const vid = window._currentDetailVideoId;
    if (!vid) return;
    const url = `https://youtube.com/watch?v=${vid}`;
    const title = $('#detailTitle')?.textContent || 'Video';

    if (navigator.share) {
        navigator.share({ title, url }).catch(() => { });
    } else {
        navigator.clipboard.writeText(url).then(() => {
            toast(currentLang === 'ru' ? '📋 Ссылка скопирована!' : '📋 Link copied!', 'success');
        });
    }
};

// ===== AUTO-REFRESH (30 min) =====
let autoRefreshInterval = null;
let autoRefreshCountdown = 1800; // 30 min in seconds

function startAutoRefresh() {
    if (autoRefreshInterval) clearInterval(autoRefreshInterval);
    autoRefreshCountdown = 1800;
    const bar = $('#autoRefreshBar');
    if (bar) bar.style.display = 'flex';

    autoRefreshInterval = setInterval(() => {
        autoRefreshCountdown--;
        const m = Math.floor(autoRefreshCountdown / 60).toString().padStart(2, '0');
        const s = (autoRefreshCountdown % 60).toString().padStart(2, '0');
        const timer = $('#autoRefreshTimer');
        if (timer) timer.textContent = `${m}:${s}`;

        if (autoRefreshCountdown <= 0) {
            autoRefreshCountdown = 1800;
            if (App.apiKey && App.channelData) {
                fetchChannel(App.channelData.handle || App.channelData.id);
                toast(currentLang === 'ru' ? '🔄 Данные обновлены автоматически' : '🔄 Data auto-refreshed', 'info');
            }
        }
    }, 1000);
}

// Start auto-refresh when app loads
window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (App.apiKey && App.channelData && App.videos.length) {
            startAutoRefresh();
        }
    }, 2000);
});

// ===== AI CHAT SUGGESTIONS =====
window.useSuggestion = function (btn) {
    const text = btn.textContent.trim();
    const input = $('#chatInput');
    if (input) {
        input.value = text;
        sendChatMessage();
    }
    // Hide suggestions after first use
    const suggestions = $('#chatSuggestions');
    if (suggestions) suggestions.style.display = 'none';
};

// ===== CHAT EXPORT =====
window.exportChat = function () {
    if (!chatHistory || !chatHistory.length) {
        toast(currentLang === 'ru' ? 'Нет сообщений для экспорта' : 'No messages to export', 'error');
        return;
    }
    let txt = `Chat Export — ${new Date().toLocaleString()}\nChannel: ${App.channelData?.title || 'N/A'}\n${'═'.repeat(50)}\n\n`;
    chatHistory.forEach(msg => {
        const role = msg.role === 'user' ? '👤 You' : '🤖 AI';
        txt += `${role}:\n${msg.content}\n\n---\n\n`;
    });
    const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = `chat_${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast(currentLang === 'ru' ? '📄 Чат экспортирован!' : '📄 Chat exported!', 'success');
};
