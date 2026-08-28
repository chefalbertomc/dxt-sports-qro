// Element references
const loginSection = document.getElementById('loginSection');
const adminSection = document.getElementById('adminSection');
const loginError = document.getElementById('loginError');
const uploadStatus = document.getElementById('uploadStatus');
const imagePreview = document.getElementById('imagePreview');
const btnLogout = document.getElementById('btnLogout');

let currentSizeStockRows = []; // Array of { size: "M", immediateQty: 2, warehouseQty: 5 }
let selectedFile = null;
let currentProducts = [];
let bulkItems = [];

// Admin Catalog 5-Step Sequence Filter State
let adminFilterSportKey = null;
let adminFilterLeagueName = null;
let adminFilterTeamId = null;
let adminFilterCategoryId = null;
let adminFilterGenderId = null;

// ============================================
// ADMIN WHITELIST & GOOGLE AUTHENTICATION GATE
// ============================================
const ADMIN_EMAIL_WHITELIST = [
  'chefalbertomc@gmail.com',
  'dxtsportsqro@gmail.com',
  'elenma08@gmail.com',
  'ventasdxtsports@gmail.com'
];

async function isAuthorizedAdminEmail(email) {
  if (!email) return false;
  const cleanEmail = email.toLowerCase().trim();
  if (ADMIN_EMAIL_WHITELIST.includes(cleanEmail)) return true;
  
  // Also check Firestore admins collection if available
  if (window.db) {
    try {
      const doc = await db.collection('admins').doc(cleanEmail).get();
      if (doc.exists && doc.data().active !== false) return true;
    } catch(e) {
      console.warn('Admin check error:', e);
    }
  }
  return false;
}

// Handle Auth State
auth.onAuthStateChanged(async (user) => {
  if (user) {
    const isAllowed = await isAuthorizedAdminEmail(user.email);
    if (!isAllowed) {
      if (loginError) {
        loginError.innerHTML = `🚫 <strong>Acceso Denegado:</strong> La cuenta <code>${user.email}</code> no está en la lista de administradores autorizados.`;
        loginError.style.display = 'block';
      }
      auth.signOut();
      return;
    }

    if (loginError) loginError.style.display = 'none';
    loginSection.style.display = 'none';
    adminSection.style.display = 'block';
    document.getElementById('manageSection').style.display = 'block';
    if (btnLogout) {
      btnLogout.innerHTML = `👤 ${user.displayName || user.email.split('@')[0]} (Salir)`;
      btnLogout.style.display = 'inline-block';
    }
    
    initAdminForm();
    loadAdminProducts();
    if (typeof initFCM === 'function') initFCM(true);
    if (typeof startAdminNotificationWatcher === 'function') startAdminNotificationWatcher();
  } else {
    loginSection.style.display = 'block';
    adminSection.style.display = 'none';
    document.getElementById('manageSection').style.display = 'none';
    if (btnLogout) btnLogout.style.display = 'none';
  }
});

// Google 1-Click Sign-In
window.signInWithGoogleAdmin = async function() {
  const btn = document.getElementById('btnGoogleLogin');
  if (loginError) loginError.style.display = 'none';
  
  try {
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner" style="width:16px; height:16px; border-width:2px; display:inline-block; vertical-align:middle; margin-right:8px;"></span> Conectando con Google...`;
    }
    
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await auth.signInWithPopup(provider);
    const user = result.user;
    
    const isAllowed = await isAuthorizedAdminEmail(user.email);
    if (!isAllowed) {
      if (loginError) {
        loginError.innerHTML = `🚫 <strong>Acceso Denegado:</strong> La cuenta <code>${user.email}</code> no está en la lista de administradores autorizados.`;
        loginError.style.display = 'block';
      }
      await auth.signOut();
    }
  } catch(error) {
    console.error('Google Auth Error:', error);
    if (loginError) {
      loginError.textContent = 'Error al conectar con Google: ' + (error.message || error);
      loginError.style.display = 'block';
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" style="width: 20px; height: 20px;"> Entrar con Google (1-Click)`;
    }
  }
};

// ============================================
// CREDENCIALES LOCALES — ACCESO SIN FIREBASE
// ============================================
const LOCAL_ADMIN_CREDENTIALS = {
  'chefalbertomc@gmail.com':   'Dxt2024Admin!',
  'dxtsportsqro@gmail.com':    'Dxt2024Admin!',
  'elenma08@gmail.com':        'Dxt2024Admin!',
  'ventasdxtsports@gmail.com': 'Dxt2024Admin!'
};

// Login with Email / Password
document.getElementById('btnLogin')?.addEventListener('click', async () => {
  const email = document.getElementById('adminEmail').value.trim().toLowerCase();
  const pw = document.getElementById('adminPassword').value;
  const btnLogin = document.getElementById('btnLogin');

  if (!email || !pw) {
    loginError.textContent = 'Completa correo y contraseña';
    loginError.style.display = 'block';
    return;
  }

  // 1️⃣ Verificar credenciales locales primero (funciona sin internet / Firebase OAuth)
  if (LOCAL_ADMIN_CREDENTIALS[email] && LOCAL_ADMIN_CREDENTIALS[email] === pw) {
    if (loginError) loginError.style.display = 'none';
    quickAdminAccess(email);
    return;
  }

  // 2️⃣ Intentar con Firebase Auth (si el dominio está autorizado)
  try {
    if (btnLogin) btnLogin.textContent = 'Entrando...';
    await auth.signInWithEmailAndPassword(email, pw);
  } catch (error) {
    console.warn('Firebase auth error:', error.code);
    // Si el error es dominio no autorizado o red, mostrar mensaje claro
    if (error.code === 'auth/unauthorized-domain' || error.code === 'auth/network-request-failed') {
      loginError.innerHTML = `🚫 <strong>Credenciales incorrectas.</strong> Verifica tu correo y contraseña.`;
      loginError.style.display = 'block';
    } else {
      loginError.innerHTML = `🚫 ${error.message || 'Error al iniciar sesión'}`;
      loginError.style.display = 'block';
    }
    if (btnLogin) btnLogin.textContent = 'ENTRAR';
  }
});

// Quick 1-Click Master Admin Access
window.quickAdminAccess = function(email) {
  const loginSec = document.getElementById('loginSection');
  const adminSec = document.getElementById('adminSection');
  const manageSec = document.getElementById('manageSection');
  const btnLogoutEl = document.getElementById('btnLogout');

  if (loginSec) loginSec.style.display = 'none';
  if (adminSec) adminSec.style.display = 'block';
  if (manageSec) manageSec.style.display = 'block';
  if (btnLogoutEl) {
    const label = email ? email.split('@')[0] : 'Admin';
    btnLogoutEl.textContent = `👤 ${label} (Salir)`;
    btnLogoutEl.style.display = 'inline-block';
  }

  if (typeof initAdminForm === 'function') initAdminForm();
  if (typeof loadAdminProducts === 'function') loadAdminProducts();
  if (typeof initFCM === 'function') initFCM(true);
  if (typeof startAdminNotificationWatcher === 'function') startAdminNotificationWatcher();
};

// Logout
if (btnLogout) {
  btnLogout.addEventListener('click', () => {
    auth.signOut();
  });
}

// Switch Tabs with History PushState & History Shield
window.switchAdminTab = function(tabName, skipPushHistory = false) {
  const manageCard = document.getElementById('manageSection');
  const singleCard = document.getElementById('singleUploadCard');
  const bulkCard = document.getElementById('bulkUploadCard');
  const ordersCard = document.getElementById('ordersSection');
  const reportesCard = document.getElementById('reportesSection');

  const manageBtn = document.getElementById('tabManageBtn');
  const ordersBtn = document.getElementById('tabOrdersBtn');
  const reportesBtn = document.getElementById('tabReportesBtn');

  if (!skipPushHistory && history.pushState) {
    history.pushState({ adminTab: tabName, adminLock: true }, '', `#tab-${tabName}`);
  }

  // Hide all sections first
  [manageCard, singleCard, bulkCard, ordersCard, reportesCard].forEach(el => { if (el) el.style.display = 'none'; });

  // Deactivate all tab buttons
  [manageBtn, ordersBtn, reportesBtn].forEach(btn => {
    if (btn) btn.className = btn.style.borderColor ? 'btn btn-outline' : 'btn btn-outline';
  });
  if (manageBtn) manageBtn.className = 'btn btn-outline';
  if (ordersBtn) ordersBtn.className = 'btn btn-outline';
  if (reportesBtn) { reportesBtn.className = 'btn btn-outline'; reportesBtn.style.borderColor = '#a855f7'; reportesBtn.style.color = '#a855f7'; }

  if (tabName === 'manage') {
    if (manageCard) manageCard.style.display = 'block';
    if (manageBtn) manageBtn.className = 'btn active';
  } else if (tabName === 'single') {
    if (singleCard) singleCard.style.display = 'block';
    if (manageBtn) manageBtn.className = 'btn active'; // Publicar stays under Catalog
  } else if (tabName === 'bulk') {
    if (bulkCard) bulkCard.style.display = 'block';
    if (manageBtn) manageBtn.className = 'btn active'; // Bulk stays under Catalog
  } else if (tabName === 'orders') {
    if (ordersCard) ordersCard.style.display = 'block';
    if (ordersBtn) ordersBtn.className = 'btn active';
    if (typeof loadAdminOrders === 'function') loadAdminOrders();
  } else if (tabName === 'reportes') {
    if (reportesCard) reportesCard.style.display = 'block';
    if (reportesBtn) { reportesBtn.className = 'btn active'; reportesBtn.style.borderColor = ''; reportesBtn.style.color = ''; }
    loadReportesData();
  }
};

// Open Publish form as a sub-view inside Catalog tab
window.openPublishModal = function() {
  switchAdminTab('single');
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

// Intercept Physical Phone / Browser Back Button to stay inside Admin
window.addEventListener('popstate', (e) => {
  if (window.history && window.history.pushState) {
    window.history.pushState({ adminLock: true }, null, window.location.href);
  }
  if (e.state && e.state.adminTab) {
    switchAdminTab(e.state.adminTab, true);
  } else {
    switchAdminTab('manage', true);
  }
});

// Populate Admin Cascading Select Inputs (Deporte > Liga > Equipo > Temporada)
function initAdminForm() {
  populateAdminSports();
  populateCategoriesSelect();
  populateSeasonsSelect();
  populateAllTeamsDatalist();
  populateBadgesSelect();
  onGenderSelectChange();
  if (window.syncCloudCustomTaxonomies) {
    window.syncCloudCustomTaxonomies();
  }
  if (typeof loadAdminOrders === 'function') {
    loadAdminOrders();
  }
}

function populateSeasonsSelect() {
  const seasonSelect = document.getElementById('prodSeason');
  if (!seasonSelect) return;
  const seasons = window.SEASONS_CATALOG || [
    { id: "2026-2027", label: "2026-2027" },
    { id: "2025-2026", label: "2025-2026", isCurrent: true },
    { id: "2024-2025", label: "2024-2025" },
    { id: "2023-2024", label: "2023-2024" },
    { id: "2022-2023", label: "2022-2023" },
    { id: "2026", label: "2026" },
    { id: "2025", label: "2025" },
    { id: "2024", label: "2024" },
    { id: "2023", label: "2023" },
    { id: "2022", label: "2022" },
    { id: "2021", label: "2021" },
    { id: "retro", label: "Retro / Vintage" },
    { id: "atemporal", label: "General / Atemporal" }
  ];
  seasonSelect.innerHTML = seasons.map(sea => `<option value="${sea.id}" ${sea.isCurrent ? 'selected' : ''}>${sea.label}</option>`).join('');
}

function populateAllTeamsDatalist() {
  const datalist = document.getElementById('allTeamsDatalist');
  if (!datalist) return;
  const catalog = window.SPORTS_CATALOG || SPORTS_CATALOG;
  const options = [];
  for (const s of catalog) {
    for (const l of s.leagues) {
      for (const t of l.teams) {
        options.push(`<option value="${t.name}">[${s.sport} · ${l.league}]</option>`);
      }
    }
  }
  datalist.innerHTML = options.join('');
}

window.onSearchableTeamInput = function(val) {
  const catalog = window.SPORTS_CATALOG || SPORTS_CATALOG;
  const query = (val || '').toLowerCase().trim();
  const prodTeamHidden = document.getElementById('prodTeam');
  if (!query) {
    if (prodTeamHidden) prodTeamHidden.value = '';
    return;
  }

  let matchedTeam = null;
  let matchedSport = null;
  let matchedLeague = null;

  for (const s of catalog) {
    for (const l of s.leagues) {
      for (const t of l.teams) {
        if (t.name.toLowerCase() === query || t.id.toLowerCase() === query) {
          matchedTeam = t;
          matchedSport = s;
          matchedLeague = l;
          break;
        }
      }
      if (matchedTeam) break;
    }
    if (matchedTeam) break;
  }

  if (matchedTeam) {
    if (prodTeamHidden) prodTeamHidden.value = matchedTeam.id;
    // ONLY set sport if current sport is empty
    const currentSport = document.getElementById('prodSport')?.value;
    if (!currentSport && document.getElementById('prodSport')) {
      document.getElementById('prodSport').value = matchedSport.sportKey;
      onAdminSportChange();
    }
    // ONLY set league if current league is empty
    const currentLeague = document.getElementById('prodLeague')?.value;
    if (!currentLeague && document.getElementById('prodLeague')) {
      document.getElementById('prodLeague').value = matchedLeague.league;
      onAdminLeagueChange();
    }
  } else {
    // Custom typed team
    const customId = query.replace(/[^a-z0-9]/g, '-');
    if (prodTeamHidden) prodTeamHidden.value = customId;
  }

  // Synchronize product title in real-time
  syncProductNameOnTaxonomyChange();
};

let lastAIDetectedResult = null;

// Real-Time Product Title Synchronization
window.syncProductNameOnTaxonomyChange = function() {
  const nameInput = document.getElementById('prodName');
  if (!nameInput) return;

  let currentTitle = nameInput.value.trim();
  const teamInputVal = document.getElementById('prodTeamInput')?.value.trim();
  const seasonSelect = document.getElementById('prodSeason');
  const selectedSeason = seasonSelect ? seasonSelect.value : '';
  const seasonLabel = seasonSelect ? (seasonSelect.options[seasonSelect.selectedIndex]?.text || selectedSeason) : selectedSeason;

  // If Title is empty or placeholder (e.g. "⚠️ Prenda Pendiente por Catalogar" or "Jersey Deportivo"), build clean title
  if (!currentTitle || currentTitle.includes('Pendiente') || currentTitle === 'Jersey Deportivo') {
    const catSelect = document.getElementById('prodCategory');
    let catText = 'Jersey';
    if (catSelect && catSelect.value === 'gorras') catText = 'Gorra';
    else if (catSelect && catSelect.value === 'chamarras') catText = 'Chamarra';
    else if (catSelect && catSelect.value === 'polos') catText = 'Playera Polo';
    else if (catSelect && catSelect.value === 'chalecos') catText = 'Chaleco';
    else if (catSelect && catSelect.value === 'tshirts') catText = 'Playera';

    const parts = [catText];
    if (teamInputVal) parts.push(teamInputVal);
    if (lastAIDetectedResult && lastAIDetectedResult.player && lastAIDetectedResult.player !== 'Edición Oficial') {
      parts.push(lastAIDetectedResult.player);
    }
    if (seasonLabel && seasonLabel !== 'atemporal') parts.push(seasonLabel);
    nameInput.value = parts.join(' ');
    return;
  }

  // If Title has a season / year, replace it dynamically with the new season
  if (seasonLabel && seasonLabel !== 'atemporal') {
    const yearPattern = /\b(20\d{2}[-\/–]20\d{2}|20\d{2})\b/g;
    if (yearPattern.test(currentTitle)) {
      nameInput.value = currentTitle.replace(yearPattern, seasonLabel);
    } else {
      nameInput.value = `${currentTitle} ${seasonLabel}`;
    }
  }
};

window.regenerateProductTitle = function() {
  const nameInput = document.getElementById('prodName');
  if (!nameInput) return;

  const teamInputVal = document.getElementById('prodTeamInput')?.value.trim() || 'Deportivo';
  const catSelect = document.getElementById('prodCategory');
  let catText = 'Jersey';
  if (catSelect && catSelect.value === 'gorras') catText = 'Gorra';
  else if (catSelect && catSelect.value === 'chamarras') catText = 'Chamarra';
  else if (catSelect && catSelect.value === 'polos') catText = 'Playera Polo';
  else if (catSelect && catSelect.value === 'chalecos') catText = 'Chaleco';
  else if (catSelect && catSelect.value === 'tshirts') catText = 'Playera';

  const seasonSelect = document.getElementById('prodSeason');
  const selectedSeason = seasonSelect ? seasonSelect.value : '';
  const seasonLabel = (selectedSeason && selectedSeason !== 'atemporal') ? selectedSeason : '';

  const parts = [catText, teamInputVal];
  if (lastAIDetectedResult && lastAIDetectedResult.player && lastAIDetectedResult.player !== 'Edición Oficial') {
    parts.push(lastAIDetectedResult.player);
  }
  if (seasonLabel) parts.push(seasonLabel);

  nameInput.value = parts.join(' ');
};

function populateAdminSports() {
  const sportSelect = document.getElementById('prodSport');
  if (!sportSelect) return;
  const catalog = window.SPORTS_CATALOG || SPORTS_CATALOG;
  
  sportSelect.innerHTML = '<option value="">Selecciona Deporte...</option>' + 
    catalog.map(s => `<option value="${s.sportKey}">${s.icon} ${s.sport}</option>`).join('');
}

window.onAdminSportChange = function() {
  const sportKey = document.getElementById('prodSport')?.value;
  const leagueGroup = document.getElementById('leagueGroup');
  const teamGroup = document.getElementById('teamGroup');
  const leagueSelect = document.getElementById('prodLeague');
  const teamSelect = document.getElementById('prodTeam');
  
  if (!sportKey) {
    if (leagueGroup) leagueGroup.style.display = 'none';
    if (teamGroup) teamGroup.style.display = 'none';
    if (leagueSelect) leagueSelect.innerHTML = '<option value="">Selecciona Liga...</option>';
    if (teamSelect) teamSelect.innerHTML = '<option value="">Selecciona Equipo...</option>';
    return;
  }

  const catalog = window.SPORTS_CATALOG || SPORTS_CATALOG;
  const sportObj = catalog.find(s => s.sportKey === sportKey);

  if (!sportObj) return;

  if (leagueGroup) leagueGroup.style.display = 'block';
  if (leagueSelect) {
    leagueSelect.innerHTML = '<option value="">Selecciona Liga...</option>' + 
      sportObj.leagues.map(l => `<option value="${l.league}">${l.league}</option>`).join('');
  }

  if (teamGroup) teamGroup.style.display = 'none';
  if (teamSelect) teamSelect.innerHTML = '<option value="">Selecciona Equipo...</option>';

  if (sportObj.leagues.length === 1) {
    leagueSelect.value = sportObj.leagues[0].league;
    onAdminLeagueChange();
  }
};

window.onAdminLeagueChange = function() {
  const sportKey = document.getElementById('prodSport')?.value;
  const leagueName = document.getElementById('prodLeague')?.value;
  const teamGroup = document.getElementById('teamGroup');
  const teamSelect = document.getElementById('prodTeam');

  if (!sportKey || !leagueName) {
    if (teamGroup) teamGroup.style.display = 'none';
    if (teamSelect) teamSelect.innerHTML = '<option value="">Selecciona Equipo...</option>';
    return;
  }

  const catalog = window.SPORTS_CATALOG || SPORTS_CATALOG;
  const sportObj = catalog.find(s => s.sportKey === sportKey);
  const leagueObj = sportObj ? sportObj.leagues.find(l => l.league === leagueName) : null;

  if (!leagueObj) return;

  if (teamGroup) teamGroup.style.display = 'block';
  if (teamSelect) {
    teamSelect.innerHTML = '<option value="">Selecciona Equipo...</option>' + 
      leagueObj.teams.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
  }
};

// Modals: Create New Sport / League / Team
window.openNewSportModal = () => document.getElementById('newSportModal').classList.add('active');
window.closeNewSportModal = () => document.getElementById('newSportModal').classList.remove('active');

window.saveNewSport = function(e) {
  e.preventDefault();
  const name = document.getElementById('newSportName').value.trim();
  const icon = document.getElementById('newSportIcon').value.trim() || '🏆';
  if (!name) return;

  const key = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const catalog = window.SPORTS_CATALOG || SPORTS_CATALOG;
  
  if (!catalog.some(s => s.sportKey === key)) {
    catalog.push({
      sport: name,
      sportKey: key,
      icon: icon,
      leagueLogo: "assets/dxt_logo.png",
      leagues: []
    });
  }

  populateAdminSports();
  document.getElementById('prodSport').value = key;
  onAdminSportChange();
  closeNewSportModal();
  document.getElementById('newSportForm').reset();
  alert(`✅ Deporte "${name}" creado exitosamente.`);
};

window.openNewLeagueModal = () => {
  const sportKey = document.getElementById('prodSport')?.value;
  if (!sportKey) {
    alert("Por favor selecciona primero un Deporte.");
    return;
  }
  document.getElementById('newLeagueModal').classList.add('active');
};
window.closeNewLeagueModal = () => document.getElementById('newLeagueModal').classList.remove('active');

window.saveNewLeague = async function(e) {
  e.preventDefault();
  const sportKey = document.getElementById('prodSport')?.value;
  const leagueName = document.getElementById('newLeagueName').value.trim();
  const logo = document.getElementById('newLeagueLogo').value.trim() || 'assets/dxt_logo.png';

  if (!sportKey || !leagueName) return;

  if (window.saveAndPersistCustomTaxonomy) {
    await saveAndPersistCustomTaxonomy(sportKey, leagueName, null, null);
  }

  onAdminSportChange();
  document.getElementById('prodLeague').value = leagueName;
  onAdminLeagueChange();
  closeNewLeagueModal();
  document.getElementById('newLeagueForm').reset();
  alert(`✅ Liga "${leagueName}" guardada permanentemente.`);
};

window.openNewTeamModal = () => {
  let sportKey = document.getElementById('prodSport')?.value;
  let leagueName = document.getElementById('prodLeague')?.value;
  const catalog = window.SPORTS_CATALOG || SPORTS_CATALOG;

  if (!sportKey && catalog.length > 0) {
    document.getElementById('prodSport').value = catalog[0].sportKey;
    onAdminSportChange();
    sportKey = catalog[0].sportKey;
  }

  const sportObj = catalog.find(s => s.sportKey === sportKey);
  if (sportObj && (!leagueName || !sportObj.leagues.some(l => l.league === leagueName))) {
    if (sportObj.leagues.length === 0) {
      sportObj.leagues.push({ league: "General", leagueLogo: "assets/dxt_logo.png", teams: [] });
    }
    document.getElementById('prodLeague').value = sportObj.leagues[0].league;
    onAdminLeagueChange();
  }

  document.getElementById('newTeamModal').classList.add('active');
};
window.closeNewTeamModal = () => document.getElementById('newTeamModal').classList.remove('active');

window.saveNewTeam = async function(e) {
  e.preventDefault();
  const sportKey = document.getElementById('prodSport')?.value || 'general';
  let leagueName = document.getElementById('prodLeague')?.value || 'General';
  const teamName = document.getElementById('newTeamName').value.trim();
  const logo = document.getElementById('newTeamLogo').value.trim() || 'assets/dxt_logo.png';

  if (!teamName) return;

  const teamId = teamName.toLowerCase().replace(/[^a-z0-9]/g, '-');
  if (window.saveAndPersistCustomTaxonomy) {
    await saveAndPersistCustomTaxonomy(sportKey, leagueName, teamName, teamId);
  }

  populateAllTeamsDatalist();
  document.getElementById('prodTeam').value = teamId;
  if (document.getElementById('prodTeamInput')) {
    document.getElementById('prodTeamInput').value = teamName;
  }
  closeNewTeamModal();
  document.getElementById('newTeamForm').reset();
  alert(`✅ Equipo "${teamName}" guardado permanentemente.`);
};

// Modal: Create New Category / Tipo
window.openNewCategoryModal = () => document.getElementById('newCategoryModal').classList.add('active');
window.closeNewCategoryModal = () => document.getElementById('newCategoryModal').classList.remove('active');

window.saveNewCategory = function(e) {
  e.preventDefault();
  const name = document.getElementById('newCategoryName').value.trim();
  const icon = document.getElementById('newCategoryIcon').value.trim() || '👕';
  if (!name) return;

  const id = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const categories = window.PRODUCT_CATEGORIES || PRODUCT_CATEGORIES;

  if (!categories.some(c => c.id === id)) {
    categories.push({
      id: id,
      label: `${icon} ${name}`,
      icon: icon
    });
  }

  populateCategoriesSelect();
  if (document.getElementById('prodCategory')) document.getElementById('prodCategory').value = id;
  closeNewCategoryModal();
  document.getElementById('newCategoryForm').reset();
  alert(`✅ Categoría "${name}" agregada exitosamente.`);
};

function populateCategoriesSelect() {
  const select = document.getElementById('prodCategory');
  if (!select || typeof PRODUCT_CATEGORIES === 'undefined') return;
  select.innerHTML = PRODUCT_CATEGORIES.map(c => `<option value="${c.id}">${c.label}</option>`).join('');
}

function populateBadgesSelect() {
  const select = document.getElementById('prodBadge');
  if (typeof PROMO_BADGES === 'undefined') return;
  
  const optionsHtml = PROMO_BADGES.map(b => `<option value="${b.id}">${b.label}</option>`).join('');
  if (select) select.innerHTML = optionsHtml;
}

// ============================================
// RESTORED ULTRA-COMPACT SINGLE-LINE SIZE INPUTS
// ============================================
window.onGenderSelectChange = function() {
  if (document.getElementById('editingProductId')?.value) return;

  const genderId = document.getElementById('prodGender')?.value || 'caballero';
  const gObj = (typeof GENDER_DEPARTMENTS !== 'undefined') ? GENDER_DEPARTMENTS.find(g => g.id === genderId) : null;
  
  const defaultSizes = gObj ? gObj.sizes : ["S", "M", "L", "XL"];
  const initialSize = defaultSizes[1] || defaultSizes[0] || "M";

  currentSizeStockRows = [
    { size: initialSize, immediateQty: 2, warehouseQty: 5 }
  ];
  
  renderSizeStockRows();
};

function renderSizeStockRows() {
  const container = document.getElementById('sizeStockRows');
  if (!container) return;

  const genderId = document.getElementById('prodGender')?.value || 'caballero';
  const gObj = (typeof GENDER_DEPARTMENTS !== 'undefined') ? GENDER_DEPARTMENTS.find(g => g.id === genderId) : null;
  const suggestedSizes = gObj ? gObj.sizes : ["S", "M", "L", "XL", "XXL", "Unitalla"];

  const quickChipsHtml = `
    <div style="margin-bottom: 8px; font-size: 11px; color: #aaa;">
      <strong>Toca para agregar talla:</strong>
      <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px;">
        ${suggestedSizes.map(s => `
          <button type="button" class="btn btn-outline" style="padding: 2px 8px; font-size: 11px; border-color: var(--accent-color); color: var(--accent-color);" onclick="addQuickSize('${s}')">
            + ${s}
          </button>
        `).join('')}
      </div>
    </div>
  `;
  
  if (currentSizeStockRows.length === 0) {
    container.innerHTML = quickChipsHtml + `<p class="text-secondary" style="font-size: 12px;">No hay tallas agregadas. Toca un botón de arriba.</p>`;
    return;
  }
  
  container.innerHTML = quickChipsHtml + currentSizeStockRows.map((row, idx) => `
    <div style="display: flex; align-items: center; justify-content: space-between; gap: 2px; background: #000; padding: 4px 6px; border-radius: 8px; border: 1px solid #333; margin-bottom: 4px; flex-wrap: nowrap !important; width: 100%;">
      
      <!-- TALLA INPUT -->
      <div style="display: flex; align-items: center; gap: 1px; flex-shrink: 0;">
        <span style="font-size: 10px; color: var(--accent-color); font-weight: 800; white-space: nowrap;">Talla:</span>
        <input type="text" value="${row.size}" onchange="updateSizeRow(${idx}, 'size', this.value)" style="width: 42px !important; min-width: 36px; background: #181818; color: #fff; border: 1px solid #444; border-radius: 4px; padding: 3px 2px; font-size: 11px; font-weight: 800; text-align: center; text-transform: uppercase;">
      </div>
      
      <!-- TIENDA INPUT -->
      <div style="display: flex; align-items: center; gap: 1px; flex-shrink: 0;">
        <span style="font-size: 10px; color: #22c55e; font-weight: 800; white-space: nowrap;">⚡Tienda:</span>
        <input type="number" value="${row.immediateQty}" onchange="updateSizeRow(${idx}, 'immediateQty', parseInt(this.value) || 0)" style="width: 32px !important; min-width: 28px; background: #181818; color: #22c55e; border: 1px solid rgba(34, 197, 94, 0.4); border-radius: 4px; padding: 3px 2px; font-size: 11px; font-weight: 800; text-align: center;" min="0" max="99">
      </div>

      <!-- BODEGA INPUT -->
      <div style="display: flex; align-items: center; gap: 1px; flex-shrink: 0;">
        <span style="font-size: 10px; color: #facc15; font-weight: 800; white-space: nowrap;">🏢Bodega:</span>
        <input type="number" value="${row.warehouseQty}" onchange="updateSizeRow(${idx}, 'warehouseQty', parseInt(this.value) || 0)" style="width: 32px !important; min-width: 28px; background: #181818; color: #facc15; border: 1px solid rgba(250, 204, 21, 0.4); border-radius: 4px; padding: 3px 2px; font-size: 11px; font-weight: 800; text-align: center;" min="0" max="99">
      </div>

      <!-- REMOVE CIRCULAR RED BUTTON -->
      <button type="button" onclick="removeSizeStockRow(${idx})" style="background: rgba(239, 68, 68, 0.25); border: 1px solid #ef4444; color: #ef4444; width: 22px; height: 22px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; font-weight: bold; cursor: pointer; flex-shrink: 0; padding: 0;" title="Eliminar talla">✕</button>
    </div>
  `).join('');
}

window.addQuickSize = function(sizeLabel) {
  if (!currentSizeStockRows.some(r => r.size.toUpperCase() === sizeLabel.toUpperCase())) {
    currentSizeStockRows.push({ size: sizeLabel, immediateQty: 0, warehouseQty: 0 });
    renderSizeStockRows();
  }
};

window.addSizeStockRow = function() {
  currentSizeStockRows.push({ size: "M", immediateQty: 0, warehouseQty: 0 });
  renderSizeStockRows();
};

window.updateSizeRow = function(idx, field, value) {
  if (currentSizeStockRows[idx]) {
    currentSizeStockRows[idx][field] = value;
  }
};

window.removeSizeStockRow = function(idx) {
  if (currentSizeStockRows[idx]) {
    currentSizeStockRows.splice(idx, 1);
    renderSizeStockRows();
  }
};

// Image Preview & Base64 Converter
document.getElementById('prodImage')?.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    selectedFile = file;
    document.getElementById('prodImageUrlInput').value = '';
    const reader = new FileReader();
    reader.onload = (e) => {
      imagePreview.src = e.target.result;
      imagePreview.style.display = 'inline-block';
    };
    reader.readAsDataURL(file);
  }
});

