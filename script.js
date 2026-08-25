/* ==========================================================
   JIJA$ · Panel de grupos — lógica de la aplicación
   Persistencia: localStorage (clave "jijas-groups-v1")
   ========================================================== */

const STORAGE_KEY = 'jijas-groups-v1';

/** @type {Array<Object>} */
let groups = loadGroups();
let currentGroupId = null;
let editingPurchaseId = null;

/* ---------------- Persistencia ---------------- */

function loadGroups(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  }catch(e){
    console.error('No se pudo leer el almacenamiento local', e);
    return [];
  }
}

function saveGroups(){
  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
  }catch(e){
    console.error('No se pudo guardar el almacenamiento local', e);
    alert('No se pudieron guardar los cambios (almacenamiento lleno). Prueba con fotos más livianas.');
  }
}

function uid(){
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function todayISO(){
  return new Date().toISOString().slice(0,10);
}

function fmtMoney(n){
  return 'S/ ' + (Number(n)||0).toFixed(2);
}

function fmtDateHuman(iso){
  if(!iso) return '';
  const [y,m,d] = iso.split('-');
  if(!y) return iso;
  return `${d}/${m}/${y.slice(2)}`;
}

function fmtDateTimeHuman(isoDateTime){
  const dt = new Date(isoDateTime);
  const d = String(dt.getDate()).padStart(2,'0');
  const m = String(dt.getMonth()+1).padStart(2,'0');
  const y = dt.getFullYear();
  const hh = String(dt.getHours()).padStart(2,'0');
  const mm = String(dt.getMinutes()).padStart(2,'0');
  return `${d}/${m}/${y} ${hh}:${mm}`;
}

/* ---------------- Cálculos derivados de un grupo ---------------- */

function getGroup(id){
  return groups.find(g => g.id === id);
}

function uniqueUsersCount(group){
  return new Set(group.purchases.map(p => p.name.trim().toLowerCase())).size;
}

function totalCobrado(group){
  return group.purchases.reduce((sum,p) => sum + Number(p.price||0), 0);
}

function promedioPorUsuario(group){
  const users = uniqueUsersCount(group);
  return users ? totalCobrado(group) / users : 0;
}

/* ==========================================================
   RENDER: DASHBOARD
   ========================================================== */

function renderDashboard(){
  const grid = document.getElementById('groups-grid');
  const empty = document.getElementById('empty-state');
  grid.innerHTML = '';

  if(groups.length === 0){
    empty.hidden = false;
  }else{
    empty.hidden = true;
    groups.forEach(g => grid.appendChild(buildGroupCard(g)));
  }

  document.getElementById('stat-total-groups').textContent = groups.length;
  document.getElementById('stat-total-users').textContent =
    new Set(groups.flatMap(g => g.purchases.map(p => p.name.trim().toLowerCase()))).size;
  document.getElementById('stat-total-purchases').textContent =
    groups.reduce((s,g) => s + g.purchases.length, 0);
  document.getElementById('stat-total-revenue').textContent =
    fmtMoney(groups.reduce((s,g) => s + totalCobrado(g), 0));
}

function buildGroupCard(g){
  const card = document.createElement('div');
  card.className = 'group-card';
  card.addEventListener('click', () => openGroup(g.id));

  const resultLabel = { pendiente:'Pendiente ⏳', ganado:'Ganado ✅', perdido:'Perdido ❌' }[g.resultado || 'pendiente'];

  card.innerHTML = `
    <div class="gc-top">
      <img class="gc-photo" src="${g.photo || placeholderPhoto()}" alt="">
      <div class="gc-name-wrap">
        <div class="gc-name">${escapeHtml(g.name)}</div>
        <div class="gc-partido">${escapeHtml(g.partido || '')}</div>
      </div>
    </div>
    <div style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
      <span class="gc-price-badge">${fmtMoney(g.price)}</span>
      <span class="gc-result ${g.resultado || 'pendiente'}">${resultLabel}</span>
    </div>
    <div class="gc-stats">
      <div class="gc-stat">
        <span class="gc-stat-label">Usuarios</span>
        <span class="gc-stat-value mono">${uniqueUsersCount(g)}</span>
      </div>
      <div class="gc-stat">
        <span class="gc-stat-label">Compras</span>
        <span class="gc-stat-value mono">${g.purchases.length}</span>
      </div>
      <div class="gc-stat">
        <span class="gc-stat-label">Cobrado</span>
        <span class="gc-stat-value mono">${fmtMoney(totalCobrado(g))}</span>
      </div>
    </div>
  `;
  return card;
}

function placeholderPhoto(){
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
      <rect width="100" height="100" fill="#1B1B25"/>
      <text x="50" y="58" font-size="42" text-anchor="middle" fill="#D8A02E" font-family="sans-serif">$</text>
    </svg>`);
}

function escapeHtml(str){
  const d = document.createElement('div');
  d.textContent = str ?? '';
  return d.innerHTML;
}

/* ==========================================================
   RENDER: GRUPO (detalle)
   ========================================================== */

function openGroup(id){
  currentGroupId = id;
  switchView('group');
  renderGroupDetail();
}

function renderGroupDetail(){
  const g = getGroup(currentGroupId);
  if(!g){ switchView('dashboard'); return; }

  document.getElementById('group-photo').src = g.photo || placeholderPhoto();
  document.getElementById('group-name').textContent = g.name;
  document.getElementById('group-partido').textContent = g.partido || '';

  document.getElementById('rcard-price').textContent = fmtMoney(g.price);
  document.getElementById('rcard-users').textContent = uniqueUsersCount(g);
  document.getElementById('rcard-purchases').textContent = g.purchases.length;
  document.getElementById('rcard-total').textContent = fmtMoney(totalCobrado(g));
  document.getElementById('rcard-avg').textContent = fmtMoney(promedioPorUsuario(g));

  document.getElementById('price-current-display').textContent = fmtMoney(g.price);

  renderPriceHistory(g);
  renderPurchasesTable(g);
  renderFlashCard(g);
}

function renderPriceHistory(g){
  const list = document.getElementById('price-history-list');
  list.innerHTML = '';
  g.priceHistory.forEach((entry, i) => {
    const li = document.createElement('li');
    const text = i === 0
      ? `Precio inicial: <b>${fmtMoney(entry.price)}</b>`
      : `Cambiado a <b>${fmtMoney(entry.price)}</b>`;
    li.innerHTML = `
      <span class="ph-dot"></span>
      <span class="ph-date">${fmtDateTimeHuman(entry.date)}</span>
      <span class="ph-text">${text}</span>
    `;
    list.appendChild(li);
  });
}

function renderPurchasesTable(g){
  const tbody = document.getElementById('purchases-tbody');
  const emptyMsg = document.getElementById('purchases-empty');
  tbody.innerHTML = '';

  if(g.purchases.length === 0){
    emptyMsg.hidden = false;
  }else{
    emptyMsg.hidden = true;
    // más recientes primero
    [...g.purchases].reverse().forEach(p => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(p.name)}</td>
        <td class="mono">${fmtMoney(p.price)}</td>
        <td class="mono">${fmtDateHuman(p.date)}</td>
        <td class="td-actions"><button class="row-edit-btn" data-id="${p.id}">Editar</button></td>
      `;
      tr.querySelector('.row-edit-btn').addEventListener('click', () => openEditPurchase(p.id));
      tbody.appendChild(tr);
    });
  }
}

