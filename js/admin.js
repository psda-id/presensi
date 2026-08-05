// ============ KONFIGURASI GLOBAL ============
const GITHUB_ASSETS = "https://raw.githubusercontent.com/tpopbwi/presensi-pusda/main/assets/";
const LOGO_INSTANSI = GITHUB_ASSETS + "logo.png";
const API = "https://script.google.com/macros/s/AKfycbxbQqM8rEC3Y60-T9bJlYcydL5y0XTc9yOml62z9YBrP833Pr0svT9b1d1M0MgADnIt/exec";
const placeholderImg = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 85'%3E%3Crect width='60' height='85' fill='%232e446e'/%3E%3Cpath d='M30 40c5.5 0 10-4.5 10-10s-4.5-10-10-10-10 4.5-10 10 4.5 10 10 10zm0 5c-8 0-20 4-20 12v5h40v-5c0-8-12-12-20-12z' fill='%23ffffff' opacity='.2'/%3E%3C/svg%3E";

let token = "", masterData = { pegawai: [], korlap: [], tools: [], config: {} }, base64Foto = null, logMode = 'edit', logsCache = [], currentGeoFences = [];
let currentDetailType = '', currentDetailId = '', currentView = 'list', debounceTimer, currentLogPage = 1;

const APP_CONFIG = { IMAGE_MAX_WIDTH: 800, IMAGE_QUALITY: 0.75, MAX_FILE_SIZE_MB: 3, CACHE_DURATION_MS: 5*60*1000, LOGS_PER_PAGE: 50 };

// ============ PWA MANIFEST (FIXED: Data URI) ============
try {
    const mf = { name:"E-PUSDA Admin Panel", short_name:"E-PUSDA Admin", start_url:"admin.html", scope:"./", display:"standalone", background_color:"#0d1b3e", theme_color:"#0d1b3e", icons:[{src:LOGO_INSTANSI,sizes:"192x192",type:"image/png"},{src:LOGO_INSTANSI,sizes:"512x512",type:"image/png",purpose:"any maskable"}] };
    const uri = 'data:application/manifest+json;base64,' + btoa(unescape(encodeURIComponent(JSON.stringify(mf))));
    const el = document.getElementById('pwaManifest');
    if (el) el.setAttribute('href', uri);
    else { const l = document.createElement('link'); l.rel='manifest'; l.href=uri; document.head.appendChild(l); }
} catch(e) { console.warn('Manifest init failed:', e); }

// ============ FETCH DENGAN TIMEOUT ============
function fetchWithTimeout(url, opts = {}, timeout = 15000) {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(new DOMException('Timeout ' + timeout + 'ms', 'AbortError')), timeout);
    return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(tid));
}

async function safeFetchJSON(url, opts = {}, timeout = 15000) {
    const res = await fetchWithTimeout(url, opts, timeout);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const txt = await res.text();
    if (!txt || !txt.trim()) throw new Error('Response kosong');
    if (txt.trim().startsWith('<!DOCTYPE') || txt.trim().startsWith('<html')) throw new Error('Server return HTML error');
    try { return JSON.parse(txt); } catch(e) { throw new Error('Parse JSON gagal: ' + e.message); }
}

// ============ UTILITIES ============
function parseGeoData(rawData) {
    if (!rawData) return [];
    if (Array.isArray(rawData)) return rawData;
    if (typeof rawData === 'string') {
        const t = rawData.trim();
        if (t === '[]' || t === 'null' || t === '') return [];
        try {
            const p = JSON.parse(t);
            if (Array.isArray(p)) return p.filter(i => i && 'lat' in i && 'lng' in i).map(i => ({ nama: i.nama || 'Lokasi', lat: parseFloat(i.lat) || 0, lng: parseFloat(i.lng) || 0, radius: parseInt(i.radius) || 100 }));
        } catch(e) { console.warn("⚠️ Parse Koordinat_Tugas gagal:", e.message); }
    }
    return [];
}

function sanitizeGeoData(list) {
    if (!Array.isArray(list)) return [];
    return list.map(p => { const r = p.Koordinat_Tugas || p.koordinat_tugas; const parsed = parseGeoData(r); p.Koordinat_Tugas = parsed.length > 0 ? JSON.stringify(parsed) : '[]'; return p; });
}

