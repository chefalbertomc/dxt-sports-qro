// Parse URL parameters
const urlParams = new URLSearchParams(window.location.search);

// Wizard Navigation Flow State
let currentWizardStep = 1; // 1: Deporte, 2: Liga, 3: Equipo
let wizardSportObj = null;
let wizardLeagueObj = null;
let wizardTeamObj = null;

let activeGenderFilter = urlParams.get('gender') || 'all';
let activeSportFilter = urlParams.get('sport') || 'all';
let activeCategoryFilter = urlParams.get('category') || 'all';
let activeTeamFilter = urlParams.get('team') || 'all';
let activePromoFilter = urlParams.get('promo') || 'all';
let searchQuery = '';

// Shopping Cart State
let cart = JSON.parse(localStorage.getItem('catch_sports_cart') || '[]');
let allProducts = [];

// DOM References
let productGrid, loader, storeTitle, storeSubtitle, searchInput, teamFilterSelect;

function initDOMReferences() {
  productGrid = document.getElementById('productGrid');
  loader = document.getElementById('loader');
  storeTitle = document.getElementById('storeTitle');
  storeSubtitle = document.getElementById('storeSubtitle');
  searchInput = document.getElementById('searchInput');
  teamFilterSelect = document.getElementById('teamFilterSelect');
}

// Format price to currency
function formatPrice(price) {
  if (isNaN(price)) return '$0.00 MXN';
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(price);
}

// ============================================
// STEP-BY-STEP GUIDED WIZARD NAVIGATION FLOW
// ============================================
function initWizardNavigation() {
  initDOMReferences();
  
  if (urlParams.get('team')) {
    const teamId = urlParams.get('team');
    for (const s of SPORTS_CATALOG) {
      for (const l of s.leagues) {
        const t = l.teams.find(item => item.id === teamId);
        if (t) {
          wizardSportObj = s;
          wizardLeagueObj = l;
          wizardTeamObj = t;
          currentWizardStep = 3;
          activeTeamFilter = t.id;
          break;
        }
      }
    }
  }
  renderWizardStep();
}

function renderWizardStep() {
  const cardsGrid = document.getElementById('wizardCardsGrid');
  const titleEl = document.getElementById('wizardTitle');
  const subTitleEl = document.getElementById('wizardSubtitle');
  const pill1 = document.getElementById('pillStep1');
  const pill2 = document.getElementById('pillStep2');
  const pill3 = document.getElementById('pillStep3');
  const btnReset = document.getElementById('btnResetWizard');

  if (!cardsGrid) return;
  
  const catalog = window.SPORTS_CATALOG || SPORTS_CATALOG;
  if (!catalog || catalog.length === 0) return;

  // Update Breadcrumb Pills
  if (pill1) pill1.className = `wizard-step-pill ${currentWizardStep === 1 ? 'active' : (wizardSportObj ? 'completed' : '')}`;
  if (pill2) pill2.className = `wizard-step-pill ${currentWizardStep === 2 ? 'active' : (wizardLeagueObj ? 'completed' : '')}`;
  if (pill3) pill3.className = `wizard-step-pill ${currentWizardStep === 3 ? 'active' : (wizardTeamObj ? 'completed' : '')}`;

  const labelSport = document.getElementById('selectedSportLabel');
  const labelLeague = document.getElementById('selectedLeagueLabel');
  const labelTeam = document.getElementById('selectedTeamLabel');

  if (labelSport) labelSport.textContent = wizardSportObj ? `: ${wizardSportObj.sport}` : '';
  if (labelLeague) labelLeague.textContent = wizardLeagueObj ? `: ${wizardLeagueObj.league}` : '';
  if (labelTeam) labelTeam.textContent = wizardTeamObj ? `: ${wizardTeamObj.name}` : '';

  if (btnReset) btnReset.style.display = (wizardSportObj || wizardLeagueObj || wizardTeamObj) ? 'inline-block' : 'none';

  // STEP 1: SELECT SPORT
  if (currentWizardStep === 1) {
    if (titleEl) titleEl.textContent = 'PASO 1: SELECCIONA EL DEPORTE';
    if (subTitleEl) subTitleEl.textContent = 'Elige la disciplina deportiva que deseas explorar';

    cardsGrid.innerHTML = catalog.map(s => `
      <div class="wizard-card" onclick="selectWizardSport('${s.sportKey}')">
        <div class="wizard-card-icon">${s.icon}</div>
        <div class="wizard-card-label">${s.sport}</div>
        <div class="wizard-card-sublabel">${s.leagues.length} ${s.leagues.length === 1 ? 'Liga' : 'Ligas'}</div>
      </div>
    `).join('');
  }
  
  // STEP 2: SELECT LEAGUE
  else if (currentWizardStep === 2 && wizardSportObj) {
    if (titleEl) titleEl.textContent = `PASO 2: SELECCIONA LA LIGA (${wizardSportObj.sport.toUpperCase()})`;
    if (subTitleEl) subTitleEl.textContent = `Haz clic en la liga o torneo de ${wizardSportObj.sport}`;

    cardsGrid.innerHTML = wizardSportObj.leagues.map(l => {
      const totalTeams = l.teams.length;
      const logoHtml = l.leagueLogo ? `<img src="${l.leagueLogo}" class="wizard-card-img" onerror="this.src='assets/catch_sports_logo.png'"/>` : `<div class="wizard-card-icon">${wizardSportObj.icon}</div>`;
      return `
        <div class="wizard-card" onclick="selectWizardLeague('${l.league}')">
          ${logoHtml}
          <div class="wizard-card-label">${l.league}</div>
          <div class="wizard-card-sublabel">${totalTeams} Equipos</div>
        </div>
      `;
    }).join('');
  }

  // STEP 3: SELECT TEAM
  else if (currentWizardStep === 3 && wizardLeagueObj) {
    if (titleEl) titleEl.textContent = `PASO 3: SELECCIONA TU EQUIPO (${wizardLeagueObj.league})`;
    if (subTitleEl) subTitleEl.textContent = `Explora los artículos oficiales de tu franquicia favorita`;

    cardsGrid.innerHTML = wizardLeagueObj.teams.map(t => {
      const logoHtml = t.logo ? `<img src="${t.logo}" class="wizard-card-img" onerror="this.src='assets/catch_sports_logo.png'"/>` : `<div class="wizard-card-icon">🛡️</div>`;
      const isSelected = wizardTeamObj && wizardTeamObj.id === t.id;
      return `
        <div class="wizard-card ${isSelected ? 'selected-card' : ''}" style="${isSelected ? 'border-color: var(--accent-color); background: #242424;' : ''}" onclick="selectWizardTeam('${t.id}')">
          ${logoHtml}
          <div class="wizard-card-label">${t.name}</div>
          <div class="wizard-card-sublabel">Ver Colección →</div>
        </div>
      `;
    }).join('');
  }
}

window.goToWizardStep = function(step) {
  if (step === 1) {
    resetWizardToStep1();
  } else if (step === 2 && wizardSportObj) {
    currentWizardStep = 2;
    wizardTeamObj = null;
    renderWizardStep();
  } else if (step === 3 && wizardLeagueObj) {
    currentWizardStep = 3;
    renderWizardStep();
  }
};

window.selectWizardSport = function(sportKey) {
  const catalog = window.SPORTS_CATALOG || SPORTS_CATALOG;
  wizardSportObj = catalog.find(s => s.sportKey === sportKey);
  wizardLeagueObj = null;
  wizardTeamObj = null;
  
  if (!wizardSportObj) return;

  if (wizardSportObj.leagues.length === 1) {
    wizardLeagueObj = wizardSportObj.leagues[0];
    currentWizardStep = 3;
  } else {
    currentWizardStep = 2;
  }
  
  activeSportFilter = sportKey;
  activeTeamFilter = 'all';
  renderWizardStep();
  updateStoreHeader();
  renderProducts();
};

window.selectWizardLeague = function(leagueName) {
  if (!wizardSportObj) return;
  wizardLeagueObj = wizardSportObj.leagues.find(l => l.league === leagueName);
  wizardTeamObj = null;
  currentWizardStep = 3;
  
  renderWizardStep();
  updateStoreHeader();
  renderProducts();
};

window.selectWizardTeam = function(teamId) {
  const catalog = window.SPORTS_CATALOG || SPORTS_CATALOG;
  for (const s of catalog) {
    for (const l of s.leagues) {
      const t = l.teams.find(item => item.id === teamId);
      if (t) {
        wizardSportObj = s;
        wizardLeagueObj = l;
        wizardTeamObj = t;
        break;
      }
    }
  }
  
  activeTeamFilter = teamId;
  activeSportFilter = 'all';
  activeCategoryFilter = 'all';
  if (teamFilterSelect) teamFilterSelect.value = teamId;
  
  renderWizardStep();
  updateStoreHeader();
  renderProducts();
  
  document.getElementById('catalogToolbar')?.scrollIntoView({ behavior: 'smooth' });
};

