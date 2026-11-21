/* ═══════════════════════════════════════════════════════
   Segnala Rogo — pagina unica: mappa dei roghi + modulo di segnalazione
   Derivato da SegnalaOra (CC BY 4.0) — OpenDataSicilia / G. B. Vitrano.
   Modificato: segnalazioni limitate ai roghi, mappa e form in una pagina.
   Tutti i valori configurabili sono in js/config.js (APP_CONFIG).
   ═══════════════════════════════════════════════════════ */

// ─────────────────────────────────────────────
//  STATO
// ─────────────────────────────────────────────
let map, marker;
let osmLayerLight, osmLayerDark, satelliteLayer;
let currentMapStyle = 'osm';          // 'osm' | 'satellite'
let allReports      = [];             // segnalazioni caricate dai CSV
let reportMarkers   = [];             // marker Leaflet delle segnalazioni
let _selectedDests  = (APP_CONFIG.destinatari || []).slice();   // sempre tutti: nessuna scelta
let _emailDebounce  = null;
let _ticketCopied   = false;
let _positionSet    = false;
let _popupJustClosed = false;
const _socialPlatforms = new Set();

const MAX_PHOTOS = APP_CONFIG.form.maxFoto;
const CATEGORIA_DEFAULT = 'Incendio / rogo doloso';

let reportData = {
  lat: APP_CONFIG.mappa.lat,
  lng: APP_CONFIG.mappa.lng,
  address: '',
  via: '',
  civico: '',
  cap: '',
  comune: '',
  provincia: '',
  regione: '',
  fontePosizione: 'Manuale',
  accuratezza: '',
  exifLat: null,
  exifLng: null,
  photos: [],     // [{ base64, dims, exifLat, exifLng }, ...]
  hasPhoto: false,
};

// ─────────────────────────────────────────────
//  UTILITA' (i dati dei CSV sono scritti da chiunque: mai in HTML senza escape)
// ─────────────────────────────────────────────
function esc(s) {
  return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function safeUrl(u) {
  u = String(u || '').trim();
  return /^https?:\/\//i.test(u) ? u : '';
}

function colorFor(key) {
  const m = APP_CONFIG.marker;
  return (key && Object.prototype.hasOwnProperty.call(m, key) && typeof m[key] === 'string')
    ? m[key] : m.default;
}

function isValidEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function siteBaseUrl() {
  const configured = APP_CONFIG.app.siteUrl;
  const url = configured || (location.origin + location.pathname.replace(/index\.html$/, ''));
  return url.replace(/\/?$/, '/');
}

// ─────────────────────────────────────────────
//  MAPPA (unica: roghi già segnalati + posizione del nuovo)
// ─────────────────────────────────────────────
function initMap() {
  const c = APP_CONFIG.mappa;
  map = L.map('map', { maxZoom: c.maxZoom }).setView([c.lat, c.lng], c.zoom);

  osmLayerLight = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19
  });
  // Tema scuro: stesse tessere OSM, scurite via CSS (nessuna chiave API necessaria)
  osmLayerDark = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
    className: 'tiles-dark'
  });
  satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
    maxZoom: 19
  });
  applyMapTheme();

  // Selettore Mappa / Satellite
  const LayerToggleControl = L.Control.extend({
    options: { position: 'topright' },
    onAdd() {
      const wrap   = L.DomUtil.create('div', 'map-layer-toggle leaflet-control');
      const btnRow = L.DomUtil.create('div', 'mlt-btns', wrap);
      const btnOsm = L.DomUtil.create('button', 'mlt-btn active', btnRow);
      btnOsm.type = 'button';
      btnOsm.innerHTML = '<i class="fa-solid fa-map"></i> Mappa';
      const btnSat = L.DomUtil.create('button', 'mlt-btn', btnRow);
      btnSat.type = 'button';
      btnSat.innerHTML = '<i class="fa-solid fa-satellite"></i> Satellite';
      L.DomEvent.disableClickPropagation(wrap);
      L.DomEvent.on(btnOsm, 'click', () => {
        currentMapStyle = 'osm';
        applyMapTheme();
        btnOsm.classList.add('active');
        btnSat.classList.remove('active');
      });
      L.DomEvent.on(btnSat, 'click', () => {
        currentMapStyle = 'satellite';
        applyMapTheme();
        btnSat.classList.add('active');
        btnOsm.classList.remove('active');
      });
      return wrap;
    }
  });
  new LayerToggleControl().addTo(map);

  // Pulsante "panoramica": inquadra tutte le segnalazioni
  const HomeControl = L.Control.extend({
    options: { position: 'topleft' },
    onAdd() {
      const wrap = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
      const btn  = L.DomUtil.create('button', 'map-home-btn', wrap);
      btn.type = 'button';
      btn.innerHTML = '<i class="fa-solid fa-house"></i>';
      btn.title = 'Panoramica — tutte le segnalazioni';
      L.DomEvent.disableClickPropagation(btn);
      L.DomEvent.on(btn, 'click', goHome);
      return wrap;
    }
  });
  new HomeControl().addTo(map);

  // Segnaposto della NUOVA segnalazione (trascinabile)
  marker = L.marker([reportData.lat, reportData.lng], {
    draggable: true,
    opacity: 0.35,
    zIndexOffset: 1000,
    title: 'Trascina per indicare il rogo'
  }).addTo(map);

  marker.on('dragend', e => {
    const p = e.target.getLatLng();
    setPosition(p.lat, p.lng, 'Manuale');
  });

  // Chiudere un popup toccando la mappa non deve spostare il segnaposto
  map.on('popupclose', () => {
    _popupJustClosed = true;
    setTimeout(() => { _popupJustClosed = false; }, 80);
  });
  map.on('click', e => {
    if (_popupJustClosed) return;
    setPosition(e.latlng.lat, e.latlng.lng, 'Manuale');
  });

  setTimeout(() => map.invalidateSize(), 300);
}

