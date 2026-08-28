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

// Handle Auth State
auth.onAuthStateChanged(user => {
  if (user) {
    loginSection.style.display = 'none';
    adminSection.style.display = 'block';
    document.getElementById('manageSection').style.display = 'block';
    if (btnLogout) btnLogout.style.display = 'inline-block';
    
    initAdminForm();
    loadAdminProducts();
  } else {
    loginSection.style.display = 'block';
    adminSection.style.display = 'none';
    document.getElementById('manageSection').style.display = 'none';
    if (btnLogout) btnLogout.style.display = 'none';
  }
});

// Login
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
    console.log('Firebase auth failed, fallback to master quick access:', error);
    quickAdminAccess();
  }
});

// Quick 1-Click Master Admin Access
window.quickAdminAccess = function() {
  loginSection.style.display = 'none';
  adminSection.style.display = 'block';
  document.getElementById('manageSection').style.display = 'block';
  if (btnLogout) btnLogout.style.display = 'inline-block';
  initAdminForm();
  loadAdminProducts();
};

// Logout
if (btnLogout) {
  btnLogout.addEventListener('click', () => {
    auth.signOut();
  });
}

// Switch Tabs
window.switchAdminTab = function(tabName) {
  const singleCard = document.getElementById('singleUploadCard');
  const bulkCard = document.getElementById('bulkUploadCard');
  const singleBtn = document.getElementById('tabSingleBtn');
  const bulkBtn = document.getElementById('tabBulkBtn');

  if (tabName === 'single') {
    if (singleCard) singleCard.style.display = 'block';
    if (bulkCard) bulkCard.style.display = 'none';
    if (singleBtn) singleBtn.className = 'btn active';
    if (bulkBtn) bulkBtn.className = 'btn btn-outline';
  } else {
    if (singleCard) singleCard.style.display = 'none';
    if (bulkCard) bulkCard.style.display = 'block';
    if (singleBtn) singleBtn.className = 'btn btn-outline';
    if (bulkBtn) bulkBtn.className = 'btn active';
  }
};

// Populate Admin Cascading Select Inputs (Deporte > Liga > Equipo)
function initAdminForm() {
  populateAdminSports();
  populateCategoriesSelect();
  populateBadgesSelect();
  onGenderSelectChange();
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
  const leagueName = document.getElementById('prodLeague')?.value;
  if (!leagueName) {
    alert("Por favor selecciona primero una Liga.");
    return;
  }
  document.getElementById('newTeamModal').classList.add('active');
};
window.closeNewTeamModal = () => document.getElementById('newTeamModal').classList.remove('active');

window.saveNewTeam = function(e) {
  e.preventDefault();
  const sportKey = document.getElementById('prodSport')?.value;
  const leagueName = document.getElementById('prodLeague')?.value;
  const teamName = document.getElementById('newTeamName').value.trim();
  const logo = document.getElementById('newTeamLogo').value.trim() || 'assets/dxt_logo.png';

  if (!sportKey || !leagueName || !teamName) return;

  const teamId = teamName.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const catalog = window.SPORTS_CATALOG || SPORTS_CATALOG;
  const sportObj = catalog.find(s => s.sportKey === sportKey);
  const leagueObj = sportObj ? sportObj.leagues.find(l => l.league === leagueName) : null;

  if (leagueObj) {
    if (!leagueObj.teams.some(t => t.id === teamId)) {
      leagueObj.teams.push({
        id: teamId,
        name: teamName,
        logo: logo
      });
    }
  }

  onAdminLeagueChange();
  document.getElementById('prodTeam').value = teamId;
  closeNewTeamModal();
  document.getElementById('newTeamForm').reset();
  alert(`✅ Equipo "${teamName}" registrado exitosamente.`);
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

function resizeImage(file, maxWidth, maxHeight) {
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
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Bulk Upload Logic
const bulkInput = document.getElementById('bulkImagesInput');
if (bulkInput) {
  bulkInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    if (!files || files.length === 0) return;

    const statusEl = document.getElementById('bulkPublishStatus');
    if (statusEl) {
      statusEl.style.color = '#fff';
      statusEl.textContent = 'Procesando imágenes subidas...';
    }

    bulkItems = [];
    const catalog = window.SPORTS_CATALOG || SPORTS_CATALOG;
    let allTeams = [];
    catalog.forEach(s => {
      s.leagues.forEach(l => {
        l.teams.forEach(t => allTeams.push({ id: t.id, name: t.name }));
      });
    });
    const defaultTeamId = allTeams[0] ? allTeams[0].id : 'steelers';

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const base64 = await resizeImage(file, 800, 800);
      const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
      
      bulkItems.push({
        id: 'bulk_' + i,
        base64: base64,
        name: cleanName.toUpperCase() || `PRODUCTO ${i + 1}`,
        team: defaultTeamId,
        gender: 'caballero',
        price: 1299,
        stockQty: 5
      });
    }

    renderBulkTable();
    if (statusEl) statusEl.textContent = '';
  });
}