window.resetWizardToStep1 = function() {
  currentWizardStep = 1;
  wizardSportObj = null;
  wizardLeagueObj = null;
  wizardTeamObj = null;
  activeTeamFilter = 'all';
  activeSportFilter = 'all';
  activeCategoryFilter = 'all';
  if (teamFilterSelect) teamFilterSelect.value = 'all';
  
  renderWizardStep();
  updateStoreHeader();
  renderProducts();
};

// =================================================================
// SINGLE-LINE EXPANDABLE CASCADING SELECTOR SYSTEM
// LEVEL 1: NOMBRES DE LOS DEPORTES (Fútbol Americano, Básquetbol, Béisbol, Fútbol, F1)
// LEVEL 2: LOGOS CHIQUITOS DE LAS LIGAS (NFL, NBA, MLB, Liga MX, Europeas)
// LEVEL 3: LOGOS CHIQUITOS DE LOS EQUIPOS (Steelers, Cowboys, América, Real Madrid)
// TODO EN LA MISMA LÍNEA CONTINUA SIN OCUPAR ESPACIO VERTICAL
// =================================================================

let cascadingLevel = 1; // 1: Sports, 2: Leagues, 3: Teams

function renderSingleLineCascadingBar() {
  const bar = document.getElementById('singleLineCascadingBar');
  if (!bar) return;

  const catalog = window.SPORTS_CATALOG || SPORTS_CATALOG;

  // LEVEL 1: SHOW SPORTS ON THE SINGLE LINE
  if (cascadingLevel === 1) {
    bar.innerHTML = `
      <span style="font-size: 10px; font-weight: 900; color: var(--accent-color); text-transform: uppercase; white-space: nowrap; align-self: center; margin-right: 2px; flex-shrink: 0;">
        ⚡ DEPORTE:
      </span>
      ${catalog.map(s => `
        <button onclick="onSingleLineSportClick('${s.sportKey}')" class="league-dock-chip ${wizardSportObj && wizardSportObj.sportKey === s.sportKey ? 'active' : ''}">
          <span style="font-size: 14px;">${s.icon}</span> ${s.sport}
        </button>
      `).join('')}
    `;
  }

  // LEVEL 2: SHOW LEAGUES ON THE EXACT SAME SINGLE LINE
  else if (cascadingLevel === 2 && wizardSportObj) {
    bar.innerHTML = `
      <button onclick="goBackSingleLineLevel(1)" class="league-dock-chip" style="background: rgba(250, 204, 21, 0.15); border-color: var(--accent-color); color: var(--accent-color);">
        ↩️ Deportes
      </button>
      <span style="font-size: 10px; font-weight: 900; color: #aaa; text-transform: uppercase; white-space: nowrap; align-self: center; margin-right: 2px; flex-shrink: 0;">
        🏆 LIGAS:
      </span>
      ${wizardSportObj.leagues.map(l => `
        <button onclick="onSingleLineLeagueClick('${l.league}')" class="league-dock-chip ${wizardLeagueObj && wizardLeagueObj.league === l.league ? 'active' : ''}">
          <img src="${l.leagueLogo}" referrerpolicy="no-referrer" style="width: 18px; height: 18px; object-fit: contain;" onerror="this.src='assets/catch_sports_logo.png'"/>
          ${l.league}
        </button>
      `).join('')}
    `;
  }

  // LEVEL 3: SHOW TEAMS WITH SMALL LOGOS ON THE EXACT SAME SINGLE LINE
  else if (cascadingLevel === 3 && wizardLeagueObj) {
    bar.innerHTML = `
      <button onclick="goBackSingleLineLevel(2)" class="league-dock-chip" style="background: rgba(250, 204, 21, 0.15); border-color: var(--accent-color); color: var(--accent-color);">
        ↩️ ${wizardLeagueObj.league}
      </button>
      <button onclick="onSingleLineTeamClick('all')" class="league-dock-chip ${activeTeamFilter === 'all' ? 'active' : ''}">
        🔥 Todos los Equipos
      </button>
      ${wizardLeagueObj.teams.map(t => `
        <button onclick="onSingleLineTeamClick('${t.id}')" class="league-dock-chip ${activeTeamFilter === t.id ? 'active' : ''}">
          <img src="${t.logo}" referrerpolicy="no-referrer" style="width: 18px; height: 18px; object-fit: contain;" onerror="this.src='assets/catch_sports_logo.png'"/>
          ${t.name}
        </button>
      `).join('')}
    `;
  }

  bar.scrollTo({ left: 0, behavior: 'smooth' });
}

window.onSingleLineSportClick = function(sportKey) {
  const catalog = window.SPORTS_CATALOG || SPORTS_CATALOG;
  wizardSportObj = catalog.find(s => s.sportKey === sportKey);
  wizardLeagueObj = null;
  wizardTeamObj = null;

  activeSportFilter = sportKey;
  activeTeamFilter = 'all';

  if (wizardSportObj && wizardSportObj.leagues.length === 1) {
    wizardLeagueObj = wizardSportObj.leagues[0];
    cascadingLevel = 3; // Go directly to teams if only 1 league
  } else {
    cascadingLevel = 2; // Show leagues
  }

  renderSingleLineCascadingBar();
  updateStoreHeader();
  renderProducts();
};

window.onSingleLineLeagueClick = function(leagueName) {
  if (!wizardSportObj) return;
  wizardLeagueObj = wizardSportObj.leagues.find(l => l.league === leagueName);
  wizardTeamObj = null;

  cascadingLevel = 3; // Show teams of that league

  renderSingleLineCascadingBar();
  updateStoreHeader();
  renderProducts();
};

window.onSingleLineTeamClick = function(teamId) {
  if (teamId === 'all') {
    activeTeamFilter = 'all';
    wizardTeamObj = null;
  } else {
    activeTeamFilter = teamId;
    if (wizardLeagueObj) {
      wizardTeamObj = wizardLeagueObj.teams.find(t => t.id === teamId) || null;
    }
  }

  renderSingleLineCascadingBar();
  updateStoreHeader();
  renderProducts();
};

window.goBackSingleLineLevel = function(targetLevel) {
  cascadingLevel = targetLevel;
  if (targetLevel === 1) {
    wizardSportObj = null;
    wizardLeagueObj = null;
    wizardTeamObj = null;
    activeSportFilter = 'all';
    activeTeamFilter = 'all';
  } else if (targetLevel === 2) {
    wizardTeamObj = null;
    activeTeamFilter = 'all';
  }

  renderSingleLineCascadingBar();
  updateStoreHeader();
  renderProducts();
};

// DYNAMIC LEAGUE HUB PORTAL ROUTER SYSTEM
window.openLeagueHub = function(sportKey) {
  selectSportLevel(sportKey);
};