/* ---------------- Resumen detallado ("JIJAZO FLASH") ---------------- */

function renderFlashCard(g){
  document.getElementById('flash-title').textContent = g.name || 'JIJAZO FLASH';

  const personas = (g.personasOverride ?? uniqueUsersCount(g));
  document.getElementById('flash-personas').textContent = personas;

  document.getElementById('flash-resultado').value = g.resultado || 'pendiente';
  document.getElementById('flash-cuota').value = g.cuota || '';
  document.getElementById('flash-fecha').value = g.fecha || '';
  document.getElementById('flash-link').value = g.link || '';

  const img = document.getElementById('flash-shot-img');
  const placeholder = document.getElementById('flash-shot-placeholder');
  if(g.flashShot){
    img.src = g.flashShot;
    img.hidden = false;
    placeholder.hidden = true;
  }else{
    img.hidden = true;
    placeholder.hidden = false;
  }
}

/* ==========================================================
   VISTAS (dashboard / grupo)
   ========================================================== */

function switchView(view){
  document.getElementById('view-dashboard').hidden = view !== 'dashboard';
  document.getElementById('view-group').hidden = view !== 'group';
  if(view === 'dashboard') renderDashboard();
  window.scrollTo({ top:0, behavior:'instant' in window ? 'instant' : 'auto' });
}

