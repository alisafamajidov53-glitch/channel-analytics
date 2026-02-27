// ===== AI FEATURES PRO (ai.js) =====
// AI Provider: Groq (free, multiple models)

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';
const GROQ_TEXT_MODEL = 'llama-3.3-70b-versatile';
const GROQ_DEFAULT_MODEL = 'groq_gpt120b';

// Full Groq Model Catalog (February 2026)
const GROQ_MODELS = {
    'groq_gpt120b': { id: 'openai/gpt-oss-120b', label: '🏆 GPT-OSS 120B (Best)', tokens: 8192, temp: 0.7 },
    'groq_gpt20b': { id: 'openai/gpt-oss-20b', label: '⚡ GPT-OSS 20B (Fast)', tokens: 8192, temp: 0.7 },
    'groq_llama70b': { id: 'llama-3.3-70b-versatile', label: '🦙 Llama 3.3 70B', tokens: 8192, temp: 0.7 },
    'groq_llama8b': { id: 'llama-3.1-8b-instant', label: '🦙 Llama 3.1 8B (Instant)', tokens: 4096, temp: 0.7 },
    'groq_qwen32b': { id: 'qwen/qwen3-32b', label: '🧠 Qwen3 32B (Reasoning)', tokens: 8192, temp: 0.6 },
    'groq_kimik2': { id: 'moonshotai/kimi-k2-instruct-0905', label: '🌙 Kimi K2', tokens: 8192, temp: 0.7 },
    'groq_gemma9b': { id: 'gemma2-9b-it', label: '💎 Gemma 2 9B', tokens: 8192, temp: 0.7 },
    'groq_compound': { id: 'compound-beta', label: '🔮 Compound Beta (Tools)', tokens: 8192, temp: 0.7 },
    'groq_vision': { id: 'meta-llama/llama-4-scout-17b-16e-instruct', label: '👁️ Llama 4 Scout (Vision)', tokens: 8192, temp: 0.7 },
};

const GROQ_STORE = 'ca_groq_key';
let groqKey = localStorage.getItem(GROQ_STORE) || '';

let lastAiProvider = '';

// Get selected model definition from dropdown
function getSelectedModel() {
    const sel = document.getElementById('aiModelSelect');
    const key = sel ? sel.value : 'auto';
    if (key === 'auto') return GROQ_MODELS[GROQ_DEFAULT_MODEL];
    return GROQ_MODELS[key] || GROQ_MODELS[GROQ_DEFAULT_MODEL];
}

async function aiCall(prompt, images = []) {
    lastAiProvider = '';
    if (!groqKey) { toast('Добавьте Groq API ключ для использования AI', 'error'); return null; }

    // === IMAGE ANALYSIS: Groq Vision ===
    if (images.length > 0) {
        toast('👁️ Groq Vision (Llama 4 Scout)...', 'info');
        const r = await tryGroqVision(prompt, images);
        if (r) { lastAiProvider = 'Groq Vision (Llama 4 Scout)'; return r; }
        return null;
    }

    // === TEXT: Use selected model ===
    const model = getSelectedModel();
    toast(`⚡ ${model.label}...`, 'info');
    const r = await tryGroq(prompt, model.id, model.tokens, model.temp);
    if (r) { lastAiProvider = `Groq — ${model.label}`; return r; }
    return null;
}


// Groq API (free, supports multiple models)
async function tryGroq(prompt, model = GROQ_TEXT_MODEL, maxTokens = 8192, temperature = 0.8) {
    try {
        const res = await fetch(GROQ_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groqKey}` },
            body: JSON.stringify({
                model: model,
                messages: [{ role: 'user', content: prompt }],
                temperature: temperature, max_tokens: maxTokens
            })
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            toast('Groq: ' + (err?.error?.message || res.status), 'error');
            return null;
        }
        const data = await res.json();
        return data.choices?.[0]?.message?.content || null;
    } catch (e) { toast('Groq error: ' + e.message, 'error'); return null; }
}

// Groq Vision API (free, Llama 4 Scout 17B — multimodal with image support)
async function tryGroqVision(prompt, images = []) {
    try {
        // Build multimodal content array for vision model
        const content = [];
        // Add images (limit to 5 for Groq Llama 4 Scout Vision)
        const limitedImages = images.slice(0, 5);
        for (const img of limitedImages) {
            content.push({
                type: 'image_url',
                image_url: { url: `data:image/jpeg;base64,${img}` }
            });
        }
        // Add text prompt
        content.push({ type: 'text', text: prompt });

        const res = await fetch(GROQ_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groqKey}` },
            body: JSON.stringify({
                model: GROQ_VISION_MODEL,
                messages: [{ role: 'user', content: content }],
                temperature: 0.7, max_tokens: 8192
            })
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            const msg = err?.error?.message || res.status;
            // If model not available, silently return null for fallback
            if (res.status === 404 || String(msg).includes('not found')) return null;
            toast('Groq Vision: ' + msg, 'error');
            return null;
        }
        const data = await res.json();
        return data.choices?.[0]?.message?.content || null;
    } catch (e) { toast('Groq Vision error: ' + e.message, 'error'); return null; }
}




// ===== AI VIDEO ANALYZER PRO =====
let extractedFrames = [];
let lastAiData = null;
let lastChannelReport = null;
let _lastVideoObjectURL = null;

// Model info descriptions for the info bar
const GROQ_MODEL_INFO = {
    'auto': { desc: '🤖 Auto-selects GPT-OSS 120B — OpenAI\'s flagship 120B model.', ctx: '8K tokens' },
    'groq_gpt120b': { desc: '🏆 GPT-OSS 120B — OpenAI\'s flagship open-weight model. Best quality for deep analysis.', ctx: '8K tokens' },
    'groq_gpt20b': { desc: '⚡ GPT-OSS 20B — Fast and capable. Good balance of speed and quality.', ctx: '8K tokens' },
    'groq_llama70b': { desc: '🦙 Llama 3.3 70B — Meta\'s versatile model. Great for general-purpose analysis.', ctx: '8K tokens' },
    'groq_llama8b': { desc: '🦙 Llama 3.1 8B — Fastest model. Instant responses for quick tasks.', ctx: '4K tokens' },
    'groq_qwen32b': { desc: '🧠 Qwen3 32B — Strong reasoning model. Best for math, logic, and complex analysis.', ctx: '8K tokens' },
    'groq_kimik2': { desc: '🌙 Kimi K2 — Moonshot AI model. Good creative and analytical output.', ctx: '8K tokens' },
    'groq_gemma9b': { desc: '💎 Gemma 2 9B — Google\'s instruction-tuned model. Compact and efficient.', ctx: '8K tokens' },
    'groq_compound': { desc: '🔮 Compound Beta — AI system with built-in web search and code execution.', ctx: '8K tokens' },
    'groq_vision': { desc: '👁️ Llama 4 Scout — Only model that can analyze video frames. Required for video upload.', ctx: '8K tokens' },
};

function updateModelInfoBar(val) {
    const infoEl = $('#aiModelInfoText');
    if (!infoEl) return;
    const info = GROQ_MODEL_INFO[val] || GROQ_MODEL_INFO['auto'];
    const ctxBadge = info.ctx ? `<span style="color:var(--text-muted);margin-left:8px">· ${info.ctx}</span>` : '';
    const groqBadge = `<span style="background:#f5517322;color:#f55173;border:1px solid #f5517344;padding:1px 8px;border-radius:8px;font-size:0.75rem;font-weight:700;margin-left:4px">Groq (free)</span>`;
    infoEl.innerHTML = info.desc + groqBadge + ctxBadge;
}

function initAI() {
    const zone = $('#uploadZone'), input = $('#videoFileInput');
    zone.onclick = () => input.click();
    zone.ondragover = e => { e.preventDefault(); zone.classList.add('dragover'); };
    zone.ondragleave = () => zone.classList.remove('dragover');
    zone.ondrop = e => { e.preventDefault(); zone.classList.remove('dragover'); if (e.dataTransfer.files[0]) handleVideo(e.dataTransfer.files[0]); };
    input.onchange = () => { if (input.files[0]) handleVideo(input.files[0]); };
    $('#btnAnalyze').onclick = analyzeVideo;
    $('#btnAiTips').onclick = generateAiTips;
    $('#btnFullChannelAnalysis').onclick = fullChannelAnalysis;

    // New Video Script & Idea Generator
    const btnIdeaGen = $('#btnGenerateIdeas');
    if (btnIdeaGen) {
        btnIdeaGen.onclick = generateVideoScript;
    }

    // Wire up model info bar
    const modelSel = $('#aiModelSelect');
    if (modelSel) {
        modelSel.addEventListener('change', () => updateModelInfoBar(modelSel.value));
        updateModelInfoBar(modelSel.value);
    }
}

function handleVideo(file) {
    if (file.size > 100 * 1024 * 1024) { toast('File too large (max 100MB)', 'error'); return; }
    if (_lastVideoObjectURL) { URL.revokeObjectURL(_lastVideoObjectURL); }
    const url = URL.createObjectURL(file);
    _lastVideoObjectURL = url;
    const vid = $('#previewVideo');
    vid.src = url;
    $('#aiPreview').style.display = 'block';
    $('#aiResults').style.display = 'none';
    extractedFrames = [];
    window._videoMeta = { fileName: file.name, fileSize: (file.size / 1024 / 1024).toFixed(1) + ' MB', fileType: file.type };
    vid.onloadedmetadata = () => {
        const duration = vid.duration;
        window._videoMeta.duration = duration;
        window._videoMeta.durationFmt = duration >= 3600 ? `${Math.floor(duration / 3600)}h ${Math.floor((duration % 3600) / 60)}m` : `${Math.floor(duration / 60)}m ${Math.floor(duration % 60)}s`;
        window._videoMeta.width = vid.videoWidth || 0;
        window._videoMeta.height = vid.videoHeight || 0;
        window._videoMeta.resolution = `${vid.videoWidth || '?'}x${vid.videoHeight || '?'}`;
        window._videoMeta.isVertical = (vid.videoHeight || 0) > (vid.videoWidth || 0);
        window._videoMeta.isShort = duration <= 60 || window._videoMeta.isVertical;
        // Groq API supports max 5 images per request. 
        // We capture: Opening, 25%, 50%, 75%, Ending.
        const times = [0.3]; // Always capture opening frame
        const keyPoints = [0.25, 0.50, 0.75]; // Mid points
        keyPoints.forEach(p => {
            const t = duration * p;
            if (t > 0.5 && t < duration - 0.5) times.push(t);
        });
        times.push(Math.max(0, duration - 0.3)); // Always capture ending frame

        times.sort((a, b) => a - b);
        // Remove duplicates within 1s and strictly limit to 5 frames
        let uniqueTimes = [times[0]];
        for (let i = 1; i < times.length; i++) {
            if (times[i] - uniqueTimes[uniqueTimes.length - 1] >= 1.0) uniqueTimes.push(times[i]);
        }
        if (uniqueTimes.length > 5) {
            uniqueTimes = uniqueTimes.slice(0, 5);
        }
        extractFrames(vid, uniqueTimes);
    };
}