window.openDepartmentHub = function(categoryKey) {
  activeCategoryFilter = categoryKey;
  activeSportFilter = 'all';
  activeTeamFilter = 'all';
  activeGenderFilter = 'all';

  document.querySelectorAll('.league-dock-chip').forEach(c => c.classList.remove('active'));
  document.getElementById(`dock-${categoryKey}`)?.classList.add('active');

  let title = 'JERSEYS OFICIALES DE UTILERÍA';
  let icon = '👕';
  if (categoryKey === 'chamarras') { title = 'SUDADERAS & HOODIES FLEECE'; icon = '🧥'; }
  if (categoryKey === 'gorras') { title = 'GORRAS NEW ERA 59FIFTY & 9FIFTY'; icon = '🧢'; }

  const heroContainer = document.getElementById('dynamicPortalHero');
  if (heroContainer) {
    heroContainer.innerHTML = `
      <section style="background: radial-gradient(circle at 50% 30%, #201d16 0%, #09090b 100%); border-bottom: 2px solid var(--accent-color); padding: 32px 16px;">
        <div class="container" style="max-width: 950px; text-align: center;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 8px;">
            <button onclick="showAllProductsDirectly()" class="btn btn-outline" style="font-size: 11px; padding: 6px 14px;">
              ← Volver al Portal Principal
            </button>
            <span style="font-size: 11px; font-weight: 900; color: var(--accent-color); text-transform: uppercase;">
              ${icon} DEPARTAMENTO ESPECIALIZADO
            </span>
          </div>

          <h1 style="font-family: var(--font-display); font-size: clamp(24px, 4.5vw, 36px); font-weight: 900; color: #fff; text-transform: uppercase; margin-bottom: 8px;">
            COLECCIÓN <span style="color: var(--accent-color);">${title}</span>
          </h1>
          <p style="color: #aaa; font-size: 13px;">
            Encuentra todas las ediciones de ${title.toLowerCase()} clasificadas por equipo y talla.
          </p>
        </div>
      </section>
    `;
  }

  renderWizardStep();
  updateStoreHeader();
  renderProducts();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.setCategoryFilterDirect = function(catId) {
  openDepartmentHub(catId);
};

window.showAllProductsDirectly = function() {
  activeTeamFilter = 'all';
  activeSportFilter = 'all';
  activeCategoryFilter = 'all';
  activeGenderFilter = 'all';
  wizardSportObj = null;
  wizardLeagueObj = null;
  wizardTeamObj = null;
  currentWizardStep = 1;
  if (teamFilterSelect) teamFilterSelect.value = 'all';
  
  document.querySelectorAll('.league-dock-chip').forEach(c => c.classList.remove('active'));
  document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));

  // Reset General Portal Banner
  const heroContainer = document.getElementById('dynamicPortalHero');
  if (heroContainer) {
    heroContainer.innerHTML = `
      <section style="background: radial-gradient(circle at 50% 30%, #242217 0%, #09090b 100%); border-bottom: 1px solid var(--border-gold); padding: 36px 16px; text-align: center;">
        <div class="container" style="max-width: 900px;">
          <span style="background: rgba(250, 204, 21, 0.15); border: 1px solid var(--accent-color); color: var(--accent-color); font-size: 11px; font-weight: 900; padding: 4px 14px; border-radius: 20px; text-transform: uppercase; letter-spacing: 1px; display: inline-block; margin-bottom: 12px;">
            ⭐ TIENDA OFICIAL DE UTILERÍA Y EDICIONES DE FANÁTICO 2026
          </span>
          <h1 style="font-family: var(--font-display); font-size: clamp(26px, 5vw, 44px); font-weight: 900; color: #fff; line-height: 1.1; margin-bottom: 10px; text-transform: uppercase;">
            EQUÍPATE CON LO OFICIAL DE TU <span style="color: var(--accent-color);">EQUIPO FAVORITO</span>
          </h1>
          <p style="color: #bbb; font-size: 14px; max-width: 650px; margin: 0 auto 20px; line-height: 1.4;">
            Jerseys oficiales bordados, sudaderas Sideline fleece, gorras New Era 59FIFTY cerradas y ropa exclusiva para caballero y dama.
          </p>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; margin-top: 20px;">
            <div onclick="openDepartmentHub('jerseys')" style="background: #141414; border: 1px solid #282828; border-radius: 12px; padding: 14px; text-align: center; cursor: pointer; transition: all 0.2s ease;" onmouseover="this.style.borderColor='var(--accent-color)'" onmouseout="this.style.borderColor='#282828'">
              <div style="font-size: 28px; margin-bottom: 4px;">👕</div>
              <div style="font-weight: 800; font-size: 12px; color: #fff;">Jerseys Oficiales</div>
            </div>

            <div onclick="openDepartmentHub('chamarras')" style="background: #141414; border: 1px solid #282828; border-radius: 12px; padding: 14px; text-align: center; cursor: pointer; transition: all 0.2s ease;" onmouseover="this.style.borderColor='var(--accent-color)'" onmouseout="this.style.borderColor='#282828'">
              <div style="font-size: 28px; margin-bottom: 4px;">🧥</div>
              <div style="font-weight: 800; font-size: 12px; color: #fff;">Sudaderas & Hoodies</div>
            </div>

            <div onclick="openDepartmentHub('gorras')" style="background: #141414; border: 1px solid #282828; border-radius: 12px; padding: 14px; text-align: center; cursor: pointer; transition: all 0.2s ease;" onmouseover="this.style.borderColor='var(--accent-color)'" onmouseout="this.style.borderColor='#282828'">
              <div style="font-size: 28px; margin-bottom: 4px;">🧢</div>
              <div style="font-weight: 800; font-size: 12px; color: #fff;">Gorras New Era</div>
            </div>

            <div onclick="setGenderFilter('dama', this)" style="background: #141414; border: 1px solid #282828; border-radius: 12px; padding: 14px; text-align: center; cursor: pointer; transition: all 0.2s ease;" onmouseover="this.style.borderColor='var(--accent-color)'" onmouseout="this.style.borderColor='#282828'">
              <div style="font-size: 28px; margin-bottom: 4px;">👩</div>
              <div style="font-weight: 800; font-size: 12px; color: #fff;">Colección Dama</div>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  renderWizardStep();
  updateStoreHeader();
  renderProducts();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

// Setup Team Dropdown Select (Structured by Sport > League > Team)
function populateTeamFilterSelect() {
  initDOMReferences();
  if (!teamFilterSelect) return;
  const catalog = window.SPORTS_CATALOG || SPORTS_CATALOG;
  if (!catalog) return;
  
  teamFilterSelect.innerHTML = '<option value="all">🏆 Todos los Deportes y Equipos</option>';
  
  catalog.forEach(s => {
    s.leagues.forEach(l => {
      const group = document.createElement('optgroup');
      group.label = `${s.icon} ${s.sport} — ${l.league}`;
      
      l.teams.forEach(team => {
        const option = document.createElement('option');
        option.value = team.id;
        option.textContent = team.name;
        if (team.id === activeTeamFilter) option.selected = true;
        group.appendChild(option);
      });
      
      teamFilterSelect.appendChild(group);
    });
  });
}

// Top Navbar Search Toggle
window.toggleTopNavSearchBar = function() {
  const box = document.getElementById('topNavSearchExpandable');
  const input = document.getElementById('searchInput');
  if (box) {
    if (box.style.display === 'none' || !box.style.display) {
      box.style.display = 'block';
      if (input) input.focus();
    } else {
      box.style.display = 'none';
    }
  }
};

// INTERACTIVE EXPANDABLE CATEGORY DROPDOWN
window.onCategoryDropdownSelectChange = function(typeKey) {
  activeCategoryFilter = typeKey || 'all';

  const select = document.getElementById('categoryDropdownSelect');
  if (select && select.value !== activeCategoryFilter) {
    select.value = activeCategoryFilter;
  }

  updateStoreHeader();
  renderProducts();
};

window.toggleDropdownCategory = function(typeKey) {
  onCategoryDropdownSelectChange(typeKey);
};

window.setProductTypeFilter = function(typeKey) {
  onCategoryDropdownSelectChange(typeKey);
};

window.setGenderFilter = function(genderKey) {
  onCategoryDropdownSelectChange(genderKey);
};

// DYNAMIC COMPACT ROTATING REAL FIRESTORE PRODUCT PHOTOS SLIDESHOW ENGINE
let catSlideIndex = 0;

function updateCategorySlideshowNow() {
  const cardJ = document.getElementById('catCardJerseys');
  const cardH = document.getElementById('catCardHoodies');
  const cardC = document.getElementById('catCardCaps');
  const cardD = document.getElementById('catCardDama');

  const subJ = document.getElementById('subJerseys');
  const subH = document.getElementById('subHoodies');
  const subC = document.getElementById('subCaps');
  const subD = document.getElementById('subDama');

  if (!cardJ && !cardH) return;

  catSlideIndex++;
  const products = allProducts && allProducts.length > 0 ? allProducts : [];
  if (products.length === 0) return;
  
  // Strict filtering by active team or active sport!
  let baseProducts = products;
  if (activeTeamFilter !== 'all') {
    baseProducts = products.filter(p => (p.team || '').toLowerCase() === activeTeamFilter.toLowerCase());
  } else if (activeSportFilter !== 'all') {
    baseProducts = products.filter(p => {
      const taxonomy = typeof getFullTaxonomy !== 'undefined' ? getFullTaxonomy(p.team) : null;
      return taxonomy && taxonomy.sportKey === activeSportFilter;
    });
  }

  const jerseyProds = baseProducts.filter(p => p.category === 'jerseys' && p.imageUrl);
  const hoodieProds = baseProducts.filter(p => (p.category === 'chamarras' || p.category === 'sudaderas') && p.imageUrl);
  const capProds = baseProducts.filter(p => p.category === 'gorras' && p.imageUrl);
  const damaProds = baseProducts.filter(p => (p.gender === 'dama' || p.category === 'dama') && p.imageUrl);

  // 1. Jersey Card
  if (jerseyProds.length > 0) {
    const p = jerseyProds[catSlideIndex % jerseyProds.length];
    if (cardJ) cardJ.style.backgroundImage = `linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(10,10,12,0.92) 100%), url('${p.imageUrl}')`;
    if (subJ) subJ.textContent = p.name;
  } else {
    if (cardJ) cardJ.style.backgroundImage = `linear-gradient(180deg, rgba(0,0,0,0.4) 0%, rgba(10,10,12,0.9) 100%), url('assets/catch_sports_logo.png')`;
    if (subJ) subJ.textContent = 'Ver Jerseys...';
  }

  // 2. Hoodie Card
  if (hoodieProds.length > 0) {
    const p = hoodieProds[catSlideIndex % hoodieProds.length];
    if (cardH) cardH.style.backgroundImage = `linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(10,10,12,0.92) 100%), url('${p.imageUrl}')`;
    if (subH) subH.textContent = p.name;
  } else {
    if (cardH) cardH.style.backgroundImage = `linear-gradient(180deg, rgba(0,0,0,0.4) 0%, rgba(10,10,12,0.9) 100%), url('assets/catch_sports_logo.png')`;
    if (subH) subH.textContent = 'Ver Sudaderas...';
  }

  // 3. Cap Card
  if (capProds.length > 0) {
    const p = capProds[catSlideIndex % capProds.length];
    if (cardC) cardC.style.backgroundImage = `linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(10,10,12,0.92) 100%), url('${p.imageUrl}')`;
    if (subC) subC.textContent = p.name;
  } else {
    if (cardC) cardC.style.backgroundImage = `linear-gradient(180deg, rgba(0,0,0,0.4) 0%, rgba(10,10,12,0.9) 100%), url('assets/catch_sports_logo.png')`;
    if (subC) subC.textContent = 'Ver Gorras...';
  }

  // 4. Dama Card
  if (damaProds.length > 0) {
    const p = damaProds[catSlideIndex % damaProds.length];
    if (cardD) cardD.style.backgroundImage = `linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(10,10,12,0.92) 100%), url('${p.imageUrl}')`;
    if (subD) subD.textContent = p.name;
  } else {
    if (cardD) cardD.style.backgroundImage = `linear-gradient(180deg, rgba(0,0,0,0.4) 0%, rgba(10,10,12,0.9) 100%), url('assets/catch_sports_logo.png')`;
    if (subD) subD.textContent = 'Ver Colección Dama...';
  }
}

function initCategorySlideshowEngine() {
  updateCategorySlideshowNow();
  setInterval(updateCategorySlideshowNow, 3200);
}

// URL PARAMETER DEEP-LINKING ENGINE (Para credenciales Steelers FanID y enlaces externos)
function checkUrlDeepLinkParameters() {
  const params = new URLSearchParams(window.location.search);
  const teamParam = params.get('team');
  const sportParam = params.get('sport');
  const catParam = params.get('category');

  // 1. Direct Team Link (ej. ?team=steelers en Credencial FanID)
  if (teamParam) {
    const catalog = window.SPORTS_CATALOG || SPORTS_CATALOG;
    let foundTeam = null;
    let foundLeague = null;
    let foundSport = null;

    for (const s of catalog) {
      for (const l of s.leagues) {
        const t = l.teams.find(tm => tm.id.toLowerCase() === teamParam.toLowerCase() || tm.name.toLowerCase().includes(teamParam.toLowerCase()));
        if (t) {
          foundTeam = t;
          foundLeague = l;
          foundSport = s;
          break;
        }
      }
      if (foundTeam) break;
    }

    if (foundTeam) {
      wizardSportObj = foundSport;
      wizardLeagueObj = foundLeague;
      wizardTeamObj = foundTeam;
      activeSportFilter = foundSport.sportKey;
      activeTeamFilter = foundTeam.id;
      cascadingLevel = 3; // Nivel 3 Equipos
      renderSingleLineCascadingBar();
      updateStoreHeader();
      renderProducts();
      return;
    }
  }

  // 2. Direct Sport Link (ej. ?sport=nfl)
  if (sportParam) {
    if (typeof onSingleLineSportClick === 'function') {
      onSingleLineSportClick(sportParam);
    }
    return;
  }

  // 3. Direct Category Link (ej. ?category=jerseys)
  if (catParam) {
    if (typeof openDepartmentHub === 'function') {
      openDepartmentHub(catParam);
    }
    return;
  }
}

// Search & Selector Initializer
document.addEventListener('DOMContentLoaded', () => {
  initDOMReferences();
  initCategorySlideshowEngine();
  if (typeof renderSingleLineCascadingBar === 'function') {
    renderSingleLineCascadingBar();
  }
  checkUrlDeepLinkParameters();
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.toLowerCase().trim();
      renderProducts();
    });
  }
});

// OFFICIAL DYNAMIC TEAM BRANDING COLORS MAP (Fanatics Official Colors Engine)
window.TEAM_COLORS_MAP = {
  'steelers': { primary: '#FFB612', name: 'Pittsburgh Steelers', glow: 'rgba(255, 182, 18, 0.5)' },
  'dolphins': { primary: '#008E97', name: 'Miami Dolphins', glow: 'rgba(0, 142, 151, 0.6)' },
  'cowboys': { primary: '#003594', name: 'Dallas Cowboys', glow: 'rgba(0, 53, 148, 0.6)' },
  'eagles': { primary: '#004C54', name: 'Philadelphia Eagles', glow: 'rgba(0, 76, 84, 0.6)' },
  'chiefs': { primary: '#E31837', name: 'Kansas City Chiefs', glow: 'rgba(227, 24, 55, 0.6)' },
  'raiders': { primary: '#A5ACAF', name: 'Las Vegas Raiders', glow: 'rgba(165, 172, 175, 0.6)' },
  '49ers': { primary: '#AA0000', name: 'San Francisco 49ers', glow: 'rgba(170, 0, 0, 0.6)' },
  'packers': { primary: '#FFB612', name: 'Green Bay Packers', glow: 'rgba(255, 182, 18, 0.5)' },
  'patriots': { primary: '#C60C30', name: 'New England Patriots', glow: 'rgba(198, 12, 48, 0.6)' },
  'rams': { primary: '#FFA300', name: 'Los Angeles Rams', glow: 'rgba(255, 163, 0, 0.6)' },
  'lakers': { primary: '#FDB927', name: 'Los Angeles Lakers', glow: 'rgba(253, 185, 39, 0.6)' },
  'bulls': { primary: '#CE1141', name: 'Chicago Bulls', glow: 'rgba(206, 17, 65, 0.6)' },
  'celtics': { primary: '#007A33', name: 'Boston Celtics', glow: 'rgba(0, 122, 51, 0.6)' },
  'warriors': { primary: '#FFC72C', name: 'Golden State Warriors', glow: 'rgba(255, 199, 44, 0.6)' },
  
  // LIGA MX ALL 18 TEAMS
  'america': { primary: '#FEE100', name: 'Club América', glow: 'rgba(254, 225, 0, 0.6)' },
  'chivas': { primary: '#E30613', name: 'Chivas Guadalajara', glow: 'rgba(227, 6, 19, 0.6)' },
  'cruzazul': { primary: '#00509E', name: 'Cruz Azul', glow: 'rgba(0, 80, 158, 0.6)' },
  'pumas': { primary: '#D1A153', name: 'Pumas UNAM', glow: 'rgba(209, 161, 83, 0.6)' },
  'tigres': { primary: '#F1A80A', name: 'Tigres UANL', glow: 'rgba(241, 168, 10, 0.6)' },
  'monterrey': { primary: '#0A192F', name: 'Rayados de Monterrey', glow: 'rgba(10, 25, 47, 0.6)' },
  'toluca': { primary: '#D31115', name: 'Toluca FC', glow: 'rgba(211, 17, 21, 0.6)' },
  'leon': { primary: '#006837', name: 'Club León', glow: 'rgba(0, 104, 55, 0.6)' },
  'santos': { primary: '#006C35', name: 'Santos Laguna', glow: 'rgba(0, 108, 53, 0.6)' },
  'pachuca': { primary: '#003B70', name: 'Pachuca', glow: 'rgba(0, 59, 112, 0.6)' },
  'atlas': { primary: '#D31115', name: 'Atlas FC', glow: 'rgba(211, 17, 21, 0.6)' },
  'puebla': { primary: '#002E6D', name: 'Club Puebla', glow: 'rgba(0, 46, 109, 0.6)' },
  'tijuana': { primary: '#D31115', name: 'Xolos de Tijuana', glow: 'rgba(211, 17, 21, 0.6)' },
  'necaxa': { primary: '#E30613', name: 'Rayos del Necaxa', glow: 'rgba(227, 6, 19, 0.6)' },
  'sanluis': { primary: '#D31115', name: 'Atlético de San Luis', glow: 'rgba(211, 17, 21, 0.6)' },
  'mazatlan': { primary: '#502A7E', name: 'Mazatlán FC', glow: 'rgba(80, 42, 126, 0.6)' },
  'juarez': { primary: '#22B14C', name: 'Bravos de Juárez', glow: 'rgba(34, 177, 76, 0.6)' },
  'queretaro': { primary: '#00509E', name: 'Gallos Blancos de Querétaro', glow: 'rgba(0, 80, 158, 0.6)' },

  // EUROPEAN / OTHER
  'realmadrid': { primary: '#FEBE10', name: 'Real Madrid', glow: 'rgba(254, 190, 16, 0.6)' },
  'barcelona': { primary: '#004D98', name: 'FC Barcelona', glow: 'rgba(0, 77, 152, 0.6)' }
};

function getTeamOfficialColors(teamId) {
  if (!teamId) return { primary: '#facb15', glow: 'rgba(250, 204, 21, 0.4)' };
  const cleanId = teamId.toLowerCase().trim();
  const strippedKey = cleanId.replace(/^(soc|nfl|nba|mlb|f1|cat)-/, '');

  if (window.TEAM_COLORS_MAP[strippedKey]) {
    return window.TEAM_COLORS_MAP[strippedKey];
  }
  for (const k in window.TEAM_COLORS_MAP) {
    if (strippedKey === k || cleanId === k) return window.TEAM_COLORS_MAP[k];
  }
  return { primary: '#facb15', glow: 'rgba(250, 204, 21, 0.4)' };
}

// Store Title & Dynamic Team Hero Header Updates
function updateStoreHeader() {
  initDOMReferences();
  const heroContainer = document.getElementById('dynamicPortalHero');

  if (wizardTeamObj) {
    const tax = typeof getFullTaxonomy !== 'undefined' ? getFullTaxonomy(wizardTeamObj.id) : { team: wizardTeamObj.name, teamLogo: 'assets/catch_sports_logo.png' };
    const colors = getTeamOfficialColors(wizardTeamObj.id);
    
    // Apply Team Official Color Dynamic Branding Theme!
    document.documentElement.style.setProperty('--accent-color', colors.primary);
    document.documentElement.style.setProperty('--accent-glow', colors.glow);

    if (storeTitle) {
      const logoImg = tax.teamLogo ? `<img src="${tax.teamLogo}" style="height: 38px; vertical-align: middle; margin-right: 8px; filter: drop-shadow(0 2px 8px rgba(0,0,0,0.8));"/>` : '';
      storeTitle.innerHTML = `${logoImg}COLECCIÓN <span style="color: ${colors.primary};">${tax.team.toUpperCase()}</span>`;
      if (storeSubtitle) storeSubtitle.textContent = `${tax.icon} ${tax.sport} — Liga ${tax.league}`;
    }

    // Render Clean Team Header Pill (Logo Left + Line 1 COLECCIÓN OFICIAL, Line 2 Team Name, Line 3 Centered Pill)
    if (heroContainer) {
      heroContainer.innerHTML = `
        <section style="background: radial-gradient(circle at 50% 30%, ${colors.primary}22 0%, #09090b 100%); border-bottom: 2px solid ${colors.primary}; padding: 12px 10px; text-align: center; box-shadow: 0 6px 20px rgba(0,0,0,0.8);">
          <div class="container" style="max-width: 900px; padding: 0;">
            
            <!-- Clean Header Card: Logo Left + Right Typographic Layout -->
            <div style="background: rgba(20, 18, 12, 0.95); border: 2px solid ${colors.primary}; border-radius: 14px; padding: 12px 14px; display: flex; align-items: center; justify-content: flex-start; gap: 12px; text-align: left; margin-bottom: 8px; box-shadow: 0 4px 16px ${colors.glow};">
              
              <!-- Giant Team Logo Left (100px sin Círculo Amarillo) -->
              <img src="${tax.teamLogo}" referrerpolicy="no-referrer" style="width: 100px; height: 100px; object-fit: contain; filter: drop-shadow(0 6px 16px rgba(0,0,0,0.9)); flex-shrink: 0; margin-right: 2px;" onerror="this.src='assets/catch_sports_logo.png'"/>

              <!-- Right Info Block (Right-Aligned Text: text-align: right) -->
              <div style="display: flex; flex-direction: column; align-items: flex-end; text-align: right; width: 100%;">
                
                <!-- Renglón 1: COLECCIÓN OFICIAL (BLANCO PURO #ffffff !important, 16px !important) -->
                <div style="font-family: var(--font-display); font-size: 16px !important; font-weight: 900 !important; color: #ffffff !important; text-transform: uppercase; letter-spacing: 0.8px; line-height: 1.1; margin-bottom: 3px; text-shadow: 0 2px 4px rgba(0,0,0,0.9);">
                  COLECCIÓN OFICIAL
                </div>

                <!-- Renglón 2: NOMBRE DEL EQUIPO EN COLOR OFICIAL DEL EQUIPO -->
                <div style="font-family: var(--font-display); font-size: clamp(16px, 4.5vw, 24px); font-weight: 900; color: ${colors.primary} !important; text-transform: uppercase; text-shadow: 0 0 14px ${colors.glow}; line-height: 1.15; margin-bottom: 5px;">
                  ${tax.team.toUpperCase()}
                </div>

                <!-- Renglón 3: Pastilla FÚTBOL — LIGA MX (Alineada al Centro!) -->
                <div style="display: flex; justify-content: center; width: 100%; margin-top: 2px;">
                  <span style="background: ${colors.primary}22; border: 1.5px solid ${colors.primary}; color: ${colors.primary}; padding: 3px 12px; border-radius: 12px; font-size: 10px; font-weight: 900; text-align: center; display: inline-block;">
                    ${tax.icon} ${tax.sport.toUpperCase()} — ${tax.league.toLowerCase().startsWith('liga') ? tax.league.toUpperCase() : 'LIGA ' + tax.league.toUpperCase()}
                  </span>
                </div>

              </div>

            </div>

            <!-- DYNAMIC 4 CATEGORY CARDS GRID FOR THE ACTIVE TEAM -->
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px;" id="catCardsGridDesktop">
              <div id="catCardJerseys" class="compact-cat-card" onclick="openDepartmentHub('jerseys')">
                <div class="compact-cat-overlay">
                  <div class="compact-cat-title">👕 Jerseys Oficiales</div>
                  <div class="compact-cat-subtitle" id="subJerseys">Cargando jerseys de ${tax.team}...</div>
                </div>
              </div>
              <div id="catCardHoodies" class="compact-cat-card" onclick="openDepartmentHub('chamarras')">
                <div class="compact-cat-overlay">
                  <div class="compact-cat-title">🧥 Sudaderas & Hoodies</div>
                  <div class="compact-cat-subtitle" id="subHoodies">Cargando sudaderas de ${tax.team}...</div>
                </div>
              </div>
              <div id="catCardCaps" class="compact-cat-card" onclick="openDepartmentHub('gorras')">
                <div class="compact-cat-overlay">
                  <div class="compact-cat-title">🧢 Gorras New Era</div>
                  <div class="compact-cat-subtitle" id="subCaps">Cargando gorras de ${tax.team}...</div>
                </div>
              </div>
              <div id="catCardDama" class="compact-cat-card" onclick="toggleDropdownCategory('dama')">
                <div class="compact-cat-overlay">
                  <div class="compact-cat-title">👩 Colección Dama</div>
                  <div class="compact-cat-subtitle" id="subDama">Cargando prendas dama...</div>
                </div>
              </div>
            </div>

          </div>
        </section>
      `;
    }
  } else if (wizardSportObj) {
    if (storeTitle) {
      storeTitle.innerHTML = `DEPORTE <span style="color: var(--accent-color);">${wizardSportObj.sport.toUpperCase()}</span>`;
      if (storeSubtitle) storeSubtitle.textContent = `Catálogo especializado de ${wizardSportObj.sport}`;
    }

    if (heroContainer) {
      heroContainer.innerHTML = `
        <section style="background: radial-gradient(circle at 50% 20%, #201e14 0%, #0c0c0e 100%); border-bottom: 2px solid var(--accent-color); padding: 22px 14px; text-align: center;">
          <div class="container" style="max-width: 900px; padding: 0;">
            <span style="font-size: 32px; display: block; margin-bottom: 4px;">${wizardSportObj.icon}</span>
            <h1 style="font-family: var(--font-display); font-size: clamp(20px, 4.5vw, 32px); font-weight: 900; color: #fff; text-transform: uppercase; margin-bottom: 4px;">
              PORTAL OFICIAL <span style="color: var(--accent-color);">${wizardSportObj.sport.toUpperCase()}</span>
            </h1>
            <p style="color: #aaa; font-size: 11px; margin-bottom: 10px;">
              Explora todas las franquicias y prendas oficiales de ${wizardSportObj.sport}
            </p>

            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; margin-top: 8px;" id="catCardsGridDesktop">
              <div id="catCardJerseys" class="compact-cat-card" onclick="openDepartmentHub('jerseys')">
                <div class="compact-cat-overlay">
                  <div class="compact-cat-title">👕 Jerseys Oficiales</div>
                  <div class="compact-cat-subtitle" id="subJerseys">Jerseys de ${wizardSportObj.sport}...</div>
                </div>
              </div>
              <div id="catCardHoodies" class="compact-cat-card" onclick="openDepartmentHub('chamarras')">
                <div class="compact-cat-overlay">
                  <div class="compact-cat-title">🧥 Sudaderas & Hoodies</div>
                  <div class="compact-cat-subtitle" id="subHoodies">Sudaderas de ${wizardSportObj.sport}...</div>
                </div>
              </div>
              <div id="catCardCaps" class="compact-cat-card" onclick="openDepartmentHub('gorras')">
                <div class="compact-cat-overlay">
                  <div class="compact-cat-title">🧢 Gorras New Era</div>
                  <div class="compact-cat-subtitle" id="subCaps">Gorras de ${wizardSportObj.sport}...</div>
                </div>
              </div>
              <div id="catCardDama" class="compact-cat-card" onclick="setGenderFilter('dama', this)">
                <div class="compact-cat-overlay">
                  <div class="compact-cat-title">👩 Colección Dama</div>
                  <div class="compact-cat-subtitle" id="subDama">Colección Dama de ${wizardSportObj.sport}...</div>
                </div>
              </div>
            </div>

          </div>
        </section>
      `;
    }
  } else if (activeGenderFilter !== 'all') {
    const gLabel = typeof getGenderLabel !== 'undefined' ? getGenderLabel(activeGenderFilter) : activeGenderFilter;
    if (storeTitle) storeTitle.innerHTML = `DEPARTAMENTO <span style="color: var(--accent-color);">${gLabel.toUpperCase()}</span>`;
    if (storeSubtitle) storeSubtitle.textContent = `Catálogo especializado de tallas para ${gLabel}`;
    if (heroContainer) heroContainer.innerHTML = '';
  } else {
    if (storeTitle) storeTitle.innerHTML = `CATÁLOGO <span style="color: var(--accent-color);">OFICIAL</span>`;
    if (storeSubtitle) storeSubtitle.textContent = `Artículos deportivos clasificados por Deporte, Liga, Equipo y Departamento`;
    if (heroContainer) heroContainer.innerHTML = '';
  }
}

// Render Product Card with Mobile-Optimized Size Selection & Stock Capsule
function createProductCard(product, id) {
  const card = document.createElement('div');
  card.className = 'product-card';
  
  const tax = typeof getFullTaxonomy !== 'undefined' ? getFullTaxonomy(product.team) : { sport: 'Deportes', icon: '🏆', league: 'Oficial', team: product.team, teamLogo: 'assets/catch_sports_logo.png' };
  const genderLabel = typeof getGenderLabel !== 'undefined' ? getGenderLabel(product.gender) : '👨 Caballero';
  const categoryLabel = typeof getCategoryLabel !== 'undefined' ? getCategoryLabel(product.category) : '👕 Artículo';
  
  const sizeStockMap = product.sizeStockMap || [];
  const sizes = (sizeStockMap.length > 0) ? sizeStockMap.map(s => s.size) : (product.sizes || ["M", "L"]);
  const defaultSize = sizes[0] || 'M';
  
  // Custom Badge HTML
  let badgeHtml = '';
  if (product.badge && product.badge !== 'ninguno' && typeof PROMO_BADGES !== 'undefined') {
    const badgeObj = PROMO_BADGES.find(b => b.id === product.badge);
    if (badgeObj) {
      badgeHtml = `<div class="product-badge-custom" style="background: ${badgeObj.color}; color: #fff;">${badgeObj.label}</div>`;
    }
  }

  // Discount Badge Calculation
  let discountHtml = '';
  if (product.originalPrice && product.originalPrice > product.price) {
    const pct = Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);
    discountHtml = `<div class="discount-badge">-${pct}% OFF</div>`;
  }
  
  const originalPriceHtml = product.originalPrice ? `<div class="original-price">${formatPrice(product.originalPrice)}</div>` : '';

  const teamLogoHtml = tax.teamLogo 
    ? `<img src="${tax.teamLogo}" style="width: 20px; height: 20px; object-fit: contain; vertical-align: middle; margin-right: 4px;" onerror="this.style.display='none'"/>` 
    : '';

  card.innerHTML = `
    ${badgeHtml}
    ${discountHtml}
    <div class="product-image-container">
      <img src="${product.imageUrl}" alt="${product.name}" class="product-image" loading="lazy" onerror="this.src='https://via.placeholder.com/400x400?text=Catch+Sports'">
    </div>
    <div class="product-info">
      
      <!-- Taxonomy Breadcrumb Header: Deporte > Liga > Equipo (with official logo) -->
      <div class="product-taxonomy" style="display: flex; align-items: center; gap: 4px;">
        <span class="tax-sport">${tax.icon} ${tax.sport}</span>
        <span class="tax-sep">›</span>
        <span class="tax-league">${tax.league}</span>
        <span class="tax-sep">›</span>
        <span class="tax-team" style="display: inline-flex; align-items: center;">${teamLogoHtml}${tax.team}</span>
      </div>

      <h3 class="product-title">${product.name}</h3>
      
      <div class="product-meta-row">
        <span class="tag-department">${genderLabel}</span>
        <span class="tag-category">${categoryLabel}</span>
      </div>

      <p class="product-desc">${product.description || 'Artículo deportivo oficial de alta calidad.'}</p>
      
      <!-- Interactive Size Chips Buttons -->
      <div style="font-size: 11px; color: #aaa; margin-bottom: 6px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
        TOCA UNA TALLA PARA VER DISPONIBILIDAD:
      </div>
      <div class="sizes-container" id="sizesFor_${id}">
        ${sizes.map((s, idx) => `
          <button type="button" class="size-chip ${idx === 0 ? 'selected' : ''}" onclick="selectCardSize('${id}', '${s}', this)">${s}</button>
        `).join('')}
      </div>

      <!-- Mobile-Optimized Stock Capsule for Selected Size -->
      <div class="mobile-stock-container" id="sizeStockStatus_${id}">
        <!-- Dynamic Pills Injected via JS -->
      </div>

      <div class="product-footer">
        <div class="price-box">
          <div class="product-price">${formatPrice(product.price)}</div>
          ${originalPriceHtml}
        </div>
        <button onclick="addToCartFromCard('${id}', '${defaultSize}')" class="btn" id="btnCart_${id}">
          🛒 Agregar
        </button>
      </div>
    </div>
  `;

  // Initialize size stock box for default size
  setTimeout(() => {
    selectCardSize(id, defaultSize, null);
  }, 30);

  return card;
}

window.selectedSizesState = {};

window.selectCardSize = function(productId, size, btnEl) {
  window.selectedSizesState[productId] = size;
  const container = document.getElementById(`sizesFor_${productId}`);
  if (container && btnEl) {
    container.querySelectorAll('.size-chip').forEach(c => c.classList.remove('selected'));
    btnEl.classList.add('selected');
  }
  
  const btnCart = document.getElementById(`btnCart_${productId}`);
  if (btnCart) {
    btnCart.setAttribute('onclick', `addToCartFromCard('${productId}', '${size}')`);
  }

  // Update Mobile Stock Capsule Display
  const statusBox = document.getElementById(`sizeStockStatus_${productId}`);
  const prod = allProducts.find(p => p.id === productId);
  
  if (statusBox && prod) {
    const map = prod.sizeStockMap || [];
    const sizeData = map.find(s => s.size === size);
    
    let immPill = '';
    let whPill = '';
    
    if (sizeData) {
      const imm = sizeData.immediateQty || 0;
      const wh = sizeData.warehouseQty || 0;
      
      immPill = imm > 0 
        ? `<span class="stock-pill-inmediata">⚡ Tienda: ${imm} pzs</span>`
        : `<span class="stock-pill-agotado">⚡ Tienda: 0 pzs</span>`;
        
      whPill = wh > 0
        ? `<span class="stock-pill-bodega">🏢 Bodega: ${wh} pzs</span>`
        : `<span class="stock-pill-agotado">🏢 Bodega: 0 pzs</span>`;
    } else {
      immPill = `<span class="stock-pill-inmediata">⚡ Tienda: Disponible</span>`;
      whPill = `<span class="stock-pill-bodega">🏢 Bodega: Disponible</span>`;
    }

    statusBox.innerHTML = `
      <div class="mobile-stock-header">DISPONIBILIDAD TALLA ${size}:</div>
      <div class="mobile-stock-pills">
        ${immPill}
        ${whPill}
      </div>
    `;
  }
};

window.addToCartFromCard = function(productId, defaultSize) {
  const prod = allProducts.find(p => p.id === productId);
  if (!prod) return;
  
  const size = window.selectedSizesState[productId] || defaultSize || 'M';
  addToCart(prod, size);
};

// Filter & Render Products (3x3 COMPACT PRODUCT GRID)
function renderProducts() {
  initDOMReferences();
  if (typeof updateCategorySlideshowNow === 'function') {
    updateCategorySlideshowNow();
  }
  if (!productGrid) return;
  productGrid.innerHTML = '';
  
  const filtered = allProducts.filter(product => {
    const tax = typeof getFullTaxonomy !== 'undefined' ? getFullTaxonomy(product.team) : {};
    
    // Search query filter
    if (searchQuery) {
      const nameMatch = (product.name || '').toLowerCase().includes(searchQuery);
      const teamMatch = (tax.team || '').toLowerCase().includes(searchQuery);
      const leagueMatch = (tax.league || '').toLowerCase().includes(searchQuery);
      const sportMatch = (tax.sport || '').toLowerCase().includes(searchQuery);
      const descMatch = (product.description || '').toLowerCase().includes(searchQuery);
      const genderMatch = (product.gender || '').toLowerCase().includes(searchQuery);
      if (!nameMatch && !teamMatch && !leagueMatch && !sportMatch && !descMatch && !genderMatch) return false;
    }

    // Step-by-step wizard team filter
    if (activeTeamFilter !== 'all' && (product.team || '').toLowerCase() !== activeTeamFilter.toLowerCase()) {
      return false;
    }

    // Sport filter
    if (wizardSportObj && activeTeamFilter === 'all') {
      if ((tax.sport || '').toLowerCase() !== wizardSportObj.sport.toLowerCase()) return false;
    }

    // Product Type Filter (Jerseys, Sudaderas, Gorras, Dama)
    if (activeCategoryFilter !== 'all') {
      if (activeCategoryFilter === 'jerseys' && product.category !== 'jerseys') return false;
      if (activeCategoryFilter === 'chamarras' && (product.category !== 'chamarras' && product.category !== 'sudaderas')) return false;
      if (activeCategoryFilter === 'gorras' && product.category !== 'gorras') return false;
      if (activeCategoryFilter === 'dama' && (product.gender !== 'dama' && product.category !== 'dama')) return false;
    }
    
    return true;
  });

  if (filtered.length === 0) {
    productGrid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-state-icon">🏈</div>
        <h2>No encontramos artículos</h2>
        <p>Intenta cambiar el departamento (Caballero, Dama, Niño) o el equipo seleccionado.</p>
      </div>
    `;
    return;
  }

  // Render 3x3 compact product cards
  filtered.forEach(p => {
    const card = createCompactProductCard(p, p.id);
    productGrid.appendChild(card);
  });
}

