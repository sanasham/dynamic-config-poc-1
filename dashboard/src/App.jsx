import axios from 'axios';
import { useCallback, useEffect, useState } from 'react';
import { translations } from './i18n';
const CONFIG_SERVER =
  import.meta.env.VITE_CONFIG_SERVER_URL || 'http://localhost:4000';
const ADMIN_TOKEN =
  import.meta.env.VITE_ADMIN_TOKEN || 'supersecret_admin_token';
const API_TEST =
  (import.meta.env.VITE_API_SERVERS || 'http://localhost:3000').split(',')[0] +
  '/api/users';

function applyDark(enabled) {
  document.documentElement.classList.toggle('dark', !!enabled);
}

export default function App() {
  const [config, setConfig] = useState(null);
  const [editing, setEditing] = useState('');
  const [connected, setConnected] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [creds, setCreds] = useState({ username: '', password: '' });
  const [apiResp, setApiResp] = useState(null);

  useEffect(() => {
    const es = new EventSource(`${CONFIG_SERVER}/events`);
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        setConfig(data);
        setEditing(JSON.stringify(data, null, 2));
        applyDark(data?.ui?.darkMode);
        if (!data?.features?.enableAuth) setLoggedIn(false);
      } catch (err) {
        console.error(err);
      }
    };
    return () => {
      try {
        es.close();
      } catch (e) {}
    };
  }, []);

  const lang = config?.ui?.language || 'en';
  const t = translations[lang] || translations.en;

  const saveConfig = useCallback(async () => {
    try {
      const parsed = JSON.parse(editing);
      await axios.put(`${CONFIG_SERVER}/config`, parsed, {
        headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
      });
      alert('Saved');
    } catch (err) {
      alert('Save failed: ' + err.message);
    }
  }, [editing]);

  const toggleDark = useCallback(async () => {
    await axios.put(
      `${CONFIG_SERVER}/config`,
      { ui: { ...config.ui, darkMode: !config.ui?.darkMode } },
      { headers: { Authorization: `Bearer ${ADMIN_TOKEN}` } }
    );
  }, [config]);

  const changeLanguage = useCallback(
    async (l) => {
      await axios.put(
        `${CONFIG_SERVER}/config`,
        { ui: { ...config.ui, language: l } },
        { headers: { Authorization: `Bearer ${ADMIN_TOKEN}` } }
      );
    },
    [config]
  );

  const toggleAuth = useCallback(async () => {
    await axios.put(
      `${CONFIG_SERVER}/config`,
      {
        features: {
          ...config.features,
          enableAuth: !config.features?.enableAuth,
        },
      },
      { headers: { Authorization: `Bearer ${ADMIN_TOKEN}` } }
    );
  }, [config]);

  const handleLogin = (e) => {
    e.preventDefault();
    if (creds.username === 'admin' && creds.password === 'password')
      setLoggedIn(true);
    else alert('Invalid');
  };

  const testApi = async () => {
    try {
      const headers = {};
      if (config?.features?.enableAuth) headers.Authorization = 'Bearer demo';
      const r = await axios.get(API_TEST, { headers });
      setApiResp(JSON.stringify(r.data, null, 2));
    } catch (err) {
      setApiResp('Error: ' + (err.response?.data?.error || err.message));
    }
  };

  if (!config)
    return (
      <div style={{ padding: 20 }}>
        {connected ? t.statusConnected : t.statusDisconnected} - waiting for
        config...
      </div>
    );

  if (config.features?.enableAuth && !loggedIn) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg,#f3f4f6)',
        }}
      >
        <div
          style={{
            width: 360,
            padding: 20,
            background: '#fff',
            borderRadius: 8,
          }}
        >
          <h2 style={{ margin: 0, marginBottom: 12 }}>{t.login}</h2>
          <form onSubmit={handleLogin}>
            <input
              placeholder='admin'
              value={creds.username}
              onChange={(e) => setCreds({ ...creds, username: e.target.value })}
              style={{ width: '100%', padding: 8, marginBottom: 8 }}
            />
            <input
              type='password'
              placeholder='password'
              value={creds.password}
              onChange={(e) => setCreds({ ...creds, password: e.target.value })}
              style={{ width: '100%', padding: 8, marginBottom: 8 }}
            />
            <button
              style={{
                width: '100%',
                padding: 10,
                background: '#2563eb',
                color: '#fff',
                border: 0,
                borderRadius: 6,
              }}
            >
              {t.login}
            </button>
          </form>
          <p style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>
            Demo creds: admin / password
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', padding: 20, background: '#f3f4f6' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 20,
          }}
        >
          <h1>{t.title}</h1>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span>{connected ? t.statusConnected : t.statusDisconnected}</span>
            <button
              onClick={toggleAuth}
              style={{
                padding: '6px 10px',
                background: '#10b981',
                color: '#fff',
                border: 0,
                borderRadius: 6,
              }}
            >
              {config.features?.enableAuth ? 'Disable Auth' : 'Enable Auth'}
            </button>
          </div>
        </header>

        <div
          style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: 16 }}
        >
          <div>
            <h3>Config (live)</h3>
            <textarea
              value={editing}
              onChange={(e) => setEditing(e.target.value)}
              style={{
                width: '100%',
                height: 380,
                padding: 8,
                fontFamily: 'monospace',
              }}
            />
            <div style={{ textAlign: 'right', marginTop: 8 }}>
              <button
                onClick={saveConfig}
                style={{
                  padding: '8px 12px',
                  background: '#059669',
                  color: '#fff',
                  border: 0,
                  borderRadius: 6,
                }}
              >
                {t.save}
              </button>
            </div>
          </div>

          <aside style={{ background: '#fff', padding: 12, borderRadius: 8 }}>
            <h4>UI Controls</h4>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: 8,
              }}
            >
              <div>{t.darkMode}</div>
              <button
                onClick={toggleDark}
                style={{ padding: 6, borderRadius: 6 }}
              >
                {config.ui?.darkMode ? 'Disable' : 'Enable'}
              </button>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: 8,
              }}
            >
              <div>{t.language}</div>
              <select
                value={config.ui?.language || 'en'}
                onChange={(e) => changeLanguage(e.target.value)}
              >
                <option value='en'>English</option>
                <option value='es'>Español</option>
                <option value='fr'>Français</option>
              </select>
            </div>

            <div style={{ marginTop: 12 }}>
              <h4>{t.apiTest}</h4>
              <button
                onClick={testApi}
                style={{
                  padding: 8,
                  background: '#3b82f6',
                  color: '#fff',
                  border: 0,
                  borderRadius: 6,
                }}
              >
                {t.apiTest}
              </button>
              <pre
                style={{
                  marginTop: 8,
                  background: '#f8fafc',
                  padding: 8,
                  height: 180,
                  overflow: 'auto',
                }}
              >
                {apiResp || t.apiResponse}
              </pre>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
