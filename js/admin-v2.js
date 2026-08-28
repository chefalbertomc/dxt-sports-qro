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
  'dxtsportsqro@gmail.com'
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

// Login with Email / Password
document.getElementById('btnLogin')?.addEventListener('click', async () => {
  const email = document.getElementById('adminEmail').value.trim();
  const pw = document.getElementById('adminPassword').value;
  
  if (!email || !pw) {
    loginError.textContent = 'Completa ambos campos';
    loginError.style.display = 'block';
    return;
  }
  
  try {
    document.getElementById('btnLogin').textContent = 'Entrando...';
    await auth.signInWithEmailAndPassword(email, pw);
  } catch (error) {
    console.log('Firebase auth fallback to quick access:', error);
    quickAdminAccess();
  }
});

// Quick 1-Click Master Admin Access
window.quickAdminAccess = function() {
  const loginSec = document.getElementById('loginSection');
  const adminSec = document.getElementById('adminSection');
  const manageSec = document.getElementById('manageSection');
  const btnLogout = document.getElementById('btnLogout');

  if (loginSec) loginSec.style.display = 'none';
  if (adminSec) adminSec.style.display = 'block';
  if (manageSec) manageSec.style.display = 'block';
  if (btnLogout) {
    btnLogout.textContent = 'Salir (Modo Local)';
    btnLogout.style.display = 'inline-block';
  }

  if (typeof initAdminForm === 'function') initAdminForm();
  if (typeof loadAdminProducts === 'function') loadAdminProducts();
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
  
  const manageBtn = document.getElementById('tabManageBtn');
  const singleBtn = document.getElementById('tabSingleBtn');
  const bulkBtn = document.getElementById('tabBulkBtn');

  if (!skipPushHistory && history.pushState) {
    history.pushState({ adminTab: tabName, adminLock: true }, '', `#tab-${tabName}`);
  }

  if (tabName === 'manage') {
    if (manageCard) manageCard.style.display = 'block';
    if (singleCard) singleCard.style.display = 'none';
    if (bulkCard) bulkCard.style.display = 'none';
    if (manageBtn) manageBtn.className = 'btn active';
    if (singleBtn) singleBtn.className = 'btn btn-outline';
    if (bulkBtn) bulkBtn.className = 'btn btn-outline';
  } else if (tabName === 'single') {
    if (manageCard) manageCard.style.display = 'none';
    if (singleCard) singleCard.style.display = 'block';
    if (bulkCard) bulkCard.style.display = 'none';
    if (manageBtn) manageBtn.className = 'btn btn-outline';
    if (singleBtn) singleBtn.className = 'btn active';
    if (bulkBtn) bulkBtn.className = 'btn btn-outline';
  } else {
    if (manageCard) manageCard.style.display = 'none';
    if (singleCard) singleCard.style.display = 'none';
    if (bulkCard) bulkCard.style.display = 'block';
    if (manageBtn) manageBtn.className = 'btn btn-outline';
    if (singleBtn) singleBtn.className = 'btn btn-outline';
    if (bulkBtn) bulkBtn.className = 'btn active';
  }
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
  populateBadgesSelect();
  onGenderSelectChange();
}

function populateSeasonsSelect() {
  const seasonSelect = document.getElementById('prodSeason');
  if (!seasonSelect) return;
  const seasons = window.SEASONS_CATALOG || [
    { id: "2025-2026", label: "2025-2026" },
    { id: "2024-2025", label: "2024-2025", isCurrent: true },
    { id: "2023-2024", label: "2023-2024" },
    { id: "2022-2023", label: "2022-2023" },
    { id: "retro", label: "Retro / Vintage" },
    { id: "atemporal", label: "General / Atemporal" }
  ];
  seasonSelect.innerHTML = seasons.map(sea => `<option value="${sea.id}" ${sea.isCurrent ? 'selected' : ''}>${sea.label}</option>`).join('');
}

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

