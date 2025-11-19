# 🎬 Demo 使用指南

本專案提供完整的 demo 腳本，用於測試 Speech-to-Text Summarization API。

---

## 🚀 快速開始（3 步驟）

### 步驟 1️⃣：啟動服務

```bash
docker-compose up --build
```

等待看到以下訊息：
```
✓ postgres started
✓ redis started
✓ api started
✓ worker started
```

### 步驟 2️⃣：確認服務運行

開啟新的終端機，執行：

```bash
curl http://localhost:3000/health
```

應該看到：
```json
{
  "status": "healthy",
  "checks": {
    "database": { "status": "ok" },
    "redis": { "status": "ok" }
  }
}
```

### 步驟 3️⃣：執行 Demo

```bash
./demo.sh
```

**執行時間：約 20-40 秒**

---

## 📋 前置需求

1. **Docker 環境**
   - Docker version 20.10+
   - Docker Compose version 2.0+

2. **OpenAI API Key**
   - 確認 `.env` 檔案中的 `OPENAI_API_KEY` 已設定
   - 檢查 API 額度是否足夠

3. **jq 工具**（JSON 解析）
   ```bash
   # macOS
   brew install jq

   # Ubuntu/Debian
   sudo apt-get install jq

   # CentOS/RHEL
   sudo yum install jq
   ```

4. **測試音檔**
   ```bash
   ls harvard.wav  # 確認檔案存在
   ```

---

## 🎯 Demo 功能特色

執行 `./demo.sh` 會自動完成以下步驟：

- ✅ **Step 0**: 健康檢查（Database + Redis）
- ✅ **Step 1**: 檔案驗證（檢查音檔大小）
- ✅ **Step 2**: 音檔上傳（multipart/form-data）
- ✅ **Step 3**: 進度監控（輪詢任務狀態）
- ✅ **Step 4**: 結果展示（Transcript + Summary）
- ✅ **Step 5**: 佇列統計（waiting, active, completed, failed）
- ✅ **Bonus**: 列出所有任務

---

## 📊 預期輸出範例

```bash
$ ./demo.sh

╔════════════════════════════════════════════════╗
║  Speech-to-Text Summarization Demo            ║
║  Testing with harvard.wav                      ║
╚════════════════════════════════════════════════╝

========================================
Step 0: Health Check
========================================

[INFO] Checking if API server is running...
[SUCCESS] API server is running at http://localhost:3000

Health Status:
{
  "status": "healthy",
  "checks": {
    "database": { "status": "ok" },
    "redis": { "status": "ok" }
  }
}

========================================
Step 1: Validate Audio File
========================================

[SUCCESS] Found audio file: ./harvard.wav
[INFO] File size: 3.09 MB

========================================
Step 2: Upload Audio File
========================================

[SUCCESS] Upload successful!
[INFO] Job ID: abc-123-def-456

========================================
Step 3: Monitor Job Progress (Polling)
========================================

[INFO] Status: pending | Progress: 0%
[INFO] Status: processing | Progress: 20%
[INFO] Status: processing | Progress: 50%
[SUCCESS] Job completed!

========================================
Step 4: Retrieve Results
========================================

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 TRANSCRIPT:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
The stale smell of old beer lingers. It takes heat
to bring out the odor. A cold dip restores health
and zest...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 SUMMARY:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This transcript describes various sensory experiences
related to food and odors...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

========================================
Step 5: Queue Metrics
========================================

Queue Metrics:
{
  "waiting": 0,
  "active": 0,
  "completed": 5,
  "failed": 0
}

========================================
Demo Complete!
========================================

[SUCCESS] All steps executed successfully!
```

---

## 🧪 手動測試（使用 curl）

如果不想執行腳本，可以手動測試 API：

### 1. 上傳音檔
```bash
curl -X POST http://localhost:3000/api/jobs \
  -F "audio=@harvard.wav"
```

**回應：**
```json
{
  "success": true,
  "data": {
    "id": "abc-123-def-456",
    "status": "pending",
    "fileName": "harvard.wav"
  }
}
```

### 2. 查詢任務狀態
```bash
# 替換成你的 JOB_ID
curl http://localhost:3000/api/jobs/abc-123-def-456
```

### 3. 即時監控（SSE）
```bash
# 替換成你的 JOB_ID
curl -N http://localhost:3000/api/jobs/abc-123-def-456/stream
```

### 4. 查看佇列狀態
```bash
curl http://localhost:3000/api/queue/metrics | jq '.'
```

### 5. 列出所有任務
```bash
curl http://localhost:3000/api/jobs | jq '.data[] | {id, status, fileName}'
```

---

## 🔧 進階使用

### 修改監控方式

demo.sh 預設使用 **Polling** 方式監控進度。如果想使用 **SSE 串流**：

```bash
# 編輯 demo.sh
nano demo.sh

# 找到這幾行（大約在第 285 行）
monitor_job_polling "$JOB_ID"      # 註解掉這行
# monitor_job_sse "$JOB_ID"        # 取消註解這行
```

### 使用自己的音檔

修改腳本中的 `AUDIO_FILE` 變數：