function extractFrames(vid, times) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const framesEl = $('#aiFrames');
    framesEl.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:8px">⏳ Extracting frames... 0/' + times.length + '</div>';
    extractedFrames = [];
    let idx = 0;
    let seekTimeout = null;

    const processFrame = () => {
        clearTimeout(seekTimeout);
        // Higher resolution for better AI analysis — 1280px
        const w = Math.min(vid.videoWidth || 1280, 1280);
        const h = Math.round(w * (vid.videoHeight || 720) / (vid.videoWidth || 1280));
        canvas.width = w; canvas.height = h;
        ctx.drawImage(vid, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        const ts = times[idx];
        const tsFmt = `${Math.floor(ts / 60)}:${Math.floor(ts % 60).toString().padStart(2, '0')}`;
        extractedFrames.push({ base64: dataUrl.split(',')[1], timestamp: ts, timestampFmt: tsFmt, index: idx + 1, position: idx === 0 ? 'opening' : idx === times.length - 1 ? 'ending' : `mid-${Math.round(ts / (window._videoMeta?.duration || 1) * 100)}%` });
        framesEl.innerHTML = '';
        // Show all extracted frames with timestamps
        extractedFrames.forEach((f, fi) => {
            const frameWrapper = document.createElement('div');
            frameWrapper.className = 'frame-preview-item';
            const im = document.createElement('img');
            im.src = 'data:image/jpeg;base64,' + f.base64;
            im.title = `Frame ${f.index} — ${f.timestampFmt} (${f.position})`;
            const label = document.createElement('span');
            label.className = 'frame-preview-label';
            label.textContent = `#${f.index} ${f.timestampFmt}`;
            frameWrapper.appendChild(im);
            frameWrapper.appendChild(label);
            framesEl.appendChild(frameWrapper);
        });
        // Show progress
        const prog = document.createElement('div');
        prog.style.cssText = 'color:var(--text-muted);font-size:13px;padding:8px;text-align:center;width:100%';
        prog.textContent = `✅ ${extractedFrames.length}/${times.length} frames extracted`;
        framesEl.appendChild(prog);

        idx++;
        if (idx < times.length) {
            const nextIdx = idx;
            seekTimeout = setTimeout(() => {
                // If seek doesn't fire in 3s, skip this frame and move to next
                console.warn('Frame seek timeout, skipping frame', nextIdx);
                vid.onseeked = null;
                idx = nextIdx + 1;
                if (idx < times.length) {
                    vid.onseeked = processFrame;
                    vid.currentTime = times[idx];
                } else {
                    console.log('Frame extraction complete (with skips):', extractedFrames.length, 'frames');
                }
            }, 3000);
            vid.onseeked = processFrame;
            vid.currentTime = times[idx];
        } else {
            console.log('Frame extraction complete:', extractedFrames.length, 'frames');
        }
    };

    vid.onseeked = processFrame;
    seekTimeout = setTimeout(() => {
        if (extractedFrames.length === 0) {
            framesEl.innerHTML = '<div style="color:var(--accent-orange);padding:8px">⚠️ Could not extract frames — video may still be loadable by AI</div>';
        }
    }, 5000);
    vid.currentTime = times[0];
}

// ===== PRO VIDEO ANALYSIS WITH CHAIN-OF-THOUGHT =====
async function analyzeVideo() {
    if (!extractedFrames.length) { toast('Upload a video first', 'error'); return; }
    if (!groqKey) { toast('Add your Groq API Key', 'error'); return; }
    const btn = $('#btnAnalyze');
    btn.disabled = true;
    btn.innerHTML = '<div class="loader-ring small-ring" style="width:22px;height:22px;border-width:2px;display:inline-block;vertical-align:middle"></div> 🧠 Deep AI analysis in progress...';

    const chCtx = channelData ? `\nChannel: "${channelData.title}", ${fmtN(channelData.subs)} subs, ${fmtN(channelData.totalViews)} total views.` : '';
    const topTags = videos.length ? '\nPopular tags: ' + [...new Set(videos.flatMap(v => v.tags))].slice(0, 20).join(', ') : '';
    const bt = bestTime(videos);
    const timeCtx = bt ? `\nBest post time: ${bt.day} ${bt.time}` : '';
    const frameDescs = extractedFrames.map(f => `#${f.index} ${f.timestampFmt} (${f.position})`).join(', ');

    // Get target audience from selector
    const audienceSel = $('#audienceSelect');
    const audience = audienceSel ? audienceSel.value : 'us';

    // Choose output language based on target audience
    const audienceLabels = { 'us': 'US', 'global': 'Global', 'ru': 'Russian', 'eu': 'European' };
    const audienceLabel = audienceLabels[audience] || 'US';
    const langInstructions = {
        'us': 'US/English-speaking audience. **IMPORTANT: You MUST write your ENTIRE final JSON response strictly in ENGLISH.**',
        'global': 'Global/International audience. **IMPORTANT: You MUST write your ENTIRE final JSON response strictly in ENGLISH.**',
        'ru': 'Russian-speaking audience. **CRITICAL: You MUST write your ENTIRE final JSON response strictly in RUSSIAN (Русский язык). All strings including mainTopic, contentType, videoContentSummary, mood, scene, descriptions, scripts, ideas, tips, etc., MUST be in Russian. Do not output English.**',
        'eu': 'European audience. **IMPORTANT: You MUST write your ENTIRE final JSON response strictly in ENGLISH, tailoring to diverse European cultures.**'
    };
    const targetLanguageGuide = langInstructions[audience] || langInstructions['us'];

    const prompt = `You are an elite YouTube content analyst and growth strategist targeting a ${targetLanguageGuide}
    
INTERNAL CHAIN-OF-THOUGHT (use this reasoning process internally, do NOT output it):
1. OBSERVE: Scan every frame systematically — objects, people, text, colors, composition
2. IDENTIFY: What is the core topic? What format? What niche?
3. NARRATIVE: How do frames connect? What story arc emerges?
4. EMOTION: Map emotional intensity per frame — where are peaks and valleys?
5. RETENTION: Where would viewers drop off? Where would they stay?
6. VIRAL: What elements make this shareable? What's missing?
7. COLOR PSYCHOLOGY: What moods do the colors evoke? Are they stopping the scroll?
8. OPTIMIZE: Based on all above, generate specific, content-accurate recommendations

VIDEO INFO:
- File: ${window._videoMeta?.fileName || '?'} | Duration: ${window._videoMeta?.durationFmt || '?'} (${Math.round(window._videoMeta?.duration || 0)}s)
- Resolution: ${window._videoMeta?.resolution || '?'} | Format: ${window._videoMeta?.isVertical ? 'VERTICAL (Short)' : 'HORIZONTAL'}
- ${extractedFrames.length} frames: ${frameDescs}
${chCtx}${topTags}${timeCtx}

CRITICAL: ALL output MUST be based on ACTUAL visual content in frames. No generic filler.

RESPOND IN STRICT JSON (no markdown, no code blocks):
{
  "mainTopic": "One sentence: what this video is actually about",
  "contentType": "tutorial|review|vlog|gameplay|reaction|cooking|educational|entertainment|other",
  "videoContentSummary": "4-5 sentences describing actual content. Be specific about topics, products, techniques shown.",
  "retentionAnalysis": {
    "hookStrength": 85,
    "hookAnalysis": "Analysis of first 3 seconds — what grabs attention, what's missing",
    "predictedDropoffs": ["0:15 — reason viewers might leave", "1:30 — pacing issue"],
    "retentionTips": ["Add pattern interrupt at 0:10", "Tease payoff at 0:05", "Add visual variety at 1:00"],
    "predictedAvgViewDuration": "65%",
    "emotionalArc": "Opening: high energy → Middle: builds curiosity → End: satisfying payoff (or issues)"
  },
  "viralScore": 85,
  "viralBreakdown": {
    "shareability": 20,
    "emotionalTrigger": 22,
    "trendAlignment": 18,
    "productionQuality": 25,
    "total": 85
  },
  "viralExplanation": "Why this score — reference specific frames and content elements",
  "algorithmTips": "5 specific tips referencing actual content",
  "contentStrengths": "3 strengths visible in frames",
  "contentWeaknesses": "3 weaknesses with specific frame references",
  "improvementPlan": [
    {"priority": "HIGH", "action": "Specific improvement", "impact": "Expected result"},
    {"priority": "MEDIUM", "action": "Another improvement", "impact": "Expected result"},
    {"priority": "LOW", "action": "Nice to have", "impact": "Expected result"}
  ],
  "frameAnalysis": [{"frame": 1, "timestamp": "0:00", "scene": "Description", "textOnScreen": "text or none", "objects": ["obj1"], "mood": "exciting", "thumbnailCandidate": true, "retentionRisk": "low|medium|high"}],
  "keyMoments": [{"timestamp": "0:00", "description": "What happens"}],
  "sceneBreakdown": "Scene-by-scene narrative connecting all frames",
  "titles": ["🔥 Title 1 about ACTUAL topic","😱 Title 2","💀 Title 3","🤯 Title 4","⚡ Title 5","🚀 Title 6","😤 Title 7","🎯 Title 8","💯 Title 9","🏆 Title 10"],
  "description": "Full 500+ word SEO description with hook, timestamps, CTAs, FAQ, hashtags",
  "tags": ["25 relevant tags"],
  "hashtags": ["#12 trending hashtags"],
  "hookScript": "4 hook options for first 3 seconds + pattern interrupt (4-5s) + retention checkpoint (30s) + mid-roll hook",
  "thumbnailIdeas": "4 concepts referencing actual frames with text overlays and colors",
  "ctaSuggestions": "Pinned comment + end screen + mid-roll CTA + community post",
  "bestPostTime": "Day+time for ${audienceLabel} audience with reasoning",
  "proTips": "10 specific tips based on actual content analysis"
}`;

    const frames = extractedFrames.slice(0, 16).map(f => f.base64);
    const result = await aiCall(prompt, frames);
    btn.disabled = false;
    btn.innerHTML = `🚀 ${typeof t === 'function' ? t('ai_btn_analyze') : 'Analyze with AI'}`;

    if (!result) return;
    const data = parseAiJson(result);
    if (data) {
        lastAiData = data;
        displayAIResults(data);
        saveHistory(data);
        const providerMsg = lastAiProvider ? ` — ${lastAiProvider}` : '';
        toast(`✅ AI analysis complete${providerMsg}`, 'success');
    } else {
        toast('AI response format error — try again', 'error');
    }
}

