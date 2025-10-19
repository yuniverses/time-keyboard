# time-keyboard
Try it : https://time-keyboard-479f9ea9828a.herokuapp.com/

## OpenRouter 設定

請在部署環境加入以下環境變數：

- `OPENROUTER_API_KEY`: 從 OpenRouter 取得的 API Key
- `OPENROUTER_MODEL` (可選): 預設 `openai/gpt-4o-mini`
- `OPENROUTER_SITE` (可選): 你的網站網址（做為 Referer）
- `OPENROUTER_TITLE` (可選): 專案名稱
- `AI_SENDER_NAME` (可選): AI 在聊天室裡顯示的名稱，預設 `AI`

本地開發可使用：

```bash
OPENROUTER_API_KEY=sk-... OPENROUTER_MODEL=openai/gpt-4o-mini npm start
```

Heroku 範例：

```bash
heroku config:set OPENROUTER_API_KEY=sk-...
heroku config:set OPENROUTER_MODEL=openai/gpt-4o-mini
```