/* ==========================================================
   HELPERS: leer imagen como dataURL
   ========================================================== */

function readImageAsDataURL(file, cb){
  if(!file) return;
  const reader = new FileReader();
  reader.onload = e => cb(e.target.result);
  reader.readAsDataURL(file);
}

/* ==========================================================
   EVENTOS: NUEVO GRUPO
   ========================================================== */

let newGroupPhoto = null;

function openNewGroupModal(){
  newGroupPhoto = null;
  document.getElementById('new-photo-preview').hidden = true;
  document.getElementById('new-photo-placeholder').hidden = false;
  document.getElementById('new-group-name').value = '';
  document.getElementById('new-group-partido').value = '';
  document.getElementById('new-group-price').value = '';
  document.getElementById('modal-new-group').hidden = false;
}

document.getElementById('btn-new-group').addEventListener('click', openNewGroupModal);
document.getElementById('btn-new-group-empty').addEventListener('click', openNewGroupModal);
document.getElementById('btn-close-new-group').addEventListener('click', () => document.getElementById('modal-new-group').hidden = true);
document.getElementById('btn-cancel-new-group').addEventListener('click', () => document.getElementById('modal-new-group').hidden = true);

document.getElementById('new-photo-picker').addEventListener('click', () => document.getElementById('new-photo-input').click());
document.getElementById('new-photo-input').addEventListener('change', e => {
  readImageAsDataURL(e.target.files[0], dataUrl => {
    newGroupPhoto = dataUrl;
    const preview = document.getElementById('new-photo-preview');
    preview.src = dataUrl;
    preview.hidden = false;
    document.getElementById('new-photo-placeholder').hidden = true;
  });
});

document.getElementById('btn-create-group').addEventListener('click', () => {
  const name = document.getElementById('new-group-name').value.trim();
  const partido = document.getElementById('new-group-partido').value.trim();
  const price = parseFloat(document.getElementById('new-group-price').value) || 0;

  if(!name){ alert('Ponle un nombre al grupo.'); return; }

  const now = new Date().toISOString();
  const group = {
    id: uid(),
    name, partido,
    photo: newGroupPhoto,
    price,
    priceHistory: [{ price, date: now }],
    purchases: [],
    resultado: 'pendiente',
    cuota: '',
    fecha: '',
    link: '',
    personasOverride: null,
    flashShot: null,
  };
  groups.unshift(group);
  saveGroups();
  document.getElementById('modal-new-group').hidden = true;
  renderDashboard();
});

/* ==========================================================
   EVENTOS: VOLVER / ELIMINAR GRUPO
   ========================================================== */

document.getElementById('btn-back').addEventListener('click', () => switchView('dashboard'));

document.getElementById('btn-delete-group').addEventListener('click', () => {
  const g = getGroup(currentGroupId);
  if(!g) return;
  if(!confirm(`¿Eliminar el grupo "${g.name}"? Esta acción no se puede deshacer.`)) return;
  groups = groups.filter(x => x.id !== currentGroupId);
  saveGroups();
  switchView('dashboard');
});