// =================================================================
// COMPACT 3x3 PRODUCT GRID & FULL-SCREEN PRODUCT DETAIL MODAL
// =================================================================

function createCompactProductCard(product, id) {
  const card = document.createElement('div');
  card.className = 'compact-product-card';
  card.onclick = () => openProductDetailModal(id);
  
  const tax = typeof getFullTaxonomy !== 'undefined' ? getFullTaxonomy(product.team) : { teamLogo: 'assets/catch_sports_logo.png' };
  const formattedPrice = typeof formatPrice !== 'undefined' ? formatPrice(product.price) : `$${product.price} MXN`;

  card.innerHTML = `
    <div class="compact-prod-img-box">
      <img src="${product.imageUrl}" class="compact-prod-img" onerror="this.src='assets/catch_sports_logo.png'"/>
      ${tax.teamLogo ? `<img src="${tax.teamLogo}" class="compact-prod-team-logo"/>` : ''}
      ${product.badge && product.badge !== 'ninguno' ? `<span class="compact-prod-badge">OFICIAL</span>` : ''}
    </div>
    <div class="compact-prod-info">
      <div class="compact-prod-title">${product.name}</div>
      <div class="compact-prod-price-row">
        <span class="compact-prod-price">${formattedPrice}</span>
        <span style="font-size: 9px; color: var(--accent-color); font-weight: 900;">VER ➔</span>
      </div>
    </div>
  `;
  return card;
}