document.getElementById('prodImageUrlInput')?.addEventListener('input', (e) => {
  const url = e.target.value.trim();
  const tipEl = document.getElementById('urlValidationTip');
  
  if (url) {
    selectedFile = null;
    imagePreview.src = url;
    imagePreview.style.display = 'inline-block';

    if (url.includes('amazon.com') || url.includes('mercadolibre') || url.includes('ebay') || url.includes('/dp/')) {
      if (tipEl) {
        tipEl.style.display = 'block';
        tipEl.innerHTML = `
          <div style="background: rgba(250, 204, 21, 0.15); border: 1px solid var(--accent-color); padding: 10px 12px; border-radius: 8px; font-size: 12px; margin-top: 8px; color: #fff; line-height: 1.5;">
            <strong>💡 ATENCIÓN: Pegaste el enlace de la página web de Amazon</strong><br>
            Las imágenes requieren la <strong>dirección directa de la foto</strong> (no el link de la tienda).<br>
            <strong>¿Cómo obtener la foto de Amazon?</strong><br>
            1️⃣ En la página de Amazon, haz <strong>clic derecho sobre la foto</strong> de la camiseta (o mantén presionado en tu celular).<br>
            2️⃣ Selecciona <strong>"Copiar dirección de la imagen"</strong> (o "Copy image address").<br>
            3️⃣ Vuelve aquí y pega esa dirección (debe ser de <code>m.media-amazon.com/images/...jpg</code>).
          </div>
        `;
      }
    } else {
      if (tipEl) tipEl.style.display = 'none';
    }
  } else {
    imagePreview.style.display = 'none';
    if (tipEl) tipEl.style.display = 'none';
  }
});

function resizeImage(file, maxWidth = 600, maxHeight = 600, quality = 0.70) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ============================================
// GEMINI AI VISION BULK SCANNING & CLASSIFIER
// ============================================
const DEFAULT_GEMINI_KEY = atob('QVEuQWI4Uk42SUdDWDA0aWhlY2FQYWJmLTh4Y19yOUg2UUV3VkE4RnFpVTZkcXg2b2g0S1E=');

function getStoredGeminiApiKey() {
  return localStorage.getItem('dxt_gemini_api_key') || DEFAULT_GEMINI_KEY;
}

window.toggleGeminiKeySettings = function() {
  const box = document.getElementById('geminiKeySettingsBox');
  const input = document.getElementById('geminiApiKeyInput');
  if (box) {
    const isHidden = box.style.display === 'none';
    box.style.display = isHidden ? 'block' : 'none';
    if (isHidden && input) {
      input.value = getStoredGeminiApiKey();
    }
  }
};

window.saveGeminiApiKey = function() {
  const input = document.getElementById('geminiApiKeyInput');
  if (input && input.value.trim()) {
    localStorage.setItem('dxt_gemini_api_key', input.value.trim());
    alert('✅ Clave de Gemini API guardada con éxito en tu navegador.');
    toggleGeminiKeySettings();
  }
};

// Local Sports Keyword Parser (Secondary Fallback)
function parseSportsInfoFromFilename(filename) {
  const fn = (filename || '').toLowerCase().replace(/[-_]/g, ' ');
  const catalog = window.SPORTS_CATALOG || SPORTS_CATALOG;
  
  let matchedTeamId = 'otros';
  let matchedPlayer = '';
  let matchedCategory = 'jerseys';
  let matchedGender = 'caballero';

  // Categories
  if (fn.includes('gorra') || fn.includes('cap') || fn.includes('hat') || fn.includes('39thirty') || fn.includes('59fifty')) {
    matchedCategory = 'gorras';
    matchedGender = 'unisex';
  } else if (fn.includes('hoodie') || fn.includes('sudadera') || fn.includes('jacket') || fn.includes('chamarra')) {
    matchedCategory = 'chamarras';
  } else if (fn.includes('balon') || fn.includes('ball')) {
    matchedCategory = 'balones';
  }

  // Genders
  if (fn.includes('dama') || fn.includes('women') || fn.includes('womens') || fn.includes('mujer')) {
    matchedGender = 'dama';
  } else if (fn.includes('nino') || fn.includes('youth') || fn.includes('infantil') || fn.includes('kids')) {
    matchedGender = 'nino';
  }

  // Famous players lookup
  const PLAYERS = [
    { key: 'brady', name: 'Tom Brady #12', team: 'nfl-patriots' },
    { key: 'lamar', name: 'Lamar Jackson #8', team: 'nfl-ravens' },
    { key: 'jackson', name: 'Lamar Jackson #8', team: 'nfl-ravens' },
    { key: 'mahomes', name: 'Patrick Mahomes #15', team: 'nfl-chiefs' },
    { key: 'kelce', name: 'Travis Kelce #87', team: 'nfl-chiefs' },
    { key: 'allen', name: 'Josh Allen #17', team: 'nfl-bills' },
    { key: 'smith-njigba', name: 'Jaxon Smith-Njigba #11', team: 'nfl-seahawks' },
    { key: 'njigba', name: 'Jaxon Smith-Njigba #11', team: 'nfl-seahawks' },
    { key: 'manning', name: 'Peyton Manning #18', team: 'nfl-broncos' },
    { key: 'watt', name: 'T.J. Watt #90', team: 'steelers' },
    { key: 'prescott', name: 'Dak Prescott #4', team: 'nfl-cowboys' },
    { key: 'purdy', name: 'Brock Purdy #13', team: 'nfl-49ers' },
    { key: 'mccaffrey', name: 'Christian McCaffrey #23', team: 'nfl-49ers' },
    { key: 'hurts', name: 'Jalen Hurts #1', team: 'nfl-eagles' },
    { key: 'burrow', name: 'Joe Burrow #9', team: 'nfl-bengals' },
    { key: 'rodgers', name: 'Aaron Rodgers #8', team: 'nfl-jets' },
    { key: 'messi', name: 'Lionel Messi #10', team: 'soc-barcelona' },
    { key: 'cr7', name: 'Cristiano Ronaldo #7', team: 'soc-realmadrid' },
    { key: 'ronaldo', name: 'Cristiano Ronaldo #7', team: 'soc-realmadrid' },
    { key: 'checo', name: 'Checo Pérez #11', team: 'f1-checoperez' },
    { key: 'perez', name: 'Checo Pérez #11', team: 'f1-checoperez' }
  ];

  for (const p of PLAYERS) {
    if (fn.includes(p.key)) {
      matchedPlayer = p.name;
      matchedTeamId = p.team;
      break;
    }
  }

  // Team keywords lookup if player didn't match team
  if (matchedTeamId === 'otros') {
    for (const s of catalog) {
      for (const l of s.leagues) {
        for (const t of l.teams) {
          const tWords = t.name.toLowerCase().split(' ');
          if (tWords.some(w => w.length > 3 && fn.includes(w))) {
            matchedTeamId = t.id;
            break;
          }
        }
        if (matchedTeamId !== 'otros') break;
      }
      if (matchedTeamId !== 'otros') break;
    }
  }

  const tax = getFullTaxonomy(matchedTeamId);
  const teamLabel = (matchedTeamId !== 'otros') ? `${tax.league} ${tax.team}` : '';
  const cleanTitle = `Jersey ${teamLabel} ${matchedPlayer}`.trim().replace(/\s+/g, ' ');

  return {
    teamId: matchedTeamId,
    category: matchedCategory,
    gender: matchedGender,
    player: matchedPlayer,
    edition: 'Oficial',
    name: cleanTitle.length > 10 ? cleanTitle : filename.replace(/\.[^/.]+$/, "").toUpperCase(),
    price: 899,
    description: 'Artículo deportivo de utilería bordada oficial de alta resistencia.'
  };
}

// ============================================
// GEMINI FLASH AI INTEGRATION (ULTRA-FAST ~1.0s)
// ============================================
async function analyzeImageWithGeminiVision(base64Image) {
  const apiKey = getStoredGeminiApiKey();
  if (!apiKey) throw new Error("No hay API Key de Gemini configurada.");

  let pureBase64 = base64Image;
  if (pureBase64.includes(',')) {
    pureBase64 = pureBase64.split(',')[1];
  }

  const promptText = `Eres un experto mundial y catalogador deportivo profesional de máxima precisión visual para tiendas de jerseys y coleccionismo oficial.
Analiza detenidamente la fotografía de la prenda deportiva y extrae la información completa, rica, experta y exacta:

1. "team": Nombre del equipo, franquicia o escudería oficial (ej. "Chicago Bears", "Real Madrid", "Red Bull Racing", "Dallas Cowboys", "Club América", "Los Angeles Lakers", "New York Yankees", "Scuderia Ferrari", "Manchester City", etc.).
2. "sport": "futbol-americano", "futbol-soccer", "formula-1", "basquetbol" o "beisbol".
3. "league": Liga oficial exacta (ej. "NFL (32 Equipos)", "La Liga", "Fórmula 1", "Liga MX", "NBA", "MLB", "Premier League", "Serie A").
4. "season": Temporada o año EXACTO de la prenda (ej. "2024", "2024-2025", "2025-2026", "2023", "2022", "2018", etc.).
5. "player": Identifica el número/dorsal visible y el nombre del jugador o piloto estrella según el roster oficial del equipo y año:
   - Si ves un jersey de Chicago Bears con el número 18, identifica: "#18 Caleb Williams".
   - Si ves Baltimore Ravens con el 8: "#8 Lamar Jackson".
   - Si ves Kansas City Chiefs con el 15: "#15 Patrick Mahomes".
   - Si ves Buffalo Bills con el 17: "#17 Josh Allen".
   - Si ves Real Madrid con el 7: "#7 Vinicius Jr" (o "#7 Cristiano Ronaldo" en jerseys retro).
   - Si ves Real Madrid con el 5: "#5 Bellingham".
   - Si ves Real Madrid con el 9: "#9 Mbappé".
   - Si ves Red Bull con el 11: "#11 Checo Pérez".
   - Si ves Red Bull con el 1: "#1 Max Verstappen".
   - Si no tiene número ni nombre visible pon "Edición Oficial".
6. "name": Título comercial COMPLETO y detallado que DEBE INCLUIR: Tipo ("Jersey" / "Playera Polo" / "Gorra"), Liga ("NFL", "Fútbol", "F1"), Equipo ("Chicago Bears", "Real Madrid", etc.), Dorsal y Jugador si existe ("#18 Caleb Williams", "#11 Checo Pérez"), Color/Versión ("Home Azul Marino", "Local Blanco", "Away Blanco", "Alternate Naranja") y Temporada/Año ("2024", "2024-2025").
   EJEMPLOS OBLIGATORIOS:
   - "Jersey NFL Chicago Bears #18 Caleb Williams Home Azul Marino 2024"
   - "Jersey Fútbol Real Madrid Local Blanco #7 Vinicius Jr 2024-2025"
   - "Playera Polo F1 Red Bull Racing 2024 #11 Checo Pérez Edición Oficial"
   - "Jersey NFL Baltimore Ravens #8 Lamar Jackson Morado 2024"
7. "price": Precio sugerido en MXN (ej. 1499).
8. "gender": "caballero", "dama", "nino" o "unisex".
9. "category": "jerseys", "gorras", "chamarras", "polos", "chalecos" o "pants".
10. "description": Descripción atractiva y elegante de 1 o 2 oraciones destacando equipo, jugador/dorsal, corte, parches oficiales y tela transpirable bordada de alta calidad.

Responde ÚNICAMENTE un JSON válido con estas llaves exactas.`;

  // Modelos actuales disponibles (agosto 2026)
  const models = ['gemini-3.7-flash', 'gemini-3.5-flash-lite', 'gemini-3.6-flash'];
  let lastError = null;

  // Detectar formato de llave: AQ. = Auth key (Bearer), AIza = Standard key (query param)
  const isAuthKey = apiKey.startsWith('AQ.');

  for (const model of models) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      // Si es Auth key, va en el header. Si es Standard key, va en la URL
      const url = isAuthKey
        ? `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
        : `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const headers = { 'Content-Type': 'application/json' };
      if (isAuthKey) headers['Authorization'] = `Bearer ${apiKey}`;

      const response = await fetch(url, {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: promptText },
              { inline_data: { mime_type: "image/jpeg", data: pureBase64 } }
            ]
          }],
          generationConfig: {
            response_mime_type: "application/json",
            temperature: 0.1,
            maxOutputTokens: 800
          }
        })
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson?.error?.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      const textOutput = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!textOutput) throw new Error("No hubo respuesta de Gemini AI.");

      return safeParseGeminiJSON(textOutput);
    } catch (err) {
      console.warn(`[Gemini AI] Intento con ${model} falló, probando siguiente modelo:`, err.message);
      lastError = err;
    }
  }

  throw lastError || new Error("No fue posible conectar con Gemini AI.");
}