/* ---------------- Editar nombre del grupo (contenteditable) ---------------- */

document.getElementById('group-name').addEventListener('blur', () => {
  const g = getGroup(currentGroupId);
  if(!g) return;
  const newName = document.getElementById('group-name').textContent.trim() || g.name;
  g.name = newName;
  saveGroups();
  document.getElementById('flash-title').textContent = newName;
});

document.getElementById('group-name').addEventListener('keydown', e => {
  if(e.key === 'Enter'){ e.preventDefault(); e.target.blur(); }
});

/* ---------------- Cambiar foto del grupo ---------------- */

document.getElementById('group-photo-edit').addEventListener('click', () => document.getElementById('group-photo-input').click());
document.getElementById('group-photo-input').addEventListener('change', e => {
  const g = getGroup(currentGroupId);
  if(!g) return;
  readImageAsDataURL(e.target.files[0], dataUrl => {
    g.photo = dataUrl;
    saveGroups();
    document.getElementById('group-photo').src = dataUrl;
  });
});

/* ==========================================================
   EVENTOS: EDITAR PRECIO DEL GRUPO
   ========================================================== */

document.getElementById('btn-edit-price').addEventListener('click', () => {
  const g = getGroup(currentGroupId);
  document.getElementById('input-new-price').value = g.price;
  document.getElementById('edit-price-panel').hidden = false;
  document.getElementById('input-new-price').focus();
});

document.getElementById('btn-cancel-price').addEventListener('click', () => {
  document.getElementById('edit-price-panel').hidden = true;
});

document.getElementById('btn-save-price').addEventListener('click', () => {
  const g = getGroup(currentGroupId);
  const newPrice = parseFloat(document.getElementById('input-new-price').value);
  if(isNaN(newPrice) || newPrice < 0){ alert('Ingresa un precio válido.'); return; }

  g.price = newPrice;
  g.priceHistory.push({ price: newPrice, date: new Date().toISOString() });
  saveGroups();

  document.getElementById('edit-price-panel').hidden = true;
  renderGroupDetail();
});

/* ==========================================================
   EVENTOS: AGREGAR COMPRA (individual)
   ========================================================== */

document.getElementById('btn-add-purchase').addEventListener('click', () => {
  const g = getGroup(currentGroupId);
  document.getElementById('purchase-name').value = '';
  document.getElementById('purchase-price').value = g.price;
  document.getElementById('purchase-date').value = todayISO();
  document.getElementById('modal-add-purchase').hidden = false;
});

document.getElementById('btn-close-add-purchase').addEventListener('click', () => document.getElementById('modal-add-purchase').hidden = true);
document.getElementById('btn-cancel-add-purchase').addEventListener('click', () => document.getElementById('modal-add-purchase').hidden = true);

document.getElementById('btn-confirm-add-purchase').addEventListener('click', () => {
  const g = getGroup(currentGroupId);
  const name = document.getElementById('purchase-name').value.trim();
  const price = parseFloat(document.getElementById('purchase-price').value);
  const date = document.getElementById('purchase-date').value || todayISO();

  if(!name){ alert('Ponle un nombre al usuario.'); return; }
  if(isNaN(price) || price < 0){ alert('Ingresa un precio válido.'); return; }

  g.purchases.push({ id: uid(), name, price, date });
  saveGroups();
  document.getElementById('modal-add-purchase').hidden = true;
  renderGroupDetail();
});

/* ==========================================================
   EVENTOS: AGREGAR VARIOS (bulk paste)
   ========================================================== */

document.getElementById('btn-bulk-add').addEventListener('click', () => {
  document.getElementById('bulk-names').value = '';
  document.getElementById('modal-bulk-add').hidden = false;
});
document.getElementById('btn-close-bulk-add').addEventListener('click', () => document.getElementById('modal-bulk-add').hidden = true);
document.getElementById('btn-cancel-bulk-add').addEventListener('click', () => document.getElementById('modal-bulk-add').hidden = true);