window.openProductDetailModal = function(productId) {
  const product = allProducts.find(p => p.id === productId);
  if (!product) return;

  const overlay = document.getElementById('productDetailOverlay');
  const modal = document.getElementById('productDetailModal');
  if (!overlay || !modal) return;

  const tax = typeof getFullTaxonomy !== 'undefined' ? getFullTaxonomy(product.team) : { sport: 'Deportes', icon: '🏆', league: 'Oficial', team: product.team, teamLogo: 'assets/catch_sports_logo.png' };
  const formattedPrice = typeof formatPrice !== 'undefined' ? formatPrice(product.price) : `$${product.price} MXN`;
  const formattedOrig = product.originalPrice ? (typeof formatPrice !== 'undefined' ? formatPrice(product.originalPrice) : `$${product.originalPrice} MXN`) : null;

  const sizeStockMap = product.sizeStockMap || [];
  const sizes = (sizeStockMap.length > 0) ? sizeStockMap.map(s => s.size) : (product.sizes || ["M", "L"]);
  const defaultSize = sizes[0] || 'M';

  if (!window.selectedSizesState[productId]) {
    window.selectedSizesState[productId] = defaultSize;
  }
  const currentSize = window.selectedSizesState[productId];
  const sizeData = sizeStockMap.find(s => s.size === currentSize);

  let immQty = sizeData ? (sizeData.immediateQty || 0) : 'Disponible';
  let whQty = sizeData ? (sizeData.warehouseQty || 0) : 'Disponible';

  modal.innerHTML = `
    <button onclick="closeProductDetailModal()" style="position: absolute; top: 14px; right: 14px; background: rgba(255,255,255,0.1); border: 1px solid #444; color: #fff; border-radius: 50%; width: 32px; height: 32px; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; z-index: 20;">✕</button>

    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
      <img src="${tax.teamLogo}" style="height: 28px; width: 28px; object-fit: contain; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.8));" onerror="this.src='assets/catch_sports_logo.png'"/>
      <span style="font-size: 11px; font-weight: 900; color: var(--accent-color); text-transform: uppercase;">
        ${tax.icon} ${tax.sport} · ${tax.league} · ${tax.team}
      </span>
    </div>

    <img src="${product.imageUrl}" style="width: 100%; height: 260px; object-fit: contain; background: #000; border-radius: 12px; border: 1px solid #333; margin-bottom: 14px;" onerror="this.src='assets/catch_sports_logo.png'"/>

    <h2 style="font-size: 20px; font-weight: 900; color: #fff; line-height: 1.2; margin-bottom: 6px;">${product.name}</h2>
    
    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
      <span style="font-size: 24px; font-weight: 900; color: var(--accent-color);">${formattedPrice}</span>
      ${formattedOrig ? `<span style="font-size: 14px; text-decoration: line-through; color: #777;">${formattedOrig}</span>` : ''}
      <span style="background: rgba(34, 197, 94, 0.15); color: #22c55e; border: 1px solid rgba(34, 197, 94, 0.4); padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 900;">PRODUCTO OFICIAL VERIFICADO</span>
    </div>

    <p style="font-size: 12px; color: #aaa; line-height: 1.4; margin-bottom: 16px; background: #0a0a0c; padding: 10px; border-radius: 8px; border: 1px solid #222;">
      ${product.description || 'Artículo deportivo oficial de utilería bordada y alta resistencia.'}
    </p>

    <!-- TALLAS Y DISPONIBILIDAD -->
    <div style="margin-bottom: 16px;">
      <label style="font-size: 11px; font-weight: 800; color: var(--accent-color); text-transform: uppercase; display: block; margin-bottom: 6px;">
        1️⃣ SELECCIONA TU TALLA:
      </label>
      <div style="display: flex; gap: 6px; flex-wrap: wrap;" id="modalSizesContainer">
        ${sizes.map(sz => `
          <button onclick="selectModalSize('${productId}', '${sz}')" class="size-chip ${sz === currentSize ? 'selected' : ''}" style="padding: 8px 14px; font-size: 12px; font-weight: 800;">
            ${sz}
          </button>
        `).join('')}
      </div>
    </div>

    <!-- STOCK CAPSULE -->
    <div id="modalStockStatusBox" style="background: #0d0d0f; border: 1px solid #282828; border-radius: 10px; padding: 10px; margin-bottom: 18px;">
      <div style="font-size: 10px; font-weight: 800; color: var(--accent-color); text-transform: uppercase; margin-bottom: 6px;">
        DISPONIBILIDAD TALLA ${currentSize}:
      </div>
      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        <span class="stock-pill-inmediata">⚡ Tienda Física: ${immQty} pzs</span>
        <span class="stock-pill-bodega">🏢 Bodega Central: ${whQty} pzs</span>
      </div>
    </div>

    <!-- ACCIONES COMPRA -->
    <div style="display: flex; flex-direction: column; gap: 10px;">
      <button onclick="addToCartFromModal('${productId}')" class="btn btn-primary" style="width: 100%; padding: 14px; font-size: 15px; font-weight: 900;">
        🛒 Agregar al Carrito
      </button>
      
      <button onclick="buyNowWhatsApp('${productId}')" class="btn btn-whatsapp" style="width: 100%; padding: 14px; font-size: 15px; font-weight: 900;">
        📲 Comprar Directo por WhatsApp →
      </button>
    </div>
  `;

  overlay.classList.add('open');
};

