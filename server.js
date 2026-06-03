require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const fs         = require('fs');
const path       = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;
const DB   = path.join(__dirname, 'db.json');

app.use(express.json({ limit: '10mb' }));
app.use(cors());
app.use(express.static(path.join(__dirname)));

/* ═══════════════════════════════
   JSON FILE DATABASE
═══════════════════════════════ */
function readDb() {
  try { return JSON.parse(fs.readFileSync(DB, 'utf8')); }
  catch { return {}; }
}
function writeDb(data) {
  fs.writeFileSync(DB, JSON.stringify(data, null, 2));
}
function getUser(enrollId) {
  const db = readDb();
  return db[enrollId] || null;
}
function saveUser(enrollId, data) {
  const db = readDb();
  db[enrollId] = { ...data, updatedAt: new Date().toISOString() };
  writeDb(db);
}

/* ═══════════════════════════════
   CREDENTIALS
═══════════════════════════════ */
const VALID_ID  = '992401030089';
const VALID_PWD = 'C1B35E';

/* ═══════════════════════════════
   AUTH MIDDLEWARE
═══════════════════════════════ */
function auth(req, res, next) {
  const header = req.headers['x-auth'];
  if (!header) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const [id, pwd] = Buffer.from(header, 'base64').toString().split(':');
    if (id === VALID_ID && pwd === VALID_PWD) { req.enrollId = id; return next(); }
  } catch {}
  return res.status(401).json({ error: 'Invalid credentials' });
}

/* ═══════════════════════════════
   ROUTES
═══════════════════════════════ */

// POST /api/login
app.post('/api/login', (req, res) => {
  const { enrollId, password } = req.body || {};
  if (!enrollId || !password)
    return res.status(400).json({ success: false, message: 'Missing fields' });
  if (enrollId === VALID_ID && password === VALID_PWD) {
    const token = Buffer.from(`${enrollId}:${password}`).toString('base64');
    return res.json({ success: true, token });
  }
  return res.status(401).json({ success: false, message: 'Invalid enrollment number or password.' });
});

// GET /api/data  — fetch all portal data
app.get('/api/data', auth, (req, res) => {
  const data = getUser(req.enrollId) || {};
  return res.json({ success: true, data });
});

// POST /api/data  — save all portal data
app.post('/api/data', auth, (req, res) => {
  try {
    saveUser(req.enrollId, req.body);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Catch-all → serve index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

/* ═══════════════════════════════
   START
═══════════════════════════════ */
app.listen(PORT, async () => {
  console.log(`\n✅  JP Portal server → http://localhost:${PORT}`);
  console.log(`📦  Data stored in:    db.json\n`);

  // Try to open a public tunnel
  try {
    const localtunnel = require('localtunnel');
    const tunnel = await localtunnel({ port: PORT, subdomain: 'jportal-student' });
    console.log(`🌍  PUBLIC URL  →  ${tunnel.url}`);
    console.log(`    Share this link with your friends!\n`);
    tunnel.on('close', () => console.log('Tunnel closed.'));
    tunnel.on('error', (err) => {
      // Try without subdomain
      localtunnel({ port: PORT }).then(t => {
        console.log(`🌍  PUBLIC URL  →  ${t.url}`);
        console.log(`    Share this link with your friends!\n`);
      });
    });
  } catch (e) {
    console.log('ℹ️   To share publicly, run: npx localtunnel --port 3000');
  }
});
