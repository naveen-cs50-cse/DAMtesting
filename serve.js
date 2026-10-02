const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3456;
const DIST_DIR = path.join(__dirname, 'dam-ai', 'dist');

// Read .env if present
const env = {};
try {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const idx = trimmed.indexOf('=');
        const k = trimmed.slice(0, idx).trim();
        const v = trimmed.slice(idx + 1).trim();
        env[k] = v;
      }
    });
  }
} catch (e) {
  console.warn('Could not read .env:', e.message);
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const urlPath = req.url.split('?')[0];

  // API Route: Configuration status
  if (urlPath === '/api/config') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      hasOpenAI: !!env.OPENAI_API_KEY,
      hasTavily: !!env.TAVILY_API_KEY,
      maskedOpenAI: env.OPENAI_API_KEY ? env.OPENAI_API_KEY.slice(0, 10) + '...' + env.OPENAI_API_KEY.slice(-4) : '',
      maskedTavily: env.TAVILY_API_KEY ? env.TAVILY_API_KEY.slice(0, 12) + '...' + env.TAVILY_API_KEY.slice(-4) : '',
    }));
    return;
  }

  // API Route: Live Tavily Search
  if (urlPath === '/api/search' && req.method === 'POST') {
    try {
      const data = await readBody(req);
      const query = data.query;
      const tavilyKey = data.apiKey || env.TAVILY_API_KEY;

      if (!tavilyKey) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'TAVILY_API_KEY not configured' }));
        return;
      }

      const tavilyRes = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: tavilyKey,
          query: query,
          search_depth: data.search_depth || 'advanced',
          include_answer: true,
          max_results: data.max_results || 5,
        }),
      });

      const result = await tavilyRes.json();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // API Route: Live OpenAI Chat
  if (urlPath === '/api/chat' && req.method === 'POST') {
    try {
      const data = await readBody(req);
      const openaiKey = data.apiKey || env.OPENAI_API_KEY;

      if (!openaiKey) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'OPENAI_API_KEY not configured' }));
        return;
      }

      const chatRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: data.model || env.DAM_MODEL_PRIMARY || 'gpt-4o-mini',
          messages: data.messages,
          temperature: data.temperature ?? 0.2,
          max_tokens: data.max_tokens || 1500,
        }),
      });

      const result = await chatRes.json();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // Static File Serving
  let filePath = path.join(DIST_DIR, urlPath);
  if (filePath.endsWith(path.sep) || urlPath === '/' || urlPath.startsWith('/?')) {
    filePath = path.join(DIST_DIR, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`DAM AI Server running at http://127.0.0.1:${PORT}/`);
  console.log(`- OpenAI Key: ${env.OPENAI_API_KEY ? 'Loaded from .env' : 'Not configured'}`);
  console.log(`- Tavily Key: ${env.TAVILY_API_KEY ? 'Loaded from .env' : 'Not configured'}`);
});
