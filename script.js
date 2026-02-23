/* =============================================
   AUTOFLEET — SCRIPT.JS
   Gestion de flotte automobile complète
   ============================================= */

// ─────────────────────────────────────────────
// ÉTAT GLOBAL & STOCKAGE
// ─────────────────────────────────────────────

let voitures = JSON.parse(localStorage.getItem('af_voitures') || '[]');
let locations = JSON.parse(localStorage.getItem('af_locations') || '[]');
let sortConfig = { voitures: { key: '', dir: 'asc' }, locations: { key: '', dir: 'asc' } };

// Variables pour confirmation de suppression
let pendingDelete = null;

// ─────────────────────────────────────────────
// PERSISTANCE
// ─────────────────────────────────────────────

function saveVoitures() {
  localStorage.setItem('af_voitures', JSON.stringify(voitures));
}

function saveLocations() {
  localStorage.setItem('af_locations', JSON.stringify(locations));
}

// ─────────────────────────────────────────────
// NAVIGATION
// ─────────────────────────────────────────────

const navItems = document.querySelectorAll('.nav-item');
const pages = document.querySelectorAll('.page');

navItems.forEach(item => {
  item.addEventListener('click', e => {
    e.preventDefault();
    const target = item.dataset.page;

    navItems.forEach(n => n.classList.remove('active'));
    item.classList.add('active');

    pages.forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + target).classList.add('active');

    // Fermer sidebar mobile
    closeSidebar();

    // Rafraîchir la page active
    if (target === 'dashboard') renderDashboard();
    if (target === 'voitures') renderVoitures();
    if (target === 'locations') renderLocations();
  });
});

// ─────────────────────────────────────────────
// SIDEBAR MOBILE
// ─────────────────────────────────────────────

const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('overlay');
const mobileToggle = document.getElementById('mobileToggle');

mobileToggle.addEventListener('click', () => {
  sidebar.classList.toggle('open');
  overlay.classList.toggle('open');
});

overlay.addEventListener('click', closeSidebar);

function closeSidebar() {
  sidebar.classList.remove('open');
  overlay.classList.remove('open');
}

// ─────────────────────────────────────────────
// DARK MODE
// ─────────────────────────────────────────────

const themeToggle = document.getElementById('themeToggle');
const themeIcon = document.getElementById('themeIcon');
const themeLabel = document.getElementById('themeLabel');

const savedTheme = localStorage.getItem('af_theme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);
updateThemeUI(savedTheme);

themeToggle.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('af_theme', next);
  updateThemeUI(next);
  // Recréer graphiques avec bonnes couleurs
  renderDashboard();
});

function updateThemeUI(theme) {
  if (theme === 'dark') {
    themeIcon.textContent = '☀️';
    themeLabel.textContent = 'Light Mode';
  } else {
    themeIcon.textContent = '🌙';
    themeLabel.textContent = 'Dark Mode';
  }
}

// ─────────────────────────────────────────────
// MODALS
// ─────────────────────────────────────────────

function openModal(id) {
  document.getElementById(id).classList.add('open');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

// Boutons fermeture modals
document.querySelectorAll('[data-close]').forEach(btn => {
  btn.addEventListener('click', () => closeModal(btn.dataset.close));
});

// Cliquer hors du modal pour fermer
document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
  backdrop.addEventListener('click', e => {
    if (e.target === backdrop) closeModal(backdrop.id);
  });
});

// ─────────────────────────────────────────────
// TOAST NOTIFICATIONS
// ─────────────────────────────────────────────