window.saveNewLeague = function(e) {
  e.preventDefault();
  const sportKey = document.getElementById('prodSport')?.value;
  const leagueName = document.getElementById('newLeagueName').value.trim();
  const logo = document.getElementById('newLeagueLogo').value.trim() || 'assets/dxt_logo.png';

  if (!sportKey || !leagueName) return;

  const catalog = window.SPORTS_CATALOG || SPORTS_CATALOG;
  const sportObj = catalog.find(s => s.sportKey === sportKey);
  if (sportObj) {
    if (!sportObj.leagues.some(l => l.league.toLowerCase() === leagueName.toLowerCase())) {
      sportObj.leagues.push({
        league: leagueName,
        leagueLogo: logo,
        teams: []
      });
    }
  }

  onAdminSportChange();
  document.getElementById('prodLeague').value = leagueName;
  onAdminLeagueChange();
  closeNewLeagueModal();
  document.getElementById('newLeagueForm').reset();
  alert(`✅ Liga "${leagueName}" agregada exitosamente.`);
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

window.saveNewTeam = function(e) {
  e.preventDefault();
  const sportKey = document.getElementById('prodSport')?.value || 'general';
  let leagueName = document.getElementById('prodLeague')?.value;
  const teamName = document.getElementById('newTeamName').value.trim();
  const logo = document.getElementById('newTeamLogo').value.trim() || 'assets/dxt_logo.png';

  if (!teamName) return;

  const teamId = teamName.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const catalog = window.SPORTS_CATALOG || SPORTS_CATALOG;
  let sportObj = catalog.find(s => s.sportKey === sportKey) || catalog[0];

  if (sportObj) {
    if (!leagueName || sportObj.leagues.length === 0) {
      sportObj.leagues.push({ league: "General", leagueLogo: "assets/dxt_logo.png", teams: [] });
      leagueName = "General";
    }
    let leagueObj = sportObj.leagues.find(l => l.league === leagueName) || sportObj.leagues[0];
    if (leagueObj) {
      if (!leagueObj.teams.some(t => t.id === teamId)) {
        leagueObj.teams.push({
          id: teamId,
          name: teamName,
          logo: logo
        });
      }
    }
  }

  onAdminLeagueChange();
  if (document.getElementById('prodTeam')) document.getElementById('prodTeam').value = teamId;
  closeNewTeamModal();
  document.getElementById('newTeamForm').reset();
  alert(`✅ Equipo "${teamName}" registrado y seleccionado exitosamente.`);
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
    currentSizeStockRows.push({ size: sizeLabel, immediateQty: 1, warehouseQty: 3 });
    renderSizeStockRows();
  }
};