```bash
# 編輯 demo.sh
nano demo.sh

# 修改第 30 行
AUDIO_FILE="./your-audio-file.mp3"
```

### 修改 API 位址

如果 API 不在本機運行：

```bash
# 編輯 demo.sh
nano demo.sh

# 修改第 29 行
API_BASE_URL="http://your-server:3000"
```

---

## 📝 API 端點快速參考

| 方法 | 端點 | 說明 |
|------|------|------|
| `POST` | `/api/jobs` | 上傳音檔 |
| `GET` | `/api/jobs` | 列出所有任務 |
| `GET` | `/api/jobs/:id` | 查詢任務詳情 |
| `GET` | `/api/jobs/:id/stream` | SSE 即時進度 |
| `DELETE` | `/api/jobs/:id` | 刪除任務 |
| `GET` | `/api/queue/metrics` | 佇列統計 |
| `GET` | `/health` | 健康檢查 |

---

## ⏱️ Demo 執行時間

| 階段 | 時間 | 說明 |
|------|------|------|
| 健康檢查 | ~1秒 | 檢查服務狀態 |
| 檔案驗證 | <1秒 | 驗證音檔存在 |
| 檔案上傳 | 1-3秒 | 取決於檔案大小 |
| 音檔驗證 | ~1秒 | Worker 驗證檔案 |
| Whisper 轉錄 | 5-20秒 | 取決於音檔長度 |
| GPT-4 摘要 | 5-15秒 | 取決於文字長度 |
| **總時間** | **20-40秒** | 完整流程 |

---

## 🐛 故障排除

### 問題 1：腳本執行失敗

```bash
# 確認腳本有執行權限
chmod +x demo.sh

# 確認 jq 已安裝
which jq
```

### 問題 2：API 連線失敗

```bash
# 檢查服務是否運行
docker-compose ps

# 查看服務日誌
docker-compose logs api

# 檢查健康狀態
curl http://localhost:3000/health

# 重啟服務
docker-compose restart
```

### 問題 3：找不到 harvard.wav

```bash
# 確認檔案存在
ls -lh harvard.wav

# 如果不存在，修改 demo.sh 使用其他音檔
nano demo.sh
# 修改 AUDIO_FILE="./your-audio-file.mp3"
```

### 問題 4：任務一直卡在 processing

```bash
# 檢查 Worker 日誌
docker-compose logs worker

# 檢查 OpenAI API Key 是否正確
grep OPENAI_API_KEY .env

# 檢查 API 額度
# 訪問：https://platform.openai.com/account/usage
```

### 問題 5：Port 衝突

```bash
# 如果 3000 port 被佔用
# 編輯 .env
nano .env
# 修改 PORT=8080

# 重啟服務
docker-compose down
docker-compose up
```

### 問題 6：Redis 連線失敗

```bash
# 查看 Redis 日誌
docker-compose logs redis

# 檢查 Redis port 設定
grep REDIS_PORT .env

# 確認沒有 port 衝突
lsof -i :6380
```

---

## 🧪 測試不同場景

### 1. 測試失敗處理

上傳無效檔案：
```bash
curl -X POST http://localhost:3000/api/jobs \
  -F "audio=@invalid-file.txt"
```

### 2. 測試檔案大小限制

上傳超過 25MB 的檔案：
```bash
dd if=/dev/zero of=large.mp3 bs=1M count=30
curl -X POST http://localhost:3000/api/jobs \
  -F "audio=@large.mp3"
```

### 3. 測試 SSE 串流

```bash
# 先上傳檔案獲得 JOB_ID
JOB_ID=$(curl -s -X POST http://localhost:3000/api/jobs \
  -F "audio=@harvard.wav" | jq -r '.data.id')

# 連接 SSE 串流
curl -N http://localhost:3000/api/jobs/$JOB_ID/stream
```

### 4. 批次測試

```bash
# 上傳多個音檔
for file in *.wav; do
  echo "Uploading $file..."
  curl -s -X POST http://localhost:3000/api/jobs \
    -F "audio=@$file" | jq '.data.id'
done
```

---

## 💡 使用提示

1. **首次運行**時，請仔細觀察每個步驟的輸出
2. **開發測試**時，建議使用較短的音檔（< 1 分鐘）
3. **生產環境**測試時，記得修改 `API_BASE_URL`
4. **批次測試**可以修改腳本包裝成迴圈
5. **監控進度**推薦使用 SSE 串流，體驗更佳
6. **音檔限制**：
   - 格式：WAV, MP3, M4A
   - 大小：最大 25MB
   - 長度：建議 < 5 分鐘

---

## 📖 相關文件

- [README.md](README.md) - 完整專案說明
- [QUICKSTART.md](QUICKSTART.md) - 快速開始指南
- [ARCHITECTURE.md](ARCHITECTURE.md) - 系統架構文件

---

## 📂 檔案清單

| 檔案 | 說明 |
|------|------|
| `demo.sh` | Demo 腳本（彩色輸出，詳細步驟） |
| `DEMO.md` | 本文檔 |
| `harvard.wav` | 測試用音檔 |

---

**準備好了嗎？執行 `./demo.sh` 開始測試！🚀**
