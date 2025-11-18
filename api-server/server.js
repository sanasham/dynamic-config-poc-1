// api-server/server.js
import compression from 'compression';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import {
  getConfig,
  loadInitialConfig,
  subscribeToConfig,
} from './configClient.js';
dotenv.config();

const PORT = process.env.PORT_API || 3000;
const app = express();
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(morgan('tiny'));
app.use(express.json());

// runtime state
await loadInitialConfig();
subscribeToConfig();

// Simple in-memory rate limiter keyed by IP (for demo only)
const rateMap = new Map();

function checkRateLimit(req) {
  const cfg = getConfig();
  const rl = cfg.rateLimit || { windowMs: 60000, max: 5 };
  const now = Date.now();
  const key = req.ip || req.headers['x-forwarded-for'] || 'anon';
  const entry = rateMap.get(key) || { ts: now, count: 0 };
  if (now - entry.ts > rl.windowMs) {
    entry.ts = now;
    entry.count = 0;
  }
  entry.count += 1;
  rateMap.set(key, entry);
  return entry.count <= rl.max;
}

// middleware: dynamic global behavior
app.use((req, res, next) => {
  const cfg = getConfig();
  if (!cfg) return next();

  // logging level control (very simple)
  const level = cfg.logging?.level || 'info';
  if (level === 'debug') console.debug('DEBUG =>', req.method, req.url);

  // maintenance mode: disable writes
  if (
    cfg.maintenance?.readOnly &&
    ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)
  ) {
    return res
      .status(503)
      .json({ error: 'Service in read-only maintenance mode' });
  }

  // dynamic auth: if enabled require Authorization header
  if (cfg.features?.enableAuth) {
    const auth = req.header('authorization') || '';
    if (!auth.startsWith('Bearer '))
      return res.status(401).json({ error: 'Auth required by config' });
  }

  // simple runtime rate limit
  if (!checkRateLimit(req))
    return res.status(429).json({ error: 'Rate limit exceeded (dynamic)' });

  next();
});

// /api/users demonstrates responseMode, language and cache toggle
app.get('/api/users', (req, res) => {
  const cfg = getConfig();
  const mode = cfg?.responseMode || 'full';
  const language = cfg?.ui?.language || 'en';
  const messages = { en: 'Hello', es: 'Hola', fr: 'Bonjour' };
  const data = [
    { id: 1, name: 'Alice', email: 'a@example.com', meta: { visits: 10 } },
    { id: 2, name: 'Bob', email: 'b@example.com', meta: { visits: 3 } },
  ];

  if (cfg.features?.enableCache) {
    // demo cached response
    return res.json({
      message: `${messages[language] || messages.en} (cached)`,
      configVersion: cfg.configVersion,
      data:
        mode === 'summary'
          ? data.map((d) => ({ id: d.id, name: d.name }))
          : data,
    });
  }
  res.json({
    message: `${messages[language] || messages.en} (fresh)`,
    configVersion: cfg.configVersion,
    data:
      mode === 'summary' ? data.map((d) => ({ id: d.id, name: d.name })) : data,
  });
});

app.get('/api/status', (req, res) => {
  const cfg = getConfig() || {};
  res.json({
    status: 'ok',
    configVersion: cfg.configVersion || null,
    ui: cfg.ui || {},
    features: cfg.features || {},
  });
});

app.get('/healthz', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () =>
  console.log(`API server listening on http://0.0.0.0:${PORT}`)
);