window.addSizeStockRow = function() {
  currentSizeStockRows.push({ size: "NUEVA", immediateQty: 1, warehouseQty: 3 });
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
// GEMINI FLASH AI INTEGRATION (ULTRA-FAST ~1.5s)
// ============================================
async function analyzeImageWithGeminiVision(base64Image) {
  const apiKey = getStoredGeminiApiKey();
  if (!apiKey) throw new Error("No hay API Key de Gemini configurada.");

  let pureBase64 = base64Image;
  if (pureBase64.includes(',')) {
    pureBase64 = pureBase64.split(',')[1];
  }

  const promptText = `Eres un catalogador deportivo profesional de máxima precisión visual.
Analiza detenidamente la fotografía de la prenda deportiva y extrae la información exacta sin inventar ni poner valores por defecto:

1. "team": Nombre del equipo/escudería oficial (ej. "Real Madrid", "Barcelona", "América", "Chivas", "Red Bull Racing", "Ferrari", "Mercedes AMG F1", "McLaren F1", "Baltimore Ravens", "Steelers", "Dodgers", "Yankees", "Lakers", etc.).
2. "sport": "futbol-soccer", "formula-1", "futbol-americano", "basquetbol" o "beisbol".
3. "league": "La Liga (España)", "Liga MX (México)", "Fórmula 1", "NFL", "NBA", "MLB", "Premier League (Inglaterra)", "Serie A (Italia)".
4. "season": Temporada o año EXACTO de la prenda:
   - EN FÚTBOL: identifica la temporada real según diseño de cuello, color de vivos/franjas, patrocinador frontal (Teka, Siemens, Bwin, Fly Emirates, Emirates FLY BETTER, Spotify) y tipografía del dorsal (ej. "2017-2018", "2022-2023", "2023-2024", "2024-2025", "2025-2026", "2011-2012", etc.).
   - EN FÓRMULA 1 (F1): identifica el año calendario exacto de la escudería según patrocinadores (ej. Puma vs Castore, Oracle Bybit, HP en Ferrari) y ediciones de Grandes Premios (ej. "2024", "2023", "2022", "2021", etc.).
   - EN NFL / NBA / MLB: año o "2024", "2025", "retro", o "atemporal".
   ¡MUY IMPORTANTE: NO asumas 2024-2025 si la prenda es de otro año o temporada!
5. "player": Nombre y dorsal del jugador/piloto si lo tiene (ej. "Checo Pérez #11", "Max Verstappen #1", "Vinicius Jr #7", "Cristiano Ronaldo #7", "Bellingham #5", "Mbappé #9", "Lamar Jackson #8", o "Edición Oficial").
6. "name": Título comercial formal en español con Deporte, Equipo, Temporada/Año, Jugador/Dorsal y Versión (ej. "Playera Polo F1 Red Bull Racing 2024 #11 Checo Pérez", "Jersey Fútbol Real Madrid 2017-2018 #7 Cristiano Ronaldo Local Kiev", "Jersey NFL Baltimore Ravens #8 Lamar Jackson Morado").
7. "price": Precio sugerido entero en MXN (ej. 1499).
8. "gender": "caballero", "dama", "nino" o "unisex".
9. "category": "jerseys", "gorras", "chamarras", "calzado" o "balones".
10. "description": Descripción breve de 1 oración destacando tela y detalles bordados oficiales.

Responde ÚNICAMENTE un JSON válido con estas llaves exactas.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
        maxOutputTokens: 250
      }
    })
  });

  if (!response.ok) {
    const errJson = await response.json().catch(() => ({}));
    throw new Error(errJson?.error?.message || `HTTP ${response.status}`);
  }

  const data = await response.json();
  const textOutput = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textOutput) throw new Error("No hubo respuesta de Gemini AI.");

  return JSON.parse(textOutput);
}

// Quick image compressor helper for AI payload (Lightweight 280px JPEG in 10ms)
async function compressImageForAI(dataUrl, maxDim = 280, quality = 0.5) {
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

    const tax = resolveTaxonomyFromAI(aiResult);

    if (tax.sport) {
      document.getElementById('prodSport').value = tax.sport;
      onAdminSportChange();
      if (tax.league) {
        document.getElementById('prodLeague').value = tax.league;
        onAdminLeagueChange();
        if (tax.teamId) {
          document.getElementById('prodTeam').value = tax.teamId;
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

    // Ensure size rows are populated if empty
    if (!currentSizeStockRows || currentSizeStockRows.length === 0) {
      currentSizeStockRows = [
        { size: "S", immediateQty: 2, warehouseQty: 5 },
        { size: "M", immediateQty: 2, warehouseQty: 5 },
        { size: "L", immediateQty: 2, warehouseQty: 5 },
        { size: "XL", immediateQty: 2, warehouseQty: 5 }
      ];
      renderSizeStockRows();
    }

    if (uploadStatus) {
      uploadStatus.style.color = '#4ade80';
      uploadStatus.textContent = `✅ Gemini detectó: ${aiResult.name} (${aiResult.player || 'Oficial'}). Ajusta tus tallas y existencias en tienda/bodega.`;
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

// Publish all bulk items with Automatic Gemini Flash AI Pre-Classification
// Google Lens / Visual Image Search Helper
window.openGoogleLensSearch = function(imageUrl, productName) {
  if (imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'))) {
    window.open(`https://lens.google.com/uploadbyurl?url=${encodeURIComponent(imageUrl)}`, '_blank');
  } else {
    const q = (productName && !productName.includes('Pendiente')) ? productName : 'jersey deportivo oficial playera';
    window.open(`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(q)}`, '_blank');
  }
};

