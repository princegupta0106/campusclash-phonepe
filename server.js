const express = require('express');
const initSqlJs = require('sql.js');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'campusclash_nextbyte_secret_2026';
const ADMIN_EMAIL = 'princeguptapg0106@gmail.com';
const DB_PATH = path.join(__dirname, 'campusclash.db');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let db;

// Helper: save DB to file
function saveDb() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

// Helper: run a query and return all rows
function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

// Helper: run a query and return one row
function queryOne(sql, params = []) {
  const rows = queryAll(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

// Helper: run an insert/update/delete
function runSql(sql, params = []) {
  db.run(sql, params);
  const result = db.exec("SELECT last_insert_rowid() as lid");
  const lid = (result.length > 0 && result[0].values.length > 0) ? result[0].values[0][0] : 0;
  saveDb();
  return { lastInsertRowid: lid };
}

async function startServer() {
  const SQL = await initSqlJs();

  // Load existing DB or create new
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // Create Tables
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS tournaments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      game TEXT NOT NULL,
      venue TEXT NOT NULL,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      fees REAL DEFAULT 0,
      max_participants INTEGER DEFAULT 100,
      image_url TEXT DEFAULT '',
      status TEXT DEFAULT 'upcoming',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS registrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      tournament_id INTEGER NOT NULL,
      payment_status TEXT DEFAULT 'pending',
      transaction_id TEXT,
      registered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (tournament_id) REFERENCES tournaments(id),
      UNIQUE(user_id, tournament_id)
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS contact_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  saveDb();

  // Seed tournaments if none exist
  const countResult = queryOne('SELECT COUNT(*) as count FROM tournaments');
  if (countResult.count === 0) {
    db.run(`INSERT INTO tournaments (name, description, game, venue, date, time, fees, max_participants, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['Valorant Showdown 2026', 'The ultimate 5v5 tactical shooter tournament. Compete against the best teams on campus and prove your dominance in Valorant. Prizes worth ₹50,000!', 'Valorant', 'Main Auditorium, Block A', '2026-06-15', '10:00', 199, 64, 'upcoming']
    );
    db.run(`INSERT INTO tournaments (name, description, game, venue, date, time, fees, max_participants, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['BGMI Battle Royale', 'Drop in, loot up, and be the last squad standing! Join the most intense BGMI tournament on campus with epic prizes and bragging rights.', 'BGMI', 'Gaming Arena, Sports Complex', '2026-06-22', '14:00', 149, 100, 'upcoming']
    );
    db.run(`INSERT INTO tournaments (name, description, game, venue, date, time, fees, max_participants, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['FIFA Championship', 'Show off your football skills in this 1v1 FIFA tournament. From group stages to the grand finale, every match counts!', 'FIFA 25', 'E-Sports Lab, IT Block', '2026-07-01', '11:00', 99, 32, 'upcoming']
    );
    db.run(`INSERT INTO tournaments (name, description, game, venue, date, time, fees, max_participants, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['Chess Masters Open', 'A classic battle of minds. Whether you are a beginner or a grandmaster, this chess tournament welcomes all skill levels.', 'Chess', 'Seminar Hall, Library Building', '2026-05-10', '09:00', 49, 50, 'past']
    );
    saveDb();
    console.log('✅ Seeded 4 tournaments');
  }

  // ─── Auth Middleware ───
  function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      next();
    } catch (err) {
      return res.status(403).json({ error: 'Invalid or expired token.' });
    }
  }

  function requireAdmin(req, res, next) {
    if (req.user.email !== ADMIN_EMAIL) {
      return res.status(403).json({ error: 'Admin access required.' });
    }
    next();
  }

  // ─── AUTH ROUTES ───

  app.post('/api/auth/register', (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'All fields are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const existing = queryOne('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) {
      return res.status(400).json({ error: 'Email already registered.' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const result = runSql('INSERT INTO users (name, email, password) VALUES (?, ?, ?)', [name, email, hashedPassword]);

    const token = jwt.sign({ id: result.lastInsertRowid, email, name }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: result.lastInsertRowid, name, email, isAdmin: email === ADMIN_EMAIL } });
  });

  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = queryOne('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    const validPassword = bcrypt.compareSync(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, isAdmin: user.email === ADMIN_EMAIL } });
  });

  app.get('/api/auth/me', authenticateToken, (req, res) => {
    const user = queryOne('SELECT id, name, email, created_at FROM users WHERE id = ?', [req.user.id]);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    res.json({ ...user, isAdmin: user.email === ADMIN_EMAIL });
  });

  // ─── TOURNAMENT ROUTES ───

  app.get('/api/tournaments', (req, res) => {
    const tournaments = queryAll(`
      SELECT t.*,
        (SELECT COUNT(*) FROM registrations WHERE tournament_id = t.id AND payment_status = 'paid') as registered_count
      FROM tournaments t
      ORDER BY t.date DESC
    `);
    res.json(tournaments);
  });

  app.get('/api/tournaments/:id', (req, res) => {
    const tournament = queryOne(`
      SELECT t.*,
        (SELECT COUNT(*) FROM registrations WHERE tournament_id = t.id AND payment_status = 'paid') as registered_count
      FROM tournaments t WHERE t.id = ?
    `, [Number(req.params.id)]);
    if (!tournament) return res.status(404).json({ error: 'Tournament not found.' });
    res.json(tournament);
  });

  app.post('/api/tournaments', authenticateToken, requireAdmin, (req, res) => {
    const { name, description, game, venue, date, time, fees, max_participants } = req.body;
    if (!name || !game || !venue || !date || !time) {
      return res.status(400).json({ error: 'Required fields: name, game, venue, date, time.' });
    }

    const result = runSql(`
      INSERT INTO tournaments (name, description, game, venue, date, time, fees, max_participants, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [name, description || '', game, venue, date, time, fees || 0, max_participants || 100, 'upcoming']);

    const tournament = queryOne('SELECT * FROM tournaments WHERE id = ?', [result.lastInsertRowid]);
    res.json(tournament);
  });

  app.put('/api/tournaments/:id', authenticateToken, requireAdmin, (req, res) => {
    const { name, description, game, venue, date, time, fees, max_participants, status } = req.body;
    runSql(`
      UPDATE tournaments SET name=?, description=?, game=?, venue=?, date=?, time=?, fees=?, max_participants=?, status=?
      WHERE id=?
    `, [name, description, game, venue, date, time, fees, max_participants, status, Number(req.params.id)]);

    const tournament = queryOne('SELECT * FROM tournaments WHERE id = ?', [Number(req.params.id)]);
    res.json(tournament);
  });

  app.delete('/api/tournaments/:id', authenticateToken, requireAdmin, (req, res) => {
    runSql('DELETE FROM registrations WHERE tournament_id = ?', [Number(req.params.id)]);
    runSql('DELETE FROM tournaments WHERE id = ?', [Number(req.params.id)]);
    res.json({ message: 'Tournament deleted.' });
  });

  // ─── REGISTRATION ROUTES ───

  app.post('/api/tournaments/:id/register', authenticateToken, (req, res) => {
    const tournamentId = Number(req.params.id);
    const userId = req.user.id;

    const tournament = queryOne('SELECT * FROM tournaments WHERE id = ?', [tournamentId]);
    if (!tournament) return res.status(404).json({ error: 'Tournament not found.' });
    if (tournament.status === 'past') return res.status(400).json({ error: 'Cannot register for a past tournament.' });

    const existingReg = queryOne('SELECT * FROM registrations WHERE user_id = ? AND tournament_id = ?', [userId, tournamentId]);
    if (existingReg) {
      if (existingReg.payment_status === 'paid') {
        return res.status(400).json({ error: 'You are already registered for this tournament.' });
      }
      const txnId = 'TXN' + Date.now() + Math.random().toString(36).substring(2, 8).toUpperCase();
      runSql('UPDATE registrations SET payment_status = ?, transaction_id = ? WHERE id = ?', ['paid', txnId, existingReg.id]);
      return res.json({ message: 'Registration completed!', transaction_id: txnId });
    }

    const regCount = queryOne("SELECT COUNT(*) as count FROM registrations WHERE tournament_id = ? AND payment_status = 'paid'", [tournamentId]);
    if (regCount.count >= tournament.max_participants) {
      return res.status(400).json({ error: 'Tournament is full.' });
    }

    const txnId = 'TXN' + Date.now() + Math.random().toString(36).substring(2, 8).toUpperCase();
    runSql('INSERT INTO registrations (user_id, tournament_id, payment_status, transaction_id) VALUES (?, ?, ?, ?)', [userId, tournamentId, 'paid', txnId]);

    res.json({ message: 'Registration successful!', transaction_id: txnId });
  });

  app.get('/api/my-tournaments', authenticateToken, (req, res) => {
    const registrations = queryAll(`
      SELECT r.*, t.name as tournament_name, t.game, t.venue, t.date, t.time, t.fees, t.status as tournament_status
      FROM registrations r
      JOIN tournaments t ON r.tournament_id = t.id
      WHERE r.user_id = ?
      ORDER BY t.date DESC
    `, [req.user.id]);
    res.json(registrations);
  });

  app.get('/api/tournaments/:id/check-registration', authenticateToken, (req, res) => {
    const reg = queryOne("SELECT * FROM registrations WHERE user_id = ? AND tournament_id = ? AND payment_status = 'paid'", [req.user.id, Number(req.params.id)]);
    res.json({ registered: !!reg });
  });

  // ─── ADMIN ROUTES ───

  app.get('/api/admin/stats', authenticateToken, requireAdmin, (req, res) => {
    const totalUsers = queryOne('SELECT COUNT(*) as count FROM users').count;
    const totalTournaments = queryOne('SELECT COUNT(*) as count FROM tournaments').count;
    const totalRegistrations = queryOne("SELECT COUNT(*) as count FROM registrations WHERE payment_status = 'paid'").count;
    const totalRevenue = queryOne("SELECT COALESCE(SUM(t.fees), 0) as total FROM registrations r JOIN tournaments t ON r.tournament_id = t.id WHERE r.payment_status = 'paid'").total;
    const recentRegistrations = queryAll(`
      SELECT r.*, u.name as user_name, u.email as user_email, t.name as tournament_name
      FROM registrations r
      JOIN users u ON r.user_id = u.id
      JOIN tournaments t ON r.tournament_id = t.id
      WHERE r.payment_status = 'paid'
      ORDER BY r.registered_at DESC
      LIMIT 10
    `);

    res.json({ totalUsers, totalTournaments, totalRegistrations, totalRevenue, recentRegistrations });
  });

  app.get('/api/admin/registrations/:tournamentId', authenticateToken, requireAdmin, (req, res) => {
    const registrations = queryAll(`
      SELECT r.*, u.name as user_name, u.email as user_email
      FROM registrations r
      JOIN users u ON r.user_id = u.id
      WHERE r.tournament_id = ? AND r.payment_status = 'paid'
      ORDER BY r.registered_at DESC
    `, [Number(req.params.tournamentId)]);
    res.json(registrations);
  });

  // ─── CONTACT ───

  app.post('/api/contact', (req, res) => {
    const { name, email, subject, message } = req.body;
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ error: 'All fields are required.' });
    }
    runSql('INSERT INTO contact_messages (name, email, subject, message) VALUES (?, ?, ?, ?)', [name, email, subject, message]);
    res.json({ message: 'Message sent successfully! We will get back to you soon.' });
  });

  // SPA fallback
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  app.listen(PORT, () => {
    console.log(`
  ╔═══════════════════════════════════════════════╗
  ║                                               ║
  ║   🎮  Campus Clash Server Running!            ║
  ║   🌐  http://localhost:${PORT}                  ║
  ║   📦  NextByte Technologies                   ║
  ║                                               ║
  ╚═══════════════════════════════════════════════╝
    `);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