document.getElementById('btn-confirm-bulk-add').addEventListener('click', () => {
  const g = getGroup(currentGroupId);
  const names = document.getElementById('bulk-names').value
    .split('\n').map(n => n.trim()).filter(Boolean);

  if(names.length === 0){ alert('Escribe al menos un nombre.'); return; }

  const date = todayISO();
  names.forEach(name => {
    g.purchases.push({ id: uid(), name, price: g.price, date });
  });
  saveGroups();
  document.getElementById('modal-bulk-add').hidden = true;
  renderGroupDetail();
});

/* ==========================================================
   EVENTOS: EDITAR / ELIMINAR COMPRA INDIVIDUAL
   ========================================================== */

function openEditPurchase(purchaseId){
  const g = getGroup(currentGroupId);
  const p = g.purchases.find(x => x.id === purchaseId);
  if(!p) return;
  editingPurchaseId = purchaseId;
  document.getElementById('edit-purchase-name').value = p.name;
  document.getElementById('edit-purchase-price').value = p.price;
  document.getElementById('edit-purchase-date').value = p.date;
  document.getElementById('modal-edit-purchase').hidden = false;
}

document.getElementById('btn-close-edit-purchase').addEventListener('click', () => document.getElementById('modal-edit-purchase').hidden = true);

document.getElementById('btn-save-purchase').addEventListener('click', () => {
  const g = getGroup(currentGroupId);
  const p = g.purchases.find(x => x.id === editingPurchaseId);
  if(!p) return;

  const name = document.getElementById('edit-purchase-name').value.trim();
  const price = parseFloat(document.getElementById('edit-purchase-price').value);
  const date = document.getElementById('edit-purchase-date').value;

  if(!name){ alert('Ponle un nombre al usuario.'); return; }
  if(isNaN(price) || price < 0){ alert('Ingresa un precio válido.'); return; }

  p.name = name; p.price = price; p.date = date;
  saveGroups();
  document.getElementById('modal-edit-purchase').hidden = true;
  renderGroupDetail();
});

document.getElementById('btn-delete-purchase').addEventListener('click', () => {
  const g = getGroup(currentGroupId);
  if(!confirm('¿Eliminar esta compra?')) return;
  g.purchases = g.purchases.filter(x => x.id !== editingPurchaseId);
  saveGroups();
  document.getElementById('modal-edit-purchase').hidden = true;
  renderGroupDetail();
});

/* ==========================================================
   EVENTOS: RESUMEN DETALLADO ("JIJAZO FLASH")
   ========================================================== */

document.getElementById('btn-edit-personas').addEventListener('click', () => {
  const g = getGroup(currentGroupId);
  const current = g.personasOverride ?? uniqueUsersCount(g);
  const val = prompt('Personas que entraron (déjalo vacío para calcularlo automáticamente según los usuarios únicos):', current);
  if(val === null) return;
  g.personasOverride = val.trim() === '' ? null : (parseInt(val,10) || 0);
  saveGroups();
  renderFlashCard(g);
});

document.getElementById('flash-resultado').addEventListener('change', e => {
  const g = getGroup(currentGroupId);
  g.resultado = e.target.value;
  saveGroups();
});
document.getElementById('flash-cuota').addEventListener('input', e => {
  const g = getGroup(currentGroupId);
  g.cuota = e.target.value;
  saveGroups();
});
document.getElementById('flash-fecha').addEventListener('input', e => {
  const g = getGroup(currentGroupId);
  g.fecha = e.target.value;
  saveGroups();
});
document.getElementById('flash-link').addEventListener('input', e => {
  const g = getGroup(currentGroupId);
  g.link = e.target.value;
  saveGroups();
});