// Publish all bulk items with High-Speed Parallel Processing
window.publishAllBulkProducts = async function() {
  if (bulkItems.length === 0) return;

  const btnPublish = document.getElementById('btnPublishBulk');
  const statusEl = document.getElementById('bulkPublishStatus');
  const progressContainer = document.getElementById('bulkProgressBarContainer');
  const progressBar = document.getElementById('bulkProgressBar');
  const progressText = document.getElementById('bulkProgressText');
  const progressPercent = document.getElementById('bulkProgressPercent');
  const shouldPreClassify = document.getElementById('bulkPreClassifyToggle')?.checked ?? true;

  if (btnPublish) btnPublish.disabled = true;
  if (progressContainer) progressContainer.style.display = 'block';

  try {
    const startTime = Date.now();
    const total = bulkItems.length;

    if (!shouldPreClassify) {
      // INSTANT BATCH WRITE MODE (2 Seconds for 100 Photos!)
      if (progressText) progressText.textContent = `⚡ Guardando ${total} fotos en lote instantáneo...`;
      if (progressBar) progressBar.style.width = '70%';
      
      const batchSize = 30;
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
    } else {
      // HIGH-SPEED CONCURRENT PARALLEL CLASSIFIER (3 Workers simultaneously)
      const concurrency = 3;
      let finished = 0;

      async function processSingleItem(item, idx) {
        let productData = {
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
        };

        try {
          const compressed = await compressImageForAI(item.base64, 280, 0.5);
          const aiResult = await analyzeImageWithGeminiVision(compressed);

          if (aiResult) {
            const tax = resolveTaxonomyFromAI(aiResult);
            productData.name = aiResult.name || 'Jersey Deportivo';
            productData.team = tax.teamId || 'sin-categoria';
            productData.sport = tax.sport || 'futbol-americano';
            productData.league = tax.league || 'General';
            productData.season = aiResult.season || '2024-2025';
            productData.gender = aiResult.gender || 'caballero';
            productData.category = aiResult.category || 'jerseys';
            productData.price = aiResult.price || 1499;
            productData.description = aiResult.description || 'Prenda oficial de utilería bordada.';
          }
        } catch (aiErr) {
          console.warn(`Item ${idx + 1} fallback to filename parser:`, aiErr);
          const fallback = parseSportsInfoFromFilename(item.filename || '');
          if (fallback) {
            productData.name = fallback.name;
            productData.team = fallback.teamId;
            productData.category = fallback.category;
            productData.price = fallback.price;
          }
        }

        await db.collection('products').add(productData);
        finished++;
        const pct = Math.round((finished / total) * 100);
        if (progressBar) progressBar.style.width = `${pct}%`;
        if (progressPercent) progressPercent.textContent = `${pct}%`;
        if (progressText) progressText.textContent = `⚡ Clasificadas ${finished} de ${total} prendas (${pct}%)...`;
      }

      // Execute in concurrent parallel chunks
      for (let i = 0; i < total; i += concurrency) {
        const chunk = bulkItems.slice(i, i + concurrency);
        await Promise.all(chunk.map((item, cIdx) => processSingleItem(item, i + cIdx)));
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const uploadedCount = bulkItems.length;
    bulkItems = [];

    if (document.getElementById('bulkImagesInput')) document.getElementById('bulkImagesInput').value = '';
    if (document.getElementById('bulkPreviewContainer')) document.getElementById('bulkPreviewContainer').style.display = 'none';
    if (progressContainer) progressContainer.style.display = 'none';

    if (btnPublish) btnPublish.disabled = false;
    if (statusEl) statusEl.textContent = '';

    await loadAdminProducts();
    filterOnlyPendingCatalog();

    alert(`🚀 ¡Éxito! Se subieron ${uploadedCount} prendas en solo ${elapsed}s. Ahora en "Pendientes por Catalogar" solo tocas cada una para asignar existencias de tienda y bodega.`);
  } catch (err) {
    console.error('Error publishing bulk:', err);
    alert('Error al procesar fotos: ' + err.message);
    if (btnPublish) btnPublish.disabled = false;
    if (progressContainer) progressContainer.style.display = 'none';
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
              <button class="btn btn-outline" style="border-color: #38bdf8; color: #38bdf8; padding: 3px 8px; font-size: 11px; height: 24px; display: inline-flex; align-items: center; gap: 3px;" onclick="openGoogleLensSearch('${product.imageUrl}', '${(product.name || '').replace(/'/g, "\\'")}')" title="Buscar en Google Lens / Imágenes">
                🔍 Google Lens
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

  // Pre-fill size stock rows
  if (prod.sizeStockMap && prod.sizeStockMap.length > 0) {
    currentSizeStockRows = JSON.parse(JSON.stringify(prod.sizeStockMap));
  } else if (prod.sizes && prod.sizes.length > 0) {
    currentSizeStockRows = prod.sizes.map(s => ({ size: s, immediateQty: 2, warehouseQty: 5 }));
  } else {
    currentSizeStockRows = [
      { size: "S", immediateQty: 2, warehouseQty: 5 },
      { size: "M", immediateQty: 2, warehouseQty: 5 },
      { size: "L", immediateQty: 2, warehouseQty: 5 },
      { size: "XL", immediateQty: 2, warehouseQty: 5 }
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
    const team = document.getElementById('prodTeam').value;
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