function showToast(msg, type = 'success') {
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span style="font-size:16px">${icons[type]}</span> ${msg}`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ─────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────

let fleetChartInstance = null;
let revenusChartInstance = null;

function renderDashboard() {
  const total = voitures.length;
  const dispo = voitures.filter(v => v.etat === 'disponible').length;
  const louees = voitures.filter(v => v.etat === 'louée').length;
  const clients = locations.length;
  const revenus = locations.reduce((sum, l) => sum + (l.montant || 0), 0);

  document.getElementById('dash-total').textContent = total;
  document.getElementById('dash-dispo').textContent = dispo;
  document.getElementById('dash-louees').textContent = louees;
  document.getElementById('dash-clients').textContent = clients;
  document.getElementById('dash-revenus').textContent = revenus.toLocaleString('fr-MA') + ' DH';

  // Dernières 5 locations
  const tbody = document.getElementById('dash-recent-body');
  const recents = [...locations].reverse().slice(0, 5);
  if (recents.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-msg">Aucune location enregistrée.</td></tr>';
  } else {
    tbody.innerHTML = recents.map(l => {
      const v = voitures.find(x => x.id === l.voitureId);
      const label = v ? `${v.marque} ${v.modele}` : '—';
      return `<tr>
        <td><strong>${esc(l.client)}</strong></td>
        <td>${esc(label)}</td>
        <td>${formatDate(l.dateDebut)}</td>
        <td>${formatDate(l.dateFin)}</td>
        <td><strong>${l.montant.toLocaleString('fr-MA')} DH</strong></td>
      </tr>`;
    }).join('');
  }

  // Graphiques
  buildFleetChart(dispo, louees);
  buildRevenusChart();
}

function buildFleetChart(dispo, louees) {
  const ctx = document.getElementById('fleetChart').getContext('2d');
  if (fleetChartInstance) fleetChartInstance.destroy();

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const textColor = isDark ? '#888' : '#6b6860';

  fleetChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Disponibles', 'Louées'],
      datasets: [{
        data: [dispo || 0, louees || 0],
        backgroundColor: ['#2ec77a', '#f07840'],
        borderWidth: 0,
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: textColor, font: { family: 'DM Sans', size: 12 }, padding: 16 }
        }
      },
      cutout: '65%'
    }
  });
}

function buildRevenusChart() {
  const ctx = document.getElementById('revenusChart').getContext('2d');
  if (revenusChartInstance) revenusChartInstance.destroy();

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const textColor = isDark ? '#888' : '#6b6860';
  const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';

  // Regrouper revenus par mois
  const months = {};
  locations.forEach(l => {
    const d = new Date(l.dateDebut);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    months[key] = (months[key] || 0) + l.montant;
  });

  const sorted = Object.keys(months).sort().slice(-6);
  const labels = sorted.map(k => {
    const [y, m] = k.split('-');
    return new Date(y, m-1).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
  });
  const data = sorted.map(k => months[k]);

  revenusChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels.length ? labels : ['—'],
      datasets: [{
        label: 'Revenus (DH)',
        data: data.length ? data : [0],
        backgroundColor: '#f0e040',
        borderRadius: 6,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: { ticks: { color: textColor, font: { family: 'DM Sans' } }, grid: { display: false } },
        y: { ticks: { color: textColor, font: { family: 'DM Sans' } }, grid: { color: gridColor } }
      }
    }
  });
}

// ─────────────────────────────────────────────
// GESTION DES VOITURES
// ─────────────────────────────────────────────

// Ouvrir formulaire ajout
document.getElementById('btnAddVoiture').addEventListener('click', () => {
  resetFormVoiture();
  document.getElementById('modalVoitureTitre').textContent = 'Ajouter une Voiture';
  openModal('modalVoiture');
});

function resetFormVoiture() {
  document.getElementById('formVoiture').reset();
  document.getElementById('voitureId').value = '';
  ['marque','modele','annee','prix'].forEach(f => {
    document.getElementById('err-' + f).textContent = '';
    const input = document.getElementById('voiture' + capitalize(f));
    if (input) input.classList.remove('invalid');
  });
}

function editVoiture(id) {
  const v = voitures.find(x => x.id === id);
  if (!v) return;
  resetFormVoiture();
  document.getElementById('modalVoitureTitre').textContent = 'Modifier la Voiture';
  document.getElementById('voitureId').value = v.id;
  document.getElementById('voitureMarque').value = v.marque;
  document.getElementById('voitureModele').value = v.modele;
  document.getElementById('voitureAnnee').value = v.annee;
  document.getElementById('voiturePrix').value = v.prixJour;
  document.getElementById('voitureEtat').value = v.etat;
  openModal('modalVoiture');
}

function deleteVoiture(id) {
  const v = voitures.find(x => x.id === id);
  const isLoued = locations.some(l => l.voitureId === id);
  if (isLoued) {
    showToast('Impossible: cette voiture a des locations associées.', 'error');
    return;
  }
  document.getElementById('confirmMsg').textContent = `Supprimer "${v.marque} ${v.modele}" ?`;
  pendingDelete = () => {
    voitures = voitures.filter(x => x.id !== id);
    saveVoitures();
    renderVoitures();
    renderDashboard();
    showToast('Voiture supprimée.', 'info');
  };
  openModal('modalConfirm');
}

// Soumission formulaire voiture
document.getElementById('formVoiture').addEventListener('submit', e => {
  e.preventDefault();
  if (!validateFormVoiture()) return;

  const id = document.getElementById('voitureId').value;
  const data = {
    marque: document.getElementById('voitureMarque').value.trim(),
    modele: document.getElementById('voitureModele').value.trim(),
    annee: parseInt(document.getElementById('voitureAnnee').value),
    prixJour: parseFloat(document.getElementById('voiturePrix').value),
    etat: document.getElementById('voitureEtat').value
  };

  if (id) {
    // Modifier
    const idx = voitures.findIndex(v => v.id === id);
    voitures[idx] = { ...voitures[idx], ...data };
    showToast('Voiture modifiée avec succès!');
  } else {
    // Ajouter
    voitures.push({ id: genId(), ...data });
    showToast('Voiture ajoutée avec succès!');
  }

  saveVoitures();
  closeModal('modalVoiture');
  renderVoitures();
  renderDashboard();
});

function validateFormVoiture() {
  let valid = true;
  const fields = [
    { id: 'voitureMarque', err: 'err-marque', msg: 'La marque est requise.' },
    { id: 'voitureModele', err: 'err-modele', msg: 'Le modèle est requis.' },
    { id: 'voitureAnnee', err: 'err-annee', msg: 'Année invalide (1900-2030).' },
    { id: 'voiturePrix', err: 'err-prix', msg: 'Prix invalide.' }
  ];

  fields.forEach(f => {
    const el = document.getElementById(f.id);
    const errEl = document.getElementById(f.err);
    const val = el.value.trim();
    let ok = val !== '';
    if (f.id === 'voitureAnnee') ok = ok && +val >= 1900 && +val <= 2030;
    if (f.id === 'voiturePrix') ok = ok && +val > 0;
    errEl.textContent = ok ? '' : f.msg;
    el.classList.toggle('invalid', !ok);
    if (!ok) valid = false;
  });

  return valid;
}

// Rendu tableau voitures
function renderVoitures(filter = '') {
  const search = (filter || document.getElementById('searchVoiture').value).toLowerCase();
  const etatFilter = document.getElementById('filterEtat').value;

  let data = voitures.filter(v => {
    const match = `${v.marque} ${v.modele} ${v.annee}`.toLowerCase().includes(search);
    const etatMatch = etatFilter ? v.etat === etatFilter : true;
    return match && etatMatch;
  });

  // Tri
  const { key, dir } = sortConfig.voitures;
  if (key) {
    data.sort((a, b) => {
      let va = a[key], vb = b[key];
      if (typeof va === 'string') va = va.toLowerCase(), vb = vb.toLowerCase();
      return dir === 'asc' ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
    });
  }

  const tbody = document.getElementById('voituresBody');
  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-msg">Aucune voiture trouvée.</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(v => `
    <tr>
      <td><strong>${esc(v.marque)}</strong></td>
      <td>${esc(v.modele)}</td>
      <td>${v.annee}</td>
      <td>${v.prixJour.toLocaleString('fr-MA')} DH/j</td>
      <td><span class="badge ${v.etat === 'disponible' ? 'badge-green' : 'badge-orange'}">${v.etat}</span></td>
      <td>
        <div class="action-btns">
          <button class="btn-icon" title="Modifier" onclick="editVoiture('${v.id}')">✏️</button>
          <button class="btn-icon delete" title="Supprimer" onclick="deleteVoiture('${v.id}')">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');
}

