// server.js

require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const { fetch } = require('undici');

// 初始化 express 應用
const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// 靜態文件路徑
app.use(express.static('public'));

// OpenRouter 設定（從環境變數讀取）
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';

// 文字工具：移除 HTML tag 轉純文字
function htmlToText(html) {
    if (!html) return '';
    return html
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');
}

// 模擬/模仿輸入節奏：根據使用者 intervals 取樣並加入雜訊
function generateIntervalsFromUser(userIntervals, length) {
    const result = [];
    const base = userIntervals && userIntervals.length > 0 ? userIntervals : undefined;
    for (let i = 0; i < length; i++) {
        let v;
        if (base) {
            const pick = base[Math.floor(Math.random() * base.length)] || 120;
            const noise = (Math.random() - 0.5) * 60; // ±30ms
            v = Math.max(30, Math.min(600, Math.round(pick + noise)));
        } else {
            // 無使用者資料時的隨機節奏（偏快到中等）
            v = Math.round(80 + Math.random() * 180); // 80–260ms
        }
        result.push(v);
    }
    return result;
}

// 字元樣式：使用與前端相同的規則（以預設參數推算）
function getColorFromSpacing(calculatedSpacing) {
    const cs = Math.max(-10, Math.min(100, calculatedSpacing));
    const t = (cs + 90) / 200; // 0→快(白), 1→慢(藍)
    const R = Math.round(255 * (1 - t) + 100);
    const G = Math.round(255 * (1 - t) + 100);
    const B = 255;
    return `rgb(${R},${G},${B})`;
}

function getScaleXFromSpacing(calculatedSpacing) {
    const cs = Math.max(-5, Math.min(100, calculatedSpacing));
    const t = (cs + 10) / 110;
    return 0.05 + (5 - 0.05) * t; // 0.05–5
}

function spansHtmlFromText(text, intervals, options = {}) {
    const thresholdInterval = 130;
    const spacingFactor = 0.10;
    let html = '';
    let idx = 0; // 對應 intervals 的索引（忽略換行）
    for (const ch of text) {
        if (ch === '\n') {
            html += '<br />';
            continue;
        }
        const interval = intervals[idx] ?? 100;
        idx += 1;
        const calculatedSpacing = (interval - thresholdInterval) * spacingFactor;
        const scaleX = getScaleXFromSpacing(calculatedSpacing);
        const marginLeft = -18 + scaleX * 15;
        const color = getColorFromSpacing(calculatedSpacing);
        const safeChar = String(ch)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        html += `<span class="char" style="display:inline-block;transform-origin:left center;transform:scaleX(${scaleX});margin-right:${marginLeft}px;color:${color}">${safeChar}</span>`;
    }
    return html;
}

function countRenderableChars(text) {
    let count = 0;
    for (const ch of text) {
        if (ch !== '\n') count += 1;
    }
    return count;
}

async function callOpenRouter(prompt) {
    if (!OPENROUTER_API_KEY) {
        throw new Error('Missing OPENROUTER_API_KEY');
    }
    const body = {
        model: OPENROUTER_MODEL,
        messages: [
            {
                role: 'system',
                content:
                    '你是一個友善而簡潔的對談夥伴。請以 1-2 句直接回覆使用者，保持自然口吻，支援繁體中文與日文與英文。',
            },
            { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 256,
    };

    const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            // 推薦的額外標頭（可選）
            'HTTP-Referer': process.env.OPENROUTER_SITE || 'https://time-keyboard-479f9ea9828a.herokuapp.com/',
            'X-Title': process.env.OPENROUTER_TITLE || 'time-keyboard',
        },
        body: JSON.stringify(body),
    });

    if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        throw new Error(`OpenRouter error ${resp.status}: ${text}`);
    }
    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content || '';
    return content.trim();
}

// 當客戶端連接時觸發
io.on('connection', (socket) => {
    console.log('新用戶連接');

    // 當收到客戶端發送的消息時
    socket.on('chatMessage', async (msg) => {
        // 將消息廣播給所有連接的客戶端
        io.emit('chatMessage', msg);

        // 從 HTML 取得純文字，呼叫 OpenRouter 產生回覆
        try {
            const userText = (msg?.text && String(msg.text).trim()) || htmlToText(msg?.message || '');
            if (!userText) return;

            const aiText = await callOpenRouter(userText);
            if (!aiText) return;

            const aiRenderableCount = countRenderableChars(aiText);
            const aiIntervals = generateIntervalsFromUser(msg?.intervals || [], aiRenderableCount);
            const aiHtml = spansHtmlFromText(aiText, aiIntervals);

            io.emit('chatMessage', {
                name: process.env.AI_SENDER_NAME || 'AI',
                message: aiHtml,
                intervals: aiIntervals,
            });
        } catch (err) {
            console.error('AI 回覆失敗:', err?.message || err);
        }
    });

    // 當客戶端斷開連接時
    socket.on('disconnect', () => {
        console.log('用戶斷開連接');
    });
});

// 啟動服務器
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`服務器運行在 http://localhost:${PORT}`);
});