function displayAIResults(data) {
    $('#aiResults').style.display = 'block';

    // === PROVIDER BADGE ===
    const providerBadgeEl = $('#aiProviderBadge');
    if (providerBadgeEl) {
        if (lastAiProvider) {
            providerBadgeEl.style.display = 'inline-flex';
            providerBadgeEl.innerHTML = `⚡ ${lastAiProvider}`;
            providerBadgeEl.style.cssText += `;background:linear-gradient(90deg,#f55173,#c026d3);color:#fff;padding:5px 14px;border-radius:20px;font-size:0.82rem;font-weight:700;letter-spacing:0.3px;align-items:center;gap:6px;border:none;box-shadow:0 2px 12px rgba(0,0,0,0.3)`;
        } else {
            providerBadgeEl.style.display = 'none';
        }
    }

    // === VIDEO CONTENT ANALYSIS (NEW — shown first) ===
    const contentEl = $('#aiContentSummary');
    if (contentEl) {
        let contentHtml = '';
        // Main topic & content type
        if (data.mainTopic || data.contentType) {
            contentHtml += `<div class="content-summary-box">`;
            if (data.mainTopic) contentHtml += `<div class="content-topic"><span class="content-topic-label" data-i18n="ai_main_topic">🎯 Main Topic:</span> <strong>${data.mainTopic}</strong></div>`;
            if (data.contentType) contentHtml += `<div class="content-type-badge">${data.contentType.toUpperCase()}</div>`;
            contentHtml += `</div>`;
        }
        if (data.videoContentSummary) {
            contentHtml += `<div class="content-summary-text">${fmt(data.videoContentSummary)}</div>`;
        }
        contentEl.innerHTML = contentHtml || '<div class="empty-state-small">No content analysis available</div>';
    }

    // === PER-FRAME ANALYSIS (NEW) ===
    const framesAnalysisEl = $('#aiFrameAnalysis');
    if (framesAnalysisEl) {
        const frameData = data.frameAnalysis || [];
        if (frameData.length > 0) {
            framesAnalysisEl.innerHTML = `<div class="frame-analysis-grid">` +
                frameData.map((f, i) => {
                    const frameImg = extractedFrames[i] ? `<img src="data:image/jpeg;base64,${extractedFrames[i].base64}" class="frame-analysis-thumb" loading="lazy">` : '';
                    const objectTags = (f.objects || []).map(o => `<span class="frame-object-tag">${o}</span>`).join('');
                    const moodColor = { exciting: '#22c55e', calm: '#4f8fff', tense: '#f59e0b', funny: '#ec4899', informative: '#8b5cf6' }[f.mood] || 'var(--text-muted)';
                    return `<div class="frame-analysis-item">
                        ${frameImg}
                        <div class="frame-analysis-info">
                            <div class="frame-analysis-header">
                                <span class="frame-number">#${f.frame || i + 1}</span>
                                <span class="frame-timestamp">${f.timestamp || ''}</span>
                                <span class="frame-mood" style="color:${moodColor}">${f.mood || ''}</span>
                                ${f.thumbnailCandidate ? '<span class="frame-thumb-badge">🖼 THUMB</span>' : ''}
                            </div>
                            <div class="frame-analysis-scene">${f.scene || ''}</div>
                            ${f.textOnScreen && f.textOnScreen !== 'none' ? `<div class="frame-text-detected"><span class="text-icon">📝</span> ${f.textOnScreen}</div>` : ''}
                            ${objectTags ? `<div class="frame-objects">${objectTags}</div>` : ''}
                        </div>
                    </div>`;
                }).join('') + `</div>`;
        } else {
            framesAnalysisEl.innerHTML = '';
        }
    }

    // === KEY MOMENTS (NEW) ===
    const momentsEl = $('#aiKeyMoments');
    if (momentsEl) {
        const moments = data.keyMoments || [];
        if (moments.length > 0) {
            momentsEl.innerHTML = `<div class="key-moments-list">` +
                moments.map(m => `<div class="key-moment-item">
                    <span class="moment-timestamp">${m.timestamp}</span>
                    <span class="moment-desc">${m.description}</span>
                </div>`).join('') + `</div>`;
        } else {
            momentsEl.innerHTML = '';
        }
    }

    // === RETENTION ANALYSIS (NEW) ===
    const retEl = $('#aiRetentionAnalysis');
    if (retEl && data.retentionAnalysis) {
        const ra = data.retentionAnalysis;
        const hookScore = ra.hookStrength || 50;
        const hookColor = hookScore >= 80 ? '#22c55e' : hookScore >= 60 ? '#4f8fff' : hookScore >= 40 ? '#f59e0b' : '#ef4444';
        let retHtml = `<div class="retention-section">
            <div class="retention-hook">
                <div class="retention-hook-header">
                    <span class="retention-label">🎣 Hook Strength (First 3 Seconds)</span>
                    <span class="retention-score" style="color:${hookColor};font-size:28px;font-weight:900">${hookScore}/100</span>
                </div>
                <div class="retention-bar"><div class="retention-bar-fill" style="width:${hookScore}%;background:${hookColor}"></div></div>
                <div class="retention-hook-detail">${fmt(ra.hookAnalysis || '')}</div>
            </div>`;
        if (ra.predictedAvgViewDuration) retHtml += `<div class="retention-avg"><span>📊 Predicted Avg View Duration:</span><strong>${ra.predictedAvgViewDuration}</strong></div>`;
        if (ra.emotionalArc) retHtml += `<div class="retention-arc"><span>🎭 Emotional Arc:</span><div>${fmt(ra.emotionalArc)}</div></div>`;
        if (ra.predictedDropoffs?.length) {
            retHtml += `<div class="retention-dropoffs"><h5>⚠️ Predicted Drop-off Points:</h5>`;
            ra.predictedDropoffs.forEach(d => { retHtml += `<div class="dropoff-item">📍 ${fmt(d)}</div>`; });
            retHtml += `</div>`;
        }
        if (ra.retentionTips?.length) {
            retHtml += `<div class="retention-tips"><h5>💡 Retention Tips:</h5>`;
            ra.retentionTips.forEach(t => { retHtml += `<div class="retention-tip-item">✅ ${fmt(t)}</div>`; });
            retHtml += `</div>`;
        }
        retHtml += `</div>`;
        retEl.innerHTML = retHtml;
    }

    // === VIRAL SCORE with BREAKDOWN ===
    const vs = data.viralScore || 50;
    const vsColor = vs >= 80 ? '#22c55e' : vs >= 60 ? '#4f8fff' : vs >= 40 ? '#f59e0b' : '#ef4444';
    const vsLabel = vs >= 80 ? '🔥 HIGH VIRAL POTENTIAL — This can blow up!' : vs >= 60 ? '👍 Good potential — optimize for maximum reach' : vs >= 40 ? '⚠️ Needs work — follow tips below' : '📉 Low potential — major improvements needed';
    let viralHtml = `
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px">
            <div style="font-size:52px;font-weight:900;color:${vsColor};text-shadow:0 0 30px ${vsColor}44">${vs}<span style="font-size:24px;opacity:0.6">/100</span></div>
            <div style="flex:1">
                <div style="background:rgba(255,255,255,0.08);border-radius:20px;height:18px;overflow:hidden;box-shadow:inset 0 2px 4px rgba(0,0,0,0.3)">
                    <div style="width:${vs}%;height:100%;background:linear-gradient(90deg,${vsColor},${vsColor}aa);border-radius:20px;transition:width 1.5s cubic-bezier(0.4,0,0.2,1);box-shadow:0 0 15px ${vsColor}66"></div>
                </div>
                <div style="margin-top:8px;color:var(--text-muted);font-size:13px;font-weight:600">${vsLabel}</div>
            </div>
        </div>`;
    // Viral breakdown sub-scores
    if (data.viralBreakdown) {
        const vb = data.viralBreakdown;
        const subScores = [
            { label: '📤 Shareability', val: vb.shareability || 0, max: 25, color: '#4f8fff' },
            { label: '❤️ Emotional Trigger', val: vb.emotionalTrigger || 0, max: 25, color: '#ec4899' },
            { label: '📈 Trend Alignment', val: vb.trendAlignment || 0, max: 25, color: '#22c55e' },
            { label: '🎨 Production Quality', val: vb.productionQuality || 0, max: 25, color: '#a855f7' }
        ];
        viralHtml += `<div class="viral-breakdown">`;
        subScores.forEach(s => {
            const pct = (s.val / s.max * 100).toFixed(0);
            viralHtml += `<div class="viral-sub-score">
                <div class="viral-sub-label">${s.label}</div>
                <div class="viral-sub-bar"><div class="viral-sub-fill" style="width:${pct}%;background:${s.color}"></div></div>
                <div class="viral-sub-value" style="color:${s.color}">${s.val}/${s.max}</div>
            </div>`;
        });
        viralHtml += `</div>`;
    }
    $('#aiViralScore').innerHTML = viralHtml;

    // === IMPROVEMENT PLAN (NEW) ===
    let tipsHtml = fmt(data.viralExplanation || '') + '<br><br><strong>🎯 Algorithm Tips:</strong><br>' + fmt(data.algorithmTips || '')
        + (data.contentStrengths ? '<br><br><strong>💪 Strengths:</strong><br>' + fmt(data.contentStrengths) : '')
        + (data.contentWeaknesses ? '<br><br><strong>⚠️ Weaknesses:</strong><br>' + fmt(data.contentWeaknesses) : '');

    if (data.improvementPlan?.length) {
        tipsHtml += '<br><br><div class="improvement-plan"><strong>📋 Improvement Plan:</strong>';
        data.improvementPlan.forEach(item => {
            const prColor = item.priority === 'HIGH' ? '#ef4444' : item.priority === 'MEDIUM' ? '#f59e0b' : '#22c55e';
            tipsHtml += `<div class="improvement-item">
                <span class="improvement-priority" style="background:${prColor}20;color:${prColor};border:1px solid ${prColor}44">${item.priority}</span>
                <div class="improvement-detail"><strong>${item.action}</strong><br><small style="color:var(--text-muted)">Impact: ${item.impact}</small></div>
            </div>`;
        });
        tipsHtml += '</div>';
    }
    tipsHtml += (data.sceneBreakdown ? '<br><details style="cursor:pointer;color:var(--accent-blue)"><summary><strong>🎬 Scene-by-Scene Breakdown (click to expand)</strong></summary><br>' + fmt(data.sceneBreakdown) + '</details>' : '');
    $('#aiAlgorithmTips').innerHTML = tipsHtml;

    // Titles
    const titles = data.titles || [];
    $('#aiTitles').innerHTML = titles.map((t, i) => {
        return `<div class="ai-title-option" onclick="this.classList.toggle('selected')">
            <span class="title-num">#${i + 1}</span><span class="title-text">${esc(t)}</span>
            <button class="copy-btn" onclick="event.stopPropagation();navigator.clipboard.writeText(this.closest('.ai-title-option').querySelector('.title-text').textContent);toast('Copied!','success')">📋</button></div>`;
    }).join('');

    // Description
    $('#aiDescription').value = data.description || '';

    // Tags
    const tags = data.tags || [];
    $('#aiTags').innerHTML = tags.map(t => `<span class="ai-tag-item" onclick="navigator.clipboard.writeText(this.textContent);toast('Tag copied','success')">${esc(t)}</span>`).join('');

    // Hashtags
    const hashtags = data.hashtags || [];
    $('#aiHashtags').innerHTML = hashtags.map(t => `<span class="ai-hashtag">${t}</span>`).join('');

    // Hook
    $('#aiHook').innerHTML = fmt(data.hookScript || 'No hook script generated');

    // Thumbnail
    $('#aiThumbnail').innerHTML = fmt(data.thumbnailIdeas || 'No thumbnail ideas generated');

    // CTA
    $('#aiCTA').innerHTML = fmt(data.ctaSuggestions || 'No CTA suggestions generated');

    // Publish time
    $('#aiPublishTime').innerHTML = fmt(data.bestPostTime || 'No posting time suggestion');

    // Pro tips
    $('#aiRecommendations').innerHTML = fmt(data.proTips || 'No pro tips generated');

    // Smooth scroll to results
    setTimeout(() => $('#aiResults').scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
}

function fmt(text) {
    if (!text) return '';
    return text
        .replace(/\\n/g, '\n')
        .replace(/### (.+)/g, '<h4 style="color:var(--accent-blue);margin:12px 0 6px">$1</h4>')
        .replace(/## (.+)/g, '<h3 style="color:var(--accent-purple);margin:16px 0 8px">$1</h3>')
        .replace(/# (.+)/g, '<h2 style="color:var(--text-primary);margin:20px 0 10px">$1</h2>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code style="background:rgba(79,143,255,0.15);padding:2px 6px;border-radius:4px;font-size:13px">$1</code>')
        .replace(/\n(\d+)\.\s/g, '\n<br><strong style="color:var(--accent-blue)">$1.</strong> ')
        .replace(/\n[-•]\s/g, '\n<br>• ')
        .replace(/\n\s*[-•]\s/g, '\n<br>&nbsp;&nbsp;• ')
        .replace(/\n/g, '<br>')
        .replace(/---/g, '<hr style="border:none;border-top:1px solid var(--border);margin:12px 0">');
}

// Robust JSON parser with multiple fallback strategies
function parseAiJson(raw) {
    if (!raw) return null;
    // Strategy 1: Direct parse after cleanup
    try {
        const clean = raw.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
        return JSON.parse(clean);
    } catch (e) { /* try next */ }
    // Strategy 2: Extract JSON object from mixed content
    try {
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) return JSON.parse(jsonMatch[0]);
    } catch (e) { /* try next */ }
    // Strategy 3: Fix common JSON issues (trailing commas, unescaped newlines)
    try {
        let fixed = raw.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
        const jsonMatch = fixed.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            fixed = jsonMatch[0]
                .replace(/,\s*([}\]])/g, '$1')  // trailing commas
                .replace(/(["'])\s*\n\s*/g, '$1 ') // unescaped newlines in strings
                .replace(/\\'/g, "'");  // escaped single quotes
            return JSON.parse(fixed);
        }
    } catch (e) { /* all strategies failed */ }
    console.error('All JSON parsing strategies failed for:', raw.slice(0, 200));
    return null;
}

// Regenerate the last video analysis
window.regenerateAnalysis = async function () {
    if (!extractedFrames.length) { toast('No video loaded — upload a video first', 'error'); return; }
    toast('🔄 Regenerating analysis...', 'info');
    await analyzeVideo();
};

// ===== EXPORT TO TEXT =====
window.exportAiResults = function () {
    if (!lastAiData) { toast('No analysis to export', 'error'); return; }
    const d = lastAiData;
    let txt = `${'═'.repeat(60)}
    AI VIDEO ANALYSIS REPORT — PRO
    Generated: ${new Date().toLocaleString()}
    Channel: ${channelData?.title || 'N/A'}
${'═'.repeat(60)}

🔥 VIRAL SCORE: ${d.viralScore || '?'}/100
${d.viralExplanation || ''}

📊 ALGORITHM TIPS:
${d.algorithmTips || ''}

${'═'.repeat(60)}
🎯 CLICKBAIT TITLES (Pick the best one):
${'═'.repeat(60)}
${(d.titles || []).map((t, i) => `  ${i + 1}. ${t}`).join('\n')}

${'═'.repeat(60)}
📝 YOUTUBE DESCRIPTION (Copy to YouTube):
${'═'.repeat(60)}
${d.description || ''}

${'═'.repeat(60)}
🏷 SEO TAGS (Copy all):
${'═'.repeat(60)}
${(d.tags || []).join(', ')}

#️⃣ HASHTAGS:
${(d.hashtags || []).join(' ')}

${'═'.repeat(60)}
🪝 HOOK SCRIPT (First 3 Seconds):
${'═'.repeat(60)}
${(d.hookScript || '').replace(/\\n/g, '\n')}

${'═'.repeat(60)}
🖼 THUMBNAIL IDEAS:
${'═'.repeat(60)}
${(d.thumbnailIdeas || '').replace(/\\n/g, '\n')}

${'═'.repeat(60)}
📢 CALL-TO-ACTION & PINNED COMMENT:
${'═'.repeat(60)}
${(d.ctaSuggestions || '').replace(/\\n/g, '\n')}

${'═'.repeat(60)}
⏰ BEST POSTING TIME:
${'═'.repeat(60)}
${(d.bestPostTime || '').replace(/\\n/g, '\n')}

${'═'.repeat(60)}
💡 PRO TIPS & ALGORITHM HACKS:
${'═'.repeat(60)}
${(d.proTips || '').replace(/\\n/g, '\n')}

${'═'.repeat(60)}
Report generated by Channel Analytics Pro
`;
    downloadText(txt, `video_analysis_${Date.now()}.txt`);
    toast('📄 Report exported!', 'success');
};

function downloadText(content, filename) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    const objUrl = URL.createObjectURL(blob);
    a.href = objUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objUrl);
}

// ===== FULL CHANNEL ANALYSIS =====
async function fullChannelAnalysis() {
    if (!groqKey) { toast('Add Groq API Key', 'error'); return; }
    if (videos.length < 2) { toast('Connect channel and load videos first', 'error'); return; }
    const btn = $('#btnFullChannelAnalysis');
    btn.disabled = true;
    btn.innerHTML = '<div class="loader-ring small-ring" style="width:22px;height:22px;border-width:2px;display:inline-block;vertical-align:middle"></div> Analyzing entire channel...';

    const top10 = [...videos].sort((a, b) => b.views - a.views).slice(0, 10)
        .map(v => `"${v.title}" — ${fmtN(v.views)} views, ${eng(v).toFixed(1)}% engagement, posted ${v.date} at ${v.time}`).join('\n');
    const worst5 = [...videos].sort((a, b) => eng(a) - eng(b)).slice(0, 5)
        .map(v => `"${v.title}" — ${fmtN(v.views)} views, ${eng(v).toFixed(1)}% engagement`).join('\n');
    const bt = bestTime(videos), wt = worstTime(videos);
    const vi = videos.filter(v => v.type === 'video'), sh = videos.filter(v => v.type === 'short');
    const allTags = [...new Set(videos.flatMap(v => v.tags))].slice(0, 40).join(', ');
    const viEng = vi.length ? (vi.reduce((s, v) => s + eng(v), 0) / vi.length).toFixed(1) : '0';
    const shEng = sh.length ? (sh.reduce((s, v) => s + eng(v), 0) / sh.length).toFixed(1) : '0';

    // Posting frequency
    const dates = videos.map(v => new Date(v.date).getTime()).sort();
    const gaps = [];
    for (let i = 1; i < dates.length; i++) gaps.push(dates[i] - dates[i - 1]);
    const avgGap = gaps.length ? (gaps.reduce((s, g) => s + g, 0) / gaps.length / 86400000).toFixed(1) : 'unknown';

    // Hour distribution
    const hourDist = {};
    videos.forEach(v => { const h = parseInt(v.time) || 0; hourDist[h] = (hourDist[h] || 0) + 1; });
    const topHours = Object.entries(hourDist).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([h, c]) => `${h}:00 (${c} videos)`).join(', ');

    // Day distribution
    const dayDist = {};
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    videos.forEach(v => { const d = new Date(v.date).getDay(); dayDist[dayNames[d]] = (dayDist[dayNames[d]] || 0) + 1; });
    const topDays = Object.entries(dayDist).sort((a, b) => b[1] - a[1]).map(([d, c]) => `${d} (${c})`).join(', ');

    // Recent growth trend
    const recent30 = [...videos].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 30);
    const recentAvgViews = recent30.length ? Math.round(recent30.reduce((s, v) => s + v.views, 0) / recent30.length) : 0;
    const olderVids = [...videos].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(30, 60);
    const olderAvgViews = olderVids.length ? Math.round(olderVids.reduce((s, v) => s + v.views, 0) / olderVids.length) : 0;
    const growthTrend = olderAvgViews > 0 ? ((recentAvgViews - olderAvgViews) / olderAvgViews * 100).toFixed(0) : 'N/A';

    // Get output language preference for full channel analysis
    const isRu = (typeof currentLang !== 'undefined' && currentLang === 'ru');
    const langOutput = isRu
        ? '**CRITICAL: You MUST write your ENTIRE ANALYSIS strictly in RUSSIAN (Русский язык). ВЕСЬ ОТВЕТ ТОЛЬКО НА РУССКОМ ЯЗЫКЕ!**'
        : '**IMPORTANT: You MUST write your ENTIRE ANALYSIS strictly in ENGLISH.**';

    const prompt = `You are the #1 YouTube growth strategist in the world. Perform a COMPREHENSIVE, EXTREMELY DETAILED channel analysis. Be brutally honest and incredibly specific — NO generic advice allowed.

${langOutput}

CHANNEL DATA:
- Name: "${channelData?.title || 'Channel'}"
- Subscribers: ${fmtN(channelData?.subs || 0)}
- Total views: ${fmtN(channelData?.totalViews || 0)}
- Total videos: ${videos.length} (${vi.length} long-form videos, ${sh.length} shorts)
- Average engagement: ${avgEng().toFixed(1)}%
- Video engagement avg: ${viEng}% | Shorts engagement avg: ${shEng}%
- Posting frequency: every ${avgGap} days on average
- Most used posting hours: ${topHours}
- Posting days: ${topDays}
- Best performing time: ${bt ? bt.day + ' at ' + bt.time : 'not enough data'}
- Worst performing time: ${wt ? wt.day + ' at ' + wt.time : 'not enough data'}
- Common tags: ${allTags || 'none found'}
- Recent 30 videos avg views: ${fmtN(recentAvgViews)}
- Previous 30 videos avg views: ${fmtN(olderAvgViews)}
- Growth trend: ${growthTrend}%

TOP 10 BEST PERFORMING VIDEOS:
${top10}

BOTTOM 5 WORST PERFORMING (by engagement):
${worst5}

Provide a COMPREHENSIVE analysis covering ALL of these:

**📊 1. CHANNEL HEALTH SCORE (X/100)**
Rate the channel overall. Break down: Content quality, consistency, SEO, audience engagement, growth trajectory. Give letter grade (A-F) for each.

**🔬 2. DEEP CONTENT ANALYSIS**
- What patterns make top videos successful? (specific elements: titles, topics, timing)
- Why did bottom videos fail? (specific issues)
- Content gap analysis: What's missing that the audience wants?
- Content saturation: What topics are overdone?

**🎯 3. OPTIMAL POSTING SCHEDULE**
- EXACT days and times (EST) for long-form videos
- EXACT days and times (EST) for shorts
- How many videos per week optimal
- How many shorts per week optimal
- Worst times to NEVER post

**📈 4. GROWTH STRATEGY — 10 Steps**
Specific, actionable steps. Each step with expected subscriber impact.

**🎬 5. CONTENT CALENDAR (Next 14 Days)**
14 specific video ideas with clickbait titles (with emojis), whether video or short, and posting time.

**🏷 6. TAG & SEO STRATEGY**
- Top 10 tags to use consistently
- Tags to STOP using
- 5 new tag opportunities
- Title formula that works for this channel
- Description template

**📱 7. SHORTS STRATEGY**
- Best shorts format for this niche
- How to repurpose long-form into shorts
- Shorts-to-long-form funnel strategy
- Optimal shorts length and posting frequency

**🔥 8. VIRAL FORMULA**
Based on top content, what is this channel's unique viral recipe? Pattern analysis.

**⚠️ 9. CRITICAL MISTAKES (Top 5)**
What is actively HURTING growth right now? Ranked by severity.

**💰 10. MONETIZATION OPTIMIZATION**
Revenue strategies beyond AdSense for this channel's audience and niche.

**🤝 11. COLLABORATION STRATEGY**
Types of creators to collab with, how to approach them, collab video ideas.

**📊 12. COMPETITIVE ANALYSIS**
How does this channel compare to similar channels? What are competitors doing better?

Use emojis extensively, **bold text** for key points. Be EXTREMELY specific — every tip should be immediately actionable. Reference the actual video data provided.`;

    const result = await aiCall(prompt);
    btn.disabled = false;
    btn.innerHTML = '📊 Full Channel Analysis';

    if (result) {
        lastChannelReport = result;
        $('#channelAnalysisResults').style.display = 'block';
        $('#channelAnalysisContent').innerHTML = fmt(result);
        setTimeout(() => $('#channelAnalysisResults').scrollIntoView({ behavior: 'smooth' }), 100);
        if (lastAiProvider) toast(`✅ Full channel analysis complete! (${lastAiProvider})`, 'success');
        else toast('✅ Full channel analysis complete!', 'success');
    }
}