function getLocalDateStr(d) { if (!d) return ""; const dt = new Date(d); return dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0'); }
function sanitizeHTML(s) { if (s == null) return ""; const d = document.createElement('div'); d.textContent = String(s); return d.innerHTML; }
function debounce(fn, delay) { clearTimeout(debounceTimer); debounceTimer = setTimeout(fn, delay); }
const getQRUrl = (n, h) => `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent((n||'NAMA')+'_'+(h||'NOHP'))}`;

// ============ TOAST ============
function showToast(msg, type = "success") {
    const c = document.getElementById('toastContainer');
    const d = document.createElement('div');
    d.className = `toast ${type}`;
    const titles = { success: 'Berhasil', error: 'Gagal', warning: 'Perhatian' };
    const icons = { success: 'check-circle', error: 'alert-circle', warning: 'alert-triangle' };
    d.innerHTML = `<div class="toast-icon-wrap"><i data-lucide="${icons[type]}" size="24"></i></div><div class="toast-content"><div class="toast-title">${titles[type]}</div><div class="toast-message">${sanitizeHTML(msg)}</div></div><button class="toast-close" onclick="dismissToast(this.parentElement)"><i data-lucide="x" size="16"></i></button><div class="toast-progress"></div>`;
    c.appendChild(d);
    lucide.createIcons();
    setTimeout(() => { if (d.parentElement) dismissToast(d); }, 4000);
}
function dismissToast(t) { if (!t) return; t.style.animation = 'toastOut 0.4s forwards'; setTimeout(() => t.remove(), 400); }
document.addEventListener('keydown', e => { if (e.key === "Escape") document.querySelectorAll('.modal.show').forEach(m => closeModal(m.id)); });

// ============ INISIALISASI ============
window.onload = () => {
    lucide.createIcons();
    setInterval(() => { const el = document.getElementById('liveClock'); if(el) el.innerText = new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'}); }, 1000);
    document.getElementById('sidebarLogo').src = LOGO_INSTANSI;
    document.getElementById('loginBrandLogo').src = LOGO_INSTANSI;
    document.getElementById('logDateFilter').value = new Date().toISOString().split('T')[0];
    fetchInitial();
    updateFabVisibility();
};

async function fetchInitial() {
    try {
        const data = await safeFetchJSON(API + "?action=getDashboardData", { redirect:'follow', cache:'no-cache' }, 10000);
        if (data.status === 'error') throw new Error(data.message);
        masterData = { pegawai: data.pegawai || [], korlap: data.korlap || [], tools: data.tools || [], config: data.config || {} };
        if (masterData.config.Logo) { document.getElementById('sidebarLogo').src = masterData.config.Logo; document.getElementById('loginBrandLogo').src = masterData.config.Logo; }
        if (masterData.config.PlayStore_URL) document.getElementById('playStoreLink').href = masterData.config.PlayStore_URL;
    } catch(e) { console.warn('Fetch initial gagal:', e.message); showToast("Gagal Terhubung: " + e.message, "error"); }
}

// ============ AUTH & DASHBOARD ============
async function attemptLogin() {
    setLoading(true, "Otentikasi...");
    try {
        const d = await safeFetchJSON(API, { method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body:JSON.stringify({action:'loginAdmin',password:document.getElementById('adminPass').value}) }, 15000);
        if (d.status === 'success') { token = d.token; sessionStorage.setItem('adminToken', token); document.getElementById('loginOverlay').style.display = 'none'; document.getElementById('mainContent').style.display = 'flex'; await loadDashboard(); showToast("Login Berhasil", "success"); }
        else showToast("Sandi Salah", "error");
    } catch(e) { showToast("Gagal: " + e.message, "error"); } finally { setLoading(false); }
}

async function loadDashboard(forceRefresh = false) {
    const cached = sessionStorage.getItem('dashData'), cacheTime = sessionStorage.getItem('dashDataTime'), now = Date.now();
    if (!forceRefresh && cached && cacheTime && (now - parseInt(cacheTime) < APP_CONFIG.CACHE_DURATION_MS)) {
        masterData = JSON.parse(cached); renderPegawai(); renderKorlap(); renderTools(); renderConfig(); return;
    }
    setLoading(true, "Sinkronisasi Data...");
    try {
        const data = await safeFetchJSON(API + "?action=getDashboardData", { redirect:'follow', cache:'no-cache' }, 15000);
        masterData = { pegawai: sanitizeGeoData(data.pegawai || []), korlap: sanitizeGeoData(data.korlap || []), tools: data.tools || [], config: data.config || {} };
        const light = { pegawai: masterData.pegawai.map(p => ({id:p.id,nama:p.nama,wilayah:p.wilayah,status:p.status,jabatan:p.jabatan,nohp:p.nohp,Koordinat_Tugas:p.Koordinat_Tugas})), korlap: masterData.korlap, tools: masterData.tools, config: masterData.config };
        sessionStorage.setItem('dashData', JSON.stringify(light)); sessionStorage.setItem('dashDataTime', now.toString());
        renderPegawai(); renderKorlap(); renderTools(); renderConfig();
    } catch(e) { showToast("Gagal memuat data: " + e.message, "error"); } finally { setLoading(false); }
}

function switchTab(tab) {
    document.querySelectorAll('.admin-tab').forEach(t => t.style.display = 'none');
    document.getElementById('tab-' + tab).style.display = 'block';
    document.querySelectorAll('.nav-link,.b-nav-item').forEach(l => l.classList.remove('active'));
    document.querySelectorAll(`.nav-link[onclick*="'${tab}'"],.b-nav-item[onclick*="'${tab}']`).forEach(el => el.classList.add('active'));
    if (tab === 'logs') loadLogs();
    lucide.createIcons(); updateFabVisibility();
}

// ============ RENDERING ============
function updateQRRealtime() { const n = document.getElementById('p-nama').value.trim(), h = document.getElementById('p-nohp').value.trim(); if (n || h) { document.getElementById('p-qr-img').src = getQRUrl(n, h); document.getElementById('qr-display-container').style.display = 'block'; } }
function setView(view) {
    currentView = view;
    document.querySelectorAll('.view-toggle button').forEach(b => b.classList.remove('active'));
    if (view === 'list') { document.getElementById('btnListView').classList.add('active'); document.getElementById('btnListViewKorlap').classList.add('active'); document.querySelectorAll('.personel-table').forEach(t => t.classList.remove('hidden')); document.querySelectorAll('.desktop-card-grid').forEach(g => g.classList.remove('active')); }
    else { document.getElementById('btnCardView').classList.add('active'); document.getElementById('btnCardViewKorlap').classList.add('active'); document.querySelectorAll('.personel-table').forEach(t => t.classList.add('hidden')); document.querySelectorAll('.desktop-card-grid').forEach(g => g.classList.add('active')); }
}

function renderPegawai() { const q = document.getElementById('pegawaiSearch').value.toLowerCase(); const f = (masterData.pegawai||[]).filter(p => (p.nama||p.Nama||"").toLowerCase().includes(q) || (p.id||p.ID||"").toString().toLowerCase().includes(q) || (p.wilayah||p.Wilayah||"").toLowerCase().includes(q)); renderPersonelList(f, 'pegawaiBody', 'pegawaiGrid', 'pegawaiMobileGrid', 'pegawai'); }
function renderKorlap() { const q = document.getElementById('korlapSearch').value.toLowerCase(); const f = (masterData.korlap||[]).filter(p => (p.nama||p.Nama||"").toLowerCase().includes(q) || (p.wilayah||p.Wilayah||"").toLowerCase().includes(q)); renderPersonelList(f, 'korlapBody', 'korlapGrid', 'korlapMobileGrid', 'korlap'); }

function renderPersonelList(list, tableId, gridId, mobileGridId, type) {
    const tE = document.getElementById(tableId), gE = document.getElementById(gridId), mE = document.getElementById(mobileGridId);
    if (!list || list.length === 0) { tE.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:30px;opacity:.6">Tidak ada data.</td></tr>'; if(gE) gE.innerHTML = '<div class="empty-state" style="grid-column:1/-1;text-align:center;padding:40px 20px;opacity:.5"><i data-lucide="users" size="40"></i><p>Belum ada data</p></div>'; if(mE) mE.innerHTML = '<div class="empty-state"><i data-lucide="users" size="40"></i><p>Belum ada data</p></div>'; return; }
    tE.innerHTML = list.map(p => {
        const id = sanitizeHTML(p.id||p.ID), qr = p.urlQR||p.link_qr||getQRUrl(p.nama||p.Nama,p.nohp||p.NoHP), foto = p.urlFoto||p.link_foto_profile||p.Link_Foto_Profile||'', nama = sanitizeHTML(p.nama||p.Nama), jab = sanitizeHTML(p.jabatan||p.Jabatan), wil = sanitizeHTML(p.wilayah||p.Wilayah), st = p.status||p.Status||'Aktif', sc = st==='Aktif'?'badge-aktif':'badge-nonaktif', si = st==='Aktif'?'check-circle':'x-circle';
        let gc = 0; try { const r = p.Koordinat_Tugas||p.koordinat_tugas; if(r){const j=JSON.parse(r);if(Array.isArray(j))gc=j.length;} } catch(e){}
        return `<tr><td>${id}</td><td><img src="${qr}" class="qr-thumb-sm" onclick="window.open('${qr}')"></td><td><div class="foto-pegawai-sm"><img src="${foto}" onerror="this.src='${placeholderImg}'"></div></td><td style="font-weight:800;text-transform:uppercase">${nama}</td><td>${jab}</td><td>${wil}</td><td style="text-align:center">${gc>0?`<span class="geo-indicator"><i data-lucide="map-pin" size="12"></i> ${gc}</span>`:'-'}</td><td><span class="badge-status ${sc}"><i data-lucide="${si}" size="12"></i> ${sanitizeHTML(st)}</span></td><td><div class="action-cell"><button class="action-icon detail" onclick="showDetail('${type}','${id}')"><i data-lucide="eye" size="14"></i></button><button class="action-icon" onclick="editP('${type}','${id}')"><i data-lucide="edit-3" size="14"></i></button><button class="action-icon delete" onclick="deleteP('${type}','${id}')"><i data-lucide="trash-2" size="14"></i></button></div></td></tr>`;
    }).join('');
    const cardHTML = list.map(p => {
        const id = sanitizeHTML(p.id||p.ID), foto = p.urlFoto||p.link_foto_profile||p.Link_Foto_Profile||'', nama = sanitizeHTML(p.nama||p.Nama||'-'), jab = sanitizeHTML(p.jabatan||p.Jabatan||'-'), st = p.status||p.Status||'Aktif', sc = st==='Aktif'?'aktif':'nonaktif', si = st==='Aktif'?'check-circle':'x-circle', qr = p.urlQR||p.link_qr||getQRUrl(p.nama||p.Nama,p.nohp||p.NoHP);
        return `<div class="premium-card-container" onclick="showDetail('${type}','${id}')"><div class="premium-card-actions"><button onclick="event.stopPropagation();editP('${type}','${id}')"><i data-lucide="edit-3" size="12"></i></button><button class="delete" onclick="event.stopPropagation();deleteP('${type}','${id}')"><i data-lucide="trash-2" size="12"></i></button></div><div class="premium-card-qr" onclick="event.stopPropagation();window.open('${qr}')"><img src="${qr}" style="width:100%;height:100%;object-fit:contain"></div><img class="premium-card-bg" src="${foto}" onerror="this.src='${placeholderImg}'"><div class="premium-card-overlay"></div><div class="premium-card-watermark">PUSDA</div><div class="premium-card-info"><div class="premium-card-name">${nama}</div><div class="premium-card-job">${jab}</div><span class="premium-card-status ${sc}"><i data-lucide="${si}" size="10"></i> ${sanitizeHTML(st)}</span></div></div>`;
    }).join('');
    if(gE) gE.innerHTML = cardHTML; if(mE) mE.innerHTML = cardHTML; lucide.createIcons();
}

function showDetail(type, id) {
    currentDetailType = type; currentDetailId = id;
    const list = type === 'pegawai' ? masterData.pegawai : masterData.korlap;
    const p = (list||[]).find(x => String(x.id||x.ID) === String(id));
    if (!p) return;
    const foto = p.urlFoto||p.link_foto_profile||p.Link_Foto_Profile||placeholderImg, st = p.status||p.Status||'Aktif', sc = st==='Aktif'?'badge-aktif':'badge-nonaktif', si = st==='Aktif'?'check-circle':'x-circle';
    let gc = 0; try { const r = p.Koordinat_Tugas||p.koordinat_tugas; if(r){const j=JSON.parse(r);if(Array.isArray(j))gc=j.length;} } catch(e){}
    document.getElementById('detailImg').src = foto; document.getElementById('detailImg').onerror = function(){ this.src = placeholderImg; };
    document.getElementById('detailNama').innerText = sanitizeHTML(p.nama||p.Nama||'-');
    document.getElementById('detailJabatan').innerText = sanitizeHTML(p.jabatan||p.Jabatan||'-');
    document.getElementById('detailStatusBadge').innerHTML = `<span class="badge-status ${sc}"><i data-lucide="${si}" size="12"></i> ${sanitizeHTML(st)}</span>`;
    document.getElementById('detailID').innerText = sanitizeHTML(p.id||p.ID||'-');
    document.getElementById('detailWilayah').innerText = sanitizeHTML(p.wilayah||p.Wilayah||'-');
    document.getElementById('detailHP').innerText = sanitizeHTML(p.nohp||p.NoHP||'-');
    document.getElementById('detailLokasi').innerText = sanitizeHTML(p.lokasi_kerja||p.Lokasi_Kerja||'-');
    document.getElementById('detailGeo').innerHTML = gc > 0 ? `<span class="geo-indicator"><i data-lucide="map-pin" size="12"></i> ${gc} Titik</span>` : '<span style="opacity:.5">Tidak diatur</span>';
    document.getElementById('detailQR').src = getQRUrl(p.nama||p.Nama,p.nohp||p.NoHP);
    openModal('detailModal'); lucide.createIcons();
}

function editFromDetail() { closeModal('detailModal'); setTimeout(() => editP(currentDetailType, currentDetailId), 300); }
function deleteFromDetail() { if (!confirm("Hapus data ini?")) return; closeModal('detailModal'); setTimeout(() => deleteP(currentDetailType, currentDetailId), 300); }

// ============ LOGS ============
async function loadLogs() {
    setLoading(true, "Memuat Data Log...");
    document.getElementById('logsBody').innerHTML = Array(5).fill('<tr><td class="skeleton-cell"><div class="skeleton-line"></div></td><td class="skeleton-cell"><div class="skeleton-line"></div></td><td class="skeleton-cell"><div class="skeleton-line"></div></td><td class="skeleton-cell"><div class="skeleton-line"></div></td><td class="skeleton-cell"><div class="skeleton-line"></div></td><td class="skeleton-cell"><div class="skeleton-line"></div></td><td class="skeleton-cell"><div class="skeleton-line"></div></td><td class="skeleton-cell"><div class="skeleton-line"></div></td></tr>').join('');
    const selectedDate = document.getElementById('logDateFilter').value || new Date().toISOString().split('T')[0];
    currentLogPage = 1;
    try {
        const d = await safeFetchJSON(API + `?action=getPresensiByDate&date=${selectedDate}`, { redirect:'follow', cache:'no-cache' }, 15000);
        if (d.status === 'error') throw new Error(d.message);
        logsCache = d.data || [];
        renderLogsFiltered(true);
    } catch(e) { showToast("Gagal memuat Log: " + e.message, "error"); document.getElementById('logsBody').innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--danger);padding:50px">Gagal terhubung ke server.</td></tr>'; } finally { setLoading(false); }
}

function renderLogsFiltered(resetPage = false) {
    if (resetPage) currentLogPage = 1;
    const fD = document.getElementById('logDateFilter').value, q = document.getElementById('logSearch').value.toLowerCase();
    const all = logsCache.filter(l => { const t = l.timestamp||l.Timestamp; return t ? getLocalDateStr(t) === fD : false; });
    let s = { h:0, t:0, i:0, a:0 };
    all.forEach(l => { const st = (l.status||l.Status||'').toLowerCase(); if(st.includes('hadir')&&!st.includes('terlambat')) s.h++; else if(st.includes('terlambat')||st.includes('qr')) s.t++; else if(st.includes('izin')||st.includes('sakit')||st.includes('dinas')) s.i++; else s.a++; });
    document.getElementById('sumHadir').innerText = s.h; document.getElementById('sumTelat').innerText = s.t; document.getElementById('sumIzin').innerText = s.i; document.getElementById('sumAlpha').innerText = s.a;
    const f = all.filter(l => (l.nama||l.Nama||"").toLowerCase().includes(q)), tbody = document.getElementById('logsBody');
    if (f.length === 0) { tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;opacity:.3;padding:50px">Tidak Ada Aktivitas.<br><span style="font-size:0.8rem; margin-top:10px; display:inline-block;">Coba <a href="#" onclick="document.getElementById('logSearch').value=''; renderLogsFiltered(true);" style="color:var(--sda-toska)">reset pencarian</a>.</span></td></tr>`; lucide.createIcons(); return; }
    const endIndex = currentLogPage * APP_CONFIG.LOGS_PER_PAGE, paginatedData = f.slice(0, endIndex);
    tbody.innerHTML = paginatedData.map(l => {
        const ts = l.timestamp||l.Timestamp, id = l['ID Pegawai']||l.id_pegawai||l.id||l.ID, fs = l['Foto Selfie']||l.foto_selfie||l.Foto_Selfie||'-', fk = l['Foto Kerja']||l['Foto Lokasi']||l.foto_kerja||l.foto_lokasi||l.Foto_Kerja||'-', n = parseInt(l.nilai||l.Nilai)||0, sc = n>=50?'score-high':n>=25?'score-mid':'score-low', nama = sanitizeHTML(l.nama||l.Nama), status = sanitizeHTML(l.status||l.Status), wil = sanitizeHTML(l.wilayah||l.Wilayah);
        return `<tr><td>${new Date(ts).toLocaleTimeString('id-ID')}</td><td style="font-weight:800;text-transform:uppercase">${nama}</td><td>${status}</td><td style="text-align:center"><span class="score-badge ${sc}">${n}</span></td><td>${wil}</td><td style="text-align:center">${fs!=='-'?`<button class="action-icon" onclick="window.open('${fs}','_blank')"><i data-lucide="user" size="14"></i></button>`:'-'}</td><td style="text-align:center">${fk!=='-'?`<button class="action-icon" onclick="window.open('${fk}','_blank')"><i data-lucide="briefcase" size="14"></i></button>`:'-'}</td><td><div class="action-cell"><button class="action-icon" style="color:var(--warning)" onclick="openLogModal('edit','','${id}','${ts}','${status}','${n}')"><i data-lucide="edit-2" size="14"></i></button><button class="action-icon delete" onclick="deleteLog('${id}','${ts}')"><i data-lucide="trash-2" size="14"></i></button></div></td></tr>`;
    }).join('');
    if (endIndex < f.length) tbody.innerHTML += `<tr><td colspan="8" style="text-align:center; padding: 20px;"><button class="btn-premium" style="width: auto; margin: 0 auto; height: 40px; font-size: 0.8rem;" onclick="currentLogPage++; renderLogsFiltered(false);"><i data-lucide="chevron-down" size="16"></i> Muat Lebih Banyak (${f.length - endIndex} lagi)</button></td></tr>`;
    lucide.createIcons();
}

function exportLogsToCSV() {
    const fD = document.getElementById('logDateFilter').value, data = logsCache.filter(l => { const t = l.timestamp||l.Timestamp; return t ? getLocalDateStr(t) === fD : false; });
    if (data.length === 0) { showToast("Tidak ada data untuk diekspor", "warning"); return; }
    let csv = "Waktu,Nama,Status,Skor,Wilayah,Keterangan\n";
    data.forEach(l => { const ts = new Date(l.timestamp||l.Timestamp).toLocaleString('id-ID'), nama = (l.nama||l.Nama||"-").replace(/,/g,";"), status = (l.status||l.Status||"-").replace(/,/g,";"), nilai = l.nilai||l.Nilai||0, wilayah = (l.wilayah||l.Wilayah||"-").replace(/,/g,";"), ket = (l.keterangan||l.Keterangan||"-").replace(/,/g,";"); csv += `${ts},${nama},${status},${nilai},${wilayah},${ket}\n`; });
    const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' }), url = URL.createObjectURL(blob), link = document.createElement("a");
    link.setAttribute("href", url); link.setAttribute("download", `Log_Presensi_${fD}.csv`); link.style.visibility = 'hidden'; document.body.appendChild(link); link.click(); document.body.removeChild(link);
    showToast("Data berhasil diunduh", "success");
}

// ============ TOOLS & CONFIG ============
function renderTools() {
    const q = document.getElementById('toolSearch').value.toLowerCase(), toolsData = Array.isArray(masterData.tools) ? masterData.tools : [], f = toolsData.filter(t => { if(!t) return false; const n = String(t.Nama||t.nama||"").trim(); return n !== "" && n.toLowerCase().includes(q); });
    if (!f.length) document.getElementById('toolsBody').innerHTML = `<tr><td colspan="6" style="text-align:center;padding:50px 20px;"><i data-lucide="layout-grid" size="40" style="opacity:0.3;margin-bottom:10px"></i><p style="font-weight:700;margin-bottom:5px">Belum ada layanan digital</p><p style="font-size:0.8rem;opacity:0.6;margin-bottom:20px">Silakan tambahkan layanan baru.</p><button class="btn-premium" style="width:auto;height:40px;font-size:0.8rem;margin:0 auto" onclick="openToolModal()"><i data-lucide="plus" size="16"></i> TAMBAH LAYANAN</button></td></tr>`;
    else document.getElementById('toolsBody').innerHTML = f.map(t => {
        const nama = sanitizeHTML(t.Nama||t.nama||"-"), icon = sanitizeHTML(t.Icon||t.icon||"layers"), warna = sanitizeHTML(t.Warna||t.warna||"#3b82f6"), url = sanitizeHTML(t.Link_URL||t.link_url||t.URL||t.url||"-"), tp = sanitizeHTML(t.Type||t.type||"Folder"), safeNama = String(t.Nama||t.nama||"").replace(/'/g, "\\'");
        return `<tr><td><div style="width:32px;height:32px;background:${warna};display:flex;align-items:center;justify-content:center;border-radius:10px;box-shadow:0 4px 8px ${warna}40"><i data-lucide="${icon}" size="16" color="white"></i></div></td><td style="font-weight:800">${nama}</td><td><span style="font-size:.7rem;font-weight:800;color:${tp==='Direct'?'var(--success)':'var(--pu-blue)'}">${tp.toUpperCase()}</span></td><td><div style="width:15px;height:15px;border-radius:50%;background:${warna};box-shadow:0 0 8px ${warna}80"></div></td><td style="font-family:JetBrains Mono;font-size:.65rem;opacity:.4;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${url}</td><td><div class="action-cell"><button class="action-icon" onclick="editTool('${safeNama}')"><i data-lucide="edit-3" size="14"></i></button><button class="action-icon delete" onclick="deleteTool('${safeNama}')"><i data-lucide="trash-2" size="14"></i></button></div></td></tr>`;
    }).join('');
    lucide.createIcons();
}

function renderConfig() {
    const q = document.getElementById('configSearch').value.toLowerCase(), configData = masterData.config || {}, keys = Object.keys(configData).filter(k => k.toLowerCase().includes(q));
    if (!keys.length) { document.getElementById('configContainer').innerHTML = '<p style="opacity:.6;padding:20px;text-align:center">Tidak ada pengaturan.</p>'; return; }
    const g = { '🎨 Tampilan':[], '📍 Geo-Fencing':[], '🔗 Link':[], '⚙️ Umum':[] };
    keys.forEach(k => { const l = k.toLowerCase(); if(l.includes('logo')||l.includes('color')||l.includes('theme')||l.includes('warna')) g['🎨 Tampilan'].push(k); else if(l.includes('radius')||l.includes('jam')||l.includes('late')||l.includes('geo')) g['📍 Geo-Fencing'].push(k); else if(l.includes('url')||l.includes('link')||l.includes('playstore')||l.includes('api')) g['🔗 Link'].push(k); else g['⚙️ Umum'].push(k); });
    let h = '';
    for (const [n, ks] of Object.entries(g)) {
        if (!ks.length) continue;
        h += `<div style="margin-bottom:25px;background:rgba(0,0,0,.2);border-radius:20px;padding:20px;border:1px solid var(--glass-border)"><h3 style="font-size:.9rem;font-weight:800;color:var(--sda-toska);margin-bottom:20px;display:flex;align-items:center;gap:10px;padding-bottom:15px;border-bottom:1px solid var(--glass-border)">${n}<span style="background:rgba(45,212,191,.1);color:var(--sda-toska);padding:4px 10px;border-radius:15px;font-size:.65rem;margin-left:auto">${ks.length}</span></h3><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:15px">${ks.map(k => {
            const v = configData[k]; let inp = '';
            if(v==='true'||v==='false') inp = `<select id="c-${k}"><option value="true" ${v==='true'?'selected':''}>Aktif</option><option value="false" ${v==='false'?'selected':''}>Non-Aktif</option></select>`;
            else if(k.toLowerCase().includes('color')||k.toLowerCase().includes('warna')) inp = `<input type="color" value="${v}" id="c-${k}" style="height:48px;padding:5px">`;
            else if(String(v).length > 50) inp = `<textarea id="c-${k}" rows="2">${sanitizeHTML(v)}</textarea>`;
            else inp = `<input type="text" value="${sanitizeHTML(v)}" id="c-${k}">`;
            return `<div class="form-group" style="background:rgba(255,255,255,.02);padding:15px;border-radius:14px;border:1px solid rgba(255,255,255,.05)"><label><i data-lucide="settings-2" size="12" style="opacity:.5"></i> ${sanitizeHTML(k.replace(/_/g,' '))}</label>${inp}</div>`;
        }).join('')}</div></div>`;
    }
    document.getElementById('configContainer').innerHTML = h; lucide.createIcons();
}

// ============ GEO & MODALS ============
function renderGeoList() { const c = document.getElementById('geo-list'); if(!currentGeoFences.length){ c.innerHTML = '<p style="font-size:.7rem;opacity:.5;text-align:center;padding:10px">Belum ada lokasi</p>'; return; } c.innerHTML = currentGeoFences.map((p,i) => `<div class="geo-item"><div class="geo-item-info"><div class="geo-item-name">${sanitizeHTML(p.nama||'Lokasi '+(i+1))}</div><div class="geo-item-coords">Lat: ${p.lat}, Lng: ${p.lng} | ${p.radius}m</div></div><button class="btn-remove-geo" onclick="removeGeoPoint(${i})"><i data-lucide="trash-2" size="14"></i></button></div>`).join(''); lucide.createIcons(); }
function addGeoPoint() {
    if (!Array.isArray(currentGeoFences)) currentGeoFences = [];
    const n = document.getElementById('geo-nama').value.trim()||'Lokasi '+(currentGeoFences.length+1), la = parseFloat(document.getElementById('geo-lat').value), lo = parseFloat(document.getElementById('geo-lng').value), r = parseInt(document.getElementById('geo-radius').value)||100;
    if (isNaN(la)||isNaN(lo)) return showToast("Latitude dan Longitude harus angka!", "error");
    if (la < -90||la > 90) return showToast("Latitude tidak valid!", "error");
    if (lo < -180||lo > 180) return showToast("Longitude tidak valid!", "error");
    currentGeoFences.push({ nama:n, lat:la, lng:lo, radius:r }); renderGeoList();
    document.getElementById('geo-nama').value = ''; document.getElementById('geo-lat').value = ''; document.getElementById('geo-lng').value = ''; document.getElementById('geo-radius').value = '';
    showToast("Lokasi geo-fencing ditambahkan", "success");
}
function removeGeoPoint(i) { currentGeoFences.splice(i, 1); renderGeoList(); }
function fillCurrentLocation() {
    if (!navigator.geolocation) return showToast("GPS tidak didukung", "error");
    setLoading(true, "Mendeteksi GPS...");
    navigator.geolocation.getCurrentPosition(p => { document.getElementById('geo-lat').value = p.coords.latitude.toFixed(6); document.getElementById('geo-lng').value = p.coords.longitude.toFixed(6); if(!document.getElementById('geo-radius').value) document.getElementById('geo-radius').value = 100; if(!document.getElementById('geo-nama').value) document.getElementById('geo-nama').value = "Lokasi Saat Ini"; setLoading(false); }, e => { setLoading(false); showToast("Gagal: " + e.message, "error"); }, { enableHighAccuracy:true, timeout:10000 });
}

function openPModal(type) {
    document.getElementById('p-mode').value = type; document.getElementById('p-old-id').value = ''; document.getElementById('p-id').value = ''; document.getElementById('p-nama').value = ''; document.getElementById('p-jabatan').value = ''; document.getElementById('p-wilayah').value = ''; document.getElementById('p-nohp').value = ''; document.getElementById('p-lokasi').value = '';
    currentGeoFences = []; renderGeoList();
    document.getElementById('pModalTitle').innerText = type === 'pegawai' ? "Data Pegawai" : "Data Koordinator";
    document.getElementById('qr-display-container').style.display = 'none'; document.getElementById('p-preview-img').style.display = 'none'; document.getElementById('p-placeholder').style.display = 'flex';
    openModal('pModal');
}

function editP(type, id) {
    const list = type === 'pegawai' ? masterData.pegawai : masterData.korlap;
    const p = (list||[]).find(x => String(x.id||x.ID) === String(id));
    if (!p) return;
    document.getElementById('p-mode').value = type; document.getElementById('p-old-id').value = id; document.getElementById('p-id').value = id; document.getElementById('p-nama').value = p.nama||p.Nama; document.getElementById('p-jabatan').value = p.jabatan||p.Jabatan; document.getElementById('p-wilayah').value = p.wilayah||p.Wilayah; document.getElementById('p-nohp').value = p.nohp||p.NoHP||""; document.getElementById('p-lokasi').value = p.lokasi_kerja||p.Lokasi_Kerja||""; document.getElementById('p-status').value = p.status||p.Status||'Aktif';
    currentGeoFences = parseGeoData(p.Koordinat_Tugas||p.koordinat_tugas); renderGeoList();
    const img = p.urlFoto||p.link_foto_profile||p.Link_Foto_Profile;
    if (img) { document.getElementById('p-preview-img').src = img; document.getElementById('p-preview-img').style.display = 'block'; document.getElementById('p-placeholder').style.display = 'none'; }
    updateQRRealtime(); openModal('pModal');
}

async function savePAction() {
    const type = document.getElementById('p-mode').value, id = document.getElementById('p-id').value, nama = document.getElementById('p-nama').value;
    if (!id || !nama) return showToast("ID dan Nama Wajib!", "error");
    if (!Array.isArray(currentGeoFences)) currentGeoFences = [];
    const cLat = document.getElementById('geo-lat').value.trim(), cLng = document.getElementById('geo-lng').value.trim();
    if (cLat && cLng) addGeoPoint();
    const payload = { token, action: document.getElementById('p-old-id').value ? (type==='pegawai'?'editPegawai':'editKorlap') : (type==='pegawai'?'addPegawai':'addKorlap'), oldId: document.getElementById('p-old-id').value, id, nama, jabatan: document.getElementById('p-jabatan').value, wilayah: document.getElementById('p-wilayah').value, noHP: document.getElementById('p-nohp').value, lokasiKerja: document.getElementById('p-lokasi').value, status: document.getElementById('p-status').value, koordinatTugas: JSON.stringify(currentGeoFences), linkQR: getQRUrl(nama, document.getElementById('p-nohp').value), fotoProfile: base64Foto };
    setLoading(true, "Menyimpan...");
    try {
        const d = await safeFetchJSON(API, { method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body:JSON.stringify(payload) }, 20000);
        if (d.status === 'success') { closeModal('pModal'); await loadDashboard(true); showToast("Data berhasil disimpan", "success"); }
        else throw new Error(d.message || "Terjadi kesalahan pada server");
    } catch(e) { console.error("❌ Save Error:", e); showToast(e.message.includes('connect')?"Koneksi internet terputus":"Gagal: " + e.message, "error"); } finally { setLoading(false); }
}

async function deleteP(type, id) {
    if (!confirm("Hapus data ini?")) return;
    setLoading(true, "Menghapus...");
    try { await safeFetchJSON(API, { method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body:JSON.stringify({action:type==='pegawai'?'deletePegawai':'deleteKorlap',token,id}) }, 15000); await loadDashboard(true); showToast("Data dihapus", "success"); }
    catch(e) { showToast("Gagal: " + e.message, "error"); } finally { setLoading(false); }
}

// ============ TOOLS CRUD ============
function updateToolPreview() { const n = document.getElementById('t-nama').value||'Nama', i = document.getElementById('t-ikon').value||'layers', c = document.getElementById('t-warna').value; document.getElementById('previewName').innerText = n; document.getElementById('previewIconBox').style.background = c; document.getElementById('previewIconBox').style.boxShadow = '0 5px 15px '+c+'40'; document.getElementById('previewIconBox').innerHTML = `<i data-lucide="${i}" size="22" color="white"></i>`; lucide.createIcons(); }
function openToolModal() { document.getElementById('t-old-name').value = ''; document.getElementById('t-nama').value = ''; document.getElementById('t-ikon').value = 'layers'; document.getElementById('t-warna').value = '#3b82f6'; document.getElementById('t-type').value = 'Folder'; document.getElementById('t-url').value = ''; document.getElementById('t-desc').value = ''; openModal('toolModal'); updateToolPreview(); }
function editTool(name) { const t = (masterData.tools||[]).find(x => String(x.Nama||x.nama) === String(name)); if(!t) return; document.getElementById('t-old-name').value = name; document.getElementById('t-nama').value = t.Nama||t.nama||''; document.getElementById('t-ikon').value = t.Icon||t.icon||'layers'; document.getElementById('t-warna').value = t.Warna||t.warna||'#3b82f6'; document.getElementById('t-type').value = t.Type||t.type||'Folder'; document.getElementById('t-url').value = t.Link_URL||t.link_url||t.URL||t.url||''; document.getElementById('t-desc').value = t.Deskripsi||t.deskripsi||t.desc||''; openModal('toolModal'); updateToolPreview(); }

async function saveTool() {
    const p = { token, action:'saveTool', oldName:document.getElementById('t-old-name').value, nama:document.getElementById('t-nama').value, icon:document.getElementById('t-ikon').value, warna:document.getElementById('t-warna').value, url:document.getElementById('t-url').value, desc:document.getElementById('t-desc').value };
    setLoading(true, "Menyimpan...");
    try { await safeFetchJSON(API, { method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body:JSON.stringify(p) }, 15000); closeModal('toolModal'); await loadDashboard(true); showToast("Layanan disimpan", "success"); }
    catch(e) { showToast("Gagal: " + e.message, "error"); } finally { setLoading(false); }
}

async function deleteTool(name) {
    if (!confirm("Hapus layanan ini?")) return;
    setLoading(true, "Menghapus...");
    try { await safeFetchJSON(API, { method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body:JSON.stringify({action:'deleteTool',token,name}) }, 15000); await loadDashboard(true); showToast("Layanan dihapus", "success"); }
    catch(e) { showToast("Gagal: " + e.message, "error"); } finally { setLoading(false); }
}

// ============ LOGS CRUD ============
function openLogModal(mode, n, id, ts, st, ni) {
    logMode = mode; const d = document.getElementById('manualLogPegawai');
    d.innerHTML = [...(masterData.pegawai||[]), ...(masterData.korlap||[])].map(p => `<option value="${p.id||p.ID}">${sanitizeHTML(p.nama||p.Nama)}</option>`).join('');
    if (mode === 'add') document.getElementById('editLogTime').value = new Date().toISOString().slice(0,16);
    else { d.value = id; document.getElementById('editLogIdPeg').value = id; document.getElementById('editLogOriginalTs').value = ts; document.getElementById('editLogTime').value = new Date(ts).toISOString().slice(0,16); document.getElementById('editLogStatus').value = st; document.getElementById('editLogNilai').value = ni; }
    openModal('logEditModal');
}

async function saveLogAction() {
    let p = { token }; const id = document.getElementById('manualLogPegawai').value, pg = [...(masterData.pegawai||[]),...(masterData.korlap||[])].find(x => String(x.id||x.ID) === String(id));
    if (logMode === 'add') { p.action = 'addLog'; p.idPegawai = id; p.nama = pg?.nama||pg?.Nama; p.wilayah = pg?.wilayah||pg?.Wilayah; p.timestamp = document.getElementById('editLogTime').value; p.status = document.getElementById('editLogStatus').value; p.nilai = document.getElementById('editLogNilai').value; }
    else { p.action = 'editLog'; p.idPegawai = id; p.originalTimestamp = document.getElementById('editLogOriginalTs').value; p.newTimestamp = document.getElementById('editLogTime').value; p.status = document.getElementById('editLogStatus').value; p.nilai = document.getElementById('editLogNilai').value; }
    setLoading(true, "Menyimpan Log...");
    try { await safeFetchJSON(API, { method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body:JSON.stringify(p) }, 15000); closeModal('logEditModal'); await loadLogs(); showToast("Log disinkronisasi", "success"); }
    catch(e) { showToast("Gagal: " + e.message, "error"); } finally { setLoading(false); }
}

async function deleteLog(id, ts) {
    if (!confirm("Hapus log ini? File foto di Drive juga akan dihapus.")) return;
    setLoading(true, "Menghapus Log...");
    try { await safeFetchJSON(API, { method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body:JSON.stringify({action:'deleteLog',token,id,ts}) }, 15000); await loadLogs(); showToast("Log dihapus", "success"); }
    catch(e) { showToast("Gagal: " + e.message, "error"); } finally { setLoading(false); }
}

async function saveConfig() {
    const c = {}; Object.keys(masterData.config||{}).forEach(k => { const el = document.getElementById('c-'+k); if(el) c[k] = el.value; });
    setLoading(true, "Menyimpan Pengaturan...");
    try { await safeFetchJSON(API, { method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body:JSON.stringify({action:'updateConfig',token,config:c}) }, 15000); await loadDashboard(true); showToast("Pengaturan disimpan", "success"); }
    catch(e) { showToast("Gagal: " + e.message, "error"); } finally { setLoading(false); }
}

// ============ ✅ FILE HANDLING (FIXED: Support PNG/WebP Transparan) ============
function handleFile(input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    if (!file.type.startsWith('image/')) { showToast("Hanya file gambar yang diizinkan!", "error"); input.value = ''; return; }
    if (file.size > APP_CONFIG.MAX_FILE_SIZE_MB * 1024 * 1024) { showToast(`Ukuran file terlalu besar! Maksimal ${APP_CONFIG.MAX_FILE_SIZE_MB}MB.`, "error"); input.value = ''; return; }
    
    setLoading(true, "Mengompres Gambar...");
    const r = new FileReader();
    r.onload = e => {
        const img = new Image();
        img.onload = () => {
            const c = document.createElement('canvas');
            let w = img.width, h = img.height;
            if (w > APP_CONFIG.IMAGE_MAX_WIDTH) { h = h * (APP_CONFIG.IMAGE_MAX_WIDTH / w); w = APP_CONFIG.IMAGE_MAX_WIDTH; }
            c.width = w; c.height = h;
            const ctx = c.getContext('2d');
            
            // ✅ FIX TRANSPARANSI: Deteksi tipe file
            const isPng = file.type === 'image/png';
            const isWebp = file.type === 'image/webp';
            const hasTransparency = isPng || isWebp;
            
            if (hasTransparency) {
                // Untuk PNG/WebP: pertahankan transparansi
                // Clear canvas dengan transparent
                ctx.clearRect(0, 0, w, h);
                ctx.drawImage(img, 0, 0, w, h);
                // Export sebagai PNG untuk pertahankan alpha channel
                base64Foto = c.toDataURL('image/png');
            } else {
                // Untuk JPEG/other: isi background putih lalu draw
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, w, h);
                ctx.drawImage(img, 0, 0, w, h);
                // Export sebagai JPEG dengan quality tinggi
                base64Foto = c.toDataURL('image/jpeg', APP_CONFIG.IMAGE_QUALITY);
            }
            
            document.getElementById('p-preview-img').src = base64Foto;
            document.getElementById('p-preview-img').style.display = 'block';
            document.getElementById('p-placeholder').style.display = 'none';
            setLoading(false);
        };
        img.onerror = () => { setLoading(false); showToast("Gagal memuat gambar", "error"); };
        img.src = e.target.result;
    };
    r.onerror = () => { setLoading(false); showToast("Gagal membaca file", "error"); };
    r.readAsDataURL(file);
}

// ============ UI HELPERS ============
function handleFabClick() { const a = document.querySelector('.b-nav-item.active'); if(!a) return; const o = a.getAttribute('onclick')||''; if(o.includes("'pegawai'")) openPModal('pegawai'); else if(o.includes("'korlap'")) openPModal('korlap'); else if(o.includes("'tools'")) openToolModal(); else if(o.includes("'logs'")) openLogModal('add'); }
function updateFabVisibility() { const f = document.getElementById('fabAdd'); if(f) f.style.display = window.innerWidth <= 768 ? 'flex' : 'none'; }
window.addEventListener('resize', updateFabVisibility);

function openModal(id) { const m = document.getElementById(id); m.style.display = 'flex'; setTimeout(() => m.classList.add('show'), 10); }
function closeModal(id) { const m = document.getElementById(id); m.classList.remove('show'); setTimeout(() => m.style.display = 'none', 300); base64Foto = null; }
function setLoading(s, t) { const o = document.getElementById('sendingOverlay'); if(t) document.getElementById('overlayText').innerText = t; if(s) { o.style.display = 'flex'; setTimeout(() => o.classList.add('show'), 10); } else { o.classList.remove('show'); setTimeout(() => o.style.display = 'none', 300); } }