window.closeProductDetailModal = function() {
  const overlay = document.getElementById('productDetailOverlay');
  if (overlay) overlay.classList.remove('open');
};

window.selectModalSize = function(productId, size) {
  window.selectedSizesState[productId] = size;
  openProductDetailModal(productId);
};

window.addToCartFromModal = function(productId) {
  const prod = allProducts.find(p => p.id === productId);
  if (!prod) return;
  const size = window.selectedSizesState[productId] || 'M';
  addToCart(prod, size);
  closeProductDetailModal();
  toggleCartDrawer();
};

window.buyNowWhatsApp = function(productId) {
  const prod = allProducts.find(p => p.id === productId);
  if (!prod) return;
  const size = window.selectedSizesState[productId] || 'M';
  const tax = typeof getFullTaxonomy !== 'undefined' ? getFullTaxonomy(prod.team) : { team: prod.team };
  
  const msg = `¡Hola Catch Sports! 👋 Me interesa comprar directamente este artículo de la tienda:%0A%0A` +
              `🏆 *${prod.name}*%0A` +
              `🛡️ Equipo: ${tax.team}%0A` +
              `📏 Talla seleccionada: ${size}%0A` +
              `💵 Precio: $${prod.price} MXN%0A%0A` +
              `¿Tienen disponibilidad inmediata para envío?`;
              
  window.open(`https://wa.me/524423376955?text=${msg}`, '_blank');
};