function applyMapTheme() {
  map.eachLayer(layer => {
    if (layer instanceof L.TileLayer) map.removeLayer(layer);
  });
  const isDark = document.documentElement.classList.contains('dark');
  if (currentMapStyle === 'satellite') satelliteLayer.addTo(map);
  else if (isDark) osmLayerDark.addTo(map);
  else osmLayerLight.addTo(map);
}

function goHome() {
  if (reportMarkers.length > 0) {
    map.fitBounds(L.featureGroup(reportMarkers).getBounds().pad(APP_CONFIG.mappa.fitBoundsPad), { animate: true, maxZoom: 14 });
  } else {
    map.setView([APP_CONFIG.mappa.lat, APP_CONFIG.mappa.lng], APP_CONFIG.mappa.zoom, { animate: true });
  }
}

// ─────────────────────────────────────────────
//  CARICAMENTO SEGNALAZIONI (CSV pubblicati da Google Sheets)
// ─────────────────────────────────────────────
async function fetchCsv(url) {
  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), APP_CONFIG.mappa.loadTimeout);
  try {
    const sep = url.indexOf('?') === -1 ? '?' : '&';
    const res = await fetch(url + sep + 't=' + Date.now(), { signal: controller.signal });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.text();
  } finally {
    clearTimeout(timeoutId);
  }
}

async function loadReports() {
  const sources = [
    { url: APP_CONFIG.sheetsCsvAperte,  risolta: false },
    { url: APP_CONFIG.sheetsCsvRisolte, risolta: true  },
  ].filter(s => s.url);

  if (sources.length === 0) {
    showDemoData();
    return;
  }

  const results = await Promise.allSettled(sources.map(async s => {
    const rows = parseCSV(await fetchCsv(s.url));
    return s.risolta ? rows.map(r => Object.assign({}, r, { Stato: 'Risolta' })) : rows;
  }));

  const ok = results.filter(r => r.status === 'fulfilled');
  if (ok.length === 0) {
    const aborted = results.some(r => r.reason && r.reason.name === 'AbortError');
    showLoadError(aborted
      ? '⏱ Caricamento troppo lento. Controlla la connessione o riprova.'
      : '❌ Impossibile caricare le segnalazioni. Controlla la connessione o riprova tra qualche minuto.');
    return;
  }

  allReports = ok.flatMap(r => r.value);
  renderMarkers();
  updateCount();
  document.getElementById('loadingOverlay').style.display = 'none';
}

function parseCSV(text) {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  const rows = splitCSVRows(normalized);
  if (rows.length < 2) return [];

  const headers = parseCSVLine(rows[0]);
  const reports = [];

  for (let i = 1; i < rows.length; i++) {
    if (!rows[i].trim()) continue;
    const vals = parseCSVLine(rows[i]);
    const obj  = {};
    headers.forEach((h, idx) => {
      obj[h.trim().replace(/^﻿/, '')] = (vals[idx] !== undefined ? vals[idx] : '').trim();
    });
    if (!obj.Lat || isNaN(parseFloat(obj.Lat))) continue;
    if (!obj.ID_Segnalazione) {
      obj.ID_Segnalazione = obj.Timestamp_UTC
        ? 'SGN-' + obj.Timestamp_UTC.replace(/\W/g, '')
        : 'row-' + i;
    }
    reports.push(obj);
  }
  return reports;
}

// Divide il testo CSV in righe logiche rispettando i campi tra virgolette su più righe
function splitCSVRows(text) {
  const rows = [];
  let rowStart = 0;
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') { i++; }
      else inQuotes = !inQuotes;
    } else if (ch === '\n' && !inQuotes) {
      rows.push(text.slice(rowStart, i));
      rowStart = i + 1;
    }
  }
  const last = text.slice(rowStart);
  if (last.trim()) rows.push(last);
  return rows;
}