window.exportChannelAnalysis = function () {
    if (!lastChannelReport) { toast('No report to export', 'error'); return; }
    const txt = `${'═'.repeat(60)}
FULL CHANNEL ANALYSIS REPORT
Channel: ${channelData?.title || 'Channel'}
Subscribers: ${fmtN(channelData?.subs || 0)}
Total Views: ${fmtN(channelData?.totalViews || 0)}
Generated: ${new Date().toLocaleString()}
${'═'.repeat(60)}

${lastChannelReport.replace(/\*\*/g, '').replace(/\\n/g, '\n')}

${'═'.repeat(60)}
Report generated by Channel Analytics Pro
`;
    downloadText(txt, `channel_report_${(channelData?.title || 'channel').replace(/\s+/g, '_')}_${Date.now()}.txt`);
    toast('📄 Channel report exported!', 'success');
};

// ===== HISTORY =====
function saveHistory(data) {
    const hist = JSON.parse(localStorage.getItem(HIST_KEY) || '[]');
    hist.unshift({ date: new Date().toLocaleString(), title: (data.titles?.[0] || 'Video Analysis').slice(0, 60), data });
    if (hist.length > 20) hist.pop();
    localStorage.setItem(HIST_KEY, JSON.stringify(hist));
    renderHistory();
}
function renderHistory() {
    const hist = JSON.parse(localStorage.getItem(HIST_KEY) || '[]');
    const el = $('#aiHistory'); if (!el) return;
    if (!hist.length) { el.innerHTML = '<div class="empty-state-small">No analyses yet — upload a video above</div>'; return; }
    el.innerHTML = hist.map((h, i) => `<div class="ai-history-item" onclick="loadHistory(${i})"><span class="ai-badge">🤖</span><span class="history-title">${h.title}</span><span class="history-date">${h.date}</span></div>`).join('');
}
window.loadHistory = function (i) {
    const hist = JSON.parse(localStorage.getItem(HIST_KEY) || '[]');
    if (hist[i]) { lastAiData = hist[i].data; displayAIResults(hist[i].data); toast('Loaded: ' + hist[i].title, 'info'); }
};

