/* ═══════════════════════════════════════════
   CAMPUS CLASH - APPLICATION LOGIC
   by NextByte Technologies
   ═══════════════════════════════════════════ */

const API_URL = 'https://campusclash-phonepe-production.up.railway.app';
let currentUser = null;
let allTournaments = [];

// ─── INITIALIZATION ───

document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  loadTournaments();
  setupScrollEffects();
  setupClickOutside();
});

// ─── AUTH ───

function getToken() {
  return localStorage.getItem('cc_token');
}

function setToken(token) {
  localStorage.setItem('cc_token', token);
}

function removeToken() {
  localStorage.removeItem('cc_token');
}

async function checkAuth() {
  const token = getToken();
  if (!token) {
    updateUIForGuest();
    return;
  }

  try {
    const res = await fetch(`${API_URL}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Invalid token');
    currentUser = await res.json();
    updateUIForUser();
  } catch (err) {
    removeToken();
    currentUser = null;
    updateUIForGuest();
  }
}

function updateUIForUser() {
  document.getElementById('authButtons').style.display = 'none';
  document.getElementById('userMenu').style.display = 'block';
  document.getElementById('userInitial').textContent = currentUser.name.charAt(0).toUpperCase();
  document.getElementById('dropdownName').textContent = currentUser.name;
  document.getElementById('dropdownEmail').textContent = currentUser.email;
  document.getElementById('myTournamentsLink').style.display = 'inline-block';

  if (currentUser.isAdmin) {
    document.getElementById('adminLink').style.display = 'inline-block';
  }
}

function updateUIForGuest() {
  document.getElementById('authButtons').style.display = 'flex';
  document.getElementById('userMenu').style.display = 'none';
  document.getElementById('myTournamentsLink').style.display = 'none';
  document.getElementById('adminLink').style.display = 'none';
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errorEl = document.getElementById('loginError');
  const btn = document.getElementById('loginBtn');

  errorEl.textContent = '';
  btn.disabled = true;
  btn.innerHTML = '<span>Logging in...</span>';

  try {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    setToken(data.token);
    currentUser = data.user;
    updateUIForUser();
    showToast('Welcome back, ' + data.user.name + '! 🎮', 'success');
    navigateTo('home');
    document.getElementById('loginForm').reset();
  } catch (err) {
    errorEl.textContent = err.message;
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span>Log In</span>';
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  const errorEl = document.getElementById('registerError');
  const btn = document.getElementById('registerBtn');

  errorEl.textContent = '';
  btn.disabled = true;
  btn.innerHTML = '<span>Creating account...</span>';

  try {
    const res = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    setToken(data.token);
    currentUser = data.user;
    updateUIForUser();
    showToast('Account created! Welcome to Campus Clash! 🚀', 'success');
    navigateTo('home');
    document.getElementById('registerForm').reset();
  } catch (err) {
    errorEl.textContent = err.message;
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span>Create Account</span>';
  }
}

function logout() {
  removeToken();
  currentUser = null;
  updateUIForGuest();
  closeUserDropdown();
  navigateTo('home');
  showToast('Logged out successfully', 'info');
}

// ─── NAVIGATION ───

function navigateTo(page, data) {
  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  // Show target page
  const target = document.getElementById(`page-${page}`);
  if (target) {
    target.classList.add('active');
    // Re-trigger animation
    target.style.animation = 'none';
    target.offsetHeight; // reflow
    target.style.animation = '';
  }

  // Update nav links
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.dataset.page === page);
  });

  // Close mobile menu
  document.getElementById('navLinks').classList.remove('show');
  document.getElementById('mobileMenuBtn').classList.remove('active');

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Page-specific logic
  if (page === 'tournament' && data) {
    loadTournamentDetail(data);
  } else if (page === 'payment' && data) {
    showPaymentPage(data);
  } else if (page === 'my-tournaments') {
    if (!currentUser) {
      navigateTo('login');
      showToast('Please log in to view your tournaments', 'info');
      return;
    }
    loadMyTournaments();
  } else if (page === 'admin') {
    if (!currentUser || !currentUser.isAdmin) {
      navigateTo('home');
      showToast('Access denied', 'error');
      return;
    }
    loadAdminDashboard();
  }
}

// ─── TOURNAMENTS ───

async function loadTournaments() {
  try {
    const res = await fetch(`${API_URL}/api/tournaments`);
    allTournaments = await res.json();
    renderTournaments();
  } catch (err) {
    console.error('Failed to load tournaments:', err);
  }
}

function renderTournaments() {
  const upcoming = allTournaments.filter(t => t.status === 'upcoming');
  const past = allTournaments.filter(t => t.status === 'past');

  // Update hero stats
  document.getElementById('statTournaments').textContent = allTournaments.length;
  const totalPlayers = allTournaments.reduce((sum, t) => sum + (t.registered_count || 0), 0);
  document.getElementById('statPlayers').textContent = totalPlayers;

  // Render upcoming
  const upcomingGrid = document.getElementById('upcomingGrid');
  if (upcoming.length === 0) {
    upcomingGrid.innerHTML = '<div class="empty-state"><span class="empty-icon">🕐</span><p>No upcoming tournaments at the moment. Check back soon!</p></div>';
  } else {
    upcomingGrid.innerHTML = upcoming.map(t => createTournamentCard(t)).join('');
  }

  // Render past
  const pastGrid = document.getElementById('pastGrid');
  const pastEmpty = document.getElementById('pastEmpty');
  if (past.length === 0) {
    pastGrid.innerHTML = '';
    pastEmpty.style.display = 'block';
  } else {
    pastEmpty.style.display = 'none';
    pastGrid.innerHTML = past.map(t => createTournamentCard(t)).join('');
  }
}

function getGameEmoji(game) {
  const g = game.toLowerCase();
  if (g.includes('valorant')) return '🎯';
  if (g.includes('bgmi') || g.includes('pubg')) return '🔫';
  if (g.includes('fifa') || g.includes('football')) return '⚽';
  if (g.includes('chess')) return '♟️';
  if (g.includes('cod') || g.includes('call of duty')) return '💀';
  if (g.includes('cricket')) return '🏏';
  return '🎮';
}

function getGameGradient(game) {
  const g = game.toLowerCase();
  if (g.includes('valorant')) return 'linear-gradient(135deg, #ef4444, #dc2626, #991b1b)';
  if (g.includes('bgmi') || g.includes('pubg')) return 'linear-gradient(135deg, #f59e0b, #d97706, #92400e)';
  if (g.includes('fifa') || g.includes('football')) return 'linear-gradient(135deg, #10b981, #059669, #065f46)';
  if (g.includes('chess')) return 'linear-gradient(135deg, #7c3aed, #6d28d9, #4c1d95)';
  return 'linear-gradient(135deg, #06b6d4, #0891b2, #155e75)';
}

function formatDate(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(timeStr) {
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${m} ${ampm}`;
}

function createTournamentCard(t) {
  const emoji = getGameEmoji(t.game);
  const gradient = getGameGradient(t.game);
  const statusClass = t.status === 'upcoming' ? 'status-upcoming' : 'status-past';
  const priceDisplay = t.fees > 0 ? `₹${t.fees}` : 'FREE';
  const priceClass = t.fees > 0 ? '' : ' free';

  return `
    <div class="tournament-card" onclick="navigateTo('tournament', ${t.id})">
      <div class="tournament-card-banner">
        <div class="card-gradient" style="background: ${gradient};">
          <span class="card-game-icon">${emoji}</span>
        </div>
        <span class="card-status ${statusClass}">${t.status}</span>
      </div>
      <div class="tournament-card-body">
        <h3>${escapeHtml(t.name)}</h3>
        <p>${escapeHtml(t.description)}</p>
        <div class="card-meta">
          <span class="card-meta-item"><span>🎮</span> ${escapeHtml(t.game)}</span>
          <span class="card-meta-item"><span>📅</span> ${formatDate(t.date)}</span>
          <span class="card-meta-item"><span>📍</span> ${escapeHtml(t.venue)}</span>
          <span class="card-meta-item"><span>👥</span> ${t.registered_count || 0}/${t.max_participants}</span>
        </div>
        <div class="card-footer">
          <span class="card-price${priceClass}">${priceDisplay}</span>
          <span class="btn btn-primary btn-sm">${t.status === 'upcoming' ? 'View Details →' : 'View Results →'}</span>
        </div>
      </div>
    </div>
  `;
}

// ─── TOURNAMENT DETAIL ───

async function loadTournamentDetail(id) {
  const container = document.getElementById('tournamentDetail');
  container.innerHTML = '<div class="loading-skeleton"><div class="skeleton-card" style="height:500px;max-width:900px;"></div></div>';

  try {
    const res = await fetch(`${API_URL}/api/tournaments/${id}`);
    if (!res.ok) throw new Error('Tournament not found');
    const t = await res.json();

    let isRegistered = false;
    if (currentUser) {
      const regRes = await fetch(`${API_URL}/api/tournaments/${id}/check-registration`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      const regData = await regRes.json();
      isRegistered = regData.registered;
    }

    const emoji = getGameEmoji(t.game);
    const gradient = getGameGradient(t.game);
    const statusClass = t.status === 'upcoming' ? 'status-upcoming' : 'status-past';
    const priceDisplay = t.fees > 0 ? `₹${t.fees}` : 'FREE';
    const spotsLeft = t.max_participants - (t.registered_count || 0);

    let registerBtn = '';
    if (t.status === 'upcoming') {
      if (!currentUser) {
        registerBtn = `<button class="btn btn-primary btn-lg" onclick="navigateTo('login'); showToast('Please log in to register', 'info');">Log In to Register</button>`;
      } else if (isRegistered) {
        registerBtn = `<button class="btn btn-success btn-lg" disabled>✅ Already Registered</button>`;
      } else if (spotsLeft <= 0) {
        registerBtn = `<button class="btn btn-danger btn-lg" disabled>Tournament Full</button>`;
      } else {
        registerBtn = `<button class="btn btn-primary btn-lg" onclick="navigateTo('payment', ${t.id})">Register Now — ${priceDisplay}</button>`;
      }
    } else {
      registerBtn = `<button class="btn btn-outline btn-lg" disabled>Tournament Ended</button>`;
    }

    container.innerHTML = `
      <button class="detail-back" onclick="navigateTo('home')">← Back to Tournaments</button>
      <div class="detail-banner" style="background: ${gradient};">
        <span style="font-size:5rem; filter:drop-shadow(0 0 30px rgba(0,0,0,0.5));">${emoji}</span>
        <span class="card-status ${statusClass}">${t.status}</span>
      </div>
      <div class="detail-header">
        <h1>${escapeHtml(t.name)}</h1>
        <span class="detail-game-badge">🎮 ${escapeHtml(t.game)}</span>
      </div>
      <div class="detail-info-grid">
        <div class="detail-info-card">
          <span class="detail-info-icon">📅</span>
          <div>
            <span class="detail-info-label">Date</span>
            <span class="detail-info-value">${formatDate(t.date)}</span>
          </div>
        </div>
        <div class="detail-info-card">
          <span class="detail-info-icon">🕐</span>
          <div>
            <span class="detail-info-label">Time</span>
            <span class="detail-info-value">${formatTime(t.time)}</span>
          </div>
        </div>
        <div class="detail-info-card">
          <span class="detail-info-icon">📍</span>
          <div>
            <span class="detail-info-label">Venue</span>
            <span class="detail-info-value">${escapeHtml(t.venue)}</span>
          </div>
        </div>
        <div class="detail-info-card">
          <span class="detail-info-icon">👥</span>
          <div>
            <span class="detail-info-label">Spots</span>
            <span class="detail-info-value">${t.registered_count || 0} / ${t.max_participants}</span>
          </div>
        </div>
      </div>
      <div class="detail-description">
        <h3>About this Tournament</h3>
        <p>${escapeHtml(t.description)}</p>
      </div>
      <div class="detail-register-section">
        <div>
          <span class="detail-register-price ${t.fees === 0 ? 'free' : ''}">${priceDisplay}</span>
          <small>${t.status === 'upcoming' ? spotsLeft + ' spots remaining' : 'Tournament completed'}</small>
        </div>
        ${registerBtn}
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><span class="empty-icon">😕</span><p>Tournament not found.</p><button class="btn btn-primary" onclick="navigateTo('home')">Go Home</button></div>`;
  }
}

// ─── PAYMENT ───

function showPaymentPage(tournamentId) {
  if (!currentUser) {
    navigateTo('login');
    showToast('Please log in to register', 'info');
    return;
  }

  const t = allTournaments.find(t => t.id === tournamentId);
  if (!t) {
    navigateTo('home');
    return;
  }

  const container = document.getElementById('paymentContainer');
  container.innerHTML = `
    <button class="detail-back" onclick="navigateTo('tournament', ${t.id})">← Back to Tournament</button>
    <div class="payment-card">
      <h2>Complete Registration</h2>
      <p class="payment-subtitle">${escapeHtml(t.name)}</p>

      <div class="payment-summary">
        <div class="payment-summary-row">
          <span class="label">Tournament</span>
          <span>${escapeHtml(t.name)}</span>
        </div>
        <div class="payment-summary-row">
          <span class="label">Game</span>
          <span>${escapeHtml(t.game)}</span>
        </div>
        <div class="payment-summary-row">
          <span class="label">Date</span>
          <span>${formatDate(t.date)}</span>
        </div>
        <div class="payment-summary-row">
          <span class="label">Entry Fee</span>
          <span>₹${t.fees}</span>
        </div>
        <div class="payment-summary-row">
          <span class="label">Platform Fee</span>
          <span>₹0</span>
        </div>
        <div class="payment-summary-row total">
          <span>Total</span>
          <span>₹${t.fees}</span>
        </div>
      </div>

      <div id="paymentActions">
        <button class="phonepe-btn" id="phonepePayBtn" onclick="processPayment(${t.id})">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
          Pay ₹${t.fees} with PhonePe
        </button>
        <p class="payment-secure-note">🔒 Secured by NextByte Technologies • Dummy Payment Gateway</p>
      </div>

      <div class="payment-processing" id="paymentProcessing">
        <div class="payment-spinner"></div>
        <p>Processing payment via PhonePe...</p>
        <p style="font-size:0.8rem; color:var(--text-muted);">Please do not close this page</p>
      </div>

      <div class="payment-success" id="paymentSuccess">
        <span class="payment-success-icon">✅</span>
        <h3>Payment Successful!</h3>
        <p style="color:var(--text-secondary);">You're registered for ${escapeHtml(t.name)}</p>
        <p class="payment-txn" id="paymentTxnId"></p>
        <button class="btn btn-primary" onclick="navigateTo('my-tournaments')" style="margin-top:0.5rem;">View My Tournaments</button>
      </div>
    </div>
  `;
}

async function processPayment(tournamentId) {
  const btn = document.getElementById('phonepePayBtn');
  const actions = document.getElementById('paymentActions');
  const processing = document.getElementById('paymentProcessing');
  const success = document.getElementById('paymentSuccess');

  btn.disabled = true;
  btn.textContent = 'Initiating payment...';

  // Simulate PhonePe redirect
  setTimeout(() => {
    actions.style.display = 'none';
    processing.classList.add('show');

    // Simulate payment processing
    setTimeout(async () => {
      try {
        const res = await fetch(`${API_URL}/api/tournaments/${tournamentId}/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getToken()}`
          }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        processing.classList.remove('show');
        success.classList.add('show');
        document.getElementById('paymentTxnId').textContent = 'Transaction ID: ' + data.transaction_id;
        showToast('Registration successful! 🎉', 'success');

        // Reload tournaments to update counts
        loadTournaments();
      } catch (err) {
        processing.classList.remove('show');
        actions.style.display = 'block';
        btn.disabled = false;
        btn.textContent = 'Retry Payment';
        showToast(err.message, 'error');
      }
    }, 2500);
  }, 800);
}

// ─── MY TOURNAMENTS ───

async function loadMyTournaments() {
  const list = document.getElementById('myTournamentsList');
  const empty = document.getElementById('myTournamentsEmpty');
  list.innerHTML = '<div class="loading-skeleton"><div class="skeleton-card" style="height:80px;"></div></div>';
  empty.style.display = 'none';

  try {
    const res = await fetch(`${API_URL}/api/my-tournaments`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    const registrations = await res.json();

    if (registrations.length === 0) {
      list.innerHTML = '';
      empty.style.display = 'block';
      return;
    }

    list.innerHTML = registrations.map(r => {
      const emoji = getGameEmoji(r.game);
      const gradient = getGameGradient(r.game);
      const statusClass = r.tournament_status === 'upcoming' ? 'status-upcoming' : 'status-past';

      return `
        <div class="my-tournament-item" onclick="navigateTo('tournament', ${r.tournament_id})">
          <div class="my-tournament-icon" style="background: ${gradient};">
            ${emoji}
          </div>
          <div class="my-tournament-info">
            <h4>${escapeHtml(r.tournament_name)}</h4>
            <p>🎮 ${escapeHtml(r.game)} • 📅 ${formatDate(r.date)} • 📍 ${escapeHtml(r.venue)}</p>
          </div>
          <div class="my-tournament-meta">
            <span class="status-badge ${statusClass}">${r.tournament_status}</span>
            <div class="price">₹${r.fees}</div>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    list.innerHTML = '<div class="empty-state"><p>Failed to load tournaments.</p></div>';
  }
}

// ─── ADMIN ───

async function loadAdminDashboard() {
  try {
    // Load stats
    const statsRes = await fetch(`${API_URL}/api/admin/stats`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    const stats = await statsRes.json();

    document.getElementById('adminTotalUsers').textContent = stats.totalUsers;
    document.getElementById('adminTotalTournaments').textContent = stats.totalTournaments;
    document.getElementById('adminTotalRegistrations').textContent = stats.totalRegistrations;
    document.getElementById('adminTotalRevenue').textContent = '₹' + stats.totalRevenue;

    // Recent registrations table
    const regContainer = document.getElementById('recentRegistrations');
    if (stats.recentRegistrations.length === 0) {
      regContainer.innerHTML = '<p style="color:var(--text-muted); padding:1rem;">No registrations yet.</p>';
    } else {
      regContainer.innerHTML = `
        <table class="admin-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Email</th>
              <th>Tournament</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            ${stats.recentRegistrations.map(r => `
              <tr>
                <td>${escapeHtml(r.user_name)}</td>
                <td>${escapeHtml(r.user_email)}</td>
                <td>${escapeHtml(r.tournament_name)}</td>
                <td>${new Date(r.registered_at).toLocaleDateString('en-IN')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    // Tournaments list
    const tournamentsList = document.getElementById('adminTournamentsList');
    const tournamentsRes = await fetch(`${API_URL}/api/tournaments`);
    const tournaments = await tournamentsRes.json();

    if (tournaments.length === 0) {
      tournamentsList.innerHTML = '<p style="color:var(--text-muted);">No tournaments created yet.</p>';
    } else {
      tournamentsList.innerHTML = tournaments.map(t => `
        <div class="admin-tournament-item">
          <div class="admin-tournament-info">
            <h4>${getGameEmoji(t.game)} ${escapeHtml(t.name)}</h4>
            <p>${escapeHtml(t.game)} • ${formatDate(t.date)} • ${t.registered_count || 0}/${t.max_participants} registered • ₹${t.fees} fee</p>
          </div>
          <div class="admin-tournament-actions">
            <span class="card-status ${t.status === 'upcoming' ? 'status-upcoming' : 'status-past'}" style="margin-right:0.5rem;">${t.status}</span>
            <button class="btn btn-sm btn-outline" onclick="viewTournamentRegistrations(${t.id}, '${escapeHtml(t.name)}')">👥 Registrations</button>
            <button class="btn btn-sm btn-danger" onclick="deleteTournament(${t.id}, '${escapeHtml(t.name)}')">🗑️ Delete</button>
          </div>
        </div>
      `).join('');
    }
  } catch (err) {
    console.error('Failed to load admin dashboard:', err);
    showToast('Failed to load dashboard', 'error');
  }
}

async function handleCreateTournament(e) {
  e.preventDefault();
  const errorEl = document.getElementById('createTournamentError');
  errorEl.textContent = '';

  const data = {
    name: document.getElementById('tName').value.trim(),
    game: document.getElementById('tGame').value.trim(),
    description: document.getElementById('tDesc').value.trim(),
    venue: document.getElementById('tVenue').value.trim(),
    fees: parseFloat(document.getElementById('tFees').value) || 0,
    date: document.getElementById('tDate').value,
    time: document.getElementById('tTime').value,
    max_participants: parseInt(document.getElementById('tMax').value) || 100
  };

  try {
    const res = await fetch(`${API_URL}/api/tournaments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error);

    showToast('Tournament created successfully! 🏆', 'success');
    document.getElementById('createTournamentForm').reset();
    loadTournaments();
    loadAdminDashboard();
  } catch (err) {
    errorEl.textContent = err.message;
  }
}

async function deleteTournament(id, name) {
  if (!confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) return;

  try {
    const res = await fetch(`${API_URL}/api/tournaments/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    if (!res.ok) throw new Error('Failed to delete');

    showToast('Tournament deleted', 'info');
    loadTournaments();
    loadAdminDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function viewTournamentRegistrations(tournamentId, name) {
  try {
    const res = await fetch(`${API_URL}/api/admin/registrations/${tournamentId}`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    const registrations = await res.json();

    let content = `<h3 style="font-family:var(--font-heading); margin-bottom:1rem;">Registrations — ${name}</h3>`;

    if (registrations.length === 0) {
      content += '<p style="color:var(--text-muted);">No registrations yet.</p>';
    } else {
      content += `<table class="admin-table">
        <thead><tr><th>Name</th><th>Email</th><th>Transaction ID</th><th>Date</th></tr></thead>
        <tbody>
          ${registrations.map(r => `
            <tr>
              <td>${escapeHtml(r.user_name)}</td>
              <td>${escapeHtml(r.user_email)}</td>
              <td style="font-size:0.75rem;">${r.transaction_id || '-'}</td>
              <td>${new Date(r.registered_at).toLocaleDateString('en-IN')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;
    }

    document.getElementById('modalContent').innerHTML = content;
    document.getElementById('modalOverlay').classList.add('show');
  } catch (err) {
    showToast('Failed to load registrations', 'error');
  }
}

// ─── CONTACT ───

async function handleContact(e) {
  e.preventDefault();
  const errorEl = document.getElementById('contactError');
  const successEl = document.getElementById('contactSuccess');
  errorEl.textContent = '';
  successEl.style.display = 'none';

  const data = {
    name: document.getElementById('contactName').value.trim(),
    email: document.getElementById('contactEmail').value.trim(),
    subject: document.getElementById('contactSubject').value.trim(),
    message: document.getElementById('contactMessage').value.trim()
  };

  try {
    const res = await fetch(`${API_URL}/api/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error);

    successEl.textContent = result.message;
    successEl.style.display = 'block';
    document.getElementById('contactForm').reset();
    showToast('Message sent! 📨', 'success');
  } catch (err) {
    errorEl.textContent = err.message;
  }
}

// ─── UI HELPERS ───

function toggleFaq(el) {
  el.classList.toggle('open');
}

function toggleMobileMenu() {
  document.getElementById('navLinks').classList.toggle('show');
  document.getElementById('mobileMenuBtn').classList.toggle('active');
}

function toggleUserDropdown() {
  document.getElementById('userDropdown').classList.toggle('show');
}

function closeUserDropdown() {
  document.getElementById('userDropdown').classList.remove('show');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('show');
}

function setupScrollEffects() {
  window.addEventListener('scroll', () => {
    const navbar = document.getElementById('navbar');
    navbar.classList.toggle('scrolled', window.scrollY > 20);
  });
}

function setupClickOutside() {
  document.addEventListener('click', (e) => {
    const userMenu = document.getElementById('userMenu');
    const dropdown = document.getElementById('userDropdown');
    if (dropdown && !userMenu.contains(e.target)) {
      dropdown.classList.remove('show');
    }
  });
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
  toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(30px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