function parseCSVLine(line) {
  const result = [];
  let current  = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// Dati di esempio, mostrati solo finché gli URL CSV in config.js sono vuoti
function showDemoData() {
  const c   = APP_CONFIG.mappa;
  const now = new Date();
  const mk  = (n, dLat, dLng, giorni, urg, stato, descr) => ({
    ID_Segnalazione: 'SGN-demo' + n,
    Data: new Date(now - giorni * 86400000).toLocaleDateString('it-IT'),
    Ora: '',
    Categoria: CATEGORIA_DEFAULT,
    Urgenza: urg,
    Stato: stato,
    Descrizione: descr,
    Indirizzo_Completo: 'Esempio — dato dimostrativo',
    Lat: String(c.lat + dLat),
    Long: String(c.lng + dLng),
  });
  allReports = [
    mk(1,  0.012,  0.010, 0, 'Alta',    'Nuova',   'Esempio: fuoco in un terreno incolto, fumo denso.'),
    mk(2, -0.010,  0.020, 2, 'Normale', 'Nuova',   'Esempio: sterpaglie in fiamme lungo la strada.'),
    mk(3,  0.004, -0.018, 6, 'Bassa',   'Risolta', 'Esempio: rogo spento, restano le tracce.'),
  ];

  const wrap = document.querySelector('.map-wrap');
  if (wrap) {
    const notice = document.createElement('div');
    notice.className = 'demo-notice';
    notice.textContent = 'Dati di esempio — imposta gli URL CSV in js/config.js';
    wrap.appendChild(notice);
  }

  document.getElementById('loadingOverlay').style.display = 'none';
  renderMarkers();
  updateCount();
}

function showLoadError(msg) {
  const ov = document.getElementById('loadingOverlay');
  ov.innerHTML = '';
  const p = document.createElement('p');
  p.style.cssText = 'color:#c0392b;text-align:center;padding:0 1rem;line-height:1.5;';
  p.textContent = msg;
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'btn-sm';
  b.textContent = '🔄 Riprova';
  b.onclick = () => {
    ov.innerHTML = '<div class="spinner"></div><p>Caricamento segnalazioni…</p>';
    loadReports();
  };
  ov.appendChild(p);
  ov.appendChild(b);
  const el = document.getElementById('mapCountText');
  if (el) el.textContent = 'Segnalazioni non disponibili';
}

// ─────────────────────────────────────────────
//  MARKER E POPUP DELLE SEGNALAZIONI
// ─────────────────────────────────────────────
function updateCount() {
  const el = document.getElementById('mapCountText');
  if (!el) return;
  const tot = allReports.length;
  const ris = allReports.filter(r => r.Stato === 'Risolta').length;
  const ape = tot - ris;
  el.textContent = tot === 0
    ? 'Nessun rogo segnalato finora'
    : `${tot} ${tot === 1 ? 'rogo segnalato' : 'roghi segnalati'} · ${ape} ${ape === 1 ? 'aperto' : 'aperti'} · ${ris} ${ris === 1 ? 'risolto' : 'risolti'}`;
}

function makeMarkerIcon(urgenza, stato) {
  if (stato === 'Risolta') {
    return L.divIcon({
      className: '',
      html: `<svg width="28" height="36" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg">
        <path d="M14 0C6.3 0 0 6.3 0 14c0 9.8 14 22 14 22S28 23.8 28 14C28 6.3 21.7 0 14 0z" fill="${colorFor('Risolta')}"/>
        <path d="M8 14l4 4 8-8" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      </svg>`,
      iconSize: [28, 36], iconAnchor: [14, 36], popupAnchor: [0, -36]
    });
  }
  return L.divIcon({
    className: '',
    html: `<svg width="28" height="36" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 0C6.3 0 0 6.3 0 14c0 9.8 14 22 14 22S28 23.8 28 14C28 6.3 21.7 0 14 0z" fill="${colorFor(urgenza)}"/>
      <circle cx="14" cy="14" r="6" fill="white" opacity="0.9"/>
    </svg>`,
    iconSize: [28, 36], iconAnchor: [14, 36], popupAnchor: [0, -36]
  });
}

function renderMarkers() {
  reportMarkers.forEach(m => map.removeLayer(m));
  reportMarkers = [];

  allReports.forEach(report => {
    const lat = parseFloat(report.Lat);
    const lng = parseFloat(report.Long);
    if (isNaN(lat) || isNaN(lng)) return;
    const m = L.marker([lat, lng], { icon: makeMarkerIcon(report.Urgenza, report.Stato) });
    m.bindPopup(makePopupHTML(report), { maxWidth: 300 });
    m.addTo(map);
    reportMarkers.push(m);
  });

  // Se la posizione dell'utente non è ancora nota, inquadra le segnalazioni esistenti
  if (reportMarkers.length > 0 && !_positionSet) {
    map.fitBounds(L.featureGroup(reportMarkers).getBounds().pad(APP_CONFIG.mappa.fitBoundsPad), { maxZoom: 14 });
  }
}

function makeStatoBadge(stato) {
  const s = stato || 'Nuova';
  const cls = s === 'Risolta' ? 'stato-risolta'
            : s === 'In lavorazione' ? 'stato-lavorazione'
            : s === 'Chiusa' ? 'stato-chiusa'
            : 'stato-nuova';
  return `<span class="stato-badge ${cls}">${esc(s)}</span>`;
}

function makePopupHTML(r) {
  const addrShort = (r.Via ? r.Via + (r.Numero_Civico ? ' ' + r.Numero_Civico : '') + ', ' : '') +
                    (r.Comune || r.Indirizzo_Completo || '');
  const addr = addrShort || r.Indirizzo_Completo || 'Posizione non specificata';
  const urgDot = r.Urgenza === 'Alta' ? '🔴' : r.Urgenza === 'Bassa' ? '🔵' : '🟠';

  let html = `<div class="popup-cat"><i class="fa-solid fa-fire"></i> ${esc(r.Categoria || CATEGORIA_DEFAULT)}</div>`;
  html += `<div class="popup-row"><span>📌</span><span>${esc(addr)}</span></div>`;
  html += `<div class="popup-row"><span>📅</span><span>${esc(r.Data)} ${esc(r.Ora)}</span></div>`;
  html += `<div class="popup-row">
    <span style="color:${colorFor(r.Urgenza)};font-weight:600">${urgDot} ${esc(r.Urgenza || 'Normale')}</span>
    <span style="margin-left:0.5rem">${makeStatoBadge(r.Stato)}</span>
  </div>`;
  if (r.Descrizione) {
    html += `<div class="popup-descr">${esc(r.Descrizione.substring(0, 120))}${r.Descrizione.length > 120 ? '...' : ''}</div>`;
  }
  const img = safeUrl((r.URL_Immagine || (r.URL_Immagini || '').split(',')[0] || ''));
  if (img) {
    html += `<img class="popup-img-thumb" src="${esc(img)}" data-full="${esc(img)}"
      loading="lazy" title="Clicca per ingrandire" alt="Foto della segnalazione"
      onclick="openLightbox(this.dataset.full)"
      onerror="this.style.display='none'">`;
  }
  return html;
}

// ─────────────────────────────────────────────
//  LIGHTBOX
// ─────────────────────────────────────────────
function openLightbox(url) {
  const u = safeUrl(url);
  if (!u) return;
  document.getElementById('lightboxImg').src = u;
  document.getElementById('lightbox').classList.add('open');
}
function closeLightbox() {
  document.getElementById('lightbox').classList.remove('open');
  document.getElementById('lightboxImg').src = '';
}

// ─────────────────────────────────────────────
//  FOTO + RESIZE + EXIF (multi-foto)
// ─────────────────────────────────────────────
function openCamera() {
  const input = document.getElementById('fileInput');
  input.removeAttribute('multiple');
  input.setAttribute('capture', 'environment');
  input.value = '';
  input.click();
}

function openGallery() {
  const input = document.getElementById('fileInput');
  input.setAttribute('multiple', '');
  input.removeAttribute('capture');
  input.value = '';
  input.click();
}

document.getElementById('fileInput').addEventListener('change', async function (e) {
  const files = Array.from(e.target.files);
  if (!files.length) return;

  const remaining = MAX_PHOTOS - reportData.photos.length;
  const toProcess = files.slice(0, remaining);

  for (const file of toProcess) {
    await processPhoto(file);
  }
  this.value = '';
  renderPhotoGrid();
});

async function processPhoto(file) {
  // 1. Coordinate GPS dai metadati EXIF
  let exifLat = null, exifLng = null;
  try {
    const gps = await exifr.gps(file);
    if (gps && gps.latitude && gps.longitude) {
      exifLat = gps.latitude;
      exifLng = gps.longitude;
    }
  } catch (err) {}

  // 2. Ridimensiona (lato lungo massimo da config)
  return new Promise(resolve => {
    const img    = new Image();
    const reader = new FileReader();
    reader.onload = ev => {
      img.onload = () => {
        const MAX = APP_CONFIG.form.maxRisoluzioneImg;
        let w = img.width, h = img.height;
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
          else       { w = Math.round(w * MAX / h); h = MAX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        const base64 = canvas.toDataURL('image/jpeg', APP_CONFIG.form.qualitaJpeg);

        reportData.photos.push({ base64, dims: `${w}x${h}`, exifLat, exifLng });
        reportData.hasPhoto = true;

        // Usa l'EXIF della prima foto che ha il GPS
        if (exifLat && !reportData.exifLat) {
          reportData.exifLat = exifLat;
          reportData.exifLng = exifLng;
          document.getElementById('btnExif').style.display = 'flex';
          if (map) useExifGps();
        }
        resolve();
      };
      img.onerror = () => resolve();   // file non leggibile come immagine: ignorato
      img.src = ev.target.result;
    };
    reader.onerror = () => resolve();
    reader.readAsDataURL(file);
  });
}

function renderPhotoGrid() {
  const grid = document.getElementById('photoGrid');
  const slot = document.getElementById('photoAddSlot');

  grid.querySelectorAll('.photo-thumb').forEach(el => el.remove());

  reportData.photos.forEach((p, i) => {
    const thumb = document.createElement('div');
    thumb.className = 'photo-thumb';
    thumb.innerHTML = `
      <img src="${p.base64}" alt="Foto ${i + 1}">
      <button class="photo-thumb-del" type="button" onclick="removePhoto(${i})" title="Rimuovi">
        <i class="fa-solid fa-xmark"></i>
      </button>
      <span class="photo-thumb-num">${i + 1}</span>`;
    grid.insertBefore(thumb, slot);
  });

  slot.style.display = reportData.photos.length < MAX_PHOTOS ? 'flex' : 'none';
  document.getElementById('photoCount').textContent = `${reportData.photos.length} / ${MAX_PHOTOS}`;

  const info = document.getElementById('photoInfo');
  if (reportData.photos.length > 0) {
    const sizes = reportData.photos.map(p => (p.base64.length * 0.75 / 1024).toFixed(0) + ' KB').join(' · ');
    info.textContent = `${reportData.photos.length} foto · ${sizes}`;
    info.classList.add('visible');
    clearFieldError('photoZone');
    document.getElementById('photoZone-error').classList.remove('visible');
  } else {
    info.textContent = '';
    info.classList.remove('visible');
    reportData.hasPhoto = false;
  }
}

function removePhoto(index) {
  reportData.photos.splice(index, 1);
  reportData.hasPhoto = reportData.photos.length > 0;
  reportData.exifLat = null;
  reportData.exifLng = null;
  for (const p of reportData.photos) {
    if (p.exifLat) { reportData.exifLat = p.exifLat; reportData.exifLng = p.exifLng; break; }
  }
  if (!reportData.exifLat) document.getElementById('btnExif').style.display = 'none';
  renderPhotoGrid();
}

// ─────────────────────────────────────────────
//  POSIZIONE: GPS / EXIF / click sulla mappa + geocoding inverso
// ─────────────────────────────────────────────
// recenter = true per GPS ed EXIF (la mappa si sposta sul punto);
// i click e i trascinamenti manuali non cambiano zoom e inquadratura.
function setPosition(lat, lng, fonte, accuratezza, recenter) {
  reportData.lat            = lat;
  reportData.lng            = lng;
  reportData.fontePosizione = fonte || 'Manuale';
  reportData.accuratezza    = accuratezza || '';
  _positionSet = true;
  if (map) {
    if (recenter) map.setView([lat, lng], 17);
    marker.setLatLng([lat, lng]);
    marker.setOpacity(1);
  }
  const geoText = document.getElementById('geoText');
  if (geoText && fonte === 'Manuale') geoText.textContent = '✓ Posizione indicata sulla mappa';
  reverseGeocode(lat, lng);
}

function getGPS() {
  const geoText = document.getElementById('geoText');
  if (geoText) geoText.textContent = 'Rilevamento GPS in corso…';
  if (!navigator.geolocation) {
    if (geoText) geoText.textContent = 'GPS non disponibile — tocca la mappa per posizionare il segnaposto';
    return;
  }
  navigator.geolocation.getCurrentPosition(pos => {
    const { latitude: lat, longitude: lng, accuracy } = pos.coords;
    setPosition(lat, lng, 'GPS', Math.round(accuracy), true);
    if (geoText) geoText.textContent = `✓ Posizione GPS rilevata (±${Math.round(accuracy)} m)`;
  }, () => {
    if (geoText) geoText.textContent = '⚠ GPS non disponibile — tocca la mappa per posizionare il segnaposto';
  }, { enableHighAccuracy: true, timeout: 10000 });
}

function useExifGps() {
  if (!reportData.exifLat) return;
  setPosition(reportData.exifLat, reportData.exifLng, 'EXIF', '', true);
  const geoText = document.getElementById('geoText');
  if (geoText) geoText.textContent = '✓ Coordinate estratte dai metadati EXIF della foto';
  const banner = document.getElementById('exifBanner');
  if (banner) banner.style.display = 'block';
}

function dismissExifBanner() {
  const banner = document.getElementById('exifBanner');
  if (banner) banner.style.display = 'none';
  getGPS();
}

function reverseGeocode(lat, lng) {
  fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&accept-language=it`)
    .then(r => r.json())
    .then(data => {
      const a = data.address || {};
      reportData.via       = a.road || a.pedestrian || a.footway || '';
      reportData.civico    = a.house_number || '';
      reportData.cap       = a.postcode || '';
      reportData.comune    = a.city || a.town || a.village || a.municipality || '';
      reportData.provincia = a.county || a.state_district || '';
      reportData.regione   = a.state || '';
      reportData.address   = data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      const addrInput = document.getElementById('addressInput');
      if (addrInput) addrInput.value = reportData.address;
    })
    .catch(() => {
      reportData.address = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      const addrInput = document.getElementById('addressInput');
      if (addrInput) addrInput.value = reportData.address;
    });
}

// ─────────────────────────────────────────────
//  VALIDAZIONE INLINE
// ─────────────────────────────────────────────
function showFieldError(fieldId, msg) {
  const el  = document.getElementById(fieldId);
  const err = document.getElementById(fieldId + '-error');
  if (el)  el.classList.add('invalid');
  if (err) { if (msg) err.textContent = msg; err.classList.add('visible'); }
}

function clearFieldError(fieldId) {
  const el  = document.getElementById(fieldId);
  const err = document.getElementById(fieldId + '-error');
  if (el)  el.classList.remove('invalid');
  if (err) err.classList.remove('visible');
}

function onEmailInput() {
  clearFieldError('email');
  clearTimeout(_emailDebounce);
  _emailDebounce = setTimeout(validateEmailField, 650);
}

function validateEmailField() {
  const el    = document.getElementById('email');
  const errEl = document.getElementById('email-error');
  const val   = el.value.trim();
  if (!val) {
    el.classList.remove('invalid', 'valid');
    errEl.classList.remove('visible', 'ok');
    return;
  }
  if (isValidEmail(val)) {
    el.classList.remove('invalid'); el.classList.add('valid');
    errEl.textContent = '✓ Email valida';
    errEl.classList.remove('visible'); errEl.classList.add('ok');
  } else {
    el.classList.add('invalid'); el.classList.remove('valid');
    errEl.textContent = 'Inserisci un indirizzo email valido (es: nome@dominio.it).';
    errEl.classList.add('visible'); errEl.classList.remove('ok');
  }
}

function setSendError(msg) {
  const el = document.getElementById('send-error');
  if (!el) return;
  el.textContent = msg || '';
  el.classList.toggle('visible', !!msg);
}

function resetSendBtn() {
  const btn = document.getElementById('sendBtn');
  btn.disabled = false;
  btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Invia Segnalazione';
}

// ─────────────────────────────────────────────
//  INVIO
// ─────────────────────────────────────────────
async function sendReport() {
  const btn = document.getElementById('sendBtn');
  setSendError('');

  if (!APP_CONFIG.appsScriptUrl) {
    setSendError('Invio non ancora attivo: chi gestisce il sito deve impostare appsScriptUrl in js/config.js.');
    return;
  }

  btn.disabled = true;
  btn.textContent = '⏳ Controllo in corso…';

  // ── Validazioni ──
  let hasError = false;
  const descr = document.getElementById('descr').value.trim();

  if (!reportData.hasPhoto) {
    document.getElementById('photoZone-error').classList.add('visible');
    document.getElementById('photoAddSlot').scrollIntoView({ behavior: 'smooth', block: 'center' });
    hasError = true;
  }

  if (!descr) {
    showFieldError('descr', 'Inserisci una breve descrizione del rogo.');
    hasError = true;
  }

  const nome = document.getElementById('nome').value.trim();
  if (!nome) {
    showFieldError('nome', 'Inserisci il tuo nome o nickname.');
    hasError = true;
  }

  const emailSegnalante = document.getElementById('email').value.trim();
  if (!emailSegnalante || !isValidEmail(emailSegnalante)) {
    showFieldError('email', emailSegnalante
      ? 'Indirizzo email non valido (es: nome@dominio.it).'
      : "L'email è obbligatoria per ricevere la conferma di invio.");
    hasError = true;
  }

  const consent = document.getElementById('privacyConsent');
  if (!consent.checked) {
    document.getElementById('consent-error').classList.add('visible');
    hasError = true;
  } else {
    document.getElementById('consent-error').classList.remove('visible');
  }

  if (hasError) { resetSendBtn(); return; }

  // Posizione non confermata → avvisa e porta alla mappa
  if (!_positionSet) {
    const geoStatus = document.getElementById('geoStatus');
    geoStatus.classList.add('geo-warn');
    setTimeout(() => geoStatus.classList.remove('geo-warn'), 3000);
    geoStatus.scrollIntoView({ behavior: 'smooth', block: 'center' });
    document.getElementById('geoText').textContent = '⚠ Indica la posizione del rogo: tocca la mappa o usa il GPS';
    resetSendBtn();
    return;
  }

  btn.textContent = '⏳ Invio in corso…';

  const now      = new Date();
  const ticketId = 'SGN-' + now.getTime();
  const token = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : 'xxxx-xxxx-xxxx-xxxx'.replace(/x/g, () => (Math.random() * 16 | 0).toString(16));

  // Destinatari: sono quelli fissi di config.js (nessuna scelta dell'utente)
  const toEmails = _selectedDests.filter(d => d.email).map(d => d.email);
  const destNome = _selectedDests.map(d => d.nome).join(', ');
  const cat      = _selectedDests.length > 0
    ? _selectedDests.map(d => d.categoria || d.nome).join(', ')
    : CATEGORIA_DEFAULT;
  const catEmoji = _selectedDests.length > 0 ? _selectedDests[0].icon : 'fa-solid fa-fire';

  const urgenza  = document.getElementById('urgenza').value;
  const addr     = document.getElementById('addressInput').value || reportData.address;
  const urgLabel = urgenza === 'Alta' ? '🔴 URGENTE — ' : urgenza === 'Bassa' ? '🟢 ' : '🟡 ';

  const siteBase  = siteBaseUrl();
  const photoUrls = reportData.photos.map((_, i) => siteBase + 'img/' + ticketId + '/foto_' + (i + 1) + '.jpg');

  // Testo archiviato nel foglio: niente email del segnalante né link di risoluzione
  const testoMessaggio = [
    `🔥 Segnalazione rogo — ${urgLabel}${cat}`,
    `📌 Luogo: ${addr}`,
    `📝 Descrizione: ${descr}`,
    destNome ? `🏛️ Destinatari: ${destNome}` : '',
    `🕐 ${now.toLocaleString('it-IT')}`,
    photoUrls.length > 0 ? `📷 Foto: ${photoUrls.join(', ')}` : '',
    `${APP_CONFIG.app.hashtag}`,
    ticketId,
  ].filter(Boolean).join('\n');

  // Social: i link vengono mostrati nella schermata di conferma (un clic per piattaforma, nessun popup bloccato)
  const channelsBadges = [];
  const shareLinks = [];
  if (toEmails.length > 0) {
    _selectedDests.filter(d => d.email).forEach(d => { channelsBadges.push('🏛️ ' + d.nome); });
  }
  if (_socialPlatforms.size > 0) {
    const maxC = APP_CONFIG.social.maxTestoChars;
    const socialBase = [
      `🔥 ${urgLabel}${cat}`,
      `📍 ${addr}`,
      descr ? `📝 ${descr.length > maxC ? descr.slice(0, maxC - 3) + '…' : descr}` : '',
      APP_CONFIG.app.hashtag,
    ].filter(Boolean).join('\n');

    const pageUrl    = siteBase;
    const pageUrlEnc = encodeURIComponent(pageUrl);
    const txtWithUrl = encodeURIComponent(socialBase + '\n👉 ' + pageUrl);
    const txtNoUrl   = encodeURIComponent(socialBase);
    const urls = {
      twitter:  `https://twitter.com/intent/tweet?text=${txtWithUrl}`,
      whatsapp: `https://wa.me/?text=${txtWithUrl}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${pageUrlEnc}&quote=${txtNoUrl}`,
      telegram: `https://t.me/share/url?url=${pageUrlEnc}&text=${txtNoUrl}`,
      bluesky:  `https://bsky.app/intent/compose?text=${txtWithUrl}`,
    };
    const names = { twitter: 'X/Twitter', whatsapp: 'WhatsApp', facebook: 'Facebook', telegram: 'Telegram', bluesky: 'Bluesky' };
    for (const p of _socialPlatforms) {
      shareLinks.push({ name: names[p], url: urls[p] });
    }
  }

  // ── Invio dei dati ad Apps Script ──
  const payload = {
    ID_Segnalazione:     ticketId,
    Timestamp_UTC:       now.toISOString(),
    Data:                now.toLocaleDateString('it-IT'),
    Ora:                 now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
    Categoria:           cat,
    Categoria_Emoji:     catEmoji,
    Urgenza:             urgenza,
    Descrizione:         descr,
    Nome_Segnalante:     nome,
    Email_Segnalante:    emailSegnalante,
    Lat:                 reportData.lat.toFixed(6),
    Long:                reportData.lng.toFixed(6),
    Indirizzo_Completo:  addr,
    Via:                 reportData.via,
    Numero_Civico:       reportData.civico,
    CAP:                 reportData.cap,
    Comune:              reportData.comune,
    Provincia:           reportData.provincia,
    Regione:             reportData.regione,
    Fonte_Posizione:     reportData.fontePosizione,
    Accuratezza_GPS_m:   String(reportData.accuratezza),
    Area_Destinataria:   destNome,
    CC_Destinatari:      toEmails.slice(1).join(', '),
    Destinatari:         destNome,
    Canale_Email:        toEmails.length > 0 ? 'Sì' : 'No',
    Canale_WhatsApp:     _socialPlatforms.has('whatsapp') ? 'Sì' : 'No',
    Canale_Twitter:      _socialPlatforms.has('twitter')  ? 'Sì' : 'No',
    Canale_Facebook:     _socialPlatforms.has('facebook') ? 'Sì' : 'No',
    Ha_Immagine:         reportData.photos.length > 0 ? 'Sì' : 'No',
    Num_Foto:            String(reportData.photos.length),
    Dimensioni_Immagine: reportData.photos.map(p => p.dims).join(', '),
    Testo_Messaggio:     testoMessaggio,
    URL_Segnalazione:    siteBase,
    URL_Immagine:        photoUrls[0] || '',
    URL_Immagini:        photoUrls.join(', '),
    Email_Destinatario:  toEmails[0] || '',
    Stato:               'Nuova',
    Token_Risoluzione:   token,
    _hp:                 document.getElementById('hp_website')?.value || '',
  };
  reportData.photos.forEach((p, i) => { payload['imageBase64_' + (i + 1)] = p.base64; });

  try {
    await fetch(APP_CONFIG.appsScriptUrl, {
      method: 'POST', mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    // Errore di rete: la segnalazione non è partita. Non mostriamo il successo.
    setSendError('❌ Invio non riuscito: controlla la connessione e riprova.');
    resetSendBtn();
    return;
  }

  // ── Schermata di successo ──
  _ticketCopied = false;
  document.getElementById('ticketId').textContent     = ticketId;
  document.getElementById('resolveToken').textContent = token;
  document.getElementById('copyReminder').classList.remove('visible');
  document.getElementById('successDetail').textContent = toEmails.length > 0
    ? "Segnalazione registrata nell'archivio. I destinatari sono stati contattati."
    : "Segnalazione registrata nell'archivio.";

  const badgesEl = document.getElementById('channelsSent');
  badgesEl.innerHTML = channelsBadges.map(b => `<span class="channel-badge">✓ ${esc(b)}</span>`).join('');

  const shareEl = document.getElementById('shareLinks');
  if (shareEl) {
    shareEl.innerHTML = shareLinks.length
      ? '<p class="share-title">Condividi ora (si apre il social con il testo già pronto):</p>' +
        shareLinks.map(l => `<a class="share-btn" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.name)}</a>`).join('')
      : '';
  }

  document.getElementById('successOverlay').classList.add('open');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─────────────────────────────────────────────
//  SCHERMATA DI SUCCESSO
// ─────────────────────────────────────────────
function resetAll() { location.reload(); }

function closeSuccess() {
  if (!_ticketCopied) {
    document.getElementById('copyReminder').classList.add('visible');
    return;
  }
  location.reload();
}

function forceClose() { location.reload(); }

function copyTicketId() {
  const id = document.getElementById('ticketId').textContent;
  navigator.clipboard.writeText(id).then(() => {
    _ticketCopied = true;
    document.getElementById('copyReminder').classList.remove('visible');
    const btn = document.getElementById('copyIdBtn');
    btn.textContent = '✓ Copiato';
    setTimeout(() => { btn.textContent = '📋 Copia'; }, 1800);
  });
}

function copyToken() {
  const token = document.getElementById('resolveToken').textContent;
  navigator.clipboard.writeText(token).then(() => {
    const btn = document.getElementById('copyTokenBtn');
    btn.textContent = '✓ Copiato';
    setTimeout(() => { btn.textContent = '📋 Copia'; }, 1800);
  });
}

// ─────────────────────────────────────────────
//  CONDIVISIONE SOCIAL
// ─────────────────────────────────────────────
function toggleSocial(platform) {
  if (_socialPlatforms.has(platform)) _socialPlatforms.delete(platform);
  else _socialPlatforms.add(platform);
  document.querySelectorAll('.social-chip').forEach(btn =>
    btn.classList.toggle('active', _socialPlatforms.has(btn.dataset.platform))
  );
  const hint = document.getElementById('socialHint');
  if (hint) hint.style.display = _socialPlatforms.size > 0 ? 'block' : 'none';
}

function initSocialChips() {
  const allowed = APP_CONFIG.social.piattaforme || [];
  const chips = document.querySelectorAll('.social-chip');
  chips.forEach(btn => {
    if (!allowed.includes(btn.dataset.platform)) btn.style.display = 'none';
  });
  if (allowed.length === 0) {
    const section = document.getElementById('socialChips').closest('.form-section');
    if (section) section.style.display = 'none';
  }
}

// ─────────────────────────────────────────────
//  RISOLUZIONE (apre con ?risolvi=TOKEN nell'URL)
// ─────────────────────────────────────────────
function openResolve(token) {
  const input = document.getElementById('resolveIdDisplay');
  input.value = token || '';
  const res = document.getElementById('resolveResult');
  res.className   = 'resolve-result';
  res.textContent = '';
  const btn = document.getElementById('resolveConfirmBtn');
  btn.disabled = false;
  btn.innerHTML = '<i class="fa-solid fa-circle-check"></i> Conferma risoluzione';
  document.getElementById('resolveOverlay').classList.add('open');
  if (!token) setTimeout(() => input.focus(), 80);
}

function closeResolve() {
  document.getElementById('resolveOverlay').classList.remove('open');
  history.replaceState({}, '', location.pathname);
}

function confirmResolve() {
  const token = document.getElementById('resolveIdDisplay').value.trim();
  const res   = document.getElementById('resolveResult');
  const btn   = document.getElementById('resolveConfirmBtn');

  if (!token) {
    res.className   = 'resolve-result err';
    res.textContent = '⚠️ Inserisci il codice di risoluzione.';
    document.getElementById('resolveIdDisplay').focus();
    return;
  }
  if (!APP_CONFIG.appsScriptUrl) {
    res.className   = 'resolve-result err';
    res.textContent = '⚠️ Servizio non configurato (appsScriptUrl vuoto in js/config.js).';
    return;
  }

  btn.disabled    = true;
  btn.textContent = 'Invio in corso…';
  res.className   = 'resolve-result';
  res.textContent = '';

  fetch(APP_CONFIG.appsScriptUrl, {
    method: 'POST',
    mode:   'no-cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'risolvi', token })
  })
  .then(() => {
    res.className   = 'resolve-result ok';
    res.textContent = '✅ Richiesta inviata. La mappa si aggiornerà a breve…';
    btn.textContent = 'Inviato ✓';
    setTimeout(() => {
      loadReports();
      res.textContent = '✅ Mappa aggiornata. Se il codice era corretto, il rogo risulta ora risolto.';
    }, 4000);
  })
  .catch(() => {
    res.className   = 'resolve-result err';
    res.textContent = '❌ Errore di rete. Riprova tra qualche istante.';
    btn.disabled    = false;
    btn.innerHTML   = '<i class="fa-solid fa-circle-check"></i> Conferma risoluzione';
  });
}

// ─────────────────────────────────────────────
//  EVENTI GLOBALI
// ─────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeResolve(); closeLightbox(); }
});

document.addEventListener('themechange', () => { if (map) applyMapTheme(); });

// ─────────────────────────────────────────────
//  AVVIO
// ─────────────────────────────────────────────
initSocialChips();
initMap();
loadReports();
getGPS();

const _resolveToken = new URLSearchParams(location.search).get('risolvi');
if (_resolveToken) openResolve(_resolveToken);
