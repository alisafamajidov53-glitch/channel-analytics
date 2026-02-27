// ===== TELEGRAM CLOUD STORAGE SYNC =====
// Syncs critical localStorage keys to Telegram CloudStorage
// so data persists across Mini App sessions.
// Falls back gracefully when not running inside Telegram.

const TG_SYNC_KEYS = ['ca_api_key', 'ca_channel', 'ca_groq_key', 'ca_videos', 'ca_lang', 'ca_theme', 'ca_ai_history'];

// Check if running inside Telegram WebApp
function isTelegramWebApp() {
    return window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.CloudStorage;
}

// Restore all keys from Telegram CloudStorage → localStorage
function tgRestoreAll() {
    return new Promise((resolve) => {
        if (!isTelegramWebApp()) { resolve(false); return; }

        const cs = window.Telegram.WebApp.CloudStorage;
        cs.getKeys((err, keys) => {
            if (err || !keys || !keys.length) { resolve(false); return; }

            // Only fetch keys that we care about
            const relevantKeys = keys.filter(k => TG_SYNC_KEYS.includes(k));
            if (!relevantKeys.length) { resolve(false); return; }

            cs.getItems(relevantKeys, (err2, values) => {
                if (err2 || !values) { resolve(false); return; }

                let restored = 0;
                for (const key of Object.keys(values)) {
                    const val = values[key];
                    if (val && val.length > 0) {
                        // Only restore if localStorage doesn't already have this key
                        if (!localStorage.getItem(key)) {
                            localStorage.setItem(key, val);
                            restored++;
                        }
                    }
                }
                console.log(`[TG Cloud] Restored ${restored} keys from Telegram CloudStorage`);
                resolve(restored > 0);
            });
        });
    });
}

// Save a single key to Telegram CloudStorage
function tgSaveKey(key, value) {
    if (!isTelegramWebApp()) return;
    try {
        const cs = window.Telegram.WebApp.CloudStorage;
        // CloudStorage has a 4096 byte limit per value
        // For large data (videos), we may need to truncate or skip
        if (value && value.length > 4000) {
            // For ca_videos, save only essential data (no descriptions/tags to save space)
            if (key === 'ca_videos') {
                try {
                    const vids = JSON.parse(value);
                    const slim = vids.map(v => ({
                        id: v.id, title: v.title, views: v.views, likes: v.likes,
                        comments: v.comments, date: v.date, time: v.time, type: v.type,
                        thumbnail: v.thumbnail, duration: v.duration
                    }));
                    const slimStr = JSON.stringify(slim);
                    if (slimStr.length <= 4000) {
                        cs.setItem(key, slimStr);
                    }
                    // If still too big, skip — localStorage on device will handle it
                } catch (e) { /* skip */ }
                return;
            }
            // Skip other oversized values
            return;
        }
        if (value) {
            cs.setItem(key, value);
        }
    } catch (e) {
        console.warn('[TG Cloud] Save error:', e);
    }
}

// Hook into localStorage.setItem to auto-sync to Telegram Cloud
(function patchLocalStorage() {
    const originalSetItem = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function (key, value) {
        originalSetItem(key, value);
        if (TG_SYNC_KEYS.includes(key)) {
            tgSaveKey(key, value);
        }
    };
})();

// Initialize: restore from cloud, then reload App state if needed
async function initTelegramSync() {
    if (!isTelegramWebApp()) return;

    // Expand the WebApp to full height
    try {
        window.Telegram.WebApp.expand();
        window.Telegram.WebApp.ready();
    } catch (e) { /* ignore */ }

    const restored = await tgRestoreAll();
    if (restored) {
        // Re-initialize App state from restored localStorage
        if (typeof App !== 'undefined') {
            const apiKey = localStorage.getItem('ca_api_key');
            const channelData = localStorage.getItem('ca_channel');
            const videosData = localStorage.getItem('ca_videos');

            if (apiKey) App.apiKey = apiKey;
            if (channelData) {
                try { App.channelData = JSON.parse(channelData); } catch (e) { }
            }
            if (videosData) {
                try {
                    App.videos = JSON.parse(videosData);
                    // Update legacy aliases
                    if (typeof videos !== 'undefined') videos = App.videos;
                    if (typeof channelData !== 'undefined') channelData = App.channelData;
                } catch (e) { }
            }
        }

        // Restore Groq key
        const groqKey = localStorage.getItem('ca_groq_key');
        if (groqKey && typeof window.groqKey !== 'undefined') {
            window.groqKey = groqKey;
        }

        console.log('[TG Cloud] App state restored from Telegram CloudStorage');

        // If we have API key and channel, skip setup and show app
        if (App.apiKey && App.channelData) {
            const auth = document.getElementById('authScreen');
            const app = document.getElementById('appWrapper');
            if (auth) auth.style.display = 'none';
            if (app) app.style.display = '';
            // Trigger re-render
            if (typeof renderProfile === 'function') renderProfile();
            if (typeof renderActivePage === 'function') renderActivePage();
            if (typeof startAutoRefresh === 'function') startAutoRefresh();
        }
    }
}