// Copy helpers
window.copyText = function (id) {
    const el = document.getElementById(id);
    navigator.clipboard.writeText(el.value || el.textContent);
    toast('📋 Copied!', 'success');
};
window.copyTags = function () {
    const tags = [...document.querySelectorAll('#aiTags .ai-tag-item')].map(t => t.textContent).join(', ');
    navigator.clipboard.writeText(tags);
    toast('📋 All tags copied!', 'success');
};
window.copyHashtags = function () {
    const h = [...document.querySelectorAll('#aiHashtags .ai-hashtag')].map(t => t.textContent).join(' ');
    navigator.clipboard.writeText(h);
    toast('📋 Hashtags copied!', 'success');
};

// ===== COMPETITOR ANALYSIS =====
function initCompetitor() {
    $('#btnCompare').onclick = () => {
        const c = $('#competitorInput').value.trim();
        if (c) analyzeCompetitor(c);
        else toast('Enter competitor channel', 'error');
    };
}
async function analyzeCompetitor(input) {
    if (!apiKey) { toast('YouTube API Key required', 'error'); return; }
    showLoad('Finding competitor channel...');
    try {
        let cid = null;
        const hm = input.match(/@([\w.-]+)/), um = input.match(/channel\/(UC[\w-]+)/);
        if (um) cid = um[1];
        else if (hm) { const s = await ytGet('channels', { part: 'snippet,statistics', forHandle: hm[1] }); if (s.items?.length) cid = s.items[0].id; }
        if (!cid) { const s = await ytGet('search', { part: 'snippet', q: input, type: 'channel', maxResults: '1' }); if (s.items?.length) cid = s.items[0].snippet.channelId; }
        if (!cid) { toast('Competitor not found', 'error'); hideLoad(); return; }
        updLoad('Loading competitor data...');
        const ch = await ytGet('channels', { part: 'snippet,statistics', id: cid });
        if (!ch.items?.length) { toast('Failed to load competitor', 'error'); hideLoad(); return; }
        const comp = ch.items[0];
        const cs = {
            title: comp.snippet.title,
            avatar: comp.snippet.thumbnails?.medium?.url || '',
            subs: parseInt(comp.statistics.subscriberCount) || 0,
            views: parseInt(comp.statistics.viewCount) || 0,
            count: parseInt(comp.statistics.videoCount) || 0
        };
        hideLoad();
        displayComparison(cs);
    } catch (e) { hideLoad(); console.error(e); toast('Error analyzing competitor', 'error'); }
}