// Recherche & filtre voitures
document.getElementById('searchVoiture').addEventListener('input', () => renderVoitures());
document.getElementById('filterEtat').addEventListener('change', () => renderVoitures());

// Tri colonnes voitures
document.getElementById('voituresTable').querySelector('thead').addEventListener('click', e => {
  const th = e.target.closest('th[data-sort]');
  if (!th) return;
  const key = th.dataset.sort;
  if (sortConfig.voitures.key === key) {
    sortConfig.voitures.dir = sortConfig.voitures.dir === 'asc' ? 'desc' : 'asc';
  } else {
    sortConfig.voitures = { key, dir: 'asc' };
  }
  renderVoitures();
});

// ─────────────────────────────────────────────
// GESTION DES LOCATIONS
// ─────────────────────────────────────────────

document.getElementById('btnAddLocation').addEventListener('click', () => {
  resetFormLocation();
  document.getElementById('modalLocationTitre').textContent = 'Nouvelle Location';
  populateVoituresSelect(null);
  openModal('modalLocation');
});

function resetFormLocation() {
  document.getElementById('formLocation').reset();
  document.getElementById('locationId').value = '';
  document.getElementById('montantCalc').textContent = '— DH';
  ['client','voiture','debut','fin'].forEach(f => {
    const errEl = document.getElementById('err-' + f);
    if (errEl) errEl.textContent = '';
  });
  const inputs = document.querySelectorAll('#formLocation input, #formLocation select');
  inputs.forEach(el => el.classList.remove('invalid'));
}