// Fetch products from Firebase Firestore
async function loadProducts() {
  initDOMReferences();
  try {
    const snapshot = await db.collection('products').get();
    if (loader) loader.style.display = 'none';

    allProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    updateStoreHeader();
    renderProducts();

  } catch (error) {
    console.error('Error fetching products:', error);
    if (loader) loader.style.display = 'none';
    if (productGrid) {
      productGrid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1; color: #ff6b6b;">
          <div class="empty-state-icon">⚠️</div>
          <h2>Error al cargar catálogo</h2>
          <p>Verifica tu conexión a internet o intenta recargar la página.</p>
        </div>
      `;
    }
  }
}

// ============================================
// SHOPPING CART & CHECKOUT LOGIC
// ============================================
function updateCartUI() {
  const badge = document.getElementById('cartBadge');
  const itemsContainer = document.getElementById('cartItemsContainer');
  const totalPriceEl = document.getElementById('cartTotalPrice');
  
  const totalCount = cart.reduce((sum, item) => sum + item.qty, 0);
  const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  
  if (badge) badge.textContent = totalCount;
  if (totalPriceEl) totalPriceEl.textContent = formatPrice(totalPrice);
  
  localStorage.setItem('catch_sports_cart', JSON.stringify(cart));

  if (!itemsContainer) return;

  if (cart.length === 0) {
    itemsContainer.innerHTML = `
      <div class="empty-state" style="padding: 40px 10px;">
        <div class="empty-state-icon">🛒</div>
        <div style="font-weight: bold; color: #fff;">Tu carrito está vacío</div>
        <div style="font-size: 12px; margin-top: 4px;">¡Agrega artículos deportivos oficiales!</div>
      </div>`;
    return;
  }

  itemsContainer.innerHTML = cart.map((item, index) => {
    const genderLabel = typeof getGenderLabel !== 'undefined' ? getGenderLabel(item.gender) : '';
    return `
      <div class="cart-item">
        <img src="${item.imageUrl}" class="cart-item-img" onerror="this.src='https://via.placeholder.com/100'">
        <div class="cart-item-info">
          <div class="cart-item-title">${item.name}</div>
          <div class="cart-item-meta">${genderLabel} — Talla: <strong>${item.size}</strong> — ${formatPrice(item.price)}</div>
          <div class="qty-controls">
            <button class="qty-btn" onclick="updateItemQty(${index}, -1)">-</button>
            <span style="font-size: 13px; font-weight: bold; color: #fff; min-width: 18px; text-align: center;">${item.qty}</span>
            <button class="qty-btn" onclick="updateItemQty(${index}, 1)">+</button>
            <button onclick="removeFromCart(${index})" style="background: transparent; border: none; color: #ef4444; font-size: 12px; margin-left: auto; cursor: pointer;">🗑️ Quitar</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

window.addToCart = function(product, size) {
  const existingIndex = cart.findIndex(item => item.id === product.id && item.size === size);
  if (existingIndex > -1) {
    cart[existingIndex].qty += 1;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      imageUrl: product.imageUrl,
      gender: product.gender || 'caballero',
      size: size,
      qty: 1
    });
  }
  
  updateCartUI();
  toggleCartDrawer(true);
};

window.updateItemQty = function(index, delta) {
  if (cart[index]) {
    cart[index].qty += delta;
    if (cart[index].qty <= 0) cart.splice(index, 1);
    updateCartUI();
  }
};

window.removeFromCart = function(index) {
  if (cart[index]) {
    cart.splice(index, 1);
    updateCartUI();
  }
};

window.toggleCartDrawer = function(forceOpen) {
  const drawer = document.getElementById('cartDrawerOverlay');
  if (!drawer) return;
  
  if (forceOpen === true) {
    drawer.classList.add('active');
  } else {
    drawer.classList.toggle('active');
  }
};

// Checkout SPEI Modal & WhatsApp Submission
window.openCheckoutModal = function() {
  if (cart.length === 0) {
    alert("Tu carrito está vacío. Agrega artículos primero.");
    return;
  }
  
  const modal = document.getElementById('checkoutModal');
  if (modal) modal.classList.add('active');
};

window.closeCheckoutModal = function() {
  const modal = document.getElementById('checkoutModal');
  if (modal) modal.classList.remove('active');
};

window.copyClabeToClipboard = function() {
  const clabe = STORE_BANK_DETAILS.clabe;
  navigator.clipboard.writeText(clabe).then(() => {
    alert("✅ CLABE bancaria copiada al portapapeles: " + clabe);
  }).catch(() => {
    alert("CLABE: " + clabe);
  });
};

// Screenshot Preview Converter
let transferProofBase64 = null;
document.addEventListener('DOMContentLoaded', () => {
  const proofInput = document.getElementById('transferProofFile');
  if (proofInput) {
    proofInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          transferProofBase64 = e.target.result;
          const previewImg = document.getElementById('proofPreviewImg');
          const previewBox = document.getElementById('transferProofPreview');
          if (previewImg) previewImg.src = e.target.result;
          if (previewBox) previewBox.style.display = 'block';
        };
        reader.readAsDataURL(file);
      }
    });
  }
});