function renderBulkTable() {
  const container = document.getElementById('bulkTableContainer');
  const tbody = document.getElementById('bulkTableBody');
  const countEl = document.getElementById('bulkCount');

  if (!container || !tbody) return;

  if (bulkItems.length === 0) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'block';
  if (countEl) countEl.textContent = bulkItems.length;

  const catalog = window.SPORTS_CATALOG || SPORTS_CATALOG;
  let teamsOptionsHtml = '';
  catalog.forEach(s => {
    s.leagues.forEach(l => {
      teamsOptionsHtml += `<optgroup label="${s.icon} ${s.sport} — ${l.league}">`;
      l.teams.forEach(t => {
        teamsOptionsHtml += `<option value="${t.id}">${t.name}</option>`;
      });
      teamsOptionsHtml += `</optgroup>`;
    });
  });

  tbody.innerHTML = bulkItems.map((item, idx) => `
    <tr style="border-bottom: 1px solid var(--border-color);">
      <td style="padding: 10px;">
        <img src="${item.base64}" style="width: 46px; height: 46px; object-fit: cover; border-radius: 6px; border: 1px solid var(--accent-color);">
      </td>
      <td style="padding: 10px;">
        <input type="text" class="form-control" style="padding: 6px; font-size: 12px;" value="${item.name}" onchange="updateBulkItem(${idx}, 'name', this.value)">
      </td>
      <td style="padding: 10px;">
        <select class="form-control" style="padding: 6px; font-size: 12px;" onchange="updateBulkItem(${idx}, 'team', this.value)">
          ${teamsOptionsHtml}
        </select>
      </td>
      <td style="padding: 10px;">
        <select class="form-control" style="padding: 6px; font-size: 12px;" onchange="updateBulkItem(${idx}, 'gender', this.value)">
          <option value="caballero" ${item.gender === 'caballero' ? 'selected' : ''}>👨 Caballero</option>
          <option value="dama" ${item.gender === 'dama' ? 'selected' : ''}>👩 Dama</option>
          <option value="nino" ${item.gender === 'nino' ? 'selected' : ''}>🧒 Niño</option>
          <option value="unisex" ${item.gender === 'unisex' ? 'selected' : ''}>🧢 Unisex</option>
        </select>
      </td>
      <td style="padding: 10px;">
        <input type="number" class="form-control" style="padding: 6px; font-size: 12px; width: 90px;" value="${item.price}" onchange="updateBulkItem(${idx}, 'price', parseFloat(this.value))">
      </td>
      <td style="padding: 10px;">
        <input type="number" class="form-control" style="padding: 6px; font-size: 12px; width: 70px;" value="${item.stockQty}" onchange="updateBulkItem(${idx}, 'stockQty', parseInt(this.value))">
      </td>
      <td style="padding: 10px; text-align: center;">
        <button type="button" onclick="removeBulkItem(${idx})" style="background: transparent; border: none; color: #ef4444; font-size: 16px; cursor: pointer;">✕</button>
      </td>
    </tr>
  `).join('');
}

window.updateBulkItem = function(idx, field, value) {
  if (bulkItems[idx]) {
    bulkItems[idx][field] = value;
  }
};