function displayComparison(comp) {
    const my = channelData || { title: 'My Channel', avatar: '', subs: 0, totalViews: 0, videoCount: 0 };
    const mAvgV = my.videoCount > 0 ? Math.round(my.totalViews / my.videoCount) : 0;
    const cAvgV = comp.count > 0 ? Math.round(comp.views / comp.count) : 0;

    $('#competitorResults').style.display = 'block';
    $('#comparisonGrid').innerHTML = `
        <div class="comparison-side">
            <img class="comp-avatar" src="${my.avatar}" alt="">
            <h4>${my.title}</h4>
            <div class="comp-stat"><span>Subscribers</span><span class="comp-stat-value ${my.subs >= comp.subs ? 'comp-winner' : ''}">${fmtN(my.subs)}</span></div>
            <div class="comp-stat"><span>Total Views</span><span class="comp-stat-value ${my.totalViews >= comp.views ? 'comp-winner' : ''}">${fmtN(my.totalViews)}</span></div>
            <div class="comp-stat"><span>Videos</span><span class="comp-stat-value ${my.videoCount >= comp.count ? 'comp-winner' : ''}">${my.videoCount}</span></div>
            <div class="comp-stat"><span>Avg Views/Video</span><span class="comp-stat-value ${mAvgV >= cAvgV ? 'comp-winner' : ''}">${fmtN(mAvgV)}</span></div>
        </div>
        <div class="comparison-vs">VS</div>
        <div class="comparison-side">
            <img class="comp-avatar" src="${comp.avatar}" alt="">
            <h4>${comp.title}</h4>
            <div class="comp-stat"><span>Subscribers</span><span class="comp-stat-value ${comp.subs > my.subs ? 'comp-winner' : ''}">${fmtN(comp.subs)}</span></div>
            <div class="comp-stat"><span>Total Views</span><span class="comp-stat-value ${comp.views > my.totalViews ? 'comp-winner' : ''}">${fmtN(comp.views)}</span></div>
            <div class="comp-stat"><span>Videos</span><span class="comp-stat-value ${comp.count > my.videoCount ? 'comp-winner' : ''}">${comp.count}</span></div>
            <div class="comp-stat"><span>Avg Views/Video</span><span class="comp-stat-value ${cAvgV > mAvgV ? 'comp-winner' : ''}">${fmtN(cAvgV)}</span></div>
        </div>`;

    // Chart
    if (charts.comp) charts.comp.destroy();
    charts.comp = new Chart($('#competitorChart'), {
        type: 'bar',
        data: {
            labels: ['Subscribers', 'Views (K)', 'Videos', 'Avg Views (K)'],
            datasets: [
                { label: my.title, data: [my.subs, my.totalViews / 1000, my.videoCount, mAvgV / 1000], backgroundColor: 'rgba(79,143,255,0.7)', borderRadius: 8 },
                { label: comp.title, data: [comp.subs, comp.views / 1000, comp.count, cAvgV / 1000], backgroundColor: 'rgba(236,72,153,0.7)', borderRadius: 8 }
            ]
        },
        options: { ...cOpts(), plugins: { legend: { display: true, labels: { color: '#8888aa', font: { family: 'Inter' } } } } }
    });

    // AI advice
    if (groqKey) generateCompetitorAdvice(my, comp);
}

async function generateCompetitorAdvice(my, comp) {
    $('#competitorAiAdvice').innerHTML = '<div style="text-align:center;padding:20px"><div class="loader-ring small-ring" style="width:30px;height:30px;border-width:3px;margin:0 auto"></div><p style="margin-top:10px;color:var(--text-muted)">AI analyzing competition...</p></div>';

    const isRu = (typeof currentLang !== 'undefined' && currentLang === 'ru');
    const langOutput = isRu
        ? '**CRITICAL: You MUST write your ENTIRE ANALYSIS strictly in RUSSIAN (Русский язык). ВЕСЬ ОТВЕТ ТОЛЬКО НА РУССКОМ ЯЗЫКЕ!**'
        : '**IMPORTANT: You MUST write your ENTIRE ANALYSIS strictly in ENGLISH.**';

    const prompt = `You are an elite YouTube growth strategist. Compare these two channels and give 7 SPECIFIC, ACTIONABLE strategies to crush the competitor.

${langOutput}

MY CHANNEL: "${my.title}"
- ${fmtN(my.subs)} subscribers, ${fmtN(my.totalViews)} views, ${my.videoCount} videos
- Avg engagement: ${avgEng().toFixed(1)}%

COMPETITOR: "${comp.title}"
- ${fmtN(comp.subs)} subscribers, ${fmtN(comp.views)} views, ${comp.count} videos

Give 7 specific strategies. For each strategy include:
- What to do (specific action)
- Why it works (algorithm/audience reason)
- Expected impact (subscriber/view growth estimate)
- Timeline (when to expect results)

Use emojis, **bold** for key points. Be brutally specific — no generic advice.`;

    const result = await aiCall(prompt);
    $('#competitorAiAdvice').innerHTML = result ? fmt(result) : '<p style="color:var(--text-muted)">Could not generate advice — try again</p>';
}

// ===== AI TIPS =====
async function generateAiTips() {
    if (!groqKey) { toast('Add Groq API Key', 'error'); return; }
    if (videos.length < 2) { toast('Load more videos first', 'error'); return; }
    const btn = $('#btnAiTips');
    btn.disabled = true;
    btn.innerHTML = '<div class="loader-ring small-ring" style="width:22px;height:22px;border-width:2px;display:inline-block;vertical-align:middle"></div> Generating strategy...';

    const top5 = [...videos].sort((a, b) => b.views - a.views).slice(0, 5).map(v => `"${v.title}" (${fmtN(v.views)} views, ${eng(v).toFixed(1)}% eng)`).join('\n');
    const worst3 = [...videos].sort((a, b) => eng(a) - eng(b)).slice(0, 3).map(v => `"${v.title}" (${fmtN(v.views)} views, ${eng(v).toFixed(1)}% eng)`).join('\n');
    const bt = bestTime(videos);
    const vi = videos.filter(v => v.type === 'video').length, sh = videos.filter(v => v.type === 'short').length;
    const allTags = [...new Set(videos.flatMap(v => v.tags))].slice(0, 25).join(', ');

    const isRu = (typeof currentLang !== 'undefined' && currentLang === 'ru');
    const langOutput = isRu
        ? '**CRITICAL: You MUST write your ENTIRE RESPONSE strictly in RUSSIAN (Русский язык). ВЕСЬ ОТВЕТ ТОЛЬКО НА РУССКОМ ЯЗЫКЕ!**'
        : '**IMPORTANT: You MUST write your ENTIRE RESPONSE strictly in ENGLISH.**';

    const prompt = `You are the #1 YouTube strategist. Analyze this channel and provide a DETAILED growth strategy.

${langOutput}

Channel: "${channelData?.title || 'Channel'}"
Subscribers: ${fmtN(channelData?.subs || 0)}
Total videos: ${videos.length} (${vi} videos, ${sh} shorts)
Average engagement: ${avgEng().toFixed(1)}%
Best time: ${bt ? bt.day + ' ' + bt.time : 'unknown'}
Common tags: ${allTags || 'none'}

TOP 5 VIDEOS: 
${top5}

WORST 3 VIDEOS:
${worst3}

Provide comprehensive strategy:
1. 📊 **Channel Health Score** (X/100 with breakdown)
2. 🎯 **Content Strategy** (what topics to create, what to avoid)
3. 📈 **Subscriber Growth** (10 specific steps with expected impact)
4. ⏰ **Optimal Schedule** (exact days & times EST for US audience)
5. 🏷 **SEO & Tags** (exact tags to use, title formulas)
6. 📱 **Shorts Strategy** (how to leverage for growth)
7. 🔥 **3 Viral Video Ideas** (with clickbait titles including emojis)
8. 🪝 **Hook & Retention** (first 3 seconds scripts)
9. 🖼 **Thumbnail Best Practices** (specific to this niche)
10. ⚠️ **Critical Mistakes** (what's hurting growth)
11. 💡 **Quick Wins** (things to implement TODAY)

Use emojis, **bold text**, be EXTREMELY specific. No fluff.`;

    const result = await aiCall(prompt);
    btn.disabled = false;
    btn.innerHTML = '🧠 Generate AI Strategy';
    if (result) {
        $('#aiTipsCard').style.display = 'block';
        $('#aiTipsContent').innerHTML = fmt(result);
        toast('✅ AI strategy ready!', 'success');
    }
}