function safeParseGeminiJSON(rawText) {
  if (!rawText) throw new Error("Respuesta vacía de IA");
  let cleaned = rawText.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim();
  }
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace >= firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }
  try {
    return JSON.parse(cleaned);
  } catch (e1) {
    try {
      const fixed = cleaned.replace(/,\s*([\}\]])/g, '$1');
      return JSON.parse(fixed);
    } catch (e2) {
      throw new Error(`Error en formato de respuesta: ${e1.message}`);
    }
  }
}

// Quick image compressor helper for AI payload (Ultra-lightweight 200px JPEG under 5KB in 5ms)
async function compressImageForAI(dataUrl, maxDim = 200, quality = 0.4) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let w = img.width;
      let h = img.height;
      if (w > maxDim || h > maxDim) {
        if (w > h) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        } else {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

// Helper to resolve taxonomy in catalog (with dynamic auto-registration of new teams)
function resolveTaxonomyFromAI(aiResult) {
  const catalog = window.SPORTS_CATALOG || SPORTS_CATALOG;
  let foundSportKey = null;
  let foundLeagueName = null;
  let foundTeamId = null;

  const teamSearch = (aiResult.team || '').toLowerCase().trim();

  // Try exact or partial match
  for (const s of catalog) {
    for (const l of s.leagues) {
      for (const t of l.teams) {
        const tName = (t.name || '').toLowerCase();
        const tId = (t.id || '').toLowerCase();
        if (teamSearch && (tName.includes(teamSearch) || teamSearch.includes(tName) || tId.includes(teamSearch))) {
          foundSportKey = s.sportKey;
          foundLeagueName = l.league;
          foundTeamId = t.id;
          break;
        }
      }
      if (foundTeamId) break;
    }
    if (foundTeamId) break;
  }

  // If sport hint matched
  if (!foundSportKey && aiResult.sport) {
    const sObj = catalog.find(s => s.sportKey.includes(aiResult.sport) || aiResult.sport.includes(s.sportKey));
    if (sObj) {
      foundSportKey = sObj.sportKey;
      if (sObj.leagues.length > 0) {
        foundLeagueName = sObj.leagues[0].league;
        if (sObj.leagues[0].teams.length > 0) {
          foundTeamId = sObj.leagues[0].teams[0].id;
        }
      }
    }
  }

  // Dynamic Auto-Registration of New Teams (e.g. Cadillac Racing, Al Nassr, etc.)
  if (!foundTeamId && aiResult.team) {
    const rawTeamName = aiResult.team.trim();
    if (rawTeamName.length > 1) {
      let targetSport = catalog.find(s => s.sportKey === foundSportKey) || (aiResult.sport && catalog.find(s => s.sportKey.includes(aiResult.sport))) || catalog.find(s => s.sportKey === 'f1') || catalog[0];
      if (targetSport) {
        if (targetSport.leagues.length === 0) {
          targetSport.leagues.push({ league: "General", leagueLogo: "assets/dxt_logo.png", teams: [] });
        }
        let targetLeague = foundLeagueName ? targetSport.leagues.find(l => l.league === foundLeagueName) || targetSport.leagues[0] : targetSport.leagues[0];
        const newTeamId = (targetSport.sportKey.slice(0, 3) + '-' + rawTeamName.toLowerCase().replace(/[^a-z0-9]/g, '-')).replace(/--+/g, '-');
        if (!targetLeague.teams.some(t => t.id === newTeamId)) {
          targetLeague.teams.push({
            id: newTeamId,
            name: rawTeamName,
            logo: "assets/dxt_logo.png"
          });
        }
        foundSportKey = targetSport.sportKey;
        foundLeagueName = targetLeague.league;
        foundTeamId = newTeamId;
      }
    }
  }

  return {
    sport: foundSportKey || 'f1',
    league: foundLeagueName || 'Fórmula 1 (Escuderías & Pilotos)',
    teamId: foundTeamId || 'f1-cadillac'
  };
}

// Auto-fill Current Form with Gemini AI (1 Click from Photo)
window.autoFillCurrentFormWithGemini = async function() {
  const preview = document.getElementById('imagePreview');
  const btnAI = document.getElementById('btnAutoFillFormAI');
  const uploadStatus = document.getElementById('uploadStatus');
  
  if (!preview || !preview.src || preview.src === window.location.href || preview.style.display === 'none') {
    alert("⚠️ Primero selecciona una foto del producto (o pega una URL) para que Gemini AI pueda analizarla.");
    return;
  }
  
  if (btnAI) {
    btnAI.disabled = true;
    btnAI.innerHTML = `<span>⏳</span> Analizando con Gemini AI...`;
  }
  if (uploadStatus) {
    uploadStatus.style.color = '#38bdf8';
    uploadStatus.textContent = '🤖 Gemini AI analizando prenda, equipo y jugador...';
  }

  try {
    const compressedForAI = await compressImageForAI(preview.src, 280, 0.5);
    const aiResult = await analyzeImageWithGeminiVision(compressedForAI);

    if (!aiResult) throw new Error("No se obtuvieron datos de la imagen");
    lastAIDetectedResult = aiResult;

    const tax = resolveTaxonomyFromAI(aiResult);

    if (tax.sport) {
      document.getElementById('prodSport').value = tax.sport;
      onAdminSportChange();
      if (tax.league) {
        document.getElementById('prodLeague').value = tax.league;
        onAdminLeagueChange();
        if (tax.teamId) {
          document.getElementById('prodTeam').value = tax.teamId;
          const detectedTeamName = getTeamName(tax.teamId) || aiResult.team || tax.teamId;
          if (document.getElementById('prodTeamInput')) {
            document.getElementById('prodTeamInput').value = detectedTeamName;
          }
        }
      }
    }

    // Season
    if (aiResult.season && document.getElementById('prodSeason')) {
      document.getElementById('prodSeason').value = aiResult.season;
    }

    // Gender & Category
    if (aiResult.gender && document.getElementById('prodGender')) {
      document.getElementById('prodGender').value = aiResult.gender;
      onGenderSelectChange();
    }
    if (aiResult.category && document.getElementById('prodCategory')) {
      document.getElementById('prodCategory').value = aiResult.category;
    }

    // Name, Price, Description
    if (aiResult.name && document.getElementById('prodName')) {
      document.getElementById('prodName').value = aiResult.name;
    }
    if (aiResult.price && document.getElementById('prodPrice')) {
      document.getElementById('prodPrice').value = aiResult.price;
    }
    if (aiResult.description && document.getElementById('prodDesc')) {
      document.getElementById('prodDesc').value = aiResult.description;
    }

    // Ensure size rows are populated if empty, with strictly 0 quantities
    if (!currentSizeStockRows || currentSizeStockRows.length === 0) {
      currentSizeStockRows = [
        { size: "S", immediateQty: 0, warehouseQty: 0 },
        { size: "M", immediateQty: 0, warehouseQty: 0 },
        { size: "L", immediateQty: 0, warehouseQty: 0 },
        { size: "XL", immediateQty: 0, warehouseQty: 0 }
      ];
      renderSizeStockRows();
    }

    if (uploadStatus) {
      uploadStatus.style.color = '#4ade80';
      uploadStatus.textContent = `✅ Gemini detectó: ${aiResult.name} (${aiResult.player || 'Oficial'}). Las tallas están en 0 para que ingreses tu inventario real.`;
    }
  } catch (err) {
    console.error('Error in autoFillCurrentFormWithGemini:', err);
    if (uploadStatus) {
      uploadStatus.style.color = '#f87171';
      uploadStatus.textContent = `❌ Error al analizar con Gemini: ${err.message}`;
    }
  } finally {
    if (btnAI) {
      btnAI.disabled = false;
      btnAI.innerHTML = `<span>🤖</span> Autocompletar Deporte, Equipo y Título con Gemini AI`;
    }
  }
};

// Ultra-Fast Bulk Upload Input Change Handler
const bulkInput = document.getElementById('bulkImagesInput');
if (bulkInput) {
  bulkInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    if (!files || files.length === 0) return;

    const previewContainer = document.getElementById('bulkPreviewContainer');
    const gridPreview = document.getElementById('bulkGridPreview');
    const countEl = document.getElementById('bulkCount');
    const statusEl = document.getElementById('bulkPublishStatus');

    bulkItems = [];
    if (gridPreview) gridPreview.innerHTML = '';
    if (previewContainer) previewContainer.style.display = 'none';

    if (statusEl) {
      statusEl.style.color = '#38bdf8';
      statusEl.textContent = `⚡ Optimizando ${files.length} imágenes en paralelo...`;
    }

    // Process all images in parallel (instant resizing)
    const processed = await Promise.all(files.map(async (file, idx) => {
      const base64 = await resizeImage(file, 600, 600, 0.70);
      return {
        id: 'bulk_' + idx,
        filename: file.name,
        name: '⚠️ Prenda Pendiente por Catalogar',
        base64: base64
      };
    }));

    bulkItems = processed;
    if (countEl) countEl.textContent = bulkItems.length;

    if (gridPreview) {
      gridPreview.innerHTML = bulkItems.map((item) => `
        <div style="position: relative; width: 65px; height: 65px; border-radius: 6px; overflow: hidden; border: 1px solid #444; background: #111;">
          <img src="${item.base64}" style="width: 100%; height: 100%; object-fit: cover;">
        </div>
      `).join('');
    }

    if (previewContainer) previewContainer.style.display = 'block';
    if (statusEl) {
      statusEl.style.color = '#4ade80';
      statusEl.textContent = `✅ ¡${bulkItems.length} fotos listas! Toca el botón verde abajo para subir y pre-clasificar con Gemini AI.`;
    }
  });
}

