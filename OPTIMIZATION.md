# 專案優化建議

## 發現的問題與優化方向

### 🔴 高優先級（影響功能或安全性）

#### 1. 路由路徑不一致
**問題**:
- `server.js` 中 API info 顯示 metrics 為 `/api/queue/metrics`
- 實際路徑為 `/api/jobs/queue/metrics`（因為掛載在 `/api/jobs` 下）

**修復建議**:
```javascript
// 方案 1: 移動 metrics 路由到 server.js
app.get('/api/queue/metrics', getMetrics);

// 方案 2: 更新文檔路徑為實際路徑
'GET /api/jobs/queue/metrics': 'Get queue metrics'
```

#### 2. Catch-all 路由問題
**問題**: `app.get('*', ...)` 會捕獲所有路由，可能干擾 API 404 處理

**修復建議**:
```javascript
// 只在非 API 路徑使用 catch-all
app.get(/^(?!\/api).*/, (req, res) => {
  // serve index.html
});
```

#### 3. 檔案流未正確關閉
**問題**: STT 服務中使用 `createReadStream` 但沒有確保流被正確關閉

**修復建議**:
```javascript
const audioStream = fs.createReadStream(filePath);
try {
  const response = await openai.audio.transcriptions.create({
    file: audioStream,
    // ...
  });
  return response;
} finally {
  audioStream.destroy();
}
```

#### 4. 缺少 UUID 驗證
**問題**: 沒有驗證 job ID 是否為有效的 UUID 格式

**修復建議**:
```javascript
// 新增 middleware
function validateUUID(req, res, next) {
  const { id } = req.params;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!uuidRegex.test(id)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid job ID format'
    });
  }
  next();
}

// 應用到路由
router.get('/:id', validateUUID, getJobById);
```

### 🟡 中優先級（效能與可維護性）

#### 5. 缺少 Rate Limiting
**問題**: 沒有 API rate limiting，容易被濫用

**修復建議**:
```javascript
const rateLimit = require('express-rate-limit');

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: 'Too many uploads, please try again later.'
});

router.post('/', uploadLimiter, upload.single('audio'), createJob);
```

#### 6. OpenAI API Key 驗證
**問題**: 啟動時沒有驗證 API key 是否有效

**修復建議**:
```javascript
// 在 server.js 啟動時
async function validateOpenAIKey() {
  try {
    await openai.models.list();
    console.log('✓ OpenAI API key validated');
  } catch (error) {
    console.error('✗ Invalid OpenAI API key');
    process.exit(1);
  }
}
```

#### 7. SSE 連接洩漏風險
**問題**: SSE 連接管理可能有記憶體洩漏風險

**修復建議**:
```javascript
// 加入連接超時機制
const SSE_TIMEOUT = 5 * 60 * 1000; // 5 minutes
const timeout = setTimeout(() => {
  res.write('data: {"type":"timeout"}\n\n');
  res.end();
}, SSE_TIMEOUT);

req.on('close', () => {
  clearTimeout(timeout);
  // cleanup
});
```

#### 8. 缺少請求驗證
**問題**: 沒有使用驗證庫驗證請求參數

**修復建議**:
```javascript
const { body, param, query, validationResult } = require('express-validator');

// 驗證中介軟體
const validateCreateJob = [
  // multer 已處理檔案驗證
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }
    next();
  }
];

const validateQuery = [
  query('status').optional().isIn(['pending', 'processing', 'completed', 'failed']),
  query('limit').optional().isInt({ min: 1, max: 100 })
];
```

#### 9. 日誌系統
**問題**: 使用 console.log，不適合生產環境

**修復建議**:
```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});
```

### 🟢 低優先級（改善用戶體驗）

#### 10. 檔案清理策略
**問題**: 上傳的檔案沒有自動清理機制

**修復建議**:
```javascript
// 新增定期清理任務
const cron = require('node-cron');

// 每天凌晨 2 點清理超過 7 天的檔案
cron.schedule('0 2 * * *', async () => {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  // 清理邏輯
});
```

#### 11. 健康檢查增強
**問題**: 健康檢查只檢查資料庫，沒有檢查 Redis

**修復建議**:
```javascript
app.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {}
  };

  try {
    await pool.query('SELECT 1');
    health.checks.database = 'ok';
  } catch (error) {
    health.checks.database = 'failed';
    health.status = 'unhealthy';
  }

  try {
    await redis.ping();
    health.checks.redis = 'ok';
  } catch (error) {
    health.checks.redis = 'failed';
    health.status = 'unhealthy';
  }

  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});
```

#### 12. 前端錯誤處理
**問題**: 前端沒有顯示詳細的錯誤訊息

**修復建議**:
- 改善錯誤訊息顯示
- 加入重試按鈕
- 顯示網路錯誤提示

#### 13. API 版本控制
**問題**: 沒有 API 版本控制