function populateVoituresSelect(currentVoitureId) {
  const select = document.getElementById('locationVoiture');
  const disponibles = voitures.filter(v => v.etat === 'disponible' || v.id === currentVoitureId);
  select.innerHTML = '<option value="">-- Sélectionnez une voiture --</option>';
  disponibles.forEach(v => {
    select.innerHTML += `<option value="${v.id}" ${v.id === currentVoitureId ? 'selected' : ''}>${v.marque} ${v.modele} — ${v.prixJour} DH/j</option>`;
  });
}

function editLocation(id) {
  const l = locations.find(x => x.id === id);
  if (!l) return;
  resetFormLocation();
  document.getElementById('modalLocationTitre').textContent = 'Modifier la Location';
  document.getElementById('locationId').value = l.id;
  document.getElementById('locationClient').value = l.client;
  document.getElementById('locationDebut').value = l.dateDebut;
  document.getElementById('locationFin').value = l.dateFin;
  populateVoituresSelect(l.voitureId);
  document.getElementById('locationVoiture').value = l.voitureId;
  updateMontant();
  openModal('modalLocation');
}

function deleteLocation(id) {
  const l = locations.find(x => x.id === id);
  document.getElementById('confirmMsg').textContent = `Supprimer la location de "${l.client}" ?`;
  pendingDelete = () => {
    // Remettre la voiture en disponible si nécessaire
    const v = voitures.find(x => x.id === l.voitureId);
    if (v) {
      // Vérifier si d'autres locations actives existent pour cette voiture
      const autres = locations.filter(x => x.id !== id && x.voitureId === l.voitureId);
      if (autres.length === 0) {
        v.etat = 'disponible';
        saveVoitures();
      }
    }
    locations = locations.filter(x => x.id !== id);
    saveLocations();
    renderLocations();
    renderDashboard();
    showToast('Location supprimée.', 'info');
  };
  openModal('modalConfirm');
}

// Calcul montant auto
function updateMontant() {
  const voitureId = document.getElementById('locationVoiture').value;
  const debut = document.getElementById('locationDebut').value;
  const fin = document.getElementById('locationFin').value;
  const montantBox = document.getElementById('montantCalc');

  if (!voitureId || !debut || !fin) {
    montantBox.textContent = '— DH';
    return;
  }

  const v = voitures.find(x => x.id === voitureId);
  if (!v) return;

  const d1 = new Date(debut);
  const d2 = new Date(fin);
  const jours = Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24));

  if (jours <= 0) {
    montantBox.textContent = 'Dates invalides';
    return;
  }

  const montant = jours * v.prixJour;
  montantBox.textContent = `${montant.toLocaleString('fr-MA')} DH (${jours} jour${jours > 1 ? 's' : ''})`;
}