document.getElementById('flash-shot-wrap').addEventListener('click', () => document.getElementById('flash-shot-input').click());
document.getElementById('flash-shot-input').addEventListener('change', e => {
  const g = getGroup(currentGroupId);
  readImageAsDataURL(e.target.files[0], dataUrl => {
    g.flashShot = dataUrl;
    saveGroups();
    renderFlashCard(g);
  });
});

document.getElementById('btn-download-flash').addEventListener('click', () => {
  const g = getGroup(currentGroupId);
  const node = document.getElementById('flash-card');
  html2canvas(node, { backgroundColor: '#0B0B0F', scale: 2 }).then(canvas => {
    const link = document.createElement('a');
    link.download = `${(g.name || 'jijazo-flash').replace(/[^a-z0-9]+/gi,'-').toLowerCase()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  });
});

/* ---------------- Enviar resumen por WhatsApp ---------------- */

const WHATSAPP_NUMBER = '51960096203'; // 51 = código de país Perú + 960096203

function buildResumenTexto(g){
  const resultLabel = { pendiente:'Pendiente ⏳', ganado:'Ganado ✅', perdido:'Perdido ❌' }[g.resultado || 'pendiente'];
  const personas = g.personasOverride ?? uniqueUsersCount(g);

  const lineas = [
    `*${g.name || 'JIJAZO FLASH'}*`,
    '',
    `Personas que entraron: ${personas}`,
    `Resultado: ${resultLabel}`,
  ];
  if(g.cuota) lineas.push(`Cuota: ${g.cuota}`);
  if(g.fecha) lineas.push(`Fecha: ${g.fecha}`);
  if(g.link) lineas.push(`Link: ${g.link}`);

  lineas.push('');
  lineas.push('— Resumen del grupo —');
  lineas.push(`Precio del grupo: ${fmtMoney(g.price)}`);
  lineas.push(`Usuarios únicos: ${uniqueUsersCount(g)}`);
  lineas.push(`Compras totales: ${g.purchases.length}`);
  lineas.push(`Total cobrado: ${fmtMoney(totalCobrado(g))}`);
  lineas.push(`Promedio por usuario: ${fmtMoney(promedioPorUsuario(g))}`);

  return lineas.join('\n');
}

document.getElementById('btn-send-whatsapp').addEventListener('click', () => {
  const g = getGroup(currentGroupId);
  if(!g) return;
  const texto = buildResumenTexto(g);
  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(texto)}`;
  window.open(url, '_blank');
});

/* ==========================================================
   LOGIN
   ========================================================== */

const AUTH_KEY = 'jijas-auth-v1';
const VALID_USER = 'JIJAZO';
const VALID_PASS = 'ADMIN';

function isLoggedIn(){
  return sessionStorage.getItem(AUTH_KEY) === 'ok';
}

function showApp(){
  document.getElementById('login-screen').hidden = true;
  document.getElementById('app-root').hidden = false;
  renderDashboard();
}

function showLogin(){
  document.getElementById('app-root').hidden = true;
  document.getElementById('login-screen').hidden = false;
  document.getElementById('login-user').value = '';
  document.getElementById('login-pass').value = '';
  document.getElementById('login-error').hidden = true;
  document.getElementById('login-user').focus();
}

document.getElementById('login-form').addEventListener('submit', e => {
  e.preventDefault();
  const user = document.getElementById('login-user').value.trim();
  const pass = document.getElementById('login-pass').value;

  if(user === VALID_USER && pass === VALID_PASS){
    sessionStorage.setItem(AUTH_KEY, 'ok');
    showApp();
  }else{
    document.getElementById('login-error').hidden = false;
  }
});

document.getElementById('btn-logout').addEventListener('click', () => {
  sessionStorage.removeItem(AUTH_KEY);
  currentGroupId = null;
  showLogin();
});

/* ==========================================================
   INICIO
   ========================================================== */

if(isLoggedIn()){
  showApp();
}else{
  showLogin();
}