**修復建議**:
```javascript
// 使用版本前綴
app.use('/api/v1/jobs', jobRoutes);
```

#### 14. CORS 配置
**問題**: CORS 設定太寬鬆，允許所有來源

**修復建議**:
```javascript
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || 'http://localhost:3000',
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
```

#### 15. 資料庫連接池優化
**問題**: 沒有監控資料庫連接池狀態

**修復建議**:
```javascript
// 定期記錄連接池狀態
setInterval(() => {
  console.log('DB Pool:', {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount
  });
}, 60000);
```

#### 16. Worker 監控
**問題**: Worker 沒有暴露健康檢查或指標端點

**修復建議**:
```javascript
// 在 worker.js 加入簡單的 HTTP 伺服器
const express = require('express');
const monitorApp = express();

monitorApp.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    worker: {
      active: worker.isRunning(),
      paused: worker.isPaused()
    }
  });
});

monitorApp.listen(3001);
```

## 安全性改善

### 17. 檔案名稱消毒
**問題**: 原始檔名沒有消毒處理

**修復建議**:
```javascript
const sanitize = require('sanitize-filename');

filename: (req, file, cb) => {
  const sanitized = sanitize(file.originalname);
  const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(8).toString('hex');
  cb(null, uniqueSuffix + path.extname(sanitized));
}
```

### 18. SQL Injection 預防
**狀態**: ✅ 已使用參數化查詢，良好

### 19. 敏感資訊過濾
**問題**: 錯誤訊息可能洩漏系統資訊

**修復建議**:
```javascript
// 只在開發環境返回詳細錯誤
if (config.nodeEnv === 'production') {
  error.message = 'An error occurred';
  delete error.stack;
}
```

## 效能優化

### 20. 資料庫索引
**狀態**: ✅ 已建立必要索引

### 21. Redis 連接複用
**狀態**: ✅ 已正確實作

### 22. 檔案上傳流式處理
**狀態**: ✅ 已使用 multer 處理

### 23. 回應壓縮
**問題**: 沒有啟用 gzip 壓縮

**修復建議**:
```javascript
const compression = require('compression');
app.use(compression());
```

## 測試改善

### 24. 單元測試
**建議**: 加入測試框架
```javascript
// 使用 Jest
npm install --save-dev jest supertest

// 測試範例
describe('Job API', () => {
  test('should create job', async () => {
    const response = await request(app)
      .post('/api/jobs')
      .attach('audio', 'test.mp3');
    expect(response.status).toBe(201);
  });
});
```

### 25. 整合測試
**建議**: 測試完整的工作流程

### 26. 負載測試
**建議**: 使用 k6 或 Artillery 進行負載測試

## 文檔改善

### 27. API 文檔
**建議**: 使用 Swagger/OpenAPI

```javascript
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger.json');

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
```

### 28. JSDoc 註解
**狀態**: ✅ 部分函數有註解，建議補全

## 部署改善

### 29. 環境變數驗證
**建議**: 啟動時驗證所有必要的環境變數

```javascript
const requiredEnvVars = ['OPENAI_API_KEY', 'POSTGRES_PASSWORD'];
const missing = requiredEnvVars.filter(v => !process.env[v]);

if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}
```

### 30. Graceful Shutdown 改善
**問題**: 關閉時沒有等待正在處理的請求

**修復建議**:
```javascript
let server;

server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

async function gracefulShutdown(signal) {
  console.log(`${signal} received, shutting down gracefully...`);

  server.close(async () => {
    console.log('HTTP server closed');
    await pool.end();
    await redis.quit();
    process.exit(0);
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    console.error('Forced shutdown');
    process.exit(1);
  }, 30000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
```

## 監控與可觀測性

### 31. Prometheus Metrics
**建議**: 加入 Prometheus 指標

```javascript
const promClient = require('prom-client');
const register = new promClient.Registry();

const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code']
});

register.registerMetric(httpRequestDuration);

app.get('/metrics', (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(register.metrics());
});
```

### 32. 錯誤追蹤
**建議**: 整合 Sentry 或類似服務

```javascript
const Sentry = require('@sentry/node');

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV
});
```

## 總結

### 立即修復（影響正確性）:
1. ✅ 路由路徑不一致
2. ✅ Catch-all 路由問題
3. ✅ UUID 驗證

### 短期改善（1-2 週）:
4. Rate limiting
5. 日誌系統
6. 健康檢查增強
7. 請求驗證

### 中期改善（1 個月）:
8. 單元測試
9. API 文檔（Swagger）
10. Monitoring/Metrics
11. 錯誤追蹤

### 長期改善:
12. 微服務拆分
13. 水平擴展支援
14. 進階監控與告警

---

整體來說，當前實作已經是一個結構良好、功能完整的系統。
以上優化建議主要針對生產環境的穩定性、安全性和可維護性。