document.getElementById('locationVoiture').addEventListener('change', updateMontant);
document.getElementById('locationDebut').addEventListener('change', updateMontant);
document.getElementById('locationFin').addEventListener('change', updateMontant);

// Soumission formulaire location
document.getElementById('formLocation').addEventListener('submit', e => {
  e.preventDefault();
  if (!validateFormLocation()) return;

  const id = document.getElementById('locationId').value;
  const voitureId = document.getElementById('locationVoiture').value;
  const debut = document.getElementById('locationDebut').value;
  const fin = document.getElementById('locationFin').value;
  const v = voitures.find(x => x.id === voitureId);
  const jours = Math.ceil((new Date(fin) - new Date(debut)) / (1000 * 60 * 60 * 24));
  const montant = jours * v.prixJour;

  const data = {
    client: document.getElementById('locationClient').value.trim(),
    voitureId,
    dateDebut: debut,
    dateFin: fin,
    montant
  };

  if (id) {
    // Modifier
    const oldLocation = locations.find(x => x.id === id);
    // Remettre ancienne voiture en dispo si elle change
    if (oldLocation.voitureId !== voitureId) {
      const oldV = voitures.find(x => x.id === oldLocation.voitureId);
      if (oldV) { oldV.etat = 'disponible'; }
    }
    const idx = locations.findIndex(x => x.id === id);
    locations[idx] = { ...locations[idx], ...data };
    showToast('Location modifiée!');
  } else {
    locations.push({ id: genId(), ...data });
    showToast('Location enregistrée!');
  }

  // Marquer voiture comme louée
  if (v) { v.etat = 'louée'; saveVoitures(); }

  saveLocations();
  closeModal('modalLocation');
  renderLocations();
  renderDashboard();
});

function validateFormLocation() {
  let valid = true;

  // Client
  const client = document.getElementById('locationClient');
  const errClient = document.getElementById('err-client');
  if (!client.value.trim()) {
    errClient.textContent = 'Le nom du client est requis.';
    client.classList.add('invalid');
    valid = false;
  } else {
    errClient.textContent = '';
    client.classList.remove('invalid');
  }

  // Voiture
  const voiture = document.getElementById('locationVoiture');
  const errVoiture = document.getElementById('err-voiture');
  if (!voiture.value) {
    errVoiture.textContent = 'Sélectionnez une voiture.';
    voiture.classList.add('invalid');
    valid = false;
  } else {
    errVoiture.textContent = '';
    voiture.classList.remove('invalid');
  }

  // Dates
  const debut = document.getElementById('locationDebut');
  const fin = document.getElementById('locationFin');
  const errDebut = document.getElementById('err-debut');
  const errFin = document.getElementById('err-fin');

  if (!debut.value) {
    errDebut.textContent = 'La date de début est requise.';
    debut.classList.add('invalid');
    valid = false;
  } else {
    errDebut.textContent = '';
    debut.classList.remove('invalid');
  }

  if (!fin.value) {
    errFin.textContent = 'La date de fin est requise.';
    fin.classList.add('invalid');
    valid = false;
  } else if (debut.value && new Date(fin.value) <= new Date(debut.value)) {
    errFin.textContent = 'La date de fin doit être après la date de début.';
    fin.classList.add('invalid');
    valid = false;
  } else {
    errFin.textContent = '';
    fin.classList.remove('invalid');
  }

  return valid;
}