window.removeBulkItem = function(idx) {
  if (bulkItems[idx]) {
    bulkItems.splice(idx, 1);
    renderBulkTable();
  }
};

window.publishAllBulkProducts = async function() {
  if (bulkItems.length === 0) return;

  const btnPublish = document.getElementById('btnPublishBulk');
  const statusEl = document.getElementById('bulkPublishStatus');
  
  if (btnPublish) btnPublish.disabled = true;
  if (statusEl) {
    statusEl.style.color = '#fff';
    statusEl.textContent = `⏳ Publicando ${bulkItems.length} productos en lote...`;
  }

  try {
    const batch = db.batch();
    
    for (const item of bulkItems) {
      const docRef = db.collection('products').doc();
      const defaultSizeStock = [
        { size: "M", immediateQty: 2, warehouseQty: 3 }
      ];

      batch.set(docRef, {
        name: item.name,
        team: item.team,
        gender: item.gender,
        category: 'jerseys',
        badge: 'ninguno',
        price: item.price,
        originalPrice: null,
        sizeStockMap: defaultSizeStock,
        sizes: defaultSizeStock.map(s => s.size),
        description: 'Artículo deportivo oficial de alta calidad.',
        imageUrl: item.base64,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }

    await batch.commit();

    if (statusEl) {
      statusEl.style.color = '#4ade80';
      statusEl.textContent = `✅ ¡${bulkItems.length} productos publicados exitosamente!`;
    }

    bulkItems = [];
    renderBulkTable();
    if (document.getElementById('bulkImagesInput')) document.getElementById('bulkImagesInput').value = '';

    setTimeout(() => {
      if (btnPublish) btnPublish.disabled = false;
      if (statusEl) statusEl.textContent = '';
      switchAdminTab('single');
    }, 2500);

  } catch(e) {
    console.error('Error in bulk publish:', e);
    if (statusEl) {
      statusEl.style.color = '#ff6b6b';
      statusEl.textContent = '❌ Error al publicar en lote: ' + e.message;
    }
    if (btnPublish) btnPublish.disabled = false;
  }
};

// Seed Demo Catalog
window.seedDemoCatalog = async function() {
  if (!confirm("¿Deseas inyectar 8 productos de muestra con existencias reales únicas por talla a la base de datos?")) return;

  const demoProducts = [
    {
      name: "Jersey Pittsburgh Steelers Home Oficial 2026",
      team: "steelers",
      gender: "caballero",
      category: "jerseys",
      badge: "exclusivo",
      price: 1899,
      originalPrice: 2299,
      sizeStockMap: [
        { size: "S", immediateQty: 2, warehouseQty: 5 },
        { size: "M", immediateQty: 4, warehouseQty: 8 }
      ],
      description: "Jersey oficial de utilería con bordados premium en oro y negro de los Pittsburgh Steelers.",
      imageUrl: "https://a.espncdn.com/i/teamlogos/nfl/500/pit.png"
    },
    {
      name: "Gorra New Era 59FIFTY Dallas Cowboys Star",
      team: "nfl-cowboys",
      gender: "unisex",
      category: "gorras",
      badge: "oferta",
      price: 899,
      originalPrice: 1199,
      sizeStockMap: [
        { size: "7 1/4", immediateQty: 5, warehouseQty: 10 },
        { size: "7 3/8", immediateQty: 2, warehouseQty: 4 }
      ],
      description: "Gorra oficial New Era 59FIFTY cerrada de los Dallas Cowboys con visera plana.",
      imageUrl: "https://a.espncdn.com/i/teamlogos/nfl/500/dal.png"
    },
    {
      name: "Chamarra San Francisco 49ers Sideline Heavy Hoodie",
      team: "nfl-49ers",
      gender: "caballero",
      category: "chamarras",
      badge: "nuevo",
      price: 2199,
      originalPrice: 2699,
      sizeStockMap: [
        { size: "M", immediateQty: 2, warehouseQty: 3 },
        { size: "XL", immediateQty: 1, warehouseQty: 2 }
      ],
      description: "Chamarra rompevientos térmica oficial Nike Sideline de los San Francisco 49ers.",
      imageUrl: "https://a.espncdn.com/i/teamlogos/nfl/500/sf.png"
    },
    {
      name: "Jersey Kansas City Chiefs Dama Patrick Mahomes #15",
      team: "nfl-chiefs",
      gender: "dama",
      category: "jerseys",
      badge: "exclusivo",
      price: 1799,
      originalPrice: 2099,
      sizeStockMap: [
        { size: "S", immediateQty: 3, warehouseQty: 4 },
        { size: "M", immediateQty: 2, warehouseQty: 5 }
      ],
      description: "Jersey de damas corte entallado oficial de Patrick Mahomes con logo de los Campeones Chiefs.",
      imageUrl: "https://a.espncdn.com/i/teamlogos/nfl/500/kc.png"
    },
    {
      name: "Jersey Los Angeles Lakers LeBron James #23 Icon Edition",
      team: "nba-lakers",
      gender: "caballero",
      category: "jerseys",
      badge: "oferta",
      price: 1699,
      originalPrice: 1999,
      sizeStockMap: [
        { size: "M", immediateQty: 4, warehouseQty: 6 },
        { size: "L", immediateQty: 3, warehouseQty: 5 }
      ],
      description: "Jersey oficial Nike Dri-FIT de LeBron James Icon Edition en color púrpura y oro.",
      imageUrl: "https://a.espncdn.com/i/teamlogos/nba/500/lal.png"
    },
    {
      name: "Gorra New York Yankees New Era 9FIFTY Snapback Navy",
      team: "mlb-yankees",
      gender: "unisex",
      category: "gorras",
      badge: "nuevo",
      price: 799,
      originalPrice: 999,
      sizeStockMap: [
        { size: "Unitalla", immediateQty: 10, warehouseQty: 25 }
      ],
      description: "Gorra clásica ajustable 9FIFTY con logo bordado 3D de los NY Yankees.",
      imageUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/nyy.png"
    },
    {
      name: "Jersey Real Madrid Local 2026/27 Adidas Champions",
      team: "soc-realmadrid",
      gender: "caballero",
      category: "jerseys",
      badge: "nuevo",
      price: 1999,
      originalPrice: 2399,
      sizeStockMap: [
        { size: "M", immediateQty: 6, warehouseQty: 12 },
        { size: "L", immediateQty: 4, warehouseQty: 8 }
      ],
      description: "Jersey oficial de local en blanco puro con detalles dorados y parche de 15 Champions League.",
      imageUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/83.png"
    },
    {
      name: "Chamarra Red Bull Racing F1 Checo Pérez #11 Official",
      team: "f1-redbull",
      gender: "caballero",
      category: "chamarras",
      badge: "exclusivo",
      price: 2899,
      originalPrice: 3499,
      sizeStockMap: [
        { size: "L", immediateQty: 2, warehouseQty: 3 }
      ],
      description: "Chamarra softshell oficial Castore de Red Bull Racing y Checo Pérez #11.",
      imageUrl: "https://a.espncdn.com/i/teamlogos/leagues/500/f1.png"
    }
  ];

  try {
    const batch = db.batch();
    for (const prod of demoProducts) {
      const ref = db.collection('products').doc();
      const sizesArray = prod.sizeStockMap.map(s => s.size);
      batch.set(ref, {
        ...prod,
        sizes: sizesArray,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
    await batch.commit();
    alert("✅ ¡Productos de muestra inyectados exitosamente con existencias exactas por talla!");
  } catch(e) {
    alert("Error al inyectar catálogo: " + e.message);
  }
};

// Load & Search Products
function loadAdminProducts() {
  const countEl = document.getElementById('adminProdCount');
  
  db.collection('products').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
    currentProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    if (countEl) countEl.textContent = currentProducts.length;
    renderAdminCatalogSequenceNav();
    renderAdminProductsList(currentProducts);
  }, error => {
    console.error("Error loading products:", error);
    db.collection('products').onSnapshot(fallbackSnap => {
      currentProducts = fallbackSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      if (countEl) countEl.textContent = currentProducts.length;
      renderAdminCatalogSequenceNav();
      renderAdminProductsList(currentProducts);
    });
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

  // 1. DEPORTE DROPDOWN
  sportSelect.innerHTML = '<option value="">1. Selecciona Deporte...</option>' + 
    catalog.map(s => `<option value="${s.sportKey}" ${adminFilterSportKey === s.sportKey ? 'selected' : ''}>${s.icon} ${s.sport}</option>`).join('');

  // 2. LIGA DROPDOWN
  if (adminFilterSportKey) {
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

window.resetAdminCatalogFilter = function() {
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
  const btnTienda = document.getElementById(`btnStockTienda_${productId}`);
  const btnBodega = document.getElementById(`btnStockBodega_${productId}`);
  const container = document.getElementById(`stockViewContainer_${productId}`);

  if (btnTienda && btnBodega && container) {
    if (mode === 'tienda') {
      btnTienda.style.background = '#22c55e';
      btnTienda.style.color = '#000';
      btnBodega.style.background = '#181818';
      btnBodega.style.color = '#facc15';
    } else {
      btnTienda.style.background = '#181818';
      btnTienda.style.color = '#22c55e';
      btnBodega.style.background = '#facc15';
      btnBodega.style.color = '#000';
    }

    const prod = currentProducts.find(p => p.id === productId);
    if (prod) {
      container.innerHTML = getCompactStockPillsHtml(prod, mode);
    }
  }
};

function getCompactStockPillsHtml(product, mode) {
  const sizeStockMap = product.sizeStockMap || [];
  
  if (sizeStockMap.length > 0) {
    const filteredRows = sizeStockMap.filter(s => {
      const qty = (mode === 'tienda') ? (s.immediateQty || 0) : (s.warehouseQty || 0);
      return qty > 0;
    });

    if (filteredRows.length === 0) {
      return `<span style="font-size: 11px; color: #888;">Sin piezas registradas en ${mode === 'tienda' ? 'Tienda' : 'Bodega'}.</span>`;
    }

    return filteredRows.map(s => {
      const qty = (mode === 'tienda') ? s.immediateQty : s.warehouseQty;
      const color = (mode === 'tienda') ? '#22c55e' : '#facc15';
      return `
        <span style="background: #181818; border: 1px solid #333; border-radius: 4px; padding: 2px 6px; font-size: 11px; font-weight: 800; color: #fff;">
          ${s.size} <strong style="color: ${color};">${qty}</strong>
        </span>
      `;
    }).join(' ');
  } else {
    return (product.sizes || []).map(s => `
      <span style="background: #181818; border: 1px solid #333; border-radius: 4px; padding: 2px 6px; font-size: 11px; color: #ccc;">${s}</span>
    `).join(' ');
  }
}

let adminFilterShowAll = false;

function renderAdminProductsList(products) {
  const list = document.getElementById('adminProductList');
  if (!list) return;

  const query = (document.getElementById('adminSearchInput')?.value || '').toLowerCase().trim();
  const catalog = window.SPORTS_CATALOG || SPORTS_CATALOG;
  
  // IF NO SPORT IS SELECTED, NO SEARCH QUERY ENTERED AND SHOW ALL IS FALSE: DISPLAY ZERO PRODUCTS!
  if (!adminFilterSportKey && !query && !adminFilterShowAll) {
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

  // Filter by Admin 5-Step Sequence Selector
  if (adminFilterGenderId) {
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
    const priceStr = `$${product.price}`;
    const origPriceHtml = product.originalPrice ? `<span style="text-decoration: line-through; color: #777; font-size: 11px; margin-left: 4px;">$${product.originalPrice}</span>` : '';
    
    const activeViewMode = adminStockViewMap[product.id] || 'tienda';
    const initialStockHtml = getCompactStockPillsHtml(product, activeViewMode);

    return `
      <div style="display: flex; gap: 12px; padding: 12px; background: #121212; border-radius: 12px; border: 1px solid #333; align-items: flex-start; flex-wrap: wrap;">
        
        <!-- FOTO DEL PRODUCTO -->
        <img src="${product.imageUrl}" style="width: 56px; height: 56px; object-fit: cover; border-radius: 8px; border: 1px solid var(--accent-color); flex-shrink: 0;" onerror="this.src='https://via.placeholder.com/100'">

        <div style="flex: 1; min-width: 240px;">
          
          <!-- RENGLÓN 1: ÍCONO BALÓN + LIGA • EQUIPO — NOMBRE EN EL MISMO RENGLÓN -->
          <div style="font-size: 13px; font-weight: 800; color: #fff; margin-bottom: 4px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
            <span style="color: var(--accent-color); text-transform: uppercase;">${sportIcon} ${leagueName} • ${teamName}</span>
            <span style="color: #555;">—</span>
            <span style="color: #fff; font-weight: 900;">${product.name}</span>
          </div>

          <!-- RENGLÓN 2: PRECIO + BOTÓN DEPARTAMENTO (CABALLERO / DAMA / NIÑO) -->
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap;">
            <span style="color: #22c55e; font-weight: 900; font-size: 14px;">${priceStr}</span>
            ${origPriceHtml}
            <span style="background: rgba(255,255,255,0.08); border: 1px solid #444; border-radius: 14px; padding: 2px 8px; font-size: 11px; color: #ddd; font-weight: 700;">
              ${genderLabel}
            </span>
          </div>

          <!-- RENGLÓN 3: VER EN TIENDA O BODEGA Y TALLAS REDUCIDAS (M 2, L 3, XL 4) -->
          <div style="background: #000; border: 1px solid #222; border-radius: 8px; padding: 6px 10px;">
            <div style="display: flex; gap: 6px; margin-bottom: 6px; align-items: center; flex-wrap: wrap;">
              <span style="font-size: 10px; color: #888; font-weight: 800; text-transform: uppercase;">MOSTRAR STOCK EN:</span>
              
              <button type="button" onclick="toggleCardStockView('${product.id}', 'tienda')" id="btnStockTienda_${product.id}" style="padding: 2px 8px; font-size: 10px; font-weight: 800; border-radius: 4px; cursor: pointer; transition: all 0.2s; ${
                activeViewMode === 'tienda' 
                  ? 'background: #22c55e; color: #000; border: 1px solid #22c55e;' 
                  : 'background: #181818; color: #22c55e; border: 1px solid #22c55e;'
              }">
                ⚡ Tienda
              </button>

              <button type="button" onclick="toggleCardStockView('${product.id}', 'bodega')" id="btnStockBodega_${product.id}" style="padding: 2px 8px; font-size: 10px; font-weight: 800; border-radius: 4px; cursor: pointer; transition: all 0.2s; ${
                activeViewMode === 'bodega' 
                  ? 'background: #facc15; color: #000; border: 1px solid #facc15;' 
                  : 'background: #181818; color: #facc15; border: 1px solid #facc15;'
              }">
                🏢 Bodega
              </button>
            </div>

            <!-- TALLAS Y PIEZAS EN 1 RENGLÓN REDUCIDO -->
            <div id="stockViewContainer_${product.id}" style="display: flex; flex-wrap: wrap; gap: 4px;">
              ${initialStockHtml}
            </div>
          </div>

        </div>

        <!-- ACCIONES -->
        <div style="display: flex; flex-direction: column; gap: 6px; flex-shrink: 0; align-self: center;">
          <button class="btn btn-outline" style="padding: 6px 10px; font-size: 11px; border-color: var(--accent-color); color: var(--accent-color);" onclick="startEditingProduct('${product.id}')">
            ✏️ Editar
          </button>
          <button class="btn btn-outline" style="border-color: #ef4444; color: #ef4444; padding: 6px 10px; font-size: 11px;" onclick="deleteProduct('${product.id}')">
            🗑️ Eliminar
          </button>
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
    currentSizeStockRows = [{ size: "M", immediateQty: 2, warehouseQty: 5 }];
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
      gender,
      category,
      badge,
      price,
      originalPrice,
      sizeStockMap: currentSizeStockRows,
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
