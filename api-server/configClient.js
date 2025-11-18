// api-server/configClient.js
import axios from 'axios';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const EventSource = require('eventsource');

const CONFIG_URL = process.env.CONFIG_SERVER_URL || 'http://localhost:4000';

let currentConfig = {};
let lastEventId = null;

// GET latest config snapshot
export function getConfig() {
  return currentConfig;
}

// Load initial configuration (blocking)
export async function loadInitialConfig() {
  try {
    const res = await axios.get(`${CONFIG_URL}/config`, { timeout: 5000 });
    currentConfig = res.data || {};
    lastEventId = currentConfig.configVersion || null;

    console.log('API: initial config loaded v=', lastEventId);
  } catch (e) {
    console.warn('API: failed to load initial config', e.message);
    currentConfig = {};
  }
}

// Exponential backoff
function backoff(attempt) {
  const max = 30000;
  const base = Math.min(max, 1000 * Math.pow(2, attempt));
  return base + Math.floor(Math.random() * 500);
}

// Subscribe to SSE config stream
export function subscribeToConfig() {
  let attempt = 0;
  let es = null;
  let closed = false;

  const connect = () => {
    const headers = lastEventId ? { 'Last-Event-ID': String(lastEventId) } : {};

    console.log('API: connecting to SSE…');

    try {
      es = new EventSource(`${CONFIG_URL}/events`, { headers });
    } catch (err) {
      console.error('API: EventSource creation failed', err.message);
      scheduleReconnect();
      return;
    }

    es.onopen = () => {
      console.log('API: SSE connection open');
      attempt = 0;
    };

    es.onmessage = (evt) => {
      if (!evt.data) return;

      try {
        const parsed = JSON.parse(evt.data);

        currentConfig = parsed;
        lastEventId =
          evt.lastEventId || parsed.configVersion || Date.now().toString();

        console.log('API: config update received v=', lastEventId);
      } catch (err) {
        console.error('API: failed to parse SSE payload', err.message);
      }
    };

    es.onerror = (err) => {
      console.error('API: SSE error:', err?.message || err);

      try {
        es.close();
      } catch (_) {}

      if (closed) return;
      scheduleReconnect();
    };

    function scheduleReconnect() {
      attempt++;
      const wait = backoff(attempt);
      console.log(`API: reconnecting in ${wait}ms`);
      setTimeout(() => !closed && connect(), wait);
    }
  };

  connect();

  // return unsubscribe function
  return () => {
    closed = true;
    try {
      es && es.close();
    } catch (_) {}
  };
}