async function aiAnalyzeExisting(v) {
    if (!groqKey) { toast('Add Groq API Key', 'error'); return; }
    showLoad('🤖 AI analyzing video...');

    const prompt = `You are a top YouTube SEO expert and video analyst for US audience. Analyze this existing video in EXTREME detail and suggest complete optimization.

VIDEO DATA:
- Title: "${v.title}"
- Views: ${fmtN(v.views)} | Likes: ${fmtN(v.likes)} | Comments: ${fmtN(v.comments)}
- Engagement: ${eng(v).toFixed(2)}% (Channel avg: ${avgEng().toFixed(2)}%) — ${eng(v) > avgEng() ? 'ABOVE average' : 'BELOW average'}
- Type: ${v.type} | Duration: ${Math.floor(v.duration / 60)}m ${v.duration % 60}s
- Posted: ${v.date} at ${v.time}
- Tags: ${v.tags.length ? v.tags.join(', ') : 'NO TAGS (critical SEO issue!)'}
- Description (first 300 chars): ${v.description || 'NO DESCRIPTION (critical SEO issue!)'}
- Views rank: #${[...videos].sort((a, b) => b.views - a.views).findIndex(x => x.id === v.id) + 1} out of ${videos.length} videos
${channelData ? `
CHANNEL CONTEXT:
- Channel: "${channelData.title}" | ${fmtN(channelData.subs)} subscribers
- Average views across all videos: ${fmtN(Math.round(videos.reduce((s, x) => s + x.views, 0) / videos.length))}
- Top 3 videos: ${[...videos].sort((a, b) => b.views - a.views).slice(0, 3).map(x => `"${x.title}" (${fmtN(x.views)})`).join(', ')}` : ''}


RESPOND IN STRICT JSON ONLY (no markdown, no code blocks).
${typeof currentLang !== 'undefined' && currentLang === 'ru' ? 'ВНИМАНИЕ: ВСЕ СТРОКИ В JSON ДОЛЖНЫ БЫТЬ ПЕРЕВЕДЕНЫ НА РУССКИЙ ЯЗЫК. НЕ ИСПОЛЬЗУЙ АНГЛИЙСКИИЙ.' : ''}
{
  "mainTopic": "One sentence: what this video is actually about based on title and tags",
  "contentType": "tutorial|vlog|gameplay|reaction|educational|entertainment|other",
  "videoContentSummary": "Deep deduction of content based on tags, description, performance.",
  "viralScore": 75,
  "viralBreakdown": {
    "shareability": 20,
    "emotionalTrigger": 22,
    "trendAlignment": 18,
    "productionQuality": 25,
    "total": 85
  },
  "viralExplanation": "Deep psychological analysis of why this video performed ${eng(v) > avgEng() ? 'above' : 'below'} average. What worked, what didn't.",
  "retentionAnalysis": {
    "hookStrength": 85,
    "hookAnalysis": "Predicted hook performance based on engagement vs views",
    "predictedAvgViewDuration": "Estimated retention percentage",
    "retentionTips": ["3 tips based on performance metrics"]
  },
  "algorithmTips": "5 specific algorithm tips for improving this exact video's discoverability RIGHT NOW",
  "contentStrengths": "What this video does well based on its metrics and title",
  "contentWeaknesses": "What's hurting this video's performance",
  "improvementPlan": [
    {"priority": "HIGH", "action": "Specific improvement (thumbnail, title tweak)", "impact": "Expected CTR/Views change"}
  ],
  "titles": ["🔥 BETTER CLICKBAIT TITLE 1 based on actual topic","😱 TITLE 2 curiosity gap","💀 TITLE 3 shocking angle","🤯 TITLE 4 question format","⚡ TITLE 5 numbered list","🚀 TITLE 6 how-to","😤 TITLE 7 emotional","🎯 TITLE 8 direct benefit","💯 TITLE 9 challenge","🏆 TITLE 10 comparison"],
  "description": "Full improved SEO description 500+ words with hook, timestamps, CTAs, FAQ section, hashtags",
  "tags": ["tag1","tag2","tag3","tag4","tag5","tag6","tag7","tag8","tag9","tag10","tag11","tag12","tag13","tag14","tag15","tag16","tag17","tag18","tag19","tag20","tag21","tag22","tag23","tag24","tag25"],
  "hashtags": ["#h1","#h2","#h3","#h4","#h5","#h6","#h7","#h8","#h9","#h10","#h11","#h12"],
  "hookScript": "4 hook options for the first 3 seconds of similar future videos",
  "thumbnailIdeas": "4 thumbnail concepts with specific text overlays, colors, and design tips",
  "ctaSuggestions": "Pinned comment draft + end screen CTA + community post + short teaser script",
  "bestPostTime": "Best time to post similar content for US audience (EST) with reasoning",
  "proTips": "10 specific pro tips for improving this video and future similar content"
}`;

    const result = await aiCall(prompt);
    hideLoad();
    if (!result) return;

    try {
        const clean = result.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
        let data;
        try { data = JSON.parse(clean); } catch (e) {
            const jsonMatch = clean.match(/\{[\s\S]*\}/);
            if (jsonMatch) data = JSON.parse(jsonMatch[0]);
            else throw e;
        }
        // Navigate to AI analyzer page
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        document.querySelectorAll('.nav-item[data-page="aianalyzer"]').forEach(n => n.classList.add('active'));
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.querySelector('#pageAianalyzer').classList.add('active');
        lastAiData = data;
        displayAIResults(data);
        saveHistory(data);
        toast('✅ Video analysis complete!', 'success');
    } catch (e) {
        toast('Parse error — try again', 'error');
        console.error(e, result);
    }
}

// ===== TOAST =====
function toast(msg, type = 'info') {
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `<span class="toast-icon">${icons[type] || 'ℹ️'}</span><span>${msg}</span>`;
    const container = document.querySelector('#toastContainer');
    if (container) container.appendChild(t);
    setTimeout(() => { t.classList.add('hiding'); setTimeout(() => t.remove(), 300); }, 4000);
}

// ===== AI CHAT WIDGET =====

// ===== AI CHAT (FULL PAGE) =====
let chatHistory = [];

window.renderChat = function () {
    if (!window.chatInitialized) {
        const btnSend = $('#btnSendChat');
        const chatInput = $('#chatInput');
        const btnClear = $('#btnClearChat');

        if (btnSend) btnSend.onclick = sendChatMessage;
        if (chatInput) chatInput.onkeypress = (e) => { if (e.key === 'Enter') sendChatMessage(); };
        if (btnClear) btnClear.onclick = () => {
            chatHistory = [];
            $('#chatMessages').innerHTML = `
                 <div class="chat-message ai-message">
                     <div class="message-avatar">🤖</div>
                     <div class="message-bubble">
                         <span data-i18n="chat_welcome">${typeof t === 'function' ? t('chat_welcome') : 'Hi! I am the AI assistant. Ask me anything!'}</span>
                     </div>
                 </div>
             `;
        };
        window.chatInitialized = true;
    }
};

function buildSystemPrompt() {
    let stats = '';
    if (typeof channelData !== 'undefined' && channelData) {
        stats = `Channel name: ${channelData.title}\nSubscribers: ${channelData.subs}\nTotal Views: ${channelData.totalViews}\n`;
    }
    if (typeof videos !== 'undefined' && videos && videos.length > 0) {
        const vi = videos.filter(v => v.type === 'video');
        const sh = videos.filter(v => v.type === 'short');
        const avgE = (videos.reduce((s, v) => s + eng(v), 0) / videos.length).toFixed(1);
        stats += `Total Videos: ${videos.length} (${vi.length} long, ${sh.length} shorts)\nAvg Engagement: ${avgE}%\n`;
        const top = [...videos].sort((a, b) => b.views - a.views).slice(0, 5).map(v => `"${v.title}" (${v.views} views)`).join(', ');
        stats += `Top 5 Videos: ${top}\n`;
    }

    const isRu = (typeof currentLang !== 'undefined' && currentLang === 'ru');
    const langOutput = isRu
        ? 'СТРОГОЕ ПРАВИЛО: Ты обязан отвечать ИСКЛЮЧИТЕЛЬНО на русском языке. Забудь про английский. Будь профессиональным, сверх-проницательным аналитиком YouTube.'
        : 'Always reply in English. Be a highly insightful, professional YouTube analyst.';

    return `You are an elite AI assistant and YouTube strategist for a creator. You have access to their real-time channel statistics.
Use this context to give extremely specific, personalized, and deep advice. Do NOT use fake numbers. Provide insights on retention, engagement, posting times, and format trends.

${stats}

${langOutput}

Format your response with Markdown (bold text, bullet lists, emojis). Be highly professional but direct. Don't hallucinate metrics. Use the provided statistics gracefully.`;
}

async function sendChatMessage() {
    const input = $('#chatInput');
    const msg = input.value.trim();
    if (!msg) return;

    if (!groqKey) {
        toast('Add Groq API Key first', 'error');
        return;
    }

    appendChatMessage('user', typeof esc === 'function' ? esc(msg) : msg);
    input.value = '';

    input.disabled = true;
    $('#btnSendChat').disabled = true;

    const loadingId = 'loading-' + Date.now();
    appendChatMessage('ai', '<div class="loader-ring small-ring" style="width:20px;height:20px;border-width:2px;display:inline-block;vertical-align:middle"></div>', loadingId);

    chatHistory.push({ role: 'user', content: msg });

    // Context window management: keep last 20 messages to avoid token overflow
    if (chatHistory.length > 20) {
        chatHistory = chatHistory.slice(-20);
    }

    const messages = [
        { role: 'system', content: buildSystemPrompt() },
        ...chatHistory
    ];

    let reply = null;
    try {
        reply = await chatGroq(messages);

        const msgEl = document.getElementById(loadingId);
        if (msgEl) msgEl.remove();

        if (reply) {
            chatHistory.push({ role: 'assistant', content: reply });
            appendChatMessage('ai', typeof fmt === 'function' ? fmt(reply) : reply);
        } else {
            chatHistory.pop();
            appendChatMessage('ai', (typeof currentLang !== 'undefined' && currentLang === 'ru') ? '⚠️ Ошибка при генерации ответа. Попробуйте еще раз.' : '⚠️ Error generating response. Please try again.');
        }
    } catch (e) {
        console.error(e);
        chatHistory.pop();
        const msgEl = document.getElementById(loadingId);
        if (msgEl) msgEl.remove();
        appendChatMessage('ai', '⚠️ ' + e.message);
    }

    input.disabled = false;
    $('#btnSendChat').disabled = false;
    input.focus();
}