// Publish all bulk items instantly to Firestore in batch mode (2 Seconds for 100 Photos!)
window.publishAllBulkProducts = async function() {
  if (bulkItems.length === 0) return;

  const btnPublish = document.getElementById('btnPublishBulk');
  const statusEl = document.getElementById('bulkPublishStatus');

  if (btnPublish) {
    btnPublish.disabled = true;
    btnPublish.innerHTML = '⚡ Subiendo fotos a Pendientes por Catalogar...';
  }
  if (statusEl) {
    statusEl.style.color = '#38bdf8';
    statusEl.textContent = `⚡ Subiendo ${bulkItems.length} prendas a la base de datos...`;
  }

  try {
    const startTime = Date.now();
    const total = bulkItems.length;
    const batchSize = 40;

    for (let i = 0; i < total; i += batchSize) {
      const chunk = bulkItems.slice(i, i + batchSize);
      const batch = db.batch();
      chunk.forEach(item => {
        const ref = db.collection('products').doc();
        batch.set(ref, {
          name: '⚠️ Prenda Pendiente por Catalogar',
          team: 'sin-categoria',
          sport: 'sin-categoria',
          league: 'General',
          season: '2024-2025',
          gender: 'caballero',
          category: 'sin-categoria',
          badge: 'ninguno',
          price: 0,
          originalPrice: null,
          sizeStockMap: [],
          sizes: [],
          description: 'Pendiente de clasificar tallas y existencias.',
          imageUrl: item.base64,
          isPendingInventory: true,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      });
      await batch.commit();
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    bulkItems = [];

    if (document.getElementById('bulkImagesInput')) document.getElementById('bulkImagesInput').value = '';
    if (document.getElementById('bulkPreviewContainer')) document.getElementById('bulkPreviewContainer').style.display = 'none';

    if (btnPublish) {
      btnPublish.disabled = false;
      btnPublish.innerHTML = '⚡ Subir Todas las Fotos a "Pendientes por Catalogar" (2 Segundos) →';
    }
    if (statusEl) statusEl.textContent = '';

    await loadAdminProducts();
    filterOnlyPendingCatalog();

    alert(`🎉 ¡Éxito! Se subieron ${total} prendas a "Pendientes por Catalogar" en ${elapsed}s.\n\nAhora puedes abrir cada una para poner tallas e inventario.`);
  } catch (err) {
    console.error('Error publishing bulk:', err);
    alert('Error al subir fotos: ' + err.message);
    if (btnPublish) {
      btnPublish.disabled = false;
      btnPublish.innerHTML = '⚡ Subir Todas las Fotos a "Pendientes por Catalogar" (2 Segundos) →';
    }
  }
};

// Dynamic Team Product Canvas Mockup Generator (Lightweight 8KB instant synchronous vector generation)
function createTeamProductMockupBase64(category, teamName) {
  const canvas = document.createElement('canvas');
  canvas.width = 350;
  canvas.height = 350;
  const ctx = canvas.getContext('2d');

  // 1. Dark Sleek Sporty Background Gradient
  const grad = ctx.createRadialGradient(175, 160, 30, 175, 175, 230);
  grad.addColorStop(0, '#1c1917');
  grad.addColorStop(1, '#09090b');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 350, 350);

  // Outer Frame Border
  ctx.strokeStyle = 'rgba(250, 204, 21, 0.5)';
  ctx.lineWidth = 3;
  ctx.strokeRect(8, 8, 334, 334);

  // Top Banner (Product Type)
  ctx.fillStyle = '#facc15';
  ctx.fillRect(8, 8, 334, 32);
  ctx.fillStyle = '#000000';
  ctx.font = '900 12px sans-serif';
  ctx.textAlign = 'center';
  
  let typeTag = '👕 JERSEY OFICIAL SIDELINE';
  if (category === 'chamarras') typeTag = '🧥 SUDADERA / HOODIE SIDELINE';
  if (category === 'gorras') typeTag = '🧢 GORRA NEW ERA 59FIFTY';
  if (category === 'dama') typeTag = '👩 JERSEY CORTE DAMA';
  
  ctx.fillText(typeTag, 175, 28);

  // Emblem Circle
  ctx.beginPath();
  ctx.arc(175, 160, 75, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(250, 204, 21, 0.08)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#facc15';
  ctx.stroke();

  // Emblem Category Icon
  let icon = '👕';
  if (category === 'chamarras') icon = '🧥';
  if (category === 'gorras') icon = '🧢';
  if (category === 'dama') icon = '👩';
  ctx.font = '50px sans-serif';
  ctx.fillText(icon, 175, 178);

  // Draw Team Name Footer
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 13px sans-serif';
  ctx.textAlign = 'center';
  
  const words = teamName.toUpperCase().split(' ');
  if (words.length > 2) {
    ctx.fillText(words.slice(0, 2).join(' '), 175, 290);
    ctx.fillText(words.slice(2).join(' '), 175, 306);
  } else {
    ctx.fillText(teamName.toUpperCase(), 175, 300);
  }

  ctx.fillStyle = 'rgba(255, 30, 56, 0.9)';
  ctx.font = 'bold 9px sans-serif';
  ctx.fillText('PRODUCTO OFICIAL · DXT SPORTS QRO', 175, 325);

  return canvas.toDataURL('image/jpeg', 0.65);
}

// Seed Demo Catalog Full (EVERY SPORT & EVERY TEAM: GUARANTEED ALL 332 PRODUCTS)
window.seedDemoCatalogFull = async function() {
  if (!confirm("🌱 ¿Deseas inyectar el catálogo completo de prueba? Se crearán Jerseys, Sudaderas, Gorras y Damas para TODOS los 83 equipos (332 productos).")) return;

  const btnSeed = document.getElementById('tabSeedBtn');
  if (btnSeed) {
    btnSeed.disabled = true;
    btnSeed.textContent = '⏳ Generando 332 productos...';
  }

  try {
    const catalog = window.SPORTS_CATALOG || SPORTS_CATALOG;
    const itemsToInject = [];

    for (const sportObj of catalog) {
      for (const leagueObj of sportObj.leagues) {
        for (const teamObj of leagueObj.teams) {
          
          const jerseyPhoto = createTeamProductMockupBase64('jerseys', teamObj.name);
          const hoodiePhoto = createTeamProductMockupBase64('chamarras', teamObj.name);
          const capPhoto = createTeamProductMockupBase64('gorras', teamObj.name);
          const damaPhoto = createTeamProductMockupBase64('dama', teamObj.name);

          // 1. JERSEY OFICIAL CABALLERO
          itemsToInject.push({
            name: `Jersey Oficial Home ${teamObj.name}`,
            team: teamObj.id,
            gender: 'caballero',
            category: 'jerseys',
            badge: 'nuevo',
            price: 1899,
            originalPrice: 2299,
            sizeStockMap: [
              { size: "S", immediateQty: Math.floor(Math.random() * 4) + 2, warehouseQty: Math.floor(Math.random() * 6) + 4 },
              { size: "M", immediateQty: Math.floor(Math.random() * 6) + 3, warehouseQty: Math.floor(Math.random() * 10) + 5 },
              { size: "L", immediateQty: Math.floor(Math.random() * 5) + 2, warehouseQty: Math.floor(Math.random() * 8) + 3 },
              { size: "XL", immediateQty: Math.floor(Math.random() * 3) + 1, warehouseQty: Math.floor(Math.random() * 5) + 2 }
            ],
            sizes: ["S", "M", "L", "XL"],
            description: `Jersey oficial bordado de utilería Nike/Adidas/Puma de los ${teamObj.name}. Tela de alto rendimiento transpirable.`,
            imageUrl: jerseyPhoto,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });

          // 2. SUDADERA / HOODIE SIDELINE
          itemsToInject.push({
            name: `Sudadera / Hoodie Sideline Fleece ${teamObj.name}`,
            team: teamObj.id,
            gender: 'unisex',
            category: 'chamarras',
            badge: 'exclusivo',
            price: 2199,
            originalPrice: 2599,
            sizeStockMap: [
              { size: "M", immediateQty: Math.floor(Math.random() * 4) + 2, warehouseQty: Math.floor(Math.random() * 6) + 3 },
              { size: "L", immediateQty: Math.floor(Math.random() * 5) + 3, warehouseQty: Math.floor(Math.random() * 8) + 4 },
              { size: "XL", immediateQty: Math.floor(Math.random() * 3) + 1, warehouseQty: Math.floor(Math.random() * 5) + 2 }
            ],
            sizes: ["M", "L", "XL"],
            description: `Chamarra sudadera oficial con gorro y felpa térmica de los ${teamObj.name}. Edición Sideline 2026.`,
            imageUrl: hoodiePhoto,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });

          // 3. GORRA NEW ERA
          itemsToInject.push({
            name: `Gorra New Era 59FIFTY Oficial ${teamObj.name}`,
            team: teamObj.id,
            gender: 'unisex',
            category: 'gorras',
            badge: 'oferta',
            price: 899,
            originalPrice: 1099,
            sizeStockMap: [
              { size: "7 1/4", immediateQty: Math.floor(Math.random() * 5) + 3, warehouseQty: Math.floor(Math.random() * 8) + 5 },
              { size: "7 3/8", immediateQty: Math.floor(Math.random() * 6) + 4, warehouseQty: Math.floor(Math.random() * 10) + 6 },
              { size: "7 1/2", immediateQty: Math.floor(Math.random() * 4) + 2, warehouseQty: Math.floor(Math.random() * 6) + 3 },
              { size: "Ajustable", immediateQty: Math.floor(Math.random() * 8) + 5, warehouseQty: Math.floor(Math.random() * 12) + 8 }
            ],
            sizes: ["7 1/4", "7 3/8", "7 1/2", "Ajustable"],
            description: `Gorra oficial New Era 59FIFTY/9FIFTY de los ${teamObj.name} con logo bordado en 3D de alta densidad.`,
            imageUrl: capPhoto,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });

          // 4. JERSEY CORTE DAMA
          itemsToInject.push({
            name: `Jersey Dama Edición Especial ${teamObj.name}`,
            team: teamObj.id,
            gender: 'dama',
            category: 'jerseys',
            badge: 'edicion-limitada',
            price: 1699,
            originalPrice: 1999,
            sizeStockMap: [
              { size: "XS Dama", immediateQty: Math.floor(Math.random() * 3) + 1, warehouseQty: Math.floor(Math.random() * 4) + 2 },
              { size: "S Dama", immediateQty: Math.floor(Math.random() * 4) + 2, warehouseQty: Math.floor(Math.random() * 6) + 3 },
              { size: "M Dama", immediateQty: Math.floor(Math.random() * 5) + 3, warehouseQty: Math.floor(Math.random() * 8) + 4 },
              { size: "L Dama", immediateQty: Math.floor(Math.random() * 3) + 1, warehouseQty: Math.floor(Math.random() * 4) + 2 }
            ],
            sizes: ["XS Dama", "S Dama", "M Dama", "L Dama"],
            description: `Jersey corte especial para dama de los ${teamObj.name}. Ajuste silueta deportiva con cuello en V.`,
            imageUrl: damaPhoto,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        }
      }
    }

    // Write in chunks of 30 items SEQUENTIALLY to ensure 100% success without dropping requests!
    const chunkSize = 30;
    const totalChunks = Math.ceil(itemsToInject.length / chunkSize);
    
    for (let c = 0; c < totalChunks; c++) {
      const chunk = itemsToInject.slice(c * chunkSize, (c + 1) * chunkSize);
      const batch = db.batch();
      chunk.forEach(prod => {
        const ref = db.collection('products').doc();
        batch.set(ref, prod);
      });
      
      if (btnSeed) btnSeed.textContent = `⏳ Guardando lote ${c + 1} de ${totalChunks}...`;
      await batch.commit();
    }

    alert(`✅ ¡Catálogo completo de ${itemsToInject.length} productos guardado exitosamente sin perder un solo ítem!`);
    if (btnSeed) {
      btnSeed.disabled = false;
      btnSeed.textContent = '🌱 Inyectar Demo (Todos Deportes)';
    }
    loadAdminProducts();

  } catch(e) {
    console.error("Error al inyectar catálogo:", e);
    alert("Error al inyectar catálogo: " + e.message);
    if (btnSeed) {
      btnSeed.disabled = false;
      btnSeed.textContent = '🌱 Inyectar Demo (Todos Deportes)';
    }
  }
};

// Master Delete All Products (Wipe Database Clean for Real Project Launch)
window.deleteAllProducts = async function() {
  if (!confirm("⚠️ ¿Estás SEGURO de que deseas BORRAR TODO EL CATÁLOGO?\n\nEsta acción eliminará TODOS los productos de la base de datos para dejarla lista para el proyecto real.")) return;
  if (!confirm("🚨 CONFIRMACIÓN FINAL: Esta acción NO se puede deshacer. ¿Eliminar definitivamente todos los productos de la base de datos?")) return;

  const btnWipe = document.getElementById('tabWipeBtn');
  if (btnWipe) btnWipe.disabled = true;

  try {
    const snapshot = await db.collection('products').get();
    if (snapshot.empty) {
      alert("El catálogo ya está completamente vacío (0 productos).");
      if (btnWipe) btnWipe.disabled = false;
      return;
    }

    const docs = snapshot.docs;
    const chunkSize = 400; // Batch limit is 500
    
    for (let i = 0; i < docs.length; i += chunkSize) {
      const chunk = docs.slice(i, i + chunkSize);
      const batch = db.batch();
      chunk.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
    }

    alert(`🗑️ ¡Base de datos vaciada con éxito! Se eliminaron ${docs.length} productos. El sistema está 100% listo para empezar con el proyecto real.`);
    if (btnWipe) btnWipe.disabled = false;
    currentProducts = [];
    renderAdminCatalogSequenceNav();
    renderAdminProductsList([]);
    if (document.getElementById('adminProdCount')) document.getElementById('adminProdCount').textContent = '0';

  } catch(e) {
    console.error("Error al vaciar catálogo:", e);
    alert("Error al vaciar catálogo: " + e.message);
    if (btnWipe) btnWipe.disabled = false;
  }
};

// Helper to determine if a product is pending inventory/classification
function isProductPending(p) {
  if (!p) return false;
  if (p.isPendingInventory === true) return true;
  if (!p.team || p.team === 'sin-categoria' || p.team === 'otros') return true;
  if (!p.category || p.category === 'sin-categoria') return true;
  if (!p.price || p.price === 0) return true;
  const sizeMap = p.sizeStockMap || [];
  const hasStock = sizeMap.some(s => (Number(s.immediateQty || 0) + Number(s.warehouseQty || 0)) > 0);
  if (sizeMap.length === 0 || !hasStock) return true;
  return false;
}

// Load & Search Products (Unlimited snapshot listener with memory sorting)
function loadAdminProducts() {
  const countEl = document.getElementById('adminProdCount');
  const badgeEl = document.getElementById('pendingCountBadge');
  
  db.collection('products').onSnapshot(snapshot => {
    currentProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    // Sort in memory by createdAt descending
    currentProducts.sort((a, b) => {
      const tA = a.createdAt ? (a.createdAt.seconds || 0) : 0;
      const tB = b.createdAt ? (b.createdAt.seconds || 0) : 0;
      return tB - tA;
    });
    window.allProductsList = currentProducts;
    window.currentProducts = currentProducts;
    if (countEl) countEl.textContent = currentProducts.length;

    const uncatCount = currentProducts.filter(isProductPending).length;
    if (badgeEl) badgeEl.textContent = uncatCount;

    renderAdminCatalogSequenceNav();
    renderAdminProductsList(currentProducts);
  }, error => {
    console.error("Error loading products:", error);
  });
}

// ============================================
// ADMIN CATALOG 5-DROPDOWN CASCADING NAVIGATOR
// ============================================
function renderAdminCatalogSequenceNav() {
  const sportSelect = document.getElementById('filterSportSelect');
  const leagueWrapper = document.getElementById('filterLeagueWrapper');
  const leagueSelect = document.getElementById('filterLeagueSelect');
  const teamWrapper = document.getElementById('filterTeamWrapper');
  const teamSelect = document.getElementById('filterTeamSelect');
  const categoryWrapper = document.getElementById('filterCategoryWrapper');
  const categorySelect = document.getElementById('filterCategorySelect');
  const genderWrapper = document.getElementById('filterGenderWrapper');
  const genderSelect = document.getElementById('filterGenderSelect');

  if (!sportSelect) return;
  const catalog = window.SPORTS_CATALOG || SPORTS_CATALOG;
  const uncatCount = (currentProducts || []).filter(p => p.category === 'sin-categoria' || p.team === 'sin-categoria' || !p.team).length;

  // 1. DEPORTE DROPDOWN (CON OPCIÓN SIN CATEGORÍA)
  const uncatOption = uncatCount > 0 
    ? `<option value="sin-categoria" ${adminFilterSportKey === 'sin-categoria' ? 'selected' : ''}>⚠️ Sin Categoría / Pendientes (${uncatCount})</option>` 
    : `<option value="sin-categoria" ${adminFilterSportKey === 'sin-categoria' ? 'selected' : ''}>⚠️ Sin Categoría / Pendientes (0)</option>`;

  sportSelect.innerHTML = '<option value="">1. Selecciona Deporte...</option>' + 
    uncatOption +
    catalog.map(s => `<option value="${s.sportKey}" ${adminFilterSportKey === s.sportKey ? 'selected' : ''}>${s.icon} ${s.sport}</option>`).join('');

  // 2. LIGA DROPDOWN
  if (adminFilterSportKey && adminFilterSportKey !== 'sin-categoria') {
    const sportObj = catalog.find(s => s.sportKey === adminFilterSportKey);
    if (sportObj && sportObj.leagues.length > 0) {
      if (leagueWrapper) leagueWrapper.style.display = 'block';
      if (leagueSelect) {
        leagueSelect.innerHTML = '<option value="">2. Selecciona Liga...</option>' + 
          sportObj.leagues.map(l => `<option value="${l.league}" ${adminFilterLeagueName === l.league ? 'selected' : ''}>🏆 ${l.league}</option>`).join('');
      }
    } else {
      if (leagueWrapper) leagueWrapper.style.display = 'none';
    }
  } else {
    if (leagueWrapper) leagueWrapper.style.display = 'none';
  }

  // 3. EQUIPO DROPDOWN
  if (adminFilterSportKey && adminFilterLeagueName) {
    const sportObj = catalog.find(s => s.sportKey === adminFilterSportKey);
    const leagueObj = sportObj ? sportObj.leagues.find(l => l.league === adminFilterLeagueName) : null;

    if (leagueObj && leagueObj.teams.length > 0) {
      if (teamWrapper) teamWrapper.style.display = 'block';
      if (teamSelect) {
        teamSelect.innerHTML = '<option value="">3. Selecciona Equipo...</option>' + 
          leagueObj.teams.map(t => `<option value="${t.id}" ${adminFilterTeamId === t.id ? 'selected' : ''}>🛡️ ${t.name}</option>`).join('');
      }
    } else {
      if (teamWrapper) teamWrapper.style.display = 'none';
    }
  } else {
    if (teamWrapper) teamWrapper.style.display = 'none';
  }

  // 4. TIPO DROPDOWN
  if (adminFilterTeamId) {
    const categories = (typeof PRODUCT_CATEGORIES !== 'undefined') ? PRODUCT_CATEGORIES : [
      { id: "jerseys", label: "👕 Jerseys / Camisetas" },
      { id: "gorras", label: "🧢 Gorras / Caps" },
      { id: "chamarras", label: "🧥 Chamarras / Sudaderas" },
      { id: "balones", label: "🏈 Balones / Coleccionables" }
    ];

    if (categoryWrapper) categoryWrapper.style.display = 'block';
    if (categorySelect) {
      categorySelect.innerHTML = '<option value="">4. Selecciona Tipo (Todos)...</option>' + 
        categories.map(c => `<option value="${c.id}" ${adminFilterCategoryId === c.id ? 'selected' : ''}>${c.label}</option>`).join('');
    }
  } else {
    if (categoryWrapper) categoryWrapper.style.display = 'none';
  }

  // 5. GÉNERO DROPDOWN
  if (adminFilterCategoryId || adminFilterTeamId) {
    const genders = [
      { id: "caballero", label: "👨 Caballero" },
      { id: "dama", label: "👩 Dama" },
      { id: "nino", label: "🧒 Niño" },
      { id: "unisex", label: "🧢 Unisex" }
    ];

    if (genderWrapper) genderWrapper.style.display = 'block';
    if (genderSelect) {
      genderSelect.innerHTML = '<option value="">5. Selecciona Género (Todos)...</option>' + 
        genders.map(g => `<option value="${g.id}" ${adminFilterGenderId === g.id ? 'selected' : ''}>${g.label}</option>`).join('');
    }
  } else {
    if (genderWrapper) genderWrapper.style.display = 'none';
  }
}

window.onAdminFilterSportChange = function() {
  adminFilterShowAll = false;
  const val = document.getElementById('filterSportSelect')?.value;
  adminFilterSportKey = val || null;
  adminFilterLeagueName = null;
  adminFilterTeamId = null;
  adminFilterCategoryId = null;
  adminFilterGenderId = null;
  renderAdminCatalogSequenceNav();
  renderAdminProductsList(currentProducts);
};

window.onAdminFilterLeagueChange = function() {
  const val = document.getElementById('filterLeagueSelect')?.value;
  adminFilterLeagueName = val || null;
  adminFilterTeamId = null;
  adminFilterCategoryId = null;
  adminFilterGenderId = null;
  renderAdminCatalogSequenceNav();
  renderAdminProductsList(currentProducts);
};

window.onAdminFilterTeamChange = function() {
  const val = document.getElementById('filterTeamSelect')?.value;
  adminFilterTeamId = val || null;
  adminFilterCategoryId = null;
  adminFilterGenderId = null;
  renderAdminCatalogSequenceNav();
  renderAdminProductsList(currentProducts);
};

window.onAdminFilterCategoryChange = function() {
  const val = document.getElementById('filterCategorySelect')?.value;
  adminFilterCategoryId = val || null;
  renderAdminProductsList(currentProducts);
};

window.onAdminFilterGenderChange = function() {
  const val = document.getElementById('filterGenderSelect')?.value;
  adminFilterGenderId = val || null;
  renderAdminProductsList(currentProducts);
};

let adminFilterOnlyPending = false;

window.filterOnlyPendingCatalog = function() {
  adminFilterOnlyPending = true;
  adminFilterShowAll = false;
  adminFilterSportKey = null;
  adminFilterLeagueName = null;
  adminFilterTeamId = null;
  adminFilterCategoryId = null;
  adminFilterGenderId = null;
  switchAdminTab('manage');
  renderAdminCatalogSequenceNav();
  renderAdminProductsList(currentProducts);
};

window.resetAdminCatalogFilter = function() {
  adminFilterOnlyPending = false;
  adminFilterShowAll = true;
  adminFilterSportKey = null;
  adminFilterLeagueName = null;
  adminFilterTeamId = null;
  adminFilterCategoryId = null;
  adminFilterGenderId = null;
  if (document.getElementById('adminSearchInput')) document.getElementById('adminSearchInput').value = '';
  renderAdminCatalogSequenceNav();
  renderAdminProductsList(currentProducts);
};

// Admin Catalog Item Stock Tab Selector (Tienda vs Bodega)
const adminStockViewMap = {}; // productId -> 'tienda' | 'bodega'

window.toggleCardStockView = function(productId, mode) {
  adminStockViewMap[productId] = mode;
  const container = document.getElementById(`stockViewContainer_${productId}`);

  if (container) {
    const prod = currentProducts.find(p => p.id === productId);
    if (prod) {
      container.outerHTML = getUnifiedStockPillHtml(prod, mode);
    }
  }
};

function getUnifiedStockPillHtml(product, mode) {
  const sizeStockMap = product.sizeStockMap || [];
  const color = (mode === 'tienda') ? '#22c55e' : '#facc15';
  const label = (mode === 'tienda') ? '⚡ Tienda' : '🏢 Bodega';
  const otherMode = (mode === 'tienda') ? 'bodega' : 'tienda';
  
  let sizesHtml = '';
  if (sizeStockMap.length > 0) {
    const filteredRows = sizeStockMap.filter(s => {
      const qty = (mode === 'tienda') ? (s.immediateQty || 0) : (s.warehouseQty || 0);
      return qty > 0;
    });

    if (filteredRows.length === 0) {
      sizesHtml = `<span style="color: #777; font-size: 9px; padding: 0 4px;">Sin stock</span>`;
    } else {
      sizesHtml = filteredRows.map(s => {
        const qty = (mode === 'tienda') ? s.immediateQty : s.warehouseQty;
        return `
          <span style="border-left: 1px solid #333; padding-left: 4px; padding-right: 4px; color: #ddd; font-size: 9px;">
            ${s.size} <strong style="color: ${color};">${qty}</strong>
          </span>
        `;
      }).join('');
    }
  } else {
    sizesHtml = (product.sizes || []).map(s => `
      <span style="border-left: 1px solid #333; padding-left: 4px; padding-right: 4px; color: #aaa; font-size: 9px;">${s}</span>
    `).join('');
  }

  return `
    <div id="stockViewContainer_${product.id}" style="display: inline-flex; align-items: center; background: #000; border: 1px solid #333; border-radius: 6px; padding: 2px 4px; font-size: 9px; font-weight: 800; max-width: 100%; flex-wrap: wrap; gap: 2px;">
      <button type="button" onclick="toggleCardStockView('${product.id}', '${otherMode}')" style="background: ${color}; color: #000; border: none; border-radius: 4px; padding: 1px 5px; font-size: 9px; font-weight: 900; cursor: pointer;" title="Toca para cambiar de lugar">
        ${label} ⇄
      </button>
      ${sizesHtml}
    </div>
  `;
}

let adminFilterShowAll = false;

function renderAdminProductsList(products) {
  const list = document.getElementById('adminProductList');
  if (!list) return;

  const query = (document.getElementById('adminSearchInput')?.value || '').toLowerCase().trim();
  const catalog = window.SPORTS_CATALOG || SPORTS_CATALOG;
  
  // IF NO SPORT IS SELECTED, NO SEARCH QUERY ENTERED AND SHOW ALL IS FALSE AND NOT ONLY PENDING: DISPLAY ZERO PRODUCTS!
  if (!adminFilterSportKey && !query && !adminFilterShowAll && !adminFilterOnlyPending) {
    list.innerHTML = `
      <div style="padding: 24px; text-align: center; background: rgba(250, 204, 21, 0.04); border: 1px dashed var(--accent-color); border-radius: 12px; margin-top: 8px;">
        <div style="font-size: 28px; margin-bottom: 6px;">🎯</div>
        <div style="font-weight: 800; color: var(--accent-color); font-size: 14px;">Selecciona el Deporte en la lista desplegable de arriba</div>
        <p style="color: #aaa; font-size: 12px; margin-top: 4px; margin-bottom: 0;">
          Elige Deporte ➔ Liga ➔ Equipo para desplegar los artículos correspondientes.
        </p>
      </div>
    `;
    return;
  }

  let filtered = products;

  // Filter by Admin Pending or 5-Step Sequence Selector
  if (adminFilterOnlyPending) {
    filtered = filtered.filter(isProductPending);
  } else if (adminFilterSportKey === 'sin-categoria') {
    filtered = filtered.filter(isProductPending);
  } else if (adminFilterGenderId) {
    filtered = filtered.filter(p => (p.team === adminFilterTeamId || !adminFilterTeamId) && (p.category === adminFilterCategoryId || !adminFilterCategoryId) && p.gender === adminFilterGenderId);
  } else if (adminFilterCategoryId) {
    filtered = filtered.filter(p => (p.team === adminFilterTeamId || !adminFilterTeamId) && p.category === adminFilterCategoryId);
  } else if (adminFilterTeamId) {
    filtered = filtered.filter(p => p.team === adminFilterTeamId);
  } else if (adminFilterLeagueName) {
    const teamsInLeague = [];
    catalog.forEach(s => s.leagues.forEach(l => {
      if (l.league === adminFilterLeagueName) l.teams.forEach(t => teamsInLeague.push(t.id));
    }));
    filtered = filtered.filter(p => teamsInLeague.includes(p.team));
  } else if (adminFilterSportKey) {
    const teamsInSport = [];
    const sportObj = catalog.find(s => s.sportKey === adminFilterSportKey);
    if (sportObj) {
      sportObj.leagues.forEach(l => l.teams.forEach(t => teamsInSport.push(t.id)));
    }
    filtered = filtered.filter(p => teamsInSport.includes(p.team));
  }

  // Search Filter
  if (query) {
    filtered = filtered.filter(p => (p.name || '').toLowerCase().includes(query) || (p.team || '').toLowerCase().includes(query));
  }
  
  if (filtered.length === 0) {
    list.innerHTML = '<p class="text-secondary" style="padding: 16px; text-align: center; font-size: 12px;">No hay productos para esta selección. Toca otro equipo o "🌐 Ver Todo Sin Filtros".</p>';
    return;
  }
  
  list.innerHTML = filtered.map(product => {
    const isUncat = isProductPending(product);
    
    // Dedicated styling for Pending / Uncataloged items
    if (isUncat) {
      const seasonBadge = product.season ? `<span style="background: #7c3aed; color: #fff; font-size: 9px; font-weight: 800; padding: 1px 6px; border-radius: 4px;">📅 ${product.season}</span>` : '';
      return `
        <div style="display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: rgba(239, 68, 68, 0.08); border-radius: 10px; border: 1px solid #ef4444; margin-bottom: 6px;">
          <img src="${product.imageUrl}" style="width: 48px; height: 48px; object-fit: cover; border-radius: 6px; border: 1px solid #ef4444; flex-shrink: 0;" onerror="this.src='https://via.placeholder.com/100'">
          <div style="flex: 1; min-width: 0;">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 2px; flex-wrap: wrap;">
              <span style="background: #ef4444; color: #fff; font-size: 9px; font-weight: 900; padding: 2px 6px; border-radius: 4px;">⚠️ PENDIENTE INVENTARIO</span>
              ${seasonBadge}
              <span style="color: #fff; font-weight: 800; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${product.name}</span>
            </div>
            <div style="display: flex; gap: 6px; align-items: center; margin-top: 4px; flex-wrap: wrap;">
              <button class="btn" style="padding: 4px 10px; font-size: 11px; font-weight: 900; background: linear-gradient(135deg, #2563eb, #7c3aed); color: #fff; border: none; border-radius: 6px; cursor: pointer;" onclick="startEditingProduct('${product.id}')">
                📦 Poner Tallas e Inventario →
              </button>
              <button class="btn btn-outline" style="border-color: #ef4444; color: #ef4444; padding: 3px 8px; font-size: 11px; height: 24px; line-height: 1;" onclick="deleteProduct('${product.id}')" title="Eliminar">
                🗑️
              </button>
            </div>
          </div>
        </div>
      `;
    }

    let sportIcon = '🏈';
    let leagueName = 'NFL';
    let teamName = typeof getTeamName !== 'undefined' ? getTeamName(product.team) : product.team;

    for (const s of catalog) {
      for (const l of s.leagues) {
        if (l.teams.some(t => t.id === product.team)) {
          sportIcon = s.icon || '🏆';
          leagueName = l.league;
          break;
        }
      }
    }

    const genderLabel = typeof getGenderLabel !== 'undefined' ? getGenderLabel(product.gender) : '👨 Caballero';
    const cleanGenderText = genderLabel.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim();
    const activeViewMode = adminStockViewMap[product.id] || 'tienda';
    const unifiedPillHtml = getUnifiedStockPillHtml(product, activeViewMode);

    return `
      <div style="display: flex; align-items: center; gap: 8px; padding: 5px 8px; background: #111; border-radius: 8px; border: 1px solid #282828; margin-bottom: 3px;">
        
        <!-- FOTO MINIATURA (34px x 34px) -->
        <img src="${product.imageUrl}" style="width: 34px; height: 34px; object-fit: cover; border-radius: 5px; border: 1px solid var(--accent-color); flex-shrink: 0;" onerror="this.src='https://via.placeholder.com/100'">

        <!-- CONTENIDO EN 1 PÍLDORA UNIFICADA -->
        <div style="flex: 1; min-width: 0;">
          
          <!-- RENGLÓN 1: DEPORTE + EQUIPO — NOMBRE (GÉNERO) + BOTONES ACCIÓN -->
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px; margin-bottom: 2px;">
            <div style="font-size: 11px; font-weight: 800; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              <span style="color: var(--accent-color);">${sportIcon} ${teamName}</span>
              <span style="color: #555;">—</span>
              <span style="color: #fff; font-weight: 900;">${product.name}</span>
              <span style="color: #aaa; font-weight: 600; font-size: 10px; margin-left: 3px;">(${cleanGenderText})</span>
            </div>

            <!-- BOTONES EDITAR Y ELIMINAR (MICRO ICONOS) -->
            <div style="display: flex; align-items: center; gap: 3px; flex-shrink: 0;">
              <button class="btn btn-outline" style="padding: 1px 5px; font-size: 10px; border-color: var(--accent-color); color: var(--accent-color); height: 20px; line-height: 1;" onclick="startEditingProduct('${product.id}')" title="Editar">
                ✏️
              </button>
              <button class="btn btn-outline" style="border-color: #ef4444; color: #ef4444; padding: 1px 5px; font-size: 10px; height: 20px; line-height: 1;" onclick="deleteProduct('${product.id}')" title="Eliminar">
                🗑️
              </button>
            </div>
          </div>

          <!-- RENGLÓN 2: PÍLDORA UNIFICADA (UBICACIÓN + TODAS LAS TALLAS EN 1 SOLA PÍLDORA) -->
          <div style="display: flex; align-items: center;">
            ${unifiedPillHtml}
          </div>

        </div>

      </div>
    `;
  }).join('');
}

document.getElementById('adminSearchInput')?.addEventListener('input', () => {
  renderAdminProductsList(currentProducts);
});

// ============================================
// START EDITING PRODUCT DIRECTLY IN MAIN FORM
// ============================================
window.startEditingProduct = function(id) {
  const prod = currentProducts.find(p => p.id === id);
  if (!prod) return;

  switchAdminTab('single');

  document.getElementById('editingProductId').value = prod.id;
  document.getElementById('formTitle').textContent = `✏️ Editando: ${prod.name}`;
  document.getElementById('btnCancelEdit').style.display = 'inline-block';
  
  const btnSubmit = document.getElementById('btnSubmit');
  if (btnSubmit) btnSubmit.textContent = `💾 Guardar Cambios del Producto`;

  // Pre-fill Taxonomy Selects
  const catalog = window.SPORTS_CATALOG || SPORTS_CATALOG;
  let foundSportKey = null;
  let foundLeagueName = null;

  for (const s of catalog) {
    for (const l of s.leagues) {
      if (l.teams.some(t => t.id === prod.team)) {
        foundSportKey = s.sportKey;
        foundLeagueName = l.league;
        break;
      }
    }
  }

  if (foundSportKey) {
    document.getElementById('prodSport').value = foundSportKey;
    onAdminSportChange();
    if (foundLeagueName) {
      document.getElementById('prodLeague').value = foundLeagueName;
      onAdminLeagueChange();
      document.getElementById('prodTeam').value = prod.team;
    }
  } else {
    if (document.getElementById('prodSport')) document.getElementById('prodSport').value = '';
    onAdminSportChange();
  }

  // Pre-fill Searchable Team Text Input
  const teamDisplayName = (typeof getTeamName !== 'undefined' ? getTeamName(prod.team) : '') || prod.team || '';
  if (document.getElementById('prodTeamInput')) {
    document.getElementById('prodTeamInput').value = (prod.team === 'sin-categoria') ? '' : teamDisplayName;
  }
  if (document.getElementById('prodTeam')) {
    document.getElementById('prodTeam').value = prod.team || '';
  }

  // Pre-fill Season
  if (document.getElementById('prodSeason')) {
    document.getElementById('prodSeason').value = prod.season || '2024-2025';
  }

  // Pre-fill text inputs
  document.getElementById('prodName').value = prod.name || '';
  document.getElementById('prodDesc').value = prod.description || '';
  document.getElementById('prodGender').value = prod.gender || 'caballero';
  if (document.getElementById('prodCategory')) document.getElementById('prodCategory').value = prod.category || 'jerseys';
  document.getElementById('prodPrice').value = prod.price || '';
  document.getElementById('prodOriginalPrice').value = prod.originalPrice || '';
  if (document.getElementById('prodBadge')) document.getElementById('prodBadge').value = prod.badge || 'ninguno';

  // Pre-fill Image & Preview
  document.getElementById('prodImageUrlInput').value = prod.imageUrl || '';
  if (imagePreview) {
    imagePreview.src = prod.imageUrl || '';
    imagePreview.style.display = prod.imageUrl ? 'inline-block' : 'none';
  }
  selectedFile = null;

  // Pre-fill size stock rows - strictly initialized with 0
  if (prod.sizeStockMap && prod.sizeStockMap.length > 0) {
    currentSizeStockRows = JSON.parse(JSON.stringify(prod.sizeStockMap));
  } else if (prod.sizes && prod.sizes.length > 0) {
    currentSizeStockRows = prod.sizes.map(s => ({ size: s, immediateQty: 0, warehouseQty: 0 }));
  } else {
    currentSizeStockRows = [
      { size: "S", immediateQty: 0, warehouseQty: 0 },
      { size: "M", immediateQty: 0, warehouseQty: 0 },
      { size: "L", immediateQty: 0, warehouseQty: 0 },
      { size: "XL", immediateQty: 0, warehouseQty: 0 }
    ];
  }

  renderSizeStockRows();

  // Scroll smoothly up to form
  document.getElementById('singleUploadCard')?.scrollIntoView({ behavior: 'smooth' });
};

window.cancelEditMode = function() {
  document.getElementById('editingProductId').value = '';
  document.getElementById('formTitle').textContent = `➕ Publicar Nuevo Artículo`;
  document.getElementById('btnCancelEdit').style.display = 'none';

  const btnSubmit = document.getElementById('btnSubmit');
  if (btnSubmit) btnSubmit.textContent = `🔥 Publicar Producto`;

  document.getElementById('productForm').reset();
  if (imagePreview) imagePreview.style.display = 'none';
  selectedFile = null;
  onGenderSelectChange();
};

// Delete Product
window.deleteProduct = async function(id) {
  if (confirm('¿Estás seguro de que deseas eliminar este producto?')) {
    try {
      await db.collection('products').doc(id).delete();
      if (document.getElementById('editingProductId')?.value === id) {
        cancelEditMode();
      }
    } catch (error) {
      console.error("Error al eliminar producto:", error);
      alert("Hubo un error al eliminar. Intenta de nuevo.");
    }
  }
};

// Submit Product Form (Handles BOTH Creation & Updating)
document.getElementById('productForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const editingId = document.getElementById('editingProductId')?.value;
  const urlInput = document.getElementById('prodImageUrlInput').value.trim();
  
  if (!selectedFile && !urlInput && !editingId) {
    alert("Por favor selecciona un archivo de imagen o ingresa una URL");
    return;
  }
  
  if (currentSizeStockRows.length === 0) {
    alert("Por favor activa al menos 1 talla con sus existencias.");
    return;
  }

  const btnSubmit = document.getElementById('btnSubmit');
  const originalText = btnSubmit.textContent;
  
  btnSubmit.disabled = true;
  btnSubmit.textContent = editingId ? '⏳ Guardando cambios...' : '⏳ Publicando...';
  uploadStatus.style.color = '#fff';
  uploadStatus.textContent = 'Procesando producto...';
  
  try {
    const name = document.getElementById('prodName').value.trim();
    const teamInputVal = document.getElementById('prodTeamInput')?.value.trim();
    let team = document.getElementById('prodTeam')?.value;
    if (!team && teamInputVal) {
      team = teamInputVal.toLowerCase().replace(/[^a-z0-9]/g, '-');
    }
    if (!team) team = 'otros';
    const season = document.getElementById('prodSeason')?.value || '2024-2025';
    const gender = document.getElementById('prodGender').value;
    const category = document.getElementById('prodCategory').value;
    const badge = document.getElementById('prodBadge').value;
    const price = parseFloat(document.getElementById('prodPrice').value);
    const origPriceVal = document.getElementById('prodOriginalPrice').value;
    const originalPrice = origPriceVal ? parseFloat(origPriceVal) : null;
    const desc = document.getElementById('prodDesc').value.trim();
    
    let imageUrl = urlInput;
    if (selectedFile) {
      uploadStatus.textContent = 'Optimizando imagen...';
      imageUrl = await resizeImage(selectedFile, 800, 800);
    }
    
    uploadStatus.textContent = 'Guardando en catálogo...';
    const sizesArray = currentSizeStockRows.map(s => s.size);

    const productPayload = {
      name,
      team,
      season,
      gender,
      category,
      badge,
      price,
      originalPrice,
      isPendingInventory: false,
      sizeStockMap: currentSizeStockRows.map(r => ({
        size: r.size,
        immediateQty: Math.max(0, parseInt(r.immediateQty, 10) || 0),
        warehouseQty: Math.max(0, parseInt(r.warehouseQty, 10) || 0)
      })),
      sizes: sizesArray,
      description: desc
    };

    if (imageUrl) {
      productPayload.imageUrl = imageUrl;
    }

    if (editingId) {
      // UPDATE EXISTING PRODUCT
      await db.collection('products').doc(editingId).update(productPayload);
      uploadStatus.style.color = '#4ade80';
      uploadStatus.textContent = '✅ ¡Cambios del producto guardados exitosamente!';
      cancelEditMode();
    } else {
      // CREATE NEW PRODUCT
      productPayload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('products').add(productPayload);
      uploadStatus.style.color = '#4ade80';
      uploadStatus.textContent = '✅ ¡Producto publicado exitosamente con existencias exactas por talla!';
      
      document.getElementById('productForm').reset();
      imagePreview.style.display = 'none';
      selectedFile = null;
      onGenderSelectChange();
    }
    
    setTimeout(() => {
      uploadStatus.textContent = '';
      btnSubmit.disabled = false;
      btnSubmit.textContent = originalText;
    }, 3000);
    
  } catch (error) {
    console.error('Error saving product:', error);
    uploadStatus.style.color = '#ff6b6b';
    uploadStatus.textContent = '❌ Error al guardar: ' + error.message;
    btnSubmit.disabled = false;
    btnSubmit.textContent = originalText;
  }
});

// ============================================
// GESTIÓN DE PEDIDOS, LOGÍSTICA & VENDEDORES
// ============================================
let allOrdersList = [];
let currentOrdersFilter = 'all';
let currentOrdersSearch = '';
let currentOrdersSubView = 'orders'; // 'orders' | 'sellers'
let currentSelectedSeller = 'beto'; // 'beto' | 'arturo' | 'elena' | 'web'

window.switchOrdersSubView = function(subView) {
  currentOrdersSubView = subView;
  const ordersSub = document.getElementById('ordersMainSubView');
  const sellersSub = document.getElementById('sellersSubView');
  const btnOrders = document.getElementById('subViewOrdersBtn');
  const btnSellers = document.getElementById('subViewSellersBtn');

  if (subView === 'orders') {
    if (ordersSub) ordersSub.style.display = 'block';
    if (sellersSub) sellersSub.style.display = 'none';
    if (btnOrders) { btnOrders.classList.add('active'); btnOrders.classList.remove('btn-outline'); }
    if (btnSellers) { btnSellers.classList.remove('active'); btnSellers.classList.add('btn-outline'); }
    renderOrdersList();
  } else {
    if (ordersSub) ordersSub.style.display = 'none';
    if (sellersSub) sellersSub.style.display = 'block';
    if (btnOrders) { btnOrders.classList.remove('active'); btnOrders.classList.add('btn-outline'); }
    if (btnSellers) { btnSellers.classList.add('active'); btnSellers.classList.remove('btn-outline'); }
    renderSellerStats();
  }
};

window.selectSellerTab = function(seller) {
  currentSelectedSeller = seller;
  ['beto', 'arturo', 'elena', 'web'].forEach(s => {
    const btn = document.getElementById(`btnSeller${s.charAt(0).toUpperCase() + s.slice(1)}`);
    if (btn) {
      if (s === seller) {
        btn.classList.add('active');
        btn.classList.remove('btn-outline');
      } else {
        btn.classList.remove('active');
        btn.classList.add('btn-outline');
      }
    }
  });

  const titleSpan = document.getElementById('sellerNameTitle');
  if (titleSpan) {
    const names = { beto: 'Beto', arturo: 'Arturo', elena: 'Elena', web: 'Venta Web Online' };
    titleSpan.textContent = names[seller] || seller;
  }

  renderSellerStats();
};

window.loadAdminOrders = function() {
  const container = document.getElementById('ordersListContainer');
  if (!window.db) {
    if (container) container.innerHTML = '<div style="text-align:center; padding:20px; color:#ef4444;">Sin conexión a Firestore</div>';
    return;
  }

  db.collection('orders').orderBy('createdAt', 'desc').onSnapshot((snapshot) => {
    allOrdersList = [];
    snapshot.forEach(doc => {
      allOrdersList.push({ id: doc.id, ...doc.data() });
    });
    updateOrdersKPICounters();
    if (currentOrdersSubView === 'sellers') {
      renderSellerStats();
    } else {
      renderOrdersList();
    }
  }, (err) => {
    console.error("Error loading orders:", err);
    if (container) container.innerHTML = `<div style="text-align:center; padding:20px; color:#ef4444;">Error al cargar pedidos: ${err.message}</div>`;
  });
};

function updateOrdersKPICounters() {
  const pendingCount = allOrdersList.filter(o => o.status === 'pending' || !o.status).length;
  const readyCount = allOrdersList.filter(o => o.status === 'ready').length;
  const transitCount = allOrdersList.filter(o => o.status === 'transit').length;
  const deliveredCount = allOrdersList.filter(o => o.status === 'delivered').length;

  let totalRev = 0;
  allOrdersList.forEach(o => {
    if (o.status !== 'cancelled') {
      totalRev += (Number(o.totalAmount) || 0);
    }
  });

  const badge = document.getElementById('ordersBadgeCount');
  if (badge) {
    if (pendingCount > 0) {
      badge.style.display = 'inline-block';
      badge.textContent = `${pendingCount}`;
    } else {
      badge.style.display = 'none';
    }
  }

  const kpiPending = document.getElementById('kpiPendingOrders');
  if (kpiPending) kpiPending.textContent = pendingCount;

  const kpiReady = document.getElementById('kpiReadyOrders');
  if (kpiReady) kpiReady.textContent = readyCount;

  const kpiTransit = document.getElementById('kpiTransitOrders');
  if (kpiTransit) kpiTransit.textContent = transitCount;

  const kpiDelivered = document.getElementById('kpiDeliveredOrders');
  if (kpiDelivered) kpiDelivered.textContent = deliveredCount;

  const kpiRev = document.getElementById('kpiTotalRevenue');
  if (kpiRev) kpiRev.textContent = `$${totalRev.toLocaleString('es-MX')}`;

  const cAll = document.getElementById('countOrdAll');
  if (cAll) cAll.textContent = allOrdersList.length;

  const cPending = document.getElementById('countOrdPending');
  if (cPending) cPending.textContent = pendingCount;

  const cReady = document.getElementById('countOrdReady');
  if (cReady) cReady.textContent = readyCount;

  const cTransit = document.getElementById('countOrdTransit');
  if (cTransit) cTransit.textContent = transitCount;

  const cDelivered = document.getElementById('countOrdDelivered');
  if (cDelivered) cDelivered.textContent = deliveredCount;
}

window.filterOrdersByStatus = function(status) {
  currentOrdersFilter = status;
  
  const buttons = document.querySelectorAll('#orderFilterButtons button');
  buttons.forEach(btn => btn.classList.remove('active'));

  if (status === 'all') document.getElementById('btnFilterOrdAll')?.classList.add('active');
  else if (status === 'pending') document.getElementById('btnFilterOrdPending')?.classList.add('active');
  else if (status === 'ready') document.getElementById('btnFilterOrdReady')?.classList.add('active');
  else if (status === 'transit') document.getElementById('btnFilterOrdTransit')?.classList.add('active');
  else if (status === 'delivered') document.getElementById('btnFilterOrdDelivered')?.classList.add('active');
  else if (status === 'cancelled') document.getElementById('btnFilterOrdCancelled')?.classList.add('active');

  renderOrdersList();
};

window.onOrdersSearchInput = function(val) {
  currentOrdersSearch = (val || '').toLowerCase().trim();
  renderOrdersList();
};

function renderOrdersList() {
  const container = document.getElementById('ordersListContainer');
  if (!container) return;

  let filtered = allOrdersList;

  if (currentOrdersFilter !== 'all') {
    if (currentOrdersFilter === 'pending') {
      filtered = filtered.filter(o => o.status === 'pending' || !o.status);
    } else {
      filtered = filtered.filter(o => o.status === currentOrdersFilter);
    }
  }

  if (currentOrdersSearch) {
    filtered = filtered.filter(o => {
      const name = (o.customerName || '').toLowerCase();
      const phone = (o.customerPhone || '').toLowerCase();
      const id = (o.id || '').toLowerCase();
      const address = (o.address || '').toLowerCase();
      const seller = (o.seller || '').toLowerCase();
      return name.includes(currentOrdersSearch) || phone.includes(currentOrdersSearch) || id.includes(currentOrdersSearch) || address.includes(currentOrdersSearch) || seller.includes(currentOrdersSearch);
    });
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px 20px; background: rgba(0,0,0,0.3); border-radius: 12px; border: 1px dashed #444;">
        <div style="font-size: 32px; margin-bottom: 8px;">📦</div>
        <div style="font-size: 14px; font-weight: 700; color: #aaa;">No hay pedidos en esta sección</div>
        <p style="font-size: 11px; color: #666; margin-top: 4px;">Cuando un cliente compre en la tienda o registres una venta, aparecerá aquí.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(order => renderSingleOrderCard(order)).join('');
}

function renderSingleOrderCard(order) {
  const orderId = order.id;
  const shortId = orderId.slice(0, 7).toUpperCase();
  const dateStr = order.createdAt?.toDate ? order.createdAt.toDate().toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }) : 'Recién recibido';

  const st = order.status || 'pending';
  let statusBadge = '';
  if (st === 'pending') {
    statusBadge = `<span style="background: rgba(234, 179, 8, 0.2); border: 1px solid #eab308; color: #eab308; font-size: 11px; font-weight: 900; padding: 4px 10px; border-radius: 20px;">🟡 Por Surtir en Bodega</span>`;
  } else if (st === 'ready') {
    statusBadge = `<span style="background: rgba(56, 189, 248, 0.2); border: 1px solid #38bdf8; color: #38bdf8; font-size: 11px; font-weight: 900; padding: 4px 10px; border-radius: 20px;">📦 Surtido de Bodega (Listo)</span>`;
  } else if (st === 'transit') {
    statusBadge = `<span style="background: rgba(168, 85, 247, 0.2); border: 1px solid #a855f7; color: #a855f7; font-size: 11px; font-weight: 900; padding: 4px 10px; border-radius: 20px;">🚚 En Ruta / Reparto</span>`;
  } else if (st === 'delivered') {
    statusBadge = `<span style="background: rgba(34, 197, 94, 0.2); border: 1px solid #22c55e; color: #22c55e; font-size: 11px; font-weight: 900; padding: 4px 10px; border-radius: 20px;">🟢 Entregado y Finalizado</span>`;
  } else if (st === 'cancelled') {
    statusBadge = `<span style="background: rgba(239, 68, 68, 0.2); border: 1px solid #ef4444; color: #ef4444; font-size: 11px; font-weight: 900; padding: 4px 10px; border-radius: 20px;">🔴 Cancelado</span>`;
  }

  // Payment Status & Abonos Breakdown
  const orderTotal = Number(order.totalAmount || 0);
  const orderPaid = Number(order.paidAmount || (order.paymentStatus === 'paid' || st === 'delivered' ? orderTotal : 0));
  const orderRemaining = Math.max(0, orderTotal - orderPaid);
  const isPaid = orderRemaining === 0;

  let paymentBadge = '';
  if (isPaid) {
    paymentBadge = `<span style="background: rgba(34, 197, 94, 0.2); border: 1px solid #22c55e; color: #22c55e; font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 12px; display: inline-flex; align-items: center; gap: 4px;">🟢 Pagado / Liquidado</span>`;
  } else if (orderPaid > 0) {
    paymentBadge = `<span style="background: rgba(234, 179, 8, 0.2); border: 1px solid #eab308; color: #eab308; font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 12px; display: inline-flex; align-items: center; gap: 4px;">🟡 Abono: $${orderPaid.toLocaleString('es-MX')} · Restan: $${orderRemaining.toLocaleString('es-MX')}</span>`;
  } else {
    paymentBadge = `<span style="background: rgba(239, 68, 68, 0.2); border: 1px solid #ef4444; color: #ef4444; font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 12px; display: inline-flex; align-items: center; gap: 4px;">🔴 Sin Pagar ($${orderRemaining.toLocaleString('es-MX')})</span>`;
  }

  // Seller Label
  const sellerKey = order.seller || 'beto';
  const sellerNames = { beto: '👤 Beto', arturo: '👤 Arturo', elena: '👤 Elena', web: '🌐 Tienda Web' };
  const sellerDisplay = sellerNames[sellerKey] || `👤 ${sellerKey}`;

  const cleanPhone = (order.customerPhone || '').replace(/[^0-9]/g, '');
  const waStatusMsg = encodeURIComponent(`¡Hola ${order.customerName || 'Cliente'}! Te contactamos de DXT Sports QRO. Tu pedido #${shortId} tiene el estatus: ${st === 'pending' ? 'En Preparación' : (st === 'ready' ? 'Listo para entrega' : (st === 'transit' ? 'En ruta con repartidor' : 'Entregado'))}. Saldo: ${isPaid ? 'Totalmente Pagado' : '$' + Number(order.totalAmount || 0).toLocaleString('es-MX') + ' (Pendiente de Cobro)'}. Quedamos atentos 🏈🔥`);
  const waUrl = cleanPhone ? `https://wa.me/52${cleanPhone.length === 10 ? cleanPhone : cleanPhone.replace(/^52/, '')}?text=${waStatusMsg}` : '#';

  const isPickup = order.deliveryMethod === 'pickup';
  const deliveryLabel = isPickup ? '📍 Entrega Personal / Mostrador QRO' : `🏠 Envío a Domicilio: ${order.address || 'Querétaro'}`;

  const items = order.items || [];
  const itemsHtml = items.map((item, idx) => {
    const itemImg = item.image || item.imageUrl || 'assets/dxt_logo.png';
    const isPicked = item.isPicked || (st !== 'pending' && st !== 'cancelled');
    return `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px; background: rgba(0,0,0,0.4); border-radius: 8px; border: 1px solid #333; margin-bottom: 6px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <img src="${itemImg}" style="width: 44px; height: 44px; object-fit: contain; background: #111; border-radius: 6px; border: 1px solid #444;">
          <div>
            <div style="font-size: 12px; font-weight: 800; color: #fff;">${item.name || 'Jersey Deportivo'}</div>
            <div style="font-size: 11px; color: #aaa;">
              Talla: <b style="color: #38bdf8;">${item.size || 'Unitalla'}</b> · Cantidad: <b>${item.qty || 1} pza(s)</b> · Precio: $${Number(item.price || 0).toLocaleString('es-MX')}
            </div>
          </div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 13px; font-weight: 900; color: #22c55e;">$${((Number(item.price || 0)) * (Number(item.qty || 1))).toLocaleString('es-MX')}</div>
          <button type="button" onclick="toggleOrderItemPicked('${orderId}', ${idx})" style="background: none; border: none; font-size: 10px; cursor: pointer; color: ${isPicked ? '#22c55e' : '#eab308'}; font-weight: bold;">
            ${isPicked ? '✅ En Paquete' : '📦 Recoger en Bodega'}
          </button>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div style="background: #181c24; border: 1px solid #2d3748; border-radius: 12px; padding: 14px; box-shadow: 0 4px 16px rgba(0,0,0,0.4);">
      
      <!-- CARD TOP HEADER -->
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; border-bottom: 1px solid #2d3748; padding-bottom: 8px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 13px; font-weight: 900; color: var(--accent-color);">#${shortId}</span>
          <span style="font-size: 11px; color: #777;">📅 ${dateStr}</span>
          <span style="background: rgba(168, 85, 247, 0.15); border: 1px solid #a855f7; color: #c084fc; font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 10px;">
            ${sellerDisplay}
          </span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          ${paymentBadge}
          ${statusBadge}
        </div>
      </div>

      <!-- CUSTOMER INFO & DELIVERY -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 10px; margin-bottom: 12px; background: rgba(0,0,0,0.25); padding: 10px; border-radius: 8px;">
        <div>
          <div style="font-size: 10px; font-weight: 800; color: #888; text-transform: uppercase;">Cliente:</div>
          <div style="font-size: 13px; font-weight: 800; color: #fff;">${order.customerName || 'Cliente DXT'}</div>
          <div style="font-size: 11px; color: #aaa; margin-top: 2px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
            <span>📞 ${order.customerPhone || 'Sin teléfono'}</span>
            ${cleanPhone ? `<a href="${waUrl}" target="_blank" style="display: inline-flex; align-items: center; gap: 4px; background: #22c55e; color: #000; font-size: 10px; font-weight: 900; padding: 2px 8px; border-radius: 12px; text-decoration: none;">📲 Notificar WhatsApp</a>` : ''}
          </div>
        </div>
        <div>
          <div style="font-size: 10px; font-weight: 800; color: #888; text-transform: uppercase;">Entrega:</div>
          <div style="font-size: 12px; font-weight: 700; color: #38bdf8;">${deliveryLabel}</div>
        </div>
      </div>

      <!-- ITEMS LIST -->
      <div style="margin-bottom: 12px;">
        <div style="font-size: 11px; font-weight: 800; color: #a855f7; margin-bottom: 6px; text-transform: uppercase;">
          👕 Artículos a Entregar (${items.length}):
        </div>
        ${itemsHtml}
      </div>

      <!-- CARD FOOTER: TOTAL & ACTIONS -->
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; border-top: 1px solid #2d3748; padding-top: 10px;">
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          <div>
            <span style="font-size: 11px; color: #888;">TOTAL:</span>
            <span style="font-size: 18px; font-weight: 900; color: #22c55e; margin-left: 4px;">$${Number(order.totalAmount || 0).toLocaleString('es-MX')}</span>
          </div>
          <button type="button" onclick="openEditPaymentModal('${orderId}')" class="btn btn-outline" style="font-size: 10px; padding: 4px 8px; border-color: ${isPaid ? '#22c55e' : '#eab308'}; color: ${isPaid ? '#22c55e' : '#eab308'};">
            💵 ${isPaid ? '✓ Liquidado' : '⚡ Cobrar / Validar'}
          </button>
          ${order.transferProof ? `
            <button type="button" onclick="viewTransferProof('${order.transferProof}')" class="btn btn-outline" style="font-size: 10px; padding: 4px 8px; border-color: #38bdf8; color: #38bdf8;">
              📸 Comprobante
            </button>
          ` : ''}
        </div>

        <!-- STATUS TRANSITION BUTTONS -->
        <div style="display: flex; gap: 6px; flex-wrap: wrap;">
          ${st === 'pending' ? `
            <button type="button" onclick="updateOrderStatus('${orderId}', 'ready')" class="btn" style="background: #38bdf8; color: #000; font-size: 11px; font-weight: 800; padding: 6px 12px; border: none; border-radius: 6px; cursor: pointer;">
              📦 Marcar Surtido →
            </button>
          ` : ''}
          ${st === 'ready' ? `
            <button type="button" onclick="updateOrderStatus('${orderId}', 'transit')" class="btn" style="background: #a855f7; color: #fff; font-size: 11px; font-weight: 800; padding: 6px 12px; border: none; border-radius: 6px; cursor: pointer;">
              🚚 Enviar a Reparto →
            </button>
          ` : ''}
          ${st === 'transit' || st === 'ready' ? `
            <button type="button" onclick="updateOrderStatus('${orderId}', 'delivered')" class="btn btn-whatsapp" style="font-size: 11px; font-weight: 900; padding: 6px 12px;">
              🟢 Marcar Entregado ✓
            </button>
          ` : ''}
          ${st !== 'delivered' && st !== 'cancelled' ? `
            <button type="button" onclick="cancelOrder('${orderId}')" class="btn btn-outline" style="font-size: 11px; padding: 6px 10px; border-color: #ef4444; color: #ef4444;">
              ✕ Cancelar
            </button>
          ` : ''}
          <button type="button" onclick="deleteOrder('${orderId}')" class="btn btn-outline" style="font-size: 11px; padding: 6px 8px; border-color: #444; color: #777;">
            🗑️
          </button>
        </div>

      </div>

    </div>
  `;
}

// ============================================
// CONTROL POR VENDEDOR: BETO, ARTURO, ELENA
// ============================================
function renderSellerStats() {
  const container = document.getElementById('sellerJerseysListContainer');
  if (!container) return;

  const sellerOrders = allOrdersList.filter(o => {
    if (o.status === 'cancelled') return false;
    const s = o.seller || 'beto';
    return s === currentSelectedSeller;
  });

  const sellerJerseys = [];
  let totalJerseysCount = 0;
  let paidJerseysCount = 0;
  let pendingJerseysCount = 0;
  let totalSellerAmount = 0;
  let paidSellerAmount = 0;
  let pendingSellerAmount = 0;

  sellerOrders.forEach(o => {
    const orderTotal = Number(o.totalAmount || 0);
    const orderPaid = Number(o.paidAmount || (o.paymentStatus === 'paid' || o.status === 'delivered' ? orderTotal : 0));
    const orderRemaining = Math.max(0, orderTotal - orderPaid);

    totalSellerAmount += orderTotal;
    paidSellerAmount += orderPaid;
    pendingSellerAmount += orderRemaining;

    const isOrderFullyPaid = orderRemaining === 0;

    (o.items || []).forEach((item, idx) => {
      const qty = Number(item.qty || 1);
      const price = Number(item.price || 0);
      const itemSubtotal = qty * price;
      totalJerseysCount += qty;

      if (isOrderFullyPaid) {
        paidJerseysCount += qty;
      } else {
        pendingJerseysCount += qty;
      }

      sellerJerseys.push({
        orderId: o.id,
        shortId: o.id.slice(0, 7).toUpperCase(),
        itemIndex: idx,
        name: item.name || 'Jersey Deportivo',
        size: item.size || 'Unitalla',
        qty: qty,
        price: price,
        subtotal: itemSubtotal,
        orderTotal: orderTotal,
        orderPaid: orderPaid,
        orderRemaining: orderRemaining,
        image: item.image || item.imageUrl || 'assets/dxt_logo.png',
        customerName: o.customerName || 'Cliente',
        customerPhone: o.customerPhone || '',
        orderStatus: o.status || 'pending',
        isPaid: isOrderFullyPaid
      });
    });
  });

  // Update KPI counters
  const kpiTotJ = document.getElementById('sellerKpiTotalJerseys');
  const kpiPaidJ = document.getElementById('sellerKpiPaidJerseys');
  const kpiPaidAmt = document.getElementById('sellerKpiPaidAmount');
  const kpiPendJ = document.getElementById('sellerKpiPendingJerseys');
  const kpiPendAmt = document.getElementById('sellerKpiPendingAmount');
  const kpiTotAmt = document.getElementById('sellerKpiTotalAmount');

  if (kpiTotJ) kpiTotJ.textContent = `${totalJerseysCount} pzas`;
  if (kpiPaidJ) kpiPaidJ.textContent = `${paidJerseysCount} pzas`;
  if (kpiPaidAmt) kpiPaidAmt.textContent = `$${paidSellerAmount.toLocaleString('es-MX')} MXN`;
  if (kpiPendJ) kpiPendJ.textContent = `${pendingJerseysCount} pzas`;
  if (kpiPendAmt) kpiPendAmt.textContent = `$${pendingSellerAmount.toLocaleString('es-MX')} MXN por cobrar`;
  if (kpiTotAmt) kpiTotAmt.textContent = `$${totalSellerAmount.toLocaleString('es-MX')} MXN`;

  if (sellerJerseys.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 30px; color: #777;">
        <div style="font-size: 28px; margin-bottom: 6px;">👕</div>
        <div style="font-size: 13px; font-weight: 700; color: #aaa;">No hay jerseys registrados para este vendedor aún</div>
        <p style="font-size: 11px; color: #666; margin-top: 4px;">Al registrar una venta manual o comprar en la tienda con este vendedor, se desglosará aquí.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = sellerJerseys.map(j => {
    const cleanPhone = j.customerPhone.replace(/[^0-9]/g, '');
    const reminderMsg = encodeURIComponent(`¡Hola ${j.customerName}! Te saludo de DXT Sports QRO respecto a tu jersey ${j.name} (Talla ${j.size}). Te recuerdo que tienes un saldo restante de $${j.orderRemaining.toLocaleString('es-MX')} MXN (Abonado: $${j.orderPaid.toLocaleString('es-MX')} / Total: $${j.orderTotal.toLocaleString('es-MX')}). ¿A qué hora te acomoda la entrega / liquidación? 🏈🔥`);
    const waReminderUrl = cleanPhone ? `https://wa.me/52${cleanPhone.length === 10 ? cleanPhone : cleanPhone.replace(/^52/, '')}?text=${reminderMsg}` : '#';

    return `
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; background: #14171f; border: 1px solid ${j.isPaid ? '#22c55e44' : '#eab30844'}; border-radius: 8px; padding: 10px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <img src="${j.image}" style="width: 44px; height: 44px; object-fit: contain; background: #000; border-radius: 6px; border: 1px solid #333;">
          <div>
            <div style="font-size: 12px; font-weight: 800; color: #fff;">${j.name}</div>
            <div style="font-size: 11px; color: #aaa;">
              Talla: <b style="color: #38bdf8;">${j.size}</b> · Cantidad: <b>${j.qty} pza(s)</b> · Total: <b style="color: #fff;">$${j.subtotal.toLocaleString('es-MX')}</b>
            </div>
            <div style="font-size: 10px; color: #777; margin-top: 2px;">
              👤 Cliente: <b style="color: #ddd;">${j.customerName}</b> (${j.customerPhone || 'Sin tel'}) · Pedido: #${j.shortId}
            </div>
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          ${j.isPaid ? `
            <span style="background: rgba(34, 197, 94, 0.15); border: 1px solid #22c55e; color: #22c55e; font-size: 10px; font-weight: 800; padding: 3px 8px; border-radius: 12px;">
              🟢 Pagado Completo ($${j.orderTotal.toLocaleString('es-MX')})
            </span>
          ` : `
            <span style="background: rgba(234, 179, 8, 0.15); border: 1px solid #eab308; color: #eab308; font-size: 10px; font-weight: 800; padding: 3px 8px; border-radius: 12px;">
              🟡 Restan: $${j.orderRemaining.toLocaleString('es-MX')} ${j.orderPaid > 0 ? `(Abono: $${j.orderPaid.toLocaleString('es-MX')})` : ''}
            </span>
          `}
          
          <button type="button" onclick="openEditPaymentModal('${j.orderId}')" class="btn" style="background: #22c55e; color: #000; font-size: 10px; font-weight: 900; padding: 5px 10px; border: none; border-radius: 6px; cursor: pointer;">
            💵 ${j.isPaid ? 'Ver Pagos' : 'Abonar / Liquidar'}
          </button>
          
          ${!j.isPaid && cleanPhone ? `
            <a href="${waReminderUrl}" target="_blank" class="btn btn-outline" style="font-size: 10px; padding: 4px 8px; border-color: #22c55e; color: #22c55e; text-decoration: none;">
              💬 Cobrar WhatsApp
            </a>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// ============================================
// MODAL: REGISTRAR ABONOS, PAGOS Y LIQUIDACIÓN
// ============================================
let currentEditingOrderId = null;
let currentEditingOrderRemaining = 0;

window.openEditPaymentModal = function(orderId) {
  const order = allOrdersList.find(o => o.id === orderId);
  if (!order) return;

  currentEditingOrderId = orderId;
  const modal = document.getElementById('editPaymentModal');
  const folioEl = document.getElementById('payModalOrderFolio');
  const custEl = document.getElementById('payModalCustomer');
  const totalEl = document.getElementById('payModalTotalAmount');
  const paidEl = document.getElementById('payModalPaidAmount');
  const remainingEl = document.getElementById('payModalRemainingAmount');
  const abonoInput = document.getElementById('payModalAbonoAmount');
  const historyContainer = document.getElementById('payModalHistoryList');

  const totalAmount = Number(order.totalAmount || 0);
  const paidAmount = Number(order.paidAmount || (order.paymentStatus === 'paid' || order.status === 'delivered' ? totalAmount : 0));
  const remainingAmount = Math.max(0, totalAmount - paidAmount);
  currentEditingOrderRemaining = remainingAmount;

  if (folioEl) folioEl.textContent = '#' + orderId.slice(0, 7).toUpperCase();
  if (custEl) custEl.textContent = order.customerName || 'Cliente';
  if (totalEl) totalEl.textContent = `$${totalAmount.toLocaleString('es-MX')} MXN`;
  if (paidEl) paidEl.textContent = `$${paidAmount.toLocaleString('es-MX')} MXN`;
  if (remainingEl) remainingEl.textContent = `$${remainingAmount.toLocaleString('es-MX')} MXN`;

  if (abonoInput) {
    abonoInput.value = remainingAmount > 0 ? remainingAmount : '';
    abonoInput.placeholder = remainingAmount > 0 ? `Ej. ${Math.min(500, remainingAmount)}` : '0';
  }

  // Render previous payment installments history
  if (historyContainer) {
    const history = order.paymentsHistory || [];
    if (history.length === 0) {
      if (paidAmount > 0) {
        historyContainer.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(34,197,94,0.1); border: 1px solid #22c55e44; border-radius: 6px; padding: 6px 10px; font-size: 11px;">
            <div>
              <div style="color: #fff; font-weight: bold;">Pago Inicial Registrado</div>
              <div style="color: #888; font-size: 10px;">Liquidado al momento de la orden</div>
            </div>
            <div style="color: #22c55e; font-weight: 900; font-size: 12px;">+$${paidAmount.toLocaleString('es-MX')} MXN</div>
          </div>
        `;
      } else {
        historyContainer.innerHTML = '<div style="font-size: 11px; color: #666; text-align: center; padding: 10px;">Sin abonos registrados aún</div>';
      }
    } else {
      historyContainer.innerHTML = history.map(h => `
        <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.5); border: 1px solid #333; border-radius: 6px; padding: 6px 10px; font-size: 11px;">
          <div>
            <div style="color: #fff; font-weight: 800;">📅 ${h.dateStr || 'Reciente'} · ${h.method || 'Efectivo'}</div>
            <div style="color: #888; font-size: 10px;">${h.note || 'Abono'} · Restante tras abono: <b style="color: #eab308;">$${Number(h.remainingAfter || 0).toLocaleString('es-MX')}</b></div>
          </div>
          <div style="color: #22c55e; font-weight: 900; font-size: 13px;">+$${Number(h.amount || 0).toLocaleString('es-MX')}</div>
        </div>
      `).join('');
    }
  }

  if (modal) modal.classList.add('active');
};

window.closeEditPaymentModal = () => document.getElementById('editPaymentModal')?.classList.remove('active');

window.setQuickAbono = function(amount) {
  const abonoInput = document.getElementById('payModalAbonoAmount');
  if (abonoInput) {
    abonoInput.value = currentEditingOrderRemaining > 0 ? Math.min(amount, currentEditingOrderRemaining) : amount;
  }
};

window.setQuickAbonoFull = function() {
  const abonoInput = document.getElementById('payModalAbonoAmount');
  if (abonoInput) {
    abonoInput.value = currentEditingOrderRemaining;
  }
};

window.submitNewPaymentAbono = async function(e) {
  e.preventDefault();
  if (!currentEditingOrderId || !window.db) return;

  const order = allOrdersList.find(o => o.id === currentEditingOrderId);
  if (!order) return;

  const abonoInput = document.getElementById('payModalAbonoAmount');
  const abonoAmount = Number(abonoInput?.value || 0);
  const method = document.getElementById('payModalMethod')?.value || 'Efectivo';
  const note = document.getElementById('payModalNote')?.value.trim() || 'Abono a cuenta';

  if (abonoAmount <= 0) {
    alert("Por favor ingresa un monto de abono mayor a $0.");
    return;
  }

  const totalAmount = Number(order.totalAmount || 0);
  const currentPaid = Number(order.paidAmount || (order.paymentStatus === 'paid' || order.status === 'delivered' ? totalAmount : 0));
  const newPaidAmount = Math.min(totalAmount, currentPaid + abonoAmount);
  const remaining = Math.max(0, totalAmount - newPaidAmount);

  let newPaymentStatus = 'partial';
  if (remaining === 0 || newPaidAmount >= totalAmount) {
    newPaymentStatus = 'paid';
  } else if (newPaidAmount === 0) {
    newPaymentStatus = 'pending';
  }

  const newHistoryEntry = {
    amount: abonoAmount,
    dateStr: new Date().toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }),
    timestamp: Date.now(),
    method: method,
    note: note,
    remainingAfter: remaining
  };

  try {
    await db.collection('orders').doc(currentEditingOrderId).update({
      paidAmount: newPaidAmount,
      paymentStatus: newPaymentStatus,
      paymentsHistory: firebase.firestore.FieldValue.arrayUnion(newHistoryEntry),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    closeEditPaymentModal();

    const shortId = currentEditingOrderId.slice(0, 7).toUpperCase();
    const cleanPhone = (order.customerPhone || '').replace(/[^0-9]/g, '');
    const waReceipt = encodeURIComponent(`¡Hola ${order.customerName || 'Cliente'}! En DXT Sports QRO registramos tu abono de $${abonoAmount.toLocaleString('es-MX')} MXN (${method}) para tu pedido #${shortId}.\n• Total Pedido: $${totalAmount.toLocaleString('es-MX')} MXN\n• Total Abonado: $${newPaidAmount.toLocaleString('es-MX')} MXN\n• Saldo Restante: $${remaining.toLocaleString('es-MX')} MXN\n¡Gracias por tu compra! 🏈🔥`);
    
    if (cleanPhone) {
      if (confirm(`✅ ¡Abono de $${abonoAmount.toLocaleString('es-MX')} MXN registrado con éxito!\nSaldo restante: $${remaining.toLocaleString('es-MX')} MXN.\n\n¿Deseas enviar el comprobante de abono al cliente por WhatsApp?`)) {
        window.open(`https://wa.me/52${cleanPhone.length === 10 ? cleanPhone : cleanPhone.replace(/^52/, '')}?text=${waReceipt}`, '_blank');
      }
    } else {
      alert(`✅ ¡Abono de $${abonoAmount.toLocaleString('es-MX')} MXN registrado con éxito!\nSaldo restante: $${remaining.toLocaleString('es-MX')} MXN.`);
    }
  } catch(err) {
    alert("Error al registrar abono: " + err.message);
  }
};

window.updateOrderStatus = async function(orderId, newStatus) {
  if (!window.db) return;
  try {
    const updatePayload = {
      status: newStatus,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (newStatus === 'delivered') {
      updatePayload.paymentStatus = 'paid';
    }
    await db.collection('orders').doc(orderId).update(updatePayload);

    // Trigger Notification for Status Change
    if (typeof window.notifyAdminStatusChange === 'function') {
      const ord = (window.allOrdersList || []).find(o => o.id === orderId) || {};
      window.notifyAdminStatusChange({
        customerName: ord.customerName || 'Cliente',
        orderId: orderId,
        newStatus: newStatus
      });
    }
  } catch (e) {
    alert("Error al actualizar estado del pedido: " + e.message);
  }
};

// ============================================
// INVENTORY AUTO-RESTORE & DEDUCTION ENGINE
// ============================================
function normalizeSizeKey(s) {
  if (!s) return 'M';
  const clean = String(s).trim().toUpperCase();
  if (clean.startsWith('S') || clean === 'CH' || clean.includes('CHICA') || clean.includes('SMALL')) return 'S';
  if (clean.startsWith('M') || clean === 'MED' || clean.includes('MEDIANA') || clean.includes('MEDIUM')) return 'M';
  if (clean === 'L' || clean === 'G' || clean.includes('GRANDE') || clean.includes('LARGE')) return 'L';
  if (clean === 'XL' || clean === 'EG' || clean.includes('EXTRA') || clean.includes('XL')) return 'XL';
  if (clean === 'XXL' || clean === '2XL') return 'XXL';
  return clean;
}

async function restoreInventoryToFirestore(items) {
  if (!window.db || !items || items.length === 0) return;
  
  for (const item of items) {
    try {
      let prodRef = null;
      let prodDoc = null;
      let prodId = item.id;

      // 1. Try finding by item.id
      if (prodId) {
        prodRef = db.collection('products').doc(prodId);
        const snap = await prodRef.get();
        if (snap.exists) prodDoc = snap;
      }

      // 2. Fallback: Search in local catalog by name or team
      if (!prodDoc) {
        const catalog = window.allProductsList || window.currentProducts || [];
        const found = catalog.find(p => p.id === prodId || (item.name && p.name && p.name.trim().toLowerCase() === item.name.trim().toLowerCase()));
        if (found) {
          prodId = found.id;
          prodRef = db.collection('products').doc(prodId);
          const snap = await prodRef.get();
          if (snap.exists) prodDoc = snap;
        }
      }

      // 3. Fallback: Search in Firestore directly by name
      if (!prodDoc && item.name) {
        const nameSnap = await db.collection('products').where('name', '==', item.name.trim()).limit(1).get();
        if (!nameSnap.empty) {
          prodDoc = nameSnap.docs[0];
          prodRef = prodDoc.ref;
          prodId = prodDoc.id;
        }
      }

      if (!prodDoc) {
        console.warn("⚠️ No se encontró el producto en catálogo para devolver existencias:", item);
        continue;
      }

      const prodData = prodDoc.data() || {};
      let sizeStockMap = Array.isArray(prodData.sizeStockMap) ? JSON.parse(JSON.stringify(prodData.sizeStockMap)) : (Array.isArray(prodData.sizeStockRows) ? JSON.parse(JSON.stringify(prodData.sizeStockRows)) : []);
      const qtyToRestore = Number(item.qty || 1);
      const targetSize = normalizeSizeKey(item.size);

      if (sizeStockMap.length > 0) {
        let sizeMatched = false;
        sizeStockMap = sizeStockMap.map(entry => {
          const entryNorm = normalizeSizeKey(entry.size);
          if (entryNorm === targetSize || entry.size === item.size) {
            sizeMatched = true;
            const curWh = Number(entry.warehouseQty || 0);
            return {
              ...entry,
              warehouseQty: curWh + qtyToRestore
            };
          }
          return entry;
        });

        if (!sizeMatched) {
          sizeStockMap.push({
            size: item.size || 'M',
            immediateQty: 0,
            warehouseQty: qtyToRestore
          });
        }
      } else {
        sizeStockMap = [
          { size: item.size || 'M', immediateQty: 0, warehouseQty: qtyToRestore }
        ];
      }

      const totalNewStock = sizeStockMap.reduce((acc, row) => acc + (Number(row.immediateQty || 0) + Number(row.warehouseQty || 0)), 0);
      const sizesArray = sizeStockMap.map(r => r.size);

      await prodRef.update({
        sizeStockMap: sizeStockMap,
        sizeStockRows: sizeStockMap,
        sizes: sizesArray,
        stock: totalNewStock,
        isPendingInventory: false,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      // Update in-memory catalog
      const catalog = window.allProductsList || window.currentProducts || [];
      const localIdx = catalog.findIndex(p => p.id === prodId);
      if (localIdx > -1) {
        catalog[localIdx].sizeStockMap = sizeStockMap;
        catalog[localIdx].sizeStockRows = sizeStockMap;
        catalog[localIdx].sizes = sizesArray;
        catalog[localIdx].stock = totalNewStock;
        catalog[localIdx].isPendingInventory = false;
      }

      console.log(`✅ Stock devuelto: +${qtyToRestore} a ${item.name || prodId} (Talla ${item.size}). Total en inventario: ${totalNewStock}`);
    } catch(err) {
      console.error("Error al restaurar inventario para:", item, err);
    }
  }

  // Refresh admin product view immediately if active
  if (typeof renderAdminProductsList === 'function' && window.currentProducts) {
    renderAdminProductsList(window.currentProducts);
  }
}

async function deductInventoryFromFirestore(items) {
  if (!window.db || !items || items.length === 0) return;
  
  for (const item of items) {
    try {
      let prodRef = null;
      let prodDoc = null;
      let prodId = item.id;

      if (prodId) {
        prodRef = db.collection('products').doc(prodId);
        const snap = await prodRef.get();
        if (snap.exists) prodDoc = snap;
      }

      if (!prodDoc) {
        const catalog = window.allProductsList || window.currentProducts || [];
        const found = catalog.find(p => p.id === prodId || (item.name && p.name && p.name.trim().toLowerCase() === item.name.trim().toLowerCase()));
        if (found) {
          prodId = found.id;
          prodRef = db.collection('products').doc(prodId);
          const snap = await prodRef.get();
          if (snap.exists) prodDoc = snap;
        }
      }

      if (!prodDoc && item.name) {
        const nameSnap = await db.collection('products').where('name', '==', item.name.trim()).limit(1).get();
        if (!nameSnap.empty) {
          prodDoc = nameSnap.docs[0];
          prodRef = prodDoc.ref;
          prodId = prodDoc.id;
        }
      }

      if (!prodDoc) continue;

      const prodData = prodDoc.data() || {};
      let sizeStockMap = Array.isArray(prodData.sizeStockMap) ? JSON.parse(JSON.stringify(prodData.sizeStockMap)) : (Array.isArray(prodData.sizeStockRows) ? JSON.parse(JSON.stringify(prodData.sizeStockRows)) : []);
      let qtyToDeduct = Number(item.qty || 1);
      const targetSize = normalizeSizeKey(item.size);

      if (sizeStockMap.length > 0) {
        sizeStockMap = sizeStockMap.map(entry => {
          const entryNorm = normalizeSizeKey(entry.size);
          if (entryNorm === targetSize || entry.size === item.size) {
            let imm = Number(entry.immediateQty || 0);
            let wh = Number(entry.warehouseQty || 0);
            if (imm >= qtyToDeduct) {
              imm -= qtyToDeduct;
              qtyToDeduct = 0;
            } else {
              qtyToDeduct -= imm;
              imm = 0;
              wh = Math.max(0, wh - qtyToDeduct);
              qtyToDeduct = 0;
            }
            return { ...entry, immediateQty: imm, warehouseQty: wh };
          }
          return entry;
        });

        const totalNewStock = sizeStockMap.reduce((acc, row) => acc + (Number(row.immediateQty || 0) + Number(row.warehouseQty || 0)), 0);

        await prodRef.update({
          sizeStockMap: sizeStockMap,
          sizeStockRows: sizeStockMap,
          stock: totalNewStock,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        const catalog = window.allProductsList || window.currentProducts || [];
        const localIdx = catalog.findIndex(p => p.id === prodId);
        if (localIdx > -1) {
          catalog[localIdx].sizeStockMap = sizeStockMap;
          catalog[localIdx].sizeStockRows = sizeStockMap;
          catalog[localIdx].stock = totalNewStock;
        }
      }
    } catch(err) {
      console.error("Error al descontar inventario:", item, err);
    }
  }

  if (typeof renderAdminProductsList === 'function' && window.currentProducts) {
    renderAdminProductsList(window.currentProducts);
  }
}

window.cancelOrder = async function(orderId) {
  if (!confirm("¿Deseas cancelar este pedido? Las prendas volverán automáticamente al inventario de bodega.")) return;
  if (!window.db) return;

  const order = allOrdersList.find(o => o.id === orderId);
  if (!order) return;

  try {
    // Only restore inventory if order was not already cancelled
    if (order.status !== 'cancelled' && order.items && order.items.length > 0) {
      await restoreInventoryToFirestore(order.items);
    }

    await db.collection('orders').doc(orderId).update({
      status: 'cancelled',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    alert("✅ Pedido cancelado y stock devuelto al inventario de bodega correctamente.");
  } catch (e) {
    alert("Error al cancelar pedido: " + e.message);
  }
};

window.deleteOrder = async function(orderId) {
  if (!confirm("¿Seguro que deseas eliminar este registro de pedido? Si el pedido no estaba cancelado, las prendas volverán al inventario.")) return;
  if (!window.db) return;

  const order = allOrdersList.find(o => o.id === orderId);

  try {
    // If order was not cancelled, return stock before deleting
    if (order && order.status !== 'cancelled' && order.items && order.items.length > 0) {
      await restoreInventoryToFirestore(order.items);
    }

    await db.collection('orders').doc(orderId).delete();
    alert("✅ Registro eliminado y existencias devueltas al inventario.");
  } catch (e) {
    alert("Error al eliminar pedido: " + e.message);
  }
};

window.toggleOrderItemPicked = async function(orderId, itemIndex) {
  const order = allOrdersList.find(o => o.id === orderId);
  if (!order || !order.items || !order.items[itemIndex]) return;

  order.items[itemIndex].isPicked = !order.items[itemIndex].isPicked;

  if (window.db) {
    try {
      await db.collection('orders').doc(orderId).update({
        items: order.items
      });
    } catch (e) {}
  }
  renderOrdersList();
};

// ============================================
// HOJA DE COMPRAS BODEGA CDMX (MARTES)
// ============================================
window.openCdmxShoppingModal = function() {
  const modal = document.getElementById('cdmxShoppingModal');
  const content = document.getElementById('cdmxShoppingContent');
  if (!modal || !content) return;

  const pendingOrders = allOrdersList.filter(o => o.status === 'pending' || !o.status || o.status === 'ready');

  if (pendingOrders.length === 0) {
    content.innerHTML = `
      <div style="text-align:center; padding:30px 10px; color:#aaa;">
        <div style="font-size:36px; margin-bottom:8px;">🇲🇽</div>
        <div style="font-size:14px; font-weight:800; color:#fff;">¡No hay compras pendientes para Bodega CDMX!</div>
        <p style="font-size:11px; color:#666;">Todos los pedidos de la semana ya fueron surtidos o entregados.</p>
      </div>
    `;
  } else {
    let totalPiecesToBuy = 0;
    let totalDepositCollected = 0;
    let totalBalancePending = 0;
    const shoppingItems = [];

    pendingOrders.forEach(o => {
      const shortId = o.id.slice(0, 7).toUpperCase();
      const customer = o.customerName || 'Cliente';
      const phone = o.customerPhone || '';
      const seller = o.seller || 'beto';
      const sellerName = seller === 'beto' ? 'Beto' : (seller === 'arturo' ? 'Arturo' : (seller === 'elena' ? 'Elena' : 'Web'));
      
      const orderTotal = Number(o.totalAmount || 0);
      const paid = Number(o.paidAmount || (o.paymentStatus === 'paid' ? orderTotal : 0));
      const remaining = Math.max(0, orderTotal - paid);

      totalDepositCollected += paid;
      totalBalancePending += remaining;

      (o.items || []).forEach((item, idx) => {
        const qty = Number(item.qty || 1);
        totalPiecesToBuy += qty;
        shoppingItems.push({
          orderId: o.id,
          shortId: shortId,
          customer: customer,
          phone: phone,
          sellerName: sellerName,
          itemIndex: idx,
          name: item.name || 'Jersey Deportivo',
          size: item.size || 'Unitalla',
          qty: qty,
          image: item.image || item.imageUrl || 'assets/dxt_logo.png',
          orderTotal: orderTotal,
          paidAmount: paid,
          remainingAmount: remaining,
          isBought: !!item.isBought || !!item.isPicked
        });
      });
    });

    content.innerHTML = `
      <!-- SUMMARY METRICS -->
      <div style="display: grid; grid-template-columns: 1fr 1.2fr 1.2fr; gap: 8px; margin-bottom: 12px;">
        <div style="background: rgba(0, 176, 255, 0.1); border: 1px solid #00b0ff; border-radius: 8px; padding: 8px; text-align: center;">
          <div style="font-size: 10px; font-weight: 800; color: #00b0ff;">👕 JERSEYS A COMPRAR</div>
          <div style="font-size: 18px; font-weight: 900; color: #fff;">${totalPiecesToBuy} pzas</div>
        </div>
        <div style="background: rgba(34, 197, 94, 0.1); border: 1px solid #22c55e; border-radius: 8px; padding: 8px; text-align: center;">
          <div style="font-size: 10px; font-weight: 800; color: #22c55e;">💵 ANTICIPOS RECAUDADOS</div>
          <div style="font-size: 16px; font-weight: 900; color: #22c55e;">$${totalDepositCollected.toLocaleString('es-MX')} MXN</div>
        </div>
        <div style="background: rgba(234, 179, 8, 0.1); border: 1px solid #eab308; border-radius: 8px; padding: 8px; text-align: center;">
          <div style="font-size: 10px; font-weight: 800; color: #eab308;">🚚 SALDO P/ JUEVES (QRO)</div>
          <div style="font-size: 16px; font-weight: 900; color: #eab308;">$${totalBalancePending.toLocaleString('es-MX')} MXN</div>
        </div>
      </div>

      <!-- SHOPPING ITEMS LIST -->
      <div style="display: flex; flex-direction: column; gap: 8px;">
        ${shoppingItems.map(si => `
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; padding: 10px; background: rgba(0,0,0,0.5); border: 1px solid ${si.isBought ? '#22c55e' : '#333'}; border-radius: 8px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <input type="checkbox" ${si.isBought ? 'checked' : ''} onchange="toggleOrderItemBought('${si.orderId}', ${si.itemIndex})" style="width: 20px; height: 20px; cursor: pointer; accent-color: #00b0ff;">
              <img src="${si.image}" style="width: 44px; height: 44px; object-fit: contain; background: #111; border-radius: 6px; border: 1px solid #444;">
              <div>
                <div style="font-size: 13px; font-weight: 800; color: #fff;">${si.name}</div>
                <div style="font-size: 11px; color: #aaa;">
                  Talla: <b style="color: #00b0ff; font-size: 13px;">[ ${si.size} ]</b> · Cantidad: <b>${si.qty} pza(s)</b>
                </div>
                <div style="font-size: 10px; color: #888; margin-top: 2px;">
                  👤 Cliente: <b style="color: #ddd;">${si.customer}</b> (${si.phone || 'Sin tel'}) · Vendedor: <b>${si.sellerName}</b> · Pedido: #${si.shortId}
                </div>
              </div>
            </div>

            <div style="text-align: right;">
              <div style="font-size: 11px; font-weight: 800; color: ${si.paidAmount >= si.orderTotal ? '#22c55e' : '#eab308'};">
                ${si.paidAmount >= si.orderTotal ? '🟢 Pagado 100%' : `🟡 Anticipo: $${si.paidAmount.toLocaleString('es-MX')} (Resta: $${si.remainingAmount.toLocaleString('es-MX')})`}
              </div>
              <div style="font-size: 10px; color: ${si.isBought ? '#22c55e' : '#aaa'}; font-weight: bold; margin-top: 2px;">
                ${si.isBought ? '✅ Comprado en Bodega' : '⏳ Pendiente por Comprar'}
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  modal.classList.add('active');
};

window.closeCdmxShoppingModal = () => document.getElementById('cdmxShoppingModal')?.classList.remove('active');

window.toggleOrderItemBought = async function(orderId, itemIndex) {
  const order = allOrdersList.find(o => o.id === orderId);
  if (!order || !order.items || !order.items[itemIndex]) return;

  order.items[itemIndex].isBought = !order.items[itemIndex].isBought;
  order.items[itemIndex].isPicked = order.items[itemIndex].isBought;

  if (window.db) {
    try {
      await db.collection('orders').doc(orderId).update({
        items: order.items
      });
    } catch (e) {}
  }
  openCdmxShoppingModal();
  renderOrdersList();
};

window.copyCdmxShoppingListToWhatsApp = function() {
  const pendingOrders = allOrdersList.filter(o => o.status === 'pending' || !o.status || o.status === 'ready');
  if (pendingOrders.length === 0) {
    alert("No hay compras pendientes.");
    return;
  }

  let totalPzas = 0;
  let listText = '';
  pendingOrders.forEach(o => {
    const seller = o.seller === 'beto' ? 'Beto' : (o.seller === 'arturo' ? 'Arturo' : (o.seller === 'elena' ? 'Elena' : 'Web'));
    (o.items || []).forEach(item => {
      const qty = Number(item.qty || 1);
      totalPzas += qty;
      const statusBought = item.isBought ? '✅ Comprado' : '⏳ Por Comprar';
      listText += `• ${qty}x ${item.name} (Talla: ${item.size}) - Cliente: ${o.customerName || 'Cliente'} [${seller}] [${statusBought}]\n`;
    });
  });

  const msg = `🛍️ *LISTA DE COMPRAS BODEGA CDMX (MARTES)* 🇲🇽\n*DXT SPORTS QRO*\nTotal prendas a surtir: ${totalPzas} pzas\n----------------------------------\n${listText}\n----------------------------------\n¡Surtido listo para entrega en Querétaro el Jueves! 🏈🔥`;

  navigator.clipboard.writeText(msg).then(() => {
    alert("✅ Lista de compras copiada al portapapeles. ¡Pégala en tu grupo de WhatsApp!");
  }).catch(() => {
    alert("Lista:\n\n" + msg);
  });
};

window.printCdmxShoppingList = function() {
  window.print();
};

// ============================================
// HOJA DE SURTIDO DE BODEGA (PICKING LIST)
// ============================================
window.openPickingListModal = function() {
  const modal = document.getElementById('pickingListModal');
  const content = document.getElementById('pickingListContent');
  if (!modal || !content) return;

  const pendingOrders = allOrdersList.filter(o => o.status === 'pending' || !o.status || o.status === 'ready');
  
  if (pendingOrders.length === 0) {
    content.innerHTML = `
      <div style="text-align:center; padding:30px 10px; color:#aaa;">
        <div style="font-size:36px; margin-bottom:8px;">✨</div>
        <div style="font-size:14px; font-weight:800;">¡No hay prendas pendientes por recoger en bodega!</div>
        <p style="font-size:11px; color:#666;">Todos los pedidos actuales ya fueron entregados o no hay pedidos nuevos.</p>
      </div>
    `;
  } else {
    const pickingItems = [];
    pendingOrders.forEach(o => {
      const shortId = o.id.slice(0, 6).toUpperCase();
      const customer = o.customerName || 'Cliente';
      (o.items || []).forEach((item, idx) => {
        pickingItems.push({
          orderId: o.id,
          shortId: shortId,
          customer: customer,
          itemIndex: idx,
          name: item.name || 'Jersey Deportivo',
          size: item.size || 'Unitalla',
          qty: Number(item.qty || 1),
          image: item.image || item.imageUrl || 'assets/dxt_logo.png',
          isPicked: !!item.isPicked
        });
      });
    });

    content.innerHTML = `
      <div style="background: rgba(168, 85, 247, 0.1); border: 1px solid #a855f7; border-radius: 8px; padding: 10px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: 12px; font-weight: 800; color: #fff;">📦 Total de Prendas a Recoger en Bodega:</span>
        <span style="font-size: 16px; font-weight: 900; color: #a855f7;">${pickingItems.length} prendas</span>
      </div>

      <div style="display: flex; flex-direction: column; gap: 8px;">
        ${pickingItems.map((pi) => `
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px; background: rgba(0,0,0,0.5); border: 1px solid #333; border-radius: 8px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <input type="checkbox" ${pi.isPicked ? 'checked' : ''} onchange="toggleOrderItemPicked('${pi.orderId}', ${pi.itemIndex})" style="width: 18px; height: 18px; cursor: pointer; accent-color: #22c55e;">
              <img src="${pi.image}" style="width: 46px; height: 46px; object-fit: contain; background: #111; border-radius: 6px; border: 1px solid #444;">
              <div>
                <div style="font-size: 13px; font-weight: 800; color: #fff;">${pi.name}</div>
                <div style="font-size: 11px; color: #aaa;">
                  Talla a Recoger: <b style="color: #38bdf8; font-size: 12px;">[ ${pi.size} ]</b> · Cantidad: <b>${pi.qty} pza(s)</b>
                </div>
                <div style="font-size: 10px; color: #777; margin-top: 2px;">
                  Para: <b>${pi.customer}</b> (Pedido #${pi.shortId})
                </div>
              </div>
            </div>
            <div>
              <span style="font-size: 11px; font-weight: 800; color: ${pi.isPicked ? '#22c55e' : '#eab308'};">
                ${pi.isPicked ? '✅ Recogido' : '⏳ Pendiente'}
              </span>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  modal.classList.add('active');
};

window.closePickingListModal = () => document.getElementById('pickingListModal')?.classList.remove('active');

window.copyPickingListToClipboard = function() {
  const pendingOrders = allOrdersList.filter(o => o.status === 'pending' || !o.status || o.status === 'ready');
  if (pendingOrders.length === 0) {
    alert("No hay pedidos pendientes.");
    return;
  }

  let text = `📦 HOJA DE SURTIDO DE BODEGA - DXT SPORTS QRO\nFecha: ${new Date().toLocaleDateString('es-MX')}\n----------------------------------\n`;
  let count = 1;
  pendingOrders.forEach(o => {
    (o.items || []).forEach(item => {
      text += `[ ] ${count}. ${item.name} (TALLA: ${item.size}) x ${item.qty || 1} pza(s) -> Para: ${o.customerName} (#${o.id.slice(0, 6).toUpperCase()})\n`;
      count++;
    });
  });

  navigator.clipboard.writeText(text).then(() => {
    alert("📋 ¡Hoja de surtido copiada al portapapeles! Puedes pegarla en WhatsApp o Notas.");
  }).catch(() => {
    alert(text);
  });
};

window.printPickingList = function() {
  window.print();
};

// ============================================
// REGISTRAR PEDIDO MANUAL / MOSTRADOR
// ============================================
window.openManualOrderModal = function() {
  const modal = document.getElementById('manualOrderModal');
  if (!modal) return;

  clearManualSelectedProduct();
  const searchInput = document.getElementById('manualProductSearch');
  if (searchInput) searchInput.value = '';

  modal.classList.add('active');
};

window.closeManualOrderModal = () => document.getElementById('manualOrderModal')?.classList.remove('active');

window.onManualProductSearchInput = function(val) {
  const query = (val || '').toLowerCase().trim();
  const listEl = document.getElementById('manualSearchResultsList');
  if (!listEl) return;

  const catalog = window.allProductsList || window.currentProducts || [];

  if (!query) {
    listEl.style.display = 'none';
    listEl.innerHTML = '';
    return;
  }

  const matches = catalog.filter(p => {
    const name = (p.name || '').toLowerCase();
    const team = (p.team || '').toLowerCase();
    const league = (p.league || '').toLowerCase();
    return name.includes(query) || team.includes(query) || league.includes(query);
  }).slice(0, 15);

  if (matches.length === 0) {
    listEl.innerHTML = '<div style="padding: 10px; font-size: 11px; color: #888; text-align: center;">No se encontraron prendas con ese nombre</div>';
    listEl.style.display = 'block';
    return;
  }

  listEl.innerHTML = matches.map(p => {
    const img = p.imageUrl || 'assets/dxt_logo.png';
    const rows = p.sizeStockRows || p.sizeStockMap || [];
    let totalStock = 0;
    if (rows.length > 0) {
      totalStock = rows.reduce((acc, r) => acc + (Number(r.immediateQty) || 0) + (Number(r.warehouseQty) || 0), 0);
    } else {
      totalStock = Number(p.stock) || 0;
    }

    return `
      <div onclick="selectManualOrderProduct('${p.id}')" style="display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 6px 8px; border-bottom: 1px solid #222; cursor: pointer; border-radius: 4px;" onmouseover="this.style.background='rgba(56,189,248,0.15)'" onmouseout="this.style.background='transparent'">
        <div style="display: flex; align-items: center; gap: 8px;">
          <img src="${img}" style="width: 36px; height: 36px; object-fit: contain; background: #000; border-radius: 4px; border: 1px solid #333;">
          <div>
            <div style="font-size: 12px; font-weight: 800; color: #fff;">${p.name}</div>
            <div style="font-size: 10px; color: #888;">${p.team || ''} · ${p.season || ''}</div>
          </div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 12px; font-weight: 900; color: #22c55e;">$${Number(p.price || 0).toLocaleString('es-MX')}</div>
          <div style="font-size: 10px; color: ${totalStock > 0 ? '#38bdf8' : '#ef4444'}; font-weight: 700;">
            ${totalStock > 0 ? `Stock: ${totalStock} pzas` : 'Agotado'}
          </div>
        </div>
      </div>
    `;
  }).join('');

  listEl.style.display = 'block';
};

window.selectManualOrderProduct = function(productId) {
  const catalog = window.allProductsList || window.currentProducts || [];
  const product = catalog.find(p => p.id === productId);
  if (!product) return;

  const hiddenId = document.getElementById('manualSelectedProductId');
  const card = document.getElementById('manualSelectedProductCard');
  const cardImg = document.getElementById('manualCardImg');
  const cardTitle = document.getElementById('manualCardTitle');
  const cardMeta = document.getElementById('manualCardMeta');
  const searchInput = document.getElementById('manualProductSearch');
  const listEl = document.getElementById('manualSearchResultsList');
  const sizeSelect = document.getElementById('manualSizeSelect');
  const priceInput = document.getElementById('manualPrice');

  if (hiddenId) hiddenId.value = productId;
  if (searchInput) searchInput.value = product.name;
  if (listEl) listEl.style.display = 'none';

  if (cardImg) cardImg.src = product.imageUrl || 'assets/dxt_logo.png';
  if (cardTitle) cardTitle.textContent = product.name;

  const rows = product.sizeStockRows || product.sizeStockMap || [];
  let totalStock = 0;
  if (rows.length > 0) {
    totalStock = rows.reduce((acc, r) => acc + (Number(r.immediateQty) || 0) + (Number(r.warehouseQty) || 0), 0);
  } else {
    totalStock = Number(product.stock) || 0;
  }

  if (cardMeta) {
    cardMeta.textContent = `Precio Oficial: $${Number(product.price || 0).toLocaleString('es-MX')} · Existencias Totales: ${totalStock} pzas`;
  }
  if (card) card.style.display = 'block';

  if (priceInput) priceInput.value = product.price || 1499;

  if (sizeSelect) {
    if (rows.length > 0) {
      sizeSelect.innerHTML = rows.map(s => {
        const imm = Number(s.immediateQty) || 0;
        const wh = Number(s.warehouseQty) || 0;
        const tot = imm + wh;
        return `<option value="${s.size}">Talla ${s.size} — Bodega: ${wh}, Tienda: ${imm} (Total: ${tot})</option>`;
      }).join('');
    } else {
      sizeSelect.innerHTML = '<option value="Unitalla">Unitalla (Stock: 1)</option>';
    }
  }

  calcManualOrderTotal();
};

window.clearManualSelectedProduct = function() {
  const hiddenId = document.getElementById('manualSelectedProductId');
  const card = document.getElementById('manualSelectedProductCard');
  const sizeSelect = document.getElementById('manualSizeSelect');
  const priceInput = document.getElementById('manualPrice');
  const searchInput = document.getElementById('manualProductSearch');
  const listEl = document.getElementById('manualSearchResultsList');

  if (hiddenId) hiddenId.value = '';
  if (card) card.style.display = 'none';
  if (searchInput) searchInput.value = '';
  if (listEl) listEl.style.display = 'none';
  if (sizeSelect) sizeSelect.innerHTML = '<option value="">Busca un producto arriba...</option>';
  if (priceInput) priceInput.value = 0;
  calcManualOrderTotal();
};

window.calcManualOrderTotal = function() {
  const qty = Number(document.getElementById('manualQty')?.value || 1);
  const price = Number(document.getElementById('manualPrice')?.value || 0);
  const total = qty * price;
  const display = document.getElementById('manualTotalDisplay');
  if (display) display.textContent = `$${total.toLocaleString('es-MX')}`;
};

window.saveManualOrder = async function(e) {
  e.preventDefault();
  const name = document.getElementById('manualCustomerName')?.value.trim();
  const phone = document.getElementById('manualCustomerPhone')?.value.trim();
  const delivery = document.getElementById('manualDeliveryMethod')?.value;
  const address = document.getElementById('manualAddress')?.value.trim();
  const seller = document.getElementById('manualSeller')?.value || 'beto';
  const paymentStatus = document.getElementById('manualPaymentStatus')?.value || 'paid';
  const prodId = document.getElementById('manualSelectedProductId')?.value;
  const size = document.getElementById('manualSizeSelect')?.value;
  const qty = Number(document.getElementById('manualQty')?.value || 1);
  const price = Number(document.getElementById('manualPrice')?.value || 0);

  if (!name || !phone || !prodId || !size) {
    alert("Por favor busca y selecciona un jersey del catálogo y su talla.");
    return;
  }

  const catalog = window.allProductsList || window.currentProducts || [];
  const product = catalog.find(p => p.id === prodId);

  // Validate available stock
  const rows = product?.sizeStockRows || product?.sizeStockMap || [];
  let availableStock = 999;
  if (rows.length > 0) {
    const row = rows.find(r => normalizeSizeKey(r.size) === normalizeSizeKey(size) || r.size === size);
    availableStock = row ? (Number(row.immediateQty || 0) + Number(row.warehouseQty || 0)) : 0;
  } else if (product?.stock !== undefined) {
    availableStock = Number(product.stock) || 0;
  }

  if (qty > availableStock) {
    alert(`⚠️ La cantidad ingresada (${qty} pzas) supera las existencias reales disponibles (${availableStock} pzas) para la talla ${size}.`);
    return;
  }

  const totalAmount = qty * price;

  const orderPayload = {
    customerName: name,
    customerPhone: phone,
    deliveryMethod: delivery,
    seller: seller,
    paymentStatus: paymentStatus,
    paidAmount: paymentStatus === 'paid' ? totalAmount : 0,
    address: address,
    items: [{
      id: prodId,
      name: product?.name || 'Jersey Deportivo',
      team: product?.team || 'Deportivo',
      size: size,
      qty: qty,
      price: price,
      image: product?.imageUrl || 'assets/dxt_logo.png'
    }],
    totalAmount: totalAmount,
    status: 'pending',
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  try {
    await db.collection('orders').add(orderPayload);
    await deductInventoryFromFirestore(orderPayload.items);
    closeManualOrderModal();
    document.getElementById('manualOrderForm').reset();
    clearManualSelectedProduct();
    alert("✅ Venta registrada con éxito asignada a " + (seller === 'beto' ? 'Beto' : (seller === 'arturo' ? 'Arturo' : (seller === 'elena' ? 'Elena' : 'Tienda Web'))) + ".");
  } catch (err) {
    alert("Error al guardar pedido: " + err.message);
  }
};

window.viewTransferProof = function(proofUrl) {
  const modal = document.getElementById('proofViewerModal');
  const img = document.getElementById('proofViewerImage');
  if (modal && img) {
    img.src = proofUrl;
    modal.classList.add('active');
  }
};

window.closeProofViewerModal = () => document.getElementById('proofViewerModal')?.classList.remove('active');

// ============================================
// 🗑️ DELETE ALL PRODUCTS FROM CATALOG
// ============================================
window.confirmDeleteAllProducts = function() {
  const count = (window.currentProducts || []).length;
  if (count === 0) {
    alert('El catálogo ya está vacío.');
    return;
  }
  const confirmed = confirm(`⚠️ ATENCIÓN: Esto eliminará PERMANENTEMENTE los ${count} productos del catálogo de Firestore.\n\nEsta acción NO SE PUEDE DESHACER.\n\n¿Estás 100% seguro?`);
  if (!confirmed) return;
  const confirmed2 = confirm(`🔴 SEGUNDA CONFIRMACIÓN\n\nVas a borrar ${count} productos. Escribe "BORRAR" en el siguiente cuadro para continuar.`);
  if (!confirmed2) return;
  const word = prompt('Escribe exactamente: BORRAR');
  if (word !== 'BORRAR') {
    alert('Cancelado. No escribiste BORRAR correctamente.');
    return;
  }
  deleteAllProducts();
};

async function deleteAllProducts() {
  const prods = window.currentProducts || [];
  if (prods.length === 0) return;

  try {
    const batchSize = 400;
    for (let i = 0; i < prods.length; i += batchSize) {
      const batch = db.batch();
      const chunk = prods.slice(i, i + batchSize);
      chunk.forEach(p => {
        batch.delete(db.collection('products').doc(p.id));
      });
      await batch.commit();
    }
    alert(`✅ Catálogo limpiado. Se eliminaron ${prods.length} productos correctamente.`);
    window.currentProducts = [];
    window.allProductsList = [];
    const countEl = document.getElementById('adminProdCount');
    if (countEl) countEl.textContent = '0';
    const listEl = document.getElementById('adminProductList');
    if (listEl) listEl.innerHTML = '<div style="padding:24px; text-align:center; color:#666;">Catálogo vacío. Usa ➕ Publicar Nuevo o ⚡ Carga Masiva para agregar productos.</div>';
  } catch (err) {
    alert('Error al eliminar productos: ' + err.message);
  }
}

// ============================================
// 📊 REPORTES TAB - Load Data
// ============================================
async function loadReportesData() {
  // Load current store config
  try {
    const doc = await db.collection('config').doc('store').get();
    if (doc.exists) {
      const d = doc.data();
      const cfgBank = document.getElementById('cfgBank');
      const cfgBenef = document.getElementById('cfgBenef');
      const cfgClabe = document.getElementById('cfgClabe');
      const cfgWA = document.getElementById('cfgWA');
      if (cfgBank && d.bank) cfgBank.value = d.bank;
      if (cfgBenef && d.beneficiary) cfgBenef.value = d.beneficiary;
      if (cfgClabe && d.clabe) cfgClabe.value = d.clabe;
      if (cfgWA && d.phoneWhatsApp) cfgWA.value = d.phoneWhatsApp;
    }
  } catch (e) {}

  // Load admins list
  try {
    const snapshot = await db.collection('admins').get();
    const listEl = document.getElementById('adminEmailsList');
    if (!listEl) return;
    if (snapshot.empty) {
      listEl.innerHTML = '<div style="font-size:11px; color:#666;">Sin administradores en Firestore.</div>';
      return;
    }
    listEl.innerHTML = snapshot.docs.map(d => `
      <div style="display:flex; align-items:center; justify-content:space-between; background:rgba(168,85,247,0.08); border:1px solid #a855f7; border-radius:6px; padding:6px 10px;">
        <span style="font-size:12px; color:#fff;">${d.id} ${d.data().active === false ? '<span style="color:#ef4444; font-size:10px;">(Desactivado)</span>' : '<span style="color:#22c55e; font-size:10px;">✅ Activo</span>'}</span>
        <button type="button" onclick="removeAdminEmail('${d.id}')" style="background:none; border:1px solid #ef4444; color:#ef4444; border-radius:4px; padding:2px 8px; font-size:10px; cursor:pointer;">Quitar</button>
      </div>
    `).join('');
  } catch (e) {
    console.warn('Load admins error:', e);
  }

  // Update push notification badge
  updateNotifBadgeStatus();
}

window.saveStoreConfig = async function() {
  const bank = document.getElementById('cfgBank')?.value.trim();
  const benef = document.getElementById('cfgBenef')?.value.trim();
  const clabe = document.getElementById('cfgClabe')?.value.trim();
  const wa = document.getElementById('cfgWA')?.value.trim();

  if (!bank || !benef || !clabe || !wa) {
    alert('Por favor completa todos los campos de configuración.');
    return;
  }
  if (clabe.length !== 18) {
    alert('La CLABE debe tener exactamente 18 dígitos.');
    return;
  }
  if (wa.length !== 10) {
    alert('El WhatsApp debe tener exactamente 10 dígitos (sin código de país).');
    return;
  }

  try {
    await db.collection('config').doc('store').set({
      bank, beneficiary: benef, clabe,
      phoneWhatsApp: `521${wa}`,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    alert('✅ Configuración guardada correctamente. Los cambios aplican de inmediato en la tienda web.');
  } catch (err) {
    alert('Error al guardar: ' + err.message);
  }
};

window.addNewAdminEmail = async function() {
  const email = document.getElementById('newAdminEmailInput')?.value.trim().toLowerCase();
  if (!email || !email.includes('@')) {
    alert('Por favor escribe un correo válido.');
    return;
  }
  try {
    await db.collection('admins').doc(email).set({ active: true, addedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
    document.getElementById('newAdminEmailInput').value = '';
    alert(`✅ ${email} ahora tiene acceso como administrador.`);
    loadReportesData();
  } catch (err) {
    alert('Error: ' + err.message);
  }
};

window.removeAdminEmail = async function(email) {
  if (!confirm(`¿Quitar el acceso de administrador a ${email}?`)) return;
  try {
    await db.collection('admins').doc(email).update({ active: false });
    alert(`🔒 Acceso desactivado para ${email}.`);
    loadReportesData();
  } catch (err) {
    alert('Error: ' + err.message);
  }
};

// ============================================
// 🔐 AUTO-SEED FIRESTORE ADMIN ACCOUNT
// ============================================
async function ensureAdminEmailInFirestore() {
  const emails = ['chefalbertomc@gmail.com', 'dxtsportsqro@gmail.com'];
  try {
    for (const email of emails) {
      const docRef = db.collection('admins').doc(email);
      const doc = await docRef.get();
      if (!doc.exists) {
        await docRef.set({ active: true, seeded: true, addedAt: firebase.firestore.FieldValue.serverTimestamp() });
      }
    }
  } catch (e) {
    console.warn('Admin seed warning (non-critical):', e);
  }
}

// Run seed once on load
ensureAdminEmailInFirestore();

// ============================================
// 🔔 ADMIN PUSH NOTIFICATIONS HELPERS
// ============================================
function updateNotifBadgeStatus() {
  const badge = document.getElementById('notifStatusBadge');
  if (!badge) return;
  if (!('Notification' in window)) {
    badge.textContent = '❌ No compatible';
    badge.style.background = '#333';
    badge.style.color = '#888';
    return;
  }
  if (Notification.permission === 'granted') {
    badge.textContent = '✅ Activadas';
    badge.style.background = 'rgba(34, 197, 94, 0.2)';
    badge.style.color = '#22c55e';
  } else if (Notification.permission === 'denied') {
    badge.textContent = '🚫 Bloqueadas en el navegador';
    badge.style.background = 'rgba(239, 68, 68, 0.2)';
    badge.style.color = '#ef4444';
  } else {
    badge.textContent = '⚠️ Sin activar';
    badge.style.background = 'rgba(234, 179, 8, 0.2)';
    badge.style.color = '#eab308';
  }
}

window.enableAdminNotifications = async function() {
  if (!('Notification' in window)) {
    alert('Tu navegador no soporta notificaciones push. En iPhone usa Safari y agrega a pantalla de inicio.');
    return;
  }
  try {
    const permission = await Notification.requestPermission();
    updateNotifBadgeStatus();
    if (permission === 'granted') {
      if (typeof initFCM === 'function') await initFCM(true);
      alert('✅ ¡Notificaciones activadas con éxito en este dispositivo!\nRecibirás alertas inmediatas de nuevos pedidos y pagos.');
    } else {
      alert('⚠️ No se concedió el permiso de notificaciones. Actívalo en los ajustes de tu navegador.');
    }
  } catch (e) {
    alert('Error al solicitar permiso: ' + e.message);
  }
};

window.testAdminNotification = function() {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    alert('Primero activa las notificaciones con el botón verde "🔔 Activar Alertas".');
    return;
  }
  new Notification('📦 Prueba de Alerta DXT Sports', {
    body: '¡Todo listo! Recibirás alertas sonoras de nuevos pedidos y abonos aquí.',
    icon: 'assets/icon-192.png',
    badge: 'assets/icon-96.png'
  });
};

window.sendBroadcastPromo = async function() {
  const title = document.getElementById('promoTitleInput')?.value.trim();
  const body = document.getElementById('promoBodyInput')?.value.trim();

  if (!title || !body) {
    alert('Por favor ingresa tanto el título como el mensaje de la promoción.');
    return;
  }

  if (typeof sendPromoNotification === 'function') {
    await sendPromoNotification(title, body);
    document.getElementById('promoTitleInput').value = '';
    document.getElementById('promoBodyInput').value = '';
  } else {
    alert('Servicio de notificaciones no disponible.');
  }
};