window.submitCheckoutOrder = async function(event) {
  event.preventDefault();
  
  const name = document.getElementById('custName').value.trim();
  const phone = document.getElementById('custPhone').value.trim();
  const delivery = document.getElementById('custDeliveryMethod').value;
  const address = document.getElementById('custAddress').value.trim();
  
  if (!name || !phone || !address) {
    alert("Por favor completa todos los campos marcados con *");
    return;
  }
  
  const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const deliveryText = delivery === 'domicilio' ? '🚚 Envío a Domicilio' : '🏪 Entrega en Sucursal QRO';
  
  // Format WhatsApp Order Message
  let itemsListText = cart.map(item => {
    const gLabel = typeof getGenderLabel !== 'undefined' ? getGenderLabel(item.gender) : '';
    return `• ${item.qty}x ${item.name} (${gLabel} — Talla: ${item.size}) - ${formatPrice(item.price * item.qty)}`;
  }).join('\n');
  
  const whatsappMessage = 
`🏆 *NUEVO PEDIDO - CATCH SPORTS* 🏆
----------------------------------
👤 *Cliente:* ${name}
📱 *Teléfono:* ${phone}
📍 *Entrega:* ${deliveryText}
🏠 *Dirección/Notas:* ${address}
----------------------------------
📦 *PRODUCTOS:*
${itemsListText}

💰 *TOTAL A PAGAR:* ${formatPrice(totalAmount)}
----------------------------------
💳 *MÉTODO DE PAGO:* Transferencia SPEI (${STORE_BANK_DETAILS.bank})
📸 *Comprobante Adjunto:* ${transferProofBase64 ? 'Si (Captura lista)' : 'Pendiente por WhatsApp'}
----------------------------------
¡Hola! Ya envié mi orden de compra. Quedo atento a la entrega. 🏈🔥`;

  // Try saving order doc to Firestore `orders` collection
  try {
    await db.collection('orders').add({
      customerName: name,
      customerPhone: phone,
      deliveryMethod: delivery,
      address: address,
      items: cart,
      totalAmount: totalAmount,
      transferProof: transferProofBase64 || null,
      status: 'pending',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch(e) {
    console.log('Order saved offline/guest:', e);
  }

  // Clear Cart
  cart = [];
  updateCartUI();
  closeCheckoutModal();
  toggleCartDrawer(false);

  // Open WhatsApp
  const waUrl = `https://wa.me/${STORE_BANK_DETAILS.phoneWhatsApp}?text=${encodeURIComponent(whatsappMessage)}`;
  window.open(waUrl, '_blank');
};

// DOMReady & Execution Trigger
document.addEventListener('DOMContentLoaded', () => {
  initWizardNavigation();
  populateTeamFilterSelect();
  updateCartUI();
  loadProducts();
});

// Immediate execution fallback
initWizardNavigation();
populateTeamFilterSelect();
updateCartUI();
loadProducts();