function appendChatMessage(role, htmlContent, id = null) {
    const container = $('#chatMessages');
    if (!container) return;
    const isAi = role === 'ai';
    const div = document.createElement('div');
    div.className = `chat-message ${isAi ? 'ai-message' : 'user-message'}`;
    if (id) div.id = id;

    div.innerHTML = `
        <div class="message-avatar">${isAi ? '🤖' : '👤'}</div>
        <div class="message-bubble">${htmlContent}</div>
    `;

    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

async function chatGroq(messages) {
    const model = getSelectedModel();
    const res = await fetch(GROQ_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groqKey}` },
        body: JSON.stringify({
            model: model.id,
            messages: messages,
            temperature: model.temp ?? 0.7,
            max_tokens: Math.min(model.tokens ?? 4096, 4096)
        })
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || `Groq HTTP ${res.status}`);
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content || null;
}

// ===== AI ACTION PLAN =====
window.addEventListener('DOMContentLoaded', () => {
    const btnPlan = document.getElementById('btnGenerateActionPlan');
    if (btnPlan) {
        btnPlan.addEventListener('click', generateActionPlan);
    }
});

async function generateActionPlan() {
    const el = document.getElementById('actionPlanWidget');
    const vids = (typeof App !== 'undefined' && App.videos) ? App.videos : videos;
    if (!el || !vids.length) return;

    if (!groqKey) {
        el.innerHTML = `<div class="empty-state-small" style="color:var(--accent-red)">${typeof t === 'function' ? t('enter_yt_key') : 'API key needed'}</div>`;
        return;
    }

    const btn = document.getElementById('btnGenerateActionPlan');
    btn.disabled = true;
    const oldText = btn.innerHTML;
    btn.innerHTML = '⏳...';
    const lang = typeof currentLang !== 'undefined' ? currentLang : 'en';

    el.innerHTML = `<div class="empty-state-small" style="text-align:left;color:var(--text-secondary)">🤖 ${lang === 'ru' ? 'Анализирую канал...' : 'Analyzing channel...'}</div>`;

    // Prepare data
    const vi = vids.filter(v => v.type === 'video').length;
    const sh = vids.filter(v => v.type === 'short').length;
    const tv = vids.reduce((s, v) => s + v.views, 0);
    const top = [...vids].sort((a, b) => b.views - a.views).slice(0, 3).map(v => v.title).join(' | ');
    const chData = (typeof App !== 'undefined' && App.channelData) ? App.channelData : channelData;

    const prompt = `
You are an elite YouTube strategist.
Channel: ${chData?.title || 'Unknown'}
Subscribers: ${chData?.subs || 0}
Total Views: ${tv}
Videos: ${vi}, Shorts: ${sh}
Top 3 Videos: ${top}

Provide exactly 3 highly specific, actionable, short tasks the creator should do TODAY to grow the channel based on this data.
Make them incredibly insightful, not just generic tips. Check their video velocity and formats.
Format your output strictly as a JSON array of strings. Do not include markdown codeblocks, just the raw JSON array.
Respond EXCLUSIVELY in ${lang === 'ru' ? 'Russian language. THIS IS VITAL.' : 'English.'}.
Example: ["Task 1", "Task 2", "Task 3"]
`;

    try {
        let text = await aiCall(prompt);
        if (!text) throw new Error('No response');

        // Cleanup response in case of markdown
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const tasks = JSON.parse(text);

        if (Array.isArray(tasks) && tasks.length > 0) {
            el.innerHTML = tasks.slice(0, 3).map((task, i) => `
                <div class="action-task" style="animation: popIn 0.3s ease ${i * 0.1}s backwards">
                    <span style="font-size:1.2rem;line-height:1">🎯</span>
                    <div>${typeof esc === 'function' ? esc(task) : task}</div>
                </div>
            `).join('');
        } else {
            throw new Error('Invalid JSON format');
        }
    } catch (e) {
        console.error('Action Plan Error:', e);
        el.innerHTML = `<div class="empty-state-small" style="color:var(--accent-red)">${lang === 'ru' ? '❌ Ошибка при генерации плана. Попробуйте еще раз.' : '❌ Error generating plan. Try again.'}</div>`;
    } finally {
        btn.disabled = false;
        btn.innerHTML = oldText;
    }
}

// ===== AI STUDIO TOOLS (NEW) =====
window.switchStudioTab = function (tabId) {
    document.querySelectorAll('.studio-tab').forEach(t => t.style.display = 'none');
    document.getElementById('studio_' + tabId).style.display = 'block';
    document.querySelectorAll('.tabs-header .filter-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById('tab_' + tabId).classList.add('active');
};

window.testTitles = async function () {
    const t1 = $('#abTitle1').value.trim();
    const t2 = $('#abTitle2').value.trim();
    const t3 = $('#abTitle3').value.trim();

    if (!t1 || !t2) { toast('Please enter at least 2 titles', 'error'); return; }
    if (!groqKey) { toast('Add Groq API Key', 'error'); return; }

    const btn = $('#btnTestTitles');
    const resEl = $('#abResults');
    const oldText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<div class="loader-ring small-ring" style="width:20px;height:20px;display:inline-block;vertical-align:middle;border-width:2px;border-color:#fff transparent transparent transparent"></div> Analyzing...';
    resEl.style.display = 'none';

    const lang = typeof currentLang !== 'undefined' ? currentLang : 'en';
    const langCmd = lang === 'ru'
        ? 'СТРОГОЕ ПРАВИЛО: ОТВЕЧАЙ ИСКЛЮЧИТЕЛЬНО НА РУССКОМ ЯЗЫКЕ.'
        : 'Respond strictly in English.';

    const prompt = `You are a YouTube CTR and psychology expert. 
    Analyze these titles for a video and determine which will get the highest click-through rate.
    ${t1 ? '\nOption A: ' + t1 : ''}
    ${t2 ? '\nOption B: ' + t2 : ''}
    ${t3 ? '\nOption C: ' + t3 : ''}
    
    ${langCmd}
    
    Provide your analysis formatted in Markdown. 
    1. Declare the WINNER clearly.
    2. Give a CTR (Click-Through Rate) prediction out of 100 for each.
    3. Explain the psychological triggers (or lack thereof) for each option.
    4. Provide ONE new "God-Tier" title that is even better.`;

    try {
        const result = await aiCall(prompt);
        if (result) {
            resEl.style.display = 'block';
            resEl.innerHTML = `<div class="ai-recommendations" style="text-align:left">${fmt(result)}</div>`;
        }
    } catch (e) {
        toast('Analysis failed', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = oldText;
    }
};

window.generateHooks = async function () {
    const topic = $('#hookTopic').value.trim();
    if (!topic) { toast('Please enter a video topic', 'error'); return; }
    if (!groqKey) { toast('Add Groq API Key', 'error'); return; }

    const btn = $('#btnGenHooks');
    const resEl = $('#hookResults');
    const oldText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<div class="loader-ring small-ring" style="width:20px;height:20px;display:inline-block;vertical-align:middle;border-width:2px;border-color:#fff transparent transparent transparent"></div> Generating...';
    resEl.style.display = 'none';

    const lang = typeof currentLang !== 'undefined' ? currentLang : 'en';
    const langCmd = lang === 'ru'
        ? 'СТРОГОЕ ПРАВИЛО: ОТВЕЧАЙ ИСКЛЮЧИТЕЛЬНО НА РУССКОМ ЯЗЫКЕ (включая сценарии).'
        : 'Respond strictly in English.';

    const prompt = `You are a high-retention YouTube Shorts and Video scriptwriter.
    Video Topic: "${topic}"
    
    ${langCmd}
    
    Generate 3 distinct, high-impact verbal hooks for the first 3-5 seconds of this video.
    
    Format in Markdown:
    - **Hook 1 (The Question/Curiosity Gap)**
    - **Hook 2 (The Negative Statement/Shock)**
    - **Hook 3 (The Ultra-Specific Value Promise)**
    
    Include brief visual direction for each (e.g., [Camera rapidly zooms in]).`;

    try {
        const result = await aiCall(prompt);
        if (result) {
            resEl.style.display = 'block';
            resEl.innerHTML = `<div class="ai-recommendations" style="text-align:left">${fmt(result)}</div>`;
        }
    } catch (e) {
        toast('Hook generation failed', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = oldText;
    }
};

// ===== NEW: AI VIDEO SCRIPT & IDEA GENERATOR PRO =====
async function generateVideoScript() {
    const topic = $('#ideaTopic').value.trim();
    if (!topic) { toast('Please enter a video topic or idea', 'error'); return; }
    if (!groqKey) { toast('Add Groq API Key', 'error'); return; }

    const btn = $('#btnGenerateIdeas');
    const resEl = $('#ideaResults');
    const oldText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<div class="loader-ring small-ring" style="width:20px;height:20px;display:inline-block;vertical-align:middle;border-width:2px;border-color:#fff transparent transparent transparent"></div> Generating Masterpiece...';
    resEl.style.display = 'none';

    const lang = typeof currentLang !== 'undefined' ? currentLang : 'en';
    const isRu = lang === 'ru';

    // Analyze channel context to personalize the script
    const chCtx = channelData ? `\nTarget channel: "${channelData.title}", ${fmtN(channelData.subs)} subs.` : '';
    let topFormat = '';
    if (videos && videos.length > 0) {
        const topVid = [...videos].sort((a, b) => b.views - a.views)[0];
        if (topVid) topFormat = `\nTheir most successful video is titled "${topVid.title}". Imitate the vibe if relevant.`;
    }

    const langCmd = isRu
        ? 'СТРОГОЕ ПРАВИЛО: ОТВЕЧАЙ ИСКЛЮЧИТЕЛЬНО НА РУССКОМ ЯЗЫКЕ (включая сценарии, хуки и инструкции).'
        : 'Respond strictly in English.';

    const prompt = `You are a legendary YouTube Producer and Scriptwriter who has helped creators gain millions of views.
    I have an idea for a video. You need to turn it into a complete, ready-to-shoot production plan.
    
    Topic / Idea: "${topic}"
    ${chCtx}${topFormat}
    ${langCmd}
    
    Create a highly structured production guide in Markdown format. Use emojis and bold text. 
    It MUST contain these exact sections:
    
    # 🎬 1. Grand Vision & Angle
    Explain the UNIQUE angle that will make this video go viral. What is the curiosity gap? Why will people care?
    
    # 💥 2. Top 3 Clickbait Titles
    Give 3 incredibly clickable, emotional titles. (Avoid boring, factual titles).
    
    # 🖼️ 3. Thumbnail Concept
    Describe the exact thumbnail: What is the subject doing? What is the background? What text is on the screen (3 words max)? Which colors are dominant to grab attention?
    
    # 🪝 4. The 5-Second Viral Hook (Word-for-Word)
    Write the exact script for the first 5 seconds. Include camera directions or sound effects in brackets [like this].
    
    # 📜 5. Core Script / Talking Points Outline
    Break the video down into 3-4 main acts. 
    Act 1: The Setup / The Problem
    Act 2: The Journey / The Conflict
    Act 3: The Climax / The Solution
    Make it engaging. Tell a story, don't just dump information.
    
    # ⏱️ 6. The Retention Checkpoint (Mid-roll reset)
    What happens halfway through the video to wake the viewer up and prevent them from clicking away? (Pattern interrupt).
    
    # 📢 7. Call To Action & Outro
    How to naturally ask for subscribers without sounding desperate, and how to drive them to the next video (Binge loop).`;

    try {
        const result = await aiCall(prompt);
        if (result) {
            resEl.style.display = 'block';
            resEl.innerHTML = `<div class="ai-recommendations" style="text-align:left">${fmt(result)}</div>`;
        }
    } catch (e) {
        toast('Script generation failed', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = oldText;
    }
}
