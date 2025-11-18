import cors from 'cors';
import express from 'express';

const app = express();
app.use(cors());
app.use(express.json());

let config = {
  configVersion: 1,
  ui: { language: 'en' },
  features: { enableAuth: false, enableCache: false },
  responseMode: 'full',
  maintenance: { readOnly: false },
  logging: { level: 'info' },
};

// All SSE connections
let clients = [];

app.get('/config', (req, res) => {
  res.json(config);
});

// Correct SSE endpoint
app.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  res.flushHeaders(); // VERY IMPORTANT

  // register client
  const client = { id: Date.now(), res };
  clients.push(client);

  console.log('CFG: client connected:', client.id);

  // Send initial config
  res.write(`id: ${config.configVersion}\n`);
  res.write(`data: ${JSON.stringify(config)}\n\n`);

  // Remove client on disconnect
  req.on('close', () => {
    clients = clients.filter((c) => c.id !== client.id);
    console.log('CFG: client disconnected:', client.id);
  });
});

// update config
app.post('/update', (req, res) => {
  const update = req.body || {};
  config = {
    ...config,
    ...update,
    configVersion: config.configVersion + 1,
  };

  console.log('CFG: new config v=', config.configVersion);

  // Broadcast to all SSE clients
  clients.forEach((c) => {
    c.res.write(`id: ${config.configVersion}\n`);
    c.res.write(`data: ${JSON.stringify(config)}\n\n`);
  });

  res.json({ ok: true, version: config.configVersion });
});

app.listen(4000, () => {
  console.log('Config server running on http://localhost:4000');
});