// Rendu tableau locations
function renderLocations() {
  const search = document.getElementById('searchLocation').value.toLowerCase();
  const { key, dir } = sortConfig.locations;

  let data = locations.filter(l => {
    const v = voitures.find(x => x.id === l.voitureId);
    const label = v ? `${v.marque} ${v.modele}` : '';
    return `${l.client} ${label}`.toLowerCase().includes(search);
  });

  if (key) {
    data.sort((a, b) => {
      let va = a[key], vb = b[key];
      if (typeof va === 'string') va = va.toLowerCase(), vb = vb.toLowerCase();
      return dir === 'asc' ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
    });
  }

  const tbody = document.getElementById('locationsBody');
  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-msg">Aucune location trouvée.</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(l => {
    const v = voitures.find(x => x.id === l.voitureId);
    const label = v ? `${v.marque} ${v.modele}` : '<em>Voiture supprimée</em>';
    return `
      <tr>
        <td><strong>${esc(l.client)}</strong></td>
        <td>${label}</td>
        <td>${formatDate(l.dateDebut)}</td>
        <td>${formatDate(l.dateFin)}</td>
        <td><strong>${l.montant.toLocaleString('fr-MA')} DH</strong></td>
        <td>
          <div class="action-btns">
            <button class="btn-icon" title="Modifier" onclick="editLocation('${l.id}')">✏️</button>
            <button class="btn-icon delete" title="Supprimer" onclick="deleteLocation('${l.id}')">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

document.getElementById('searchLocation').addEventListener('input', () => renderLocations());

// Tri colonnes locations
document.getElementById('locationsTable').querySelector('thead').addEventListener('click', e => {
  const th = e.target.closest('th[data-sort]');
  if (!th) return;
  const key = th.dataset.sort;
  if (sortConfig.locations.key === key) {
    sortConfig.locations.dir = sortConfig.locations.dir === 'asc' ? 'desc' : 'asc';
  } else {
    sortConfig.locations = { key, dir: 'asc' };
  }
  renderLocations();
});

// ─────────────────────────────────────────────
// CONFIRMATION SUPPRESSION
// ─────────────────────────────────────────────

document.getElementById('confirmOk').addEventListener('click', () => {
  if (pendingDelete) {
    pendingDelete();
    pendingDelete = null;
  }
  closeModal('modalConfirm');
});

// ─────────────────────────────────────────────
// UTILITAIRES
// ─────────────────────────────────────────────

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

function esc(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─────────────────────────────────────────────
// DONNÉES DE DÉMONSTRATION
// ─────────────────────────────────────────────

function loadDemoData() {
  if (voitures.length > 0) return; // Ne pas écraser les données existantes

  voitures = [
    { id: genId(), marque: 'Toyota', modele: 'Corolla', annee: 2022, prixJour: 300, etat: 'disponible' },
    { id: genId(), marque: 'Dacia', modele: 'Sandero', annee: 2021, prixJour: 200, etat: 'disponible' },
    { id: genId(), marque: 'Volkswagen', modele: 'Golf', annee: 2023, prixJour: 450, etat: 'louée' },
    { id: genId(), marque: 'Renault', modele: 'Clio', annee: 2020, prixJour: 250, etat: 'disponible' },
    { id: genId(), marque: 'Mercedes', modele: 'Classe C', annee: 2022, prixJour: 800, etat: 'louée' }
  ];

  const golf = voitures.find(v => v.modele === 'Golf');
  const merc = voitures.find(v => v.modele === 'Classe C');

  locations = [
    {
      id: genId(), client: 'Ahmed Benali', voitureId: golf.id,
      dateDebut: '2025-01-10', dateFin: '2025-01-17',
      montant: 7 * golf.prixJour
    },
    {
      id: genId(), client: 'Fatima Zahra El Idrissi', voitureId: merc.id,
      dateDebut: '2025-01-15', dateFin: '2025-01-22',
      montant: 7 * merc.prixJour
    },
    {
      id: genId(), client: 'Karim Mansouri', voitureId: golf.id,
      dateDebut: '2025-02-01', dateFin: '2025-02-05',
      montant: 4 * golf.prixJour
    }
  ];

  saveVoitures();
  saveLocations();
}

// ─────────────────────────────────────────────
// INITIALISATION
// ─────────────────────────────────────────────

loadDemoData();
renderDashboard();
renderVoitures();
renderLocations();