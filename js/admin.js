// ============================================================
// ADMIN.JS - v2.3.0 (Syntax Fixed - Complete File)
// ============================================================

// ============ KONFIGURASI GLOBAL ============
const GITHUB_ASSETS = "https://raw.githubusercontent.com/tpopbwi/presensi-pusda/main/assets/";
const LOGO_INSTANSI = GITHUB_ASSETS + "logo.png";
const API = "https://script.google.com/macros/s/AKfycbxbQqM8rEC3Y60-T9bJlYcydL5y0XTc9yOml62z9YBrP833Pr0svT9b1d1M0MgADnIt/exec";
const placeholderImg = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 85'%3E%3Crect width='60' height='85' fill='%232e446e'/%3E%3Cpath d='M30 40c5.5 0 10-4.5 10-10s-4.5-10-10-10-10 4.5-10 10 4.5 10 10 10zm0 5c-8 0-20 4-20 12v5h40v-5c0-8-12-12-20-12z' fill='%23ffffff' opacity='.2'/%3E%3C/svg%3E";

let token = "", masterData = { pegawai: [], korlap: [], tools: [], config: {} };
let base64Foto = null, logMode = 'edit', logsCache = [], currentGeoFences = [];
let currentDetailType = '', currentDetailId = '', currentView = 'list';
let debounceTimer, currentLogPage = 1;

const APP_CONFIG = {
    IMAGE_MAX_WIDTH: 800, IMAGE_QUALITY: 0.75, MAX_FILE_SIZE_MB: 3,
    CACHE_DURATION_MS: 5 * 60 * 1000, LOGS_PER_PAGE: 50,
    FETCH_TIMEOUT: 15000, RETRY_DELAY: 1000
};

// ============ ✅ PWA MANIFEST (LENGKAP - No Syntax Error) ============
(function initManifest() {
    try {
        const pageUrl = location.origin + location.pathname;
        const scopeUrl = pageUrl.replace(/[^/]*$/, '');
        const mf = {
            name: "E-PUSDA Admin Panel", short_name: "E-PUSDA Admin",
            start_url: pageUrl,
            scope: scopeUrl,
            display: "standalone",
            background_color: "#0d1b3e", theme_color: "#0d1b3e",
            icons: [
                { src: LOGO_INSTANSI, sizes: "192x192", type: "image/png" },
                { src: LOGO_INSTANSI, sizes: "512x512", type: "image/png", purpose: "any maskable" }
            ]
        };
        const blob = new Blob([JSON.stringify(mf)], { type: 'application/manifest+json' });
        const uri = URL.createObjectURL(blob);
        const el = document.getElementById('pwaManifest');
        if (el) el.setAttribute('href', uri);
        else {
            const l = document.createElement('link');
            l.rel = 'manifest';
            l.href = uri;
            document.head.appendChild(l);
        }
    } catch (e) { console.warn('Manifest init failed:', e); }
})();

// ============ FETCH DENGAN TIMEOUT & RETRY ============
function fetchWithTimeout(url, opts = {}, timeout = APP_CONFIG.FETCH_TIMEOUT) {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(new DOMException('Timeout ' + timeout + 'ms', 'AbortError')), timeout);
    return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(tid));
}

async function safeFetchJSON(url, opts = {}, timeout = APP_CONFIG.FETCH_TIMEOUT, retries = 2) {
    for (let i = 0; i <= retries; i++) {
        try {
            const res = await fetchWithTimeout(url, opts, timeout);
            if (res.status === 404) {
                throw new Error('Backend tidak ditemukan (404). Deployment GAS mungkin belum di-deploy ulang.');
            }
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const txt = await res.text();
            if (!txt || !txt.trim()) throw new Error('Response kosong');
            if (txt.trim().startsWith('<!DOCTYPE') || txt.trim().startsWith('<html')) {
                throw new Error('Server return HTML error');
            }
            try { return JSON.parse(txt); }
            catch (e) { throw new Error('Parse JSON gagal: ' + e.message); }
        } catch (e) {
            const isTimeout = e.name === 'AbortError' || (e.message && e.message.includes('Timeout'));
            const isRetryable = (isTimeout || e.message.includes('Failed to fetch')) && !e.message.includes('404');
            if (isRetryable && i < retries) {
                console.warn(`⏱️ Fetch retry ${i + 1}/${retries}...`);
                await new Promise(r => setTimeout(r, APP_CONFIG.RETRY_DELAY * (i + 1)));
                continue;
            }
            if (isTimeout) {
                const err = new Error('Timeout koneksi');
                err.name = 'TimeoutError';
                throw err;
            }
            throw e;
        }
    }
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
            if (Array.isArray(p)) return p.filter(i => i && 'lat' in i && 'lng' in i).map(i => ({
                nama: i.nama || 'Lokasi',
                lat: parseFloat(i.lat) || 0,
                lng: parseFloat(i.lng) || 0,
                radius: parseInt(i.radius) || 100
            }));
        } catch (e) { console.warn("⚠️ Parse Koordinat_Tugas gagal:", e.message); }
    }
    return [];
}

function sanitizeGeoData(list) {
    if (!Array.isArray(list)) return [];
    return list.map(p => {
        const r = p.Koordinat_Tugas || p.koordinat_tugas;
        const parsed = parseGeoData(r);
        p.Koordinat_Tugas = parsed.length > 0 ? JSON.stringify(parsed) : '[]';
        return p;
    });
}

function getLocalDateStr(d) {
    if (!d) return "";
    const dt = new Date(d);
    return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
}

function sanitizeHTML(s) {
    if (s == null) return "";
    const d = document.createElement('div');
    d.textContent = String(s);
    return d.innerHTML;
}

function debounce(fn, delay) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(fn, delay);
}

const getQRUrl = (n, h) => `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent((n || 'NAMA') + '_' + (h || 'NOHP'))}`;

// ============ TOAST ============
function showToast(msg, type = "success") {
    const c = document.getElementById('toastContainer');
    if (!c) return;
    const d = document.createElement('div');
    d.className = `toast ${type}`;
    const titles = { success: 'Berhasil', error: 'Gagal', warning: 'Perhatian' };
    const icons = { success: 'check-circle', error: 'alert-circle', warning: 'alert-triangle' };
    d.innerHTML = `<div class="toast-icon-wrap"><i data-lucide="${icons[type]}" size="24"></i></div><div class="toast-content"><div class="toast-title">${titles[type]}</div><div class="toast-message">${sanitizeHTML(msg)}</div></div><button class="toast-close" onclick="dismissToast(this.parentElement)"><i data-lucide="x" size="16"></i></button><div class="toast-progress"></div>`;
    c.appendChild(d);
    lucide.createIcons();
    setTimeout(() => { if (d.parentElement) dismissToast(d); }, 4000);
}

function dismissToast(t) {
    if (!t) return;
    t.style.animation = 'toastOut 0.4s forwards';
    setTimeout(() => t.remove(), 400);
}

// ============ PASSWORD VISIBILITY TOGGLE ============
function togglePasswordVisibility() {
    const input = document.getElementById('adminPass');
    const icon = document.getElementById('eyeIcon');
    if (!input || !icon) return;
    if (input.type === 'password') {
        input.type = 'text';
        icon.setAttribute('data-lucide', 'eye-off');
    } else {
        input.type = 'password';
        icon.setAttribute('data-lucide', 'eye');
    }
    lucide.createIcons();
}

// ============ LOGOUT ============
function logoutAdmin() {
    if (!confirm("Yakin ingin keluar dari panel admin?")) return;
    sessionStorage.removeItem('adminToken');
    sessionStorage.removeItem('dashData');
    sessionStorage.removeItem('dashDataTime');
    token = '';
    document.body.classList.remove('logged-in');
    document.body.classList.add('not-logged-in');
    const passInput = document.getElementById('adminPass');
    if (passInput) passInput.value = '';
    showToast("Berhasil logout", "success");
}

// ============ MODAL CONTROLS ============
function openModal(id) {
    const m = document.getElementById(id);
    if (!m) return;
    m.style.display = 'flex';
    setTimeout(() => m.classList.add('show'), 10);
}

function closeModal(id) {
    const m = document.getElementById(id);
    if (!m) return;
    m.classList.remove('show');
    setTimeout(() => m.style.display = 'none', 300);
    base64Foto = null;
}

function setLoading(s, t) {
    const o = document.getElementById('sendingOverlay');
    if (!o) return;
    if (t) {
        const txt = document.getElementById('overlayText');
        if (txt) txt.innerText = t;
    }
    if (s) {
        o.style.display = 'flex';
        setTimeout(() => o.classList.add('show'), 10);
    } else {
        o.classList.remove('show');
        setTimeout(() => o.style.display = 'none', 300);
    }
}

document.addEventListener('keydown', e => {
    if (e.key === "Escape") {
        document.querySelectorAll('.modal.show').forEach(m => closeModal(m.id));
    }
});

// ============ ✅ HELPER: DETEKSI MOBILE ============
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
        || window.innerWidth <= 768
        || ('ontouchstart' in window);
}

// ============ ✅ FIXED: INISIALISASI (Render data setelah reload) ============
window.onload = () => {
    lucide.createIcons();

    setInterval(() => {
        const el = document.getElementById('liveClock');
        if (el) el.innerText = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    }, 1000);

    const sidebarLogo = document.getElementById('sidebarLogo');
    if (sidebarLogo) sidebarLogo.src = LOGO_INSTANSI;

    const logDateFilter = document.getElementById('logDateFilter');
    if (logDateFilter) logDateFilter.value = new Date().toISOString().split('T')[0];

    const savedToken = sessionStorage.getItem('adminToken');
    if (savedToken) {
        token = savedToken;
        document.body.classList.remove('not-logged-in');
        document.body.classList.add('logged-in');
        // ✅ FIX: Panggil loadDashboard (yang render data), BUKAN fetchInitial
        loadDashboard(true);  // forceRefresh=true → bypass cache lama
    } else {
        warmUpBackend();
    }

    updateFabVisibility();
};

// ============ ✅ WARM-UP BACKEND (Silent, untuk user belum login) ============
function warmUpBackend() {
    fetchWithTimeout(API + "?action=getDashboardData", { redirect: 'follow', cache: 'no-cache' }, 20000)
        .then(() => console.log('✅ Backend siap'))
        .catch(() => { /* telan diam-diam */ });
}

// ============ ✅ FETCH INITIAL (Tetap dipakai untuk update logo/config) ============
async function fetchInitial() {
    try {
        const data = await safeFetchJSON(API + "?action=getDashboardData", { redirect: 'follow', cache: 'no-cache' }, 25000, 1);
        if (data.status === 'error') throw new Error(data.message);
        masterData = {
            pegawai: data.pegawai || [],
            korlap: data.korlap || [],
            tools: data.tools || [],
            config: data.config || {}
        };
        if (masterData.config.Logo) {
            const sidebarLogo = document.getElementById('sidebarLogo');
            if (sidebarLogo) sidebarLogo.src = masterData.config.Logo;
        }
        if (masterData.config.PlayStore_URL) {
            const playStoreLink = document.getElementById('playStoreLink');
            if (playStoreLink) playStoreLink.href = masterData.config.PlayStore_URL;
        }
    } catch (e) {
        console.warn('Fetch initial gagal:', e.message);
        if (document.body.classList.contains('logged-in')) {
            showToast("Gagal Terhubung: " + e.message, "error");
        }
    }
}

async function fetchInitial() {
    try {
        const data = await safeFetchJSON(API + "?action=getDashboardData", { redirect: 'follow', cache: 'no-cache' }, 25000, 1);
        if (data.status === 'error') throw new Error(data.message);
        masterData = {
            pegawai: data.pegawai || [],
            korlap: data.korlap || [],
            tools: data.tools || [],
            config: data.config || {}
        };
        if (masterData.config.Logo) {
            const sidebarLogo = document.getElementById('sidebarLogo');
            if (sidebarLogo) sidebarLogo.src = masterData.config.Logo;
        }
        if (masterData.config.PlayStore_URL) {
            const playStoreLink = document.getElementById('playStoreLink');
            if (playStoreLink) playStoreLink.href = masterData.config.PlayStore_URL;
        }
    } catch (e) {
        console.warn('Fetch initial gagal:', e.message);
        if (document.body.classList.contains('logged-in')) {
            showToast("Gagal Terhubung: " + e.message, "error");
        }
    }
}

// ============ AUTH ============
async function attemptLogin() {
    setLoading(true, "Otentikasi...");
    try {
        const d = await safeFetchJSON(API, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'loginAdmin', password: document.getElementById('adminPass').value })
        }, 15000);

        if (d.status === 'success') {
            token = d.token;
            sessionStorage.setItem('adminToken', token);

            const splitLayout = document.querySelector('.login-split-layout');
            if (splitLayout) splitLayout.classList.add('success');

            setTimeout(() => {
                document.body.classList.remove('not-logged-in');
                document.body.classList.add('logged-in');
                loadDashboard();
                showToast("Login Berhasil", "success");
                lucide.createIcons();
            }, 500);
        } else {
            showToast("Sandi Salah", "error");
        }
    } catch (e) {
        showToast("Gagal: " + e.message, "error");
    } finally {
        setLoading(false);
    }
}

// ============ ✅ FIXED: LOAD DASHBOARD (Bypass cache di mobile) ============
async function loadDashboard(forceRefresh = false) {
    const cached = sessionStorage.getItem('dashData');
    const cacheTime = sessionStorage.getItem('dashDataTime');
    const now = Date.now();
    const isMobile = isMobileDevice();
    
    // ✅ Cache duration: 30 detik di mobile, 5 menit di desktop
    const cacheDuration = isMobile ? 30 * 1000 : APP_CONFIG.CACHE_DURATION_MS;
    
    // ✅ Gunakan cache HANYA jika: bukan force refresh + cache valid + bukan mobile
    const useCache = !forceRefresh && cached && cacheTime 
        && (now - parseInt(cacheTime) < cacheDuration)
        && !isMobile;  // ← Skip cache di mobile!
    
    if (useCache) {
        try {
            masterData = JSON.parse(cached);
            renderPegawai(); renderKorlap(); renderTools(); renderConfig();
            // Tetap fetch di background untuk update
            silentBackgroundRefresh();
            return;
        } catch (e) {
            console.warn('Cache corrupt, fetch ulang');
        }
    }

    setLoading(true, "Sinkronisasi Data...");
    try {
        // ✅ Timeout lebih panjang di mobile (cold-start GAS lambat)
        const timeout = isMobile ? 30000 : 15000;
        const data = await safeFetchJSON(API + "?action=getDashboardData", { redirect: 'follow', cache: 'no-cache' }, timeout);
        
        masterData = {
            pegawai: sanitizeGeoData(data.pegawai || []),
            korlap: sanitizeGeoData(data.korlap || []),
            tools: data.tools || [],
            config: data.config || {}
        };
        
        // Simpan cache (ringan, tanpa foto)
        const light = {
            pegawai: masterData.pegawai.map(p => ({
                id: p.id, nama: p.nama, wilayah: p.wilayah,
                status: p.status, jabatan: p.jabatan,
                nohp: p.nohp, Koordinat_Tugas: p.Koordinat_Tugas
            })),
            korlap: masterData.korlap,
            tools: masterData.tools,
            config: masterData.config
        };
        try {
            sessionStorage.setItem('dashData', JSON.stringify(light));
            sessionStorage.setItem('dashDataTime', now.toString());
        } catch (e) {
            console.warn('SessionStorage penuh, lanjut tanpa cache');
        }
        
        renderPegawai(); renderKorlap(); renderTools(); renderConfig();
    } catch (e) {
        showToast("Gagal memuat data: " + e.message, "error");
        // Jika ada cache lama sebagai fallback
        if (cached) {
            try {
                masterData = JSON.parse(cached);
                renderPegawai(); renderKorlap(); renderTools(); renderConfig();
                showToast("Menampilkan data cache (offline mode)", "warning");
            } catch (e2) {}
        }
    } finally {
        setLoading(false);
    }
}

// ✅ Background refresh silent (tidak ganggu user)
async function silentBackgroundRefresh() {
    try {
        const data = await safeFetchJSON(API + "?action=getDashboardData", { redirect: 'follow', cache: 'no-cache' }, 25000);
        masterData = {
            pegawai: sanitizeGeoData(data.pegawai || []),
            korlap: sanitizeGeoData(data.korlap || []),
            tools: data.tools || [],
            config: data.config || {}
        };
        const now = Date.now();
        try {
            sessionStorage.setItem('dashDataTime', now.toString());
        } catch (e) {}
        renderPegawai(); renderKorlap(); renderTools(); renderConfig();
    } catch (e) {
        console.warn('Background refresh gagal:', e.message);
    }
}

function switchTab(tab) {
    document.querySelectorAll('.admin-tab').forEach(t => t.style.display = 'none');
    const tabEl = document.getElementById('tab-' + tab);
    if (tabEl) tabEl.style.display = 'block';

    document.querySelectorAll('.nav-link,.b-nav-item').forEach(l => l.classList.remove('active'));
    document.querySelectorAll(`.nav-link[onclick*="'${tab}'"],.b-nav-item[onclick*="'${tab}']`).forEach(el => el.classList.add('active'));

    if (tab === 'pegawai') renderPegawai();
    else if (tab === 'korlap') renderKorlap();
    else if (tab === 'tools') renderTools();
    else if (tab === 'logs') loadLogs();
    else if (tab === 'config') renderConfig();

    lucide.createIcons();
    updateFabVisibility();
}

function updateQRRealtime() {
    const n = document.getElementById('p-nama')?.value.trim();
    const h = document.getElementById('p-nohp')?.value.trim();
    if (n || h) {
        const qrImg = document.getElementById('p-qr-img');
        if (qrImg) qrImg.src = getQRUrl(n, h);
        const container = document.getElementById('qr-display-container');
        if (container) container.style.display = 'block';
    }
}

function setView(view) {
    currentView = view;
    document.querySelectorAll('.view-toggle button').forEach(b => b.classList.remove('active'));

    if (view === 'list') {
        const btnList = document.getElementById('btnListView');
        const btnListK = document.getElementById('btnListViewKorlap');
        if (btnList) btnList.classList.add('active');
        if (btnListK) btnListK.classList.add('active');
        document.querySelectorAll('.personel-table').forEach(t => t.classList.remove('hidden'));
        document.querySelectorAll('.desktop-card-grid').forEach(g => g.classList.remove('active'));
    } else {
        const btnCard = document.getElementById('btnCardView');
        const btnCardK = document.getElementById('btnCardViewKorlap');
        if (btnCard) btnCard.classList.add('active');
        if (btnCardK) btnCardK.classList.add('active');
        document.querySelectorAll('.personel-table').forEach(t => t.classList.add('hidden'));
        document.querySelectorAll('.desktop-card-grid').forEach(g => g.classList.add('active'));
    }

    renderPegawai();
    renderKorlap();
}

// ============ RENDERING PERSONEL ============
function renderPegawai() {
    const q = (document.getElementById('pegawaiSearch')?.value || '').toLowerCase();
    const f = (masterData.pegawai || []).filter(p =>
        (p.nama || p.Nama || "").toLowerCase().includes(q) ||
        (p.id || p.ID || "").toString().toLowerCase().includes(q) ||
        (p.wilayah || p.Wilayah || "").toLowerCase().includes(q)
    );
    renderPersonelList(f, 'pegawaiBody', 'pegawaiGrid', 'pegawaiMobileGrid', 'pegawai');
}

function renderKorlap() {
    const q = (document.getElementById('korlapSearch')?.value || '').toLowerCase();
    const f = (masterData.korlap || []).filter(p =>
        (p.nama || p.Nama || "").toLowerCase().includes(q) ||
        (p.wilayah || p.Wilayah || "").toLowerCase().includes(q)
    );
    renderPersonelList(f, 'korlapBody', 'korlapGrid', 'korlapMobileGrid', 'korlap');
}

function renderPersonelList(list, tableId, gridId, mobileGridId, type) {
    const tE = document.getElementById(tableId);
    const gE = document.getElementById(gridId);
    const mE = document.getElementById(mobileGridId);

    if (!list || list.length === 0) {
        if (tE) tE.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:30px;opacity:.6">Tidak ada data.</td></tr>';
        if (gE) gE.innerHTML = '<div class="empty-state" style="grid-column:1/-1;text-align:center;padding:40px 20px;opacity:.5"><i data-lucide="users" size="40"></i><p>Belum ada data</p></div>';
        if (mE) mE.innerHTML = '<div class="empty-state"><i data-lucide="users" size="40"></i><p>Belum ada data</p></div>';
        lucide.createIcons();
        return;
    }

    if (currentView === 'list') {
        if (tE) {
            tE.innerHTML = list.map(p => {
                const id = sanitizeHTML(p.id || p.ID);
                const qr = p.urlQR || p.link_qr || getQRUrl(p.nama || p.Nama, p.nohp || p.NoHP);
                const foto = p.urlFoto || p.link_foto_profile || p.Link_Foto_Profile || '';
                const nama = sanitizeHTML(p.nama || p.Nama);
                const jab = sanitizeHTML(p.jabatan || p.Jabatan);
                const wil = sanitizeHTML(p.wilayah || p.Wilayah);
                const st = p.status || p.Status || 'Aktif';
                const sc = st === 'Aktif' ? 'badge-aktif' : 'badge-nonaktif';
                const si = st === 'Aktif' ? 'check-circle' : 'x-circle';
                let gc = 0;
                try {
                    const r = p.Koordinat_Tugas || p.koordinat_tugas;
                    if (r) { const j = JSON.parse(r); if (Array.isArray(j)) gc = j.length; }
                } catch (e) { }
                return `<tr>
                    <td>${id}</td>
                    <td><img src="${qr}" class="qr-thumb-sm" onclick="window.open('${qr}')"></td>
                    <td><div class="foto-pegawai-sm"><img src="${foto}" onerror="this.src='${placeholderImg}'"></div></td>
                    <td style="font-weight:800;text-transform:uppercase">${nama}</td>
                    <td>${jab}</td>
                    <td>${wil}</td>
                    <td style="text-align:center">${gc > 0 ? `<span class="geo-indicator"><i data-lucide="map-pin" size="12"></i> ${gc}</span>` : '-'}</td>
                    <td><span class="badge-status ${sc}"><i data-lucide="${si}" size="12"></i> ${sanitizeHTML(st)}</span></td>
                    <td><div class="action-cell">
                        <button class="action-icon detail" onclick="showDetail('${type}','${id}')"><i data-lucide="eye" size="14"></i></button>
                        <button class="action-icon" onclick="editP('${type}','${id}')"><i data-lucide="edit-3" size="14"></i></button>
                        <button class="action-icon delete" onclick="deleteP('${type}','${id}')"><i data-lucide="trash-2" size="14"></i></button>
                    </div></td>
                </tr>`;
            }).join('');
        }
    } else {
        const cardHTML = list.map(p => {
            const id = sanitizeHTML(p.id || p.ID);
            const foto = p.urlFoto || p.link_foto_profile || p.Link_Foto_Profile || '';
            const nama = sanitizeHTML(p.nama || p.Nama || '-');
            const jab = sanitizeHTML(p.jabatan || p.Jabatan || '-');
            const st = p.status || p.Status || 'Aktif';
            const sc = st === 'Aktif' ? 'aktif' : 'nonaktif';
            const si = st === 'Aktif' ? 'check-circle' : 'x-circle';
            const qr = p.urlQR || p.link_qr || getQRUrl(p.nama || p.Nama, p.nohp || p.NoHP);
            return `<div class="premium-card-container" onclick="showDetail('${type}','${id}')">
                <div class="premium-card-actions">
                    <button onclick="event.stopPropagation();editP('${type}','${id}')"><i data-lucide="edit-3" size="12"></i></button>
                    <button class="delete" onclick="event.stopPropagation();deleteP('${type}','${id}')"><i data-lucide="trash-2" size="12"></i></button>
                </div>
                <div class="premium-card-qr" onclick="event.stopPropagation();window.open('${qr}')"><img src="${qr}" style="width:100%;height:100%;object-fit:contain"></div>
                <img class="premium-card-bg" src="${foto}" onerror="this.src='${placeholderImg}'">
                <div class="premium-card-overlay"></div>
                <div class="premium-card-watermark">PUSDA</div>
                <div class="premium-card-info">
                    <div class="premium-card-name">${nama}</div>
                    <div class="premium-card-job">${jab}</div>
                    <span class="premium-card-status ${sc}"><i data-lucide="${si}" size="10"></i> ${sanitizeHTML(st)}</span>
                </div>
            </div>`;
        }).join('');
        if (gE) gE.innerHTML = cardHTML;
        if (mE) mE.innerHTML = cardHTML;
    }
    lucide.createIcons();
}

function showDetail(type, id) {
    currentDetailType = type;
    currentDetailId = id;
    const list = type === 'pegawai' ? masterData.pegawai : masterData.korlap;
    const p = (list || []).find(x => String(x.id || x.ID) === String(id));
    if (!p) return;

    const foto = p.urlFoto || p.link_foto_profile || p.Link_Foto_Profile || placeholderImg;
    const st = p.status || p.Status || 'Aktif';
    const sc = st === 'Aktif' ? 'badge-aktif' : 'badge-nonaktif';
    const si = st === 'Aktif' ? 'check-circle' : 'x-circle';
    let gc = 0;
    try {
        const r = p.Koordinat_Tugas || p.koordinat_tugas;
        if (r) { const j = JSON.parse(r); if (Array.isArray(j)) gc = j.length; }
    } catch (e) { }

    const detailImg = document.getElementById('detailImg');
    if (detailImg) {
        detailImg.src = foto;
        detailImg.onerror = function () { this.src = placeholderImg; };
    }

    const setText = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = sanitizeHTML(val || '-'); };
    setText('detailNama', p.nama || p.Nama);
    setText('detailJabatan', p.jabatan || p.Jabatan);
    setText('detailID', p.id || p.ID);
    setText('detailWilayah', p.wilayah || p.Wilayah);
    setText('detailHP', p.nohp || p.NoHP);
    setText('detailLokasi', p.lokasi_kerja || p.Lokasi_Kerja);

    const badgeEl = document.getElementById('detailStatusBadge');
    if (badgeEl) badgeEl.innerHTML = `<span class="badge-status ${sc}"><i data-lucide="${si}" size="12"></i> ${sanitizeHTML(st)}</span>`;

    const geoEl = document.getElementById('detailGeo');
    if (geoEl) geoEl.innerHTML = gc > 0 ? `<span class="geo-indicator"><i data-lucide="map-pin" size="12"></i> ${gc} Titik</span>` : '<span style="opacity:.5">Tidak diatur</span>';

    const qrEl = document.getElementById('detailQR');
    if (qrEl) qrEl.src = getQRUrl(p.nama || p.Nama, p.nohp || p.NoHP);

    openModal('detailModal');
    lucide.createIcons();
}

function editFromDetail() { closeModal('detailModal'); setTimeout(() => editP(currentDetailType, currentDetailId), 300); }
function deleteFromDetail() { if (!confirm("Hapus data ini?")) return; closeModal('detailModal'); setTimeout(() => deleteP(currentDetailType, currentDetailId), 300); }

// ============ LOGS ============
async function loadLogs() {
    setLoading(true, "Memuat Data Log...");
    const skeleton = Array(5).fill('<tr><td class="skeleton-cell"><div class="skeleton-line"></div></td>'.repeat(8)).join('');
    const logsBody = document.getElementById('logsBody');
    if (logsBody) logsBody.innerHTML = skeleton;

    const selectedDate = document.getElementById('logDateFilter')?.value || new Date().toISOString().split('T')[0];
    currentLogPage = 1;

    try {
        const d = await safeFetchJSON(API + `?action=getPresensiByDate&date=${selectedDate}`, { redirect: 'follow', cache: 'no-cache' }, 15000);
        if (d.status === 'error') throw new Error(d.message);
        logsCache = d.data || [];
        renderLogsFiltered(true);
    } catch (e) {
        showToast("Gagal memuat Log: " + e.message, "error");
        if (logsBody) logsBody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--danger);padding:50px">Gagal terhubung ke server.</td></tr>';
    } finally {
        setLoading(false);
    }
}

function renderLogsFiltered(resetPage = false) {
    if (resetPage) currentLogPage = 1;
    const fD = document.getElementById('logDateFilter')?.value;
    const q = (document.getElementById('logSearch')?.value || '').toLowerCase();

    const all = logsCache.filter(l => {
        const t = l.timestamp || l.Timestamp;
        return t ? getLocalDateStr(t) === fD : false;
    });

    let s = { h: 0, t: 0, i: 0, a: 0 };
    all.forEach(l => {
        const st = (l.status || l.Status || '').toLowerCase();
        if (st.includes('hadir') && !st.includes('terlambat')) s.h++;
        else if (st.includes('terlambat') || st.includes('qr')) s.t++;
        else if (st.includes('izin') || st.includes('sakit') || st.includes('dinas')) s.i++;
        else s.a++;
    });

    const sumHadir = document.getElementById('sumHadir'); if (sumHadir) sumHadir.innerText = s.h;
    const sumTelat = document.getElementById('sumTelat'); if (sumTelat) sumTelat.innerText = s.t;
    const sumIzin = document.getElementById('sumIzin'); if (sumIzin) sumIzin.innerText = s.i;
    const sumAlpha = document.getElementById('sumAlpha'); if (sumAlpha) sumAlpha.innerText = s.a;

    const f = all.filter(l => (l.nama || l.Nama || "").toLowerCase().includes(q));
    const tbody = document.getElementById('logsBody');

    if (f.length === 0) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;opacity:.3;padding:50px">Tidak Ada Aktivitas.<br><span style="font-size:0.8rem; margin-top:10px; display:inline-block;">Coba <a href="#" onclick="document.getElementById('logSearch').value=''; renderLogsFiltered(true);" style="color:var(--sda-toska)">reset pencarian</a>.</span></td></tr>`;
        lucide.createIcons();
        return;
    }

    const endIndex = currentLogPage * APP_CONFIG.LOGS_PER_PAGE;
    const paginatedData = f.slice(0, endIndex);

    if (tbody) {
        tbody.innerHTML = paginatedData.map(l => {
            const ts = l.timestamp || l.Timestamp;
            const id = l['ID Pegawai'] || l.id_pegawai || l.id || l.ID;
            const fs = l['Foto Selfie'] || l.foto_selfie || l.Foto_Selfie || '-';
            const fk = l['Foto Kerja'] || l['Foto Lokasi'] || l.foto_kerja || l.foto_lokasi || l.Foto_Kerja || '-';
            const n = parseInt(l.nilai || l.Nilai) || 0;
            const sc = n >= 50 ? 'score-high' : n >= 25 ? 'score-mid' : 'score-low';
            const nama = sanitizeHTML(l.nama || l.Nama);
            const status = sanitizeHTML(l.status || l.Status);
            const wil = sanitizeHTML(l.wilayah || l.Wilayah);
            return `<tr>
                <td>${new Date(ts).toLocaleTimeString('id-ID')}</td>
                <td style="font-weight:800;text-transform:uppercase">${nama}</td>
                <td>${status}</td>
                <td style="text-align:center"><span class="score-badge ${sc}">${n}</span></td>
                <td>${wil}</td>
                <td style="text-align:center">${fs !== '-' ? `<button class="action-icon" onclick="window.open('${fs}','_blank')"><i data-lucide="user" size="14"></i></button>` : '-'}</td>
                <td style="text-align:center">${fk !== '-' ? `<button class="action-icon" onclick="window.open('${fk}','_blank')"><i data-lucide="briefcase" size="14"></i></button>` : '-'}</td>
                <td><div class="action-cell">
                    <button class="action-icon" style="color:var(--warning)" onclick="openLogModal('edit','','${id}','${ts}','${status}','${n}')"><i data-lucide="edit-2" size="14"></i></button>
                    <button class="action-icon delete" onclick="deleteLog('${id}','${ts}')"><i data-lucide="trash-2" size="14"></i></button>
                </div></td>
            </tr>`;
        }).join('');

        if (endIndex < f.length) {
            tbody.innerHTML += `<tr><td colspan="8" style="text-align:center; padding: 20px;">
                <button class="btn-premium" style="width: auto; margin: 0 auto; height: 40px; font-size: 0.8rem;" onclick="currentLogPage++; renderLogsFiltered(false);">
                    <i data-lucide="chevron-down" size="16"></i> Muat Lebih Banyak (${f.length - endIndex} lagi)
                </button>
            </td></tr>`;
        }
    }
    lucide.createIcons();
}

function exportLogsToCSV() {
    const fD = document.getElementById('logDateFilter')?.value;
    const data = logsCache.filter(l => {
        const t = l.timestamp || l.Timestamp;
        return t ? getLocalDateStr(t) === fD : false;
    });

    if (data.length === 0) { showToast("Tidak ada data untuk diekspor", "warning"); return; }

    let csv = "Waktu,Nama,Status,Skor,Wilayah,Keterangan\n";
    data.forEach(l => {
        const ts = new Date(l.timestamp || l.Timestamp).toLocaleString('id-ID');
        const nama = (l.nama || l.Nama || "-").replace(/,/g, ";");
        const status = (l.status || l.Status || "-").replace(/,/g, ";");
        const nilai = l.nilai || l.Nilai || 0;
        const wilayah = (l.wilayah || l.Wilayah || "-").replace(/,/g, ";");
        const ket = (l.keterangan || l.Keterangan || "-").replace(/,/g, ";");
        csv += `${ts},${nama},${status},${nilai},${wilayah},${ket}\n`;
    });

    const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Log_Presensi_${fD}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Data berhasil diunduh", "success");
}

// ============ TOOLS & CONFIG ============
function renderTools() {
    const q = (document.getElementById('toolSearch')?.value || '').toLowerCase();
    const toolsData = Array.isArray(masterData.tools) ? masterData.tools : [];
    const f = toolsData.filter(t => {
        if (!t) return false;
        const n = String(t.Nama || t.nama || "").trim();
        return n !== "" && n.toLowerCase().includes(q);
    });

    const tbody = document.getElementById('toolsBody');
    if (!tbody) return;

    if (!f.length) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:50px 20px;">
            <i data-lucide="layout-grid" size="40" style="opacity:0.3;margin-bottom:10px"></i>
            <p style="font-weight:700;margin-bottom:5px">Belum ada layanan digital</p>
            <p style="font-size:0.8rem;opacity:0.6;margin-bottom:20px">Silakan tambahkan layanan baru.</p>
            <button class="btn-premium" style="width:auto;height:40px;font-size:0.8rem;margin:0 auto" onclick="openToolModal()">
                <i data-lucide="plus" size="16"></i> TAMBAH LAYANAN
            </button>
        </td></tr>`;
    } else {
        tbody.innerHTML = f.map(t => {
            const nama = sanitizeHTML(t.Nama || t.nama || "-");
            const icon = sanitizeHTML(t.Icon || t.icon || "layers");
            const warna = sanitizeHTML(t.Warna || t.warna || "#3b82f6");
            const url = sanitizeHTML(t.Link_URL || t.link_url || t.URL || t.url || "-");
            const tp = sanitizeHTML(t.Type || t.type || "Folder");
            const safeNama = String(t.Nama || t.nama || "").replace(/'/g, "\\'");
            return `<tr>
                <td><div style="width:32px;height:32px;background:${warna};display:flex;align-items:center;justify-content:center;border-radius:10px;box-shadow:0 4px 8px ${warna}40"><i data-lucide="${icon}" size="16" color="white"></i></div></td>
                <td style="font-weight:800">${nama}</td>
                <td><span style="font-size:.7rem;font-weight:800;color:${tp === 'Direct' ? 'var(--success)' : 'var(--pu-blue)'}">${tp.toUpperCase()}</span></td>
                <td><div style="width:15px;height:15px;border-radius:50%;background:${warna};box-shadow:0 0 8px ${warna}80"></div></td>
                <td style="font-family:JetBrains Mono;font-size:.65rem;opacity:.4;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${url}</td>
                <td><div class="action-cell">
                    <button class="action-icon" onclick="editTool('${safeNama}')"><i data-lucide="edit-3" size="14"></i></button>
                    <button class="action-icon delete" onclick="deleteTool('${safeNama}')"><i data-lucide="trash-2" size="14"></i></button>
                </div></td>
            </tr>`;
        }).join('');
    }
    lucide.createIcons();
}

function renderConfig() {
    const q = (document.getElementById('configSearch')?.value || '').toLowerCase();
    const configData = masterData.config || {};
    const keys = Object.keys(configData).filter(k => k.toLowerCase().includes(q));
    const container = document.getElementById('configContainer');

    if (!keys.length) {
        if (container) container.innerHTML = '<p style="opacity:.6;padding:20px;text-align:center">Tidak ada pengaturan.</p>';
        return;
    }

    const g = { '🎨 Tampilan': [], '📍 Geo-Fencing': [], '🔗 Link': [], '⚙️ Umum': [] };
    keys.forEach(k => {
        const l = k.toLowerCase();
        if (l.includes('logo') || l.includes('color') || l.includes('theme') || l.includes('warna')) g['🎨 Tampilan'].push(k);
        else if (l.includes('radius') || l.includes('jam') || l.includes('late') || l.includes('geo')) g['📍 Geo-Fencing'].push(k);
        else if (l.includes('url') || l.includes('link') || l.includes('playstore') || l.includes('api')) g['🔗 Link'].push(k);
        else g['⚙️ Umum'].push(k);
    });

    let h = '';
    for (const [n, ks] of Object.entries(g)) {
        if (!ks.length) continue;
        h += `<div style="margin-bottom:25px;background:rgba(0,0,0,.2);border-radius:20px;padding:20px;border:1px solid var(--glass-border)">
            <h3 style="font-size:.9rem;font-weight:800;color:var(--sda-toska);margin-bottom:20px;display:flex;align-items:center;gap:10px;padding-bottom:15px;border-bottom:1px solid var(--glass-border)">
                ${n}<span style="background:rgba(45,212,191,.1);color:var(--sda-toska);padding:4px 10px;border-radius:15px;font-size:.65rem;margin-left:auto">${ks.length}</span>
            </h3>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:15px">
                ${ks.map(k => {
                    const v = configData[k];
                    let inp = '';
                    if (v === 'true' || v === 'false') inp = `<select id="c-${k}"><option value="true" ${v === 'true' ? 'selected' : ''}>Aktif</option><option value="false" ${v === 'false' ? 'selected' : ''}>Non-Aktif</option></select>`;
                    else if (k.toLowerCase().includes('color') || k.toLowerCase().includes('warna')) inp = `<input type="color" value="${v}" id="c-${k}" style="height:48px;padding:5px">`;
                    else if (String(v).length > 50) inp = `<textarea id="c-${k}" rows="2">${sanitizeHTML(v)}</textarea>`;
                    else inp = `<input type="text" value="${sanitizeHTML(v)}" id="c-${k}">`;
                    return `<div class="form-group" style="background:rgba(255,255,255,.02);padding:15px;border-radius:14px;border:1px solid rgba(255,255,255,.05)">
                        <label><i data-lucide="settings-2" size="12" style="opacity:.5"></i> ${sanitizeHTML(k.replace(/_/g, ' '))}</label>${inp}
                    </div>`;
                }).join('')}
            </div>
        </div>`;
    }

    if (container) container.innerHTML = h;
    renderSystemHealth();
    lucide.createIcons();
}

function renderSystemHealth() {
    let box = document.getElementById('sysHealthBox');
    if (!box) {
        const container = document.getElementById('configContainer');
        if (!container) return;
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'margin-bottom:20px;border:1px solid var(--glass-border);border-radius:16px;padding:18px;background:rgba(0,0,0,.2)';
        wrapper.innerHTML = `<h3 style="font-size:.9rem;font-weight:800;margin-bottom:12px;display:flex;align-items:center;gap:8px">
            <i data-lucide="activity" size="16" style="color:var(--sda-toska)"></i> SYSTEM HEALTH (Perangkat Ini)
        </h3><div id="sysHealthBox"><p style="opacity:.6">Memuat...</p></div>`;
        container.parentNode.insertBefore(wrapper, container);
        box = document.getElementById('sysHealthBox');
        lucide.createIcons();
    }

    const log = JSON.parse(localStorage.getItem('pusda_perf_log') || '[]');
    if (!log.length) {
        box.innerHTML = '<p style="opacity:.6">Belum ada data performa. Data terisi setelah melakukan absen dari presensi.html.</p>';
        return;
    }

    const t = log.map(x => x.ms);
    const avg = t.reduce((a, b) => a + b, 0) / t.length;
    const max = Math.max(...t);
    const min = Math.min(...t);
    const [emoji, label, color] = avg < 5000 ? ['🟢', 'BAIK', '#10b981'] : avg < 10000 ? ['🟡', 'SEDANG', '#f59e0b'] : ['🔴', 'LAMBAT', '#ef4444'];

    box.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:12px;text-align:center">
            <div><div style="font-size:1.3rem;font-weight:800;color:${color}">${(avg / 1000).toFixed(1)}s</div><div style="font-size:.65rem;opacity:.6">RATA-RATA</div></div>
            <div><div style="font-size:1.3rem;font-weight:800">${(min / 1000).toFixed(1)}s</div><div style="font-size:.65rem;opacity:.6">TERCEPAT</div></div>
            <div><div style="font-size:1.3rem;font-weight:800">${(max / 1000).toFixed(1)}s</div><div style="font-size:.65rem;opacity:.6">TERLAMBAT</div></div>
            <div><div style="font-size:1.3rem;font-weight:800;color:${color}">${emoji} ${label}</div><div style="font-size:.65rem;opacity:.6">STATUS</div></div>
        </div>
        <p style="font-size:.65rem;opacity:.5;margin-top:10px">${log.length} sample • Untuk monitoring global 500 user, lihat GAS Executions dashboard.</p>`;
}

// ============ GEO-FENCING ============
function renderGeoList() {
    const c = document.getElementById('geo-list');
    if (!c) return;
    if (!currentGeoFences.length) {
        c.innerHTML = '<p style="font-size:.7rem;opacity:.5;text-align:center;padding:10px">Belum ada lokasi</p>';
        return;
    }
    c.innerHTML = currentGeoFences.map((p, i) => `<div class="geo-item">
        <div class="geo-item-info">
            <div class="geo-item-name">${sanitizeHTML(p.nama || 'Lokasi ' + (i + 1))}</div>
            <div class="geo-item-coords">Lat: ${p.lat}, Lng: ${p.lng} | ${p.radius}m</div>
        </div>
        <button class="btn-remove-geo" onclick="removeGeoPoint(${i})"><i data-lucide="trash-2" size="14"></i></button>
    </div>`).join('');
    lucide.createIcons();
}

function addGeoPoint() {
    if (!Array.isArray(currentGeoFences)) currentGeoFences = [];
    const n = document.getElementById('geo-nama')?.value.trim() || 'Lokasi ' + (currentGeoFences.length + 1);
    const la = parseFloat(document.getElementById('geo-lat')?.value);
    const lo = parseFloat(document.getElementById('geo-lng')?.value);
    const r = parseInt(document.getElementById('geo-radius')?.value) || 100;
    if (isNaN(la) || isNaN(lo)) return showToast("Latitude dan Longitude harus angka!", "error");
    if (la < -90 || la > 90) return showToast("Latitude tidak valid!", "error");
    if (lo < -180 || lo > 180) return showToast("Longitude tidak valid!", "error");
    currentGeoFences.push({ nama: n, lat: la, lng: lo, radius: r });
    renderGeoList();
    ['geo-nama', 'geo-lat', 'geo-lng', 'geo-radius'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    showToast("Lokasi geo-fencing ditambahkan", "success");
}

function removeGeoPoint(i) {
    currentGeoFences.splice(i, 1);
    renderGeoList();
}

function fillCurrentLocation() {
    if (!navigator.geolocation) return showToast("GPS tidak didukung", "error");
    setLoading(true, "Mendeteksi GPS...");
    navigator.geolocation.getCurrentPosition(p => {
        const lat = document.getElementById('geo-lat');
        const lng = document.getElementById('geo-lng');
        const radius = document.getElementById('geo-radius');
        const nama = document.getElementById('geo-nama');
        if (lat) lat.value = p.coords.latitude.toFixed(6);
        if (lng) lng.value = p.coords.longitude.toFixed(6);
        if (radius && !radius.value) radius.value = 100;
        if (nama && !nama.value) nama.value = "Lokasi Saat Ini";
        setLoading(false);
    }, e => {
        setLoading(false);
        showToast("Gagal: " + e.message, "error");
    }, { enableHighAccuracy: true, timeout: 10000 });
}

// ============ PERSONEL CRUD ============
function openPModal(type) {
    const pMode = document.getElementById('p-mode'); if (pMode) pMode.value = type;
    const pOldId = document.getElementById('p-old-id'); if (pOldId) pOldId.value = '';
    ['p-id', 'p-nama', 'p-jabatan', 'p-wilayah', 'p-nohp', 'p-lokasi'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    currentGeoFences = [];
    renderGeoList();
    const titleEl = document.getElementById('pModalTitle');
    if (titleEl) titleEl.innerText = type === 'pegawai' ? "Data Pegawai" : "Data Koordinator";
    const qrContainer = document.getElementById('qr-display-container');
    if (qrContainer) qrContainer.style.display = 'none';
    const previewImg = document.getElementById('p-preview-img');
    if (previewImg) previewImg.style.display = 'none';
    const placeholder = document.getElementById('p-placeholder');
    if (placeholder) placeholder.style.display = 'flex';
    openModal('pModal');
}

function editP(type, id) {
    const list = type === 'pegawai' ? masterData.pegawai : masterData.korlap;
    const p = (list || []).find(x => String(x.id || x.ID) === String(id));
    if (!p) return;

    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
    setVal('p-mode', type);
    setVal('p-old-id', id);
    setVal('p-id', id);
    setVal('p-nama', p.nama || p.Nama);
    setVal('p-jabatan', p.jabatan || p.Jabatan);
    setVal('p-wilayah', p.wilayah || p.Wilayah);
    setVal('p-nohp', p.nohp || p.NoHP || "");
    setVal('p-lokasi', p.lokasi_kerja || p.Lokasi_Kerja || "");
    setVal('p-status', p.status || p.Status || 'Aktif');

    currentGeoFences = parseGeoData(p.Koordinat_Tugas || p.koordinat_tugas);
    renderGeoList();

    const img = p.urlFoto || p.link_foto_profile || p.Link_Foto_Profile;
    if (img) {
        const previewImg = document.getElementById('p-preview-img');
        if (previewImg) { previewImg.src = img; previewImg.style.display = 'block'; }
        const placeholder = document.getElementById('p-placeholder');
        if (placeholder) placeholder.style.display = 'none';
    }
    updateQRRealtime();
    openModal('pModal');
}

async function savePAction() {
    const type = document.getElementById('p-mode')?.value;
    const id = document.getElementById('p-id')?.value;
    const nama = document.getElementById('p-nama')?.value;
    if (!id || !nama) return showToast("ID dan Nama Wajib!", "error");
    if (!Array.isArray(currentGeoFences)) currentGeoFences = [];

    const cLat = document.getElementById('geo-lat')?.value.trim();
    const cLng = document.getElementById('geo-lng')?.value.trim();
    if (cLat && cLng) addGeoPoint();

    const oldId = document.getElementById('p-old-id')?.value;
    const payload = {
        token,
        action: oldId ? (type === 'pegawai' ? 'editPegawai' : 'editKorlap') : (type === 'pegawai' ? 'addPegawai' : 'addKorlap'),
        oldId,
        id, nama,
        jabatan: document.getElementById('p-jabatan')?.value,
        wilayah: document.getElementById('p-wilayah')?.value,
        noHP: document.getElementById('p-nohp')?.value,
        lokasiKerja: document.getElementById('p-lokasi')?.value,
        status: document.getElementById('p-status')?.value,
        koordinatTugas: JSON.stringify(currentGeoFences),
        linkQR: getQRUrl(nama, document.getElementById('p-nohp')?.value),
        fotoProfile: base64Foto
    };

    setLoading(true, "Menyimpan...");
    try {
        const d = await safeFetchJSON(API, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        }, 20000);
        if (d.status === 'success') {
            closeModal('pModal');
            await loadDashboard(true);
            showToast("Data berhasil disimpan", "success");
        } else {
            throw new Error(d.message || "Terjadi kesalahan pada server");
        }
    } catch (e) {
        console.error("❌ Save Error:", e);
        showToast(e.message.includes('connect') ? "Koneksi internet terputus" : "Gagal: " + e.message, "error");
    } finally {
        setLoading(false);
    }
}

async function deleteP(type, id) {
    if (!confirm("Hapus data ini?")) return;
    setLoading(true, "Menghapus...");
    try {
        await safeFetchJSON(API, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: type === 'pegawai' ? 'deletePegawai' : 'deleteKorlap', token, id })
        }, 15000);
        await loadDashboard(true);
        showToast("Data dihapus", "success");
    } catch (e) {
        showToast("Gagal: " + e.message, "error");
    } finally {
        setLoading(false);
    }
}

// ============ TOOLS CRUD ============
function updateToolPreview() {
    const n = document.getElementById('t-nama')?.value || 'Nama';
    const i = document.getElementById('t-ikon')?.value || 'layers';
    const c = document.getElementById('t-warna')?.value;
    const previewName = document.getElementById('previewName');
    if (previewName) previewName.innerText = n;
    const previewIconBox = document.getElementById('previewIconBox');
    if (previewIconBox) {
        previewIconBox.style.background = c;
        previewIconBox.style.boxShadow = '0 5px 15px ' + c + '40';
        previewIconBox.innerHTML = `<i data-lucide="${i}" size="22" color="white"></i>`;
    }
    lucide.createIcons();
}

function openToolModal() {
    ['t-old-name', 't-nama', 't-url', 't-desc'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const ikon = document.getElementById('t-ikon'); if (ikon) ikon.value = 'layers';
    const warna = document.getElementById('t-warna'); if (warna) warna.value = '#3b82f6';
    const type = document.getElementById('t-type'); if (type) type.value = 'Folder';
    openModal('toolModal');
    updateToolPreview();
}

function editTool(name) {
    const t = (masterData.tools || []).find(x => String(x.Nama || x.nama) === String(name));
    if (!t) return;
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
    setVal('t-old-name', name);
    setVal('t-nama', t.Nama || t.nama || '');
    setVal('t-ikon', t.Icon || t.icon || 'layers');
    setVal('t-warna', t.Warna || t.warna || '#3b82f6');
    setVal('t-type', t.Type || t.type || 'Folder');
    setVal('t-url', t.Link_URL || t.link_url || t.URL || t.url || '');
    setVal('t-desc', t.Deskripsi || t.deskripsi || t.desc || '');
    openModal('toolModal');
    updateToolPreview();
}

async function saveTool() {
    const p = {
        token, action: 'saveTool',
        oldName: document.getElementById('t-old-name')?.value,
        nama: document.getElementById('t-nama')?.value,
        icon: document.getElementById('t-ikon')?.value,
        warna: document.getElementById('t-warna')?.value,
        url: document.getElementById('t-url')?.value,
        desc: document.getElementById('t-desc')?.value
    };
    setLoading(true, "Menyimpan...");
    try {
        await safeFetchJSON(API, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(p)
        }, 15000);
        closeModal('toolModal');
        await loadDashboard(true);
        showToast("Layanan disimpan", "success");
    } catch (e) {
        showToast("Gagal: " + e.message, "error");
    } finally {
        setLoading(false);
    }
}

async function deleteTool(name) {
    if (!confirm("Hapus layanan ini?")) return;
    setLoading(true, "Menghapus...");
    try {
        await safeFetchJSON(API, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'deleteTool', token, name })
        }, 15000);
        await loadDashboard(true);
        showToast("Layanan dihapus", "success");
    } catch (e) {
        showToast("Gagal: " + e.message, "error");
    } finally {
        setLoading(false);
    }
}

// ============ LOGS CRUD ============
function openLogModal(mode, n, id, ts, st, ni) {
    logMode = mode;
    const d = document.getElementById('manualLogPegawai');
    if (d) {
        d.innerHTML = [...(masterData.pegawai || []), ...(masterData.korlap || [])].map(p => `<option value="${p.id || p.ID}">${sanitizeHTML(p.nama || p.Nama)}</option>`).join('');
    }
    if (mode === 'add') {
        const editTime = document.getElementById('editLogTime');
        if (editTime) editTime.value = new Date().toISOString().slice(0, 16);
    } else {
        if (d) d.value = id;
        const origTs = document.getElementById('editLogIdPeg'); if (origTs) origTs.value = id;
        const origTime = document.getElementById('editLogOriginalTs'); if (origTime) origTime.value = ts;
        const editTime = document.getElementById('editLogTime'); if (editTime) editTime.value = new Date(ts).toISOString().slice(0, 16);
        const editStatus = document.getElementById('editLogStatus'); if (editStatus) editStatus.value = st;
        const editNilai = document.getElementById('editLogNilai'); if (editNilai) editNilai.value = ni;
    }
    openModal('logEditModal');
}

async function saveLogAction() {
    let p = { token };
    const id = document.getElementById('manualLogPegawai')?.value;
    const pg = [...(masterData.pegawai || []), ...(masterData.korlap || [])].find(x => String(x.id || x.ID) === String(id));

    if (logMode === 'add') {
        p.action = 'addLog';
        p.idPegawai = id;
        p.nama = pg?.nama || pg?.Nama;
        p.wilayah = pg?.wilayah || pg?.Wilayah;
        p.timestamp = document.getElementById('editLogTime')?.value;
        p.status = document.getElementById('editLogStatus')?.value;
        p.nilai = document.getElementById('editLogNilai')?.value;
    } else {
        p.action = 'editLog';
        p.idPegawai = id;
        p.originalTimestamp = document.getElementById('editLogOriginalTs')?.value;
        p.newTimestamp = document.getElementById('editLogTime')?.value;
        p.status = document.getElementById('editLogStatus')?.value;
        p.nilai = document.getElementById('editLogNilai')?.value;
    }

    setLoading(true, "Menyimpan Log...");
    try {
        await safeFetchJSON(API, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(p)
        }, 15000);
        closeModal('logEditModal');
        await loadLogs();
        showToast("Log disinkronisasi", "success");
    } catch (e) {
        showToast("Gagal: " + e.message, "error");
    } finally {
        setLoading(false);
    }
}

async function deleteLog(id, ts) {
    if (!confirm("Hapus log ini? File foto di Drive juga akan dihapus.")) return;
    setLoading(true, "Menghapus Log...");
    try {
        await safeFetchJSON(API, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'deleteLog', token, id, ts })
        }, 15000);
        await loadLogs();
        showToast("Log dihapus", "success");
    } catch (e) {
        showToast("Gagal: " + e.message, "error");
    } finally {
        setLoading(false);
    }
}

async function saveConfig() {
    const c = {};
    Object.keys(masterData.config || {}).forEach(k => {
        const el = document.getElementById('c-' + k);
        if (el) c[k] = el.value;
    });
    setLoading(true, "Menyimpan Pengaturan...");
    try {
        await safeFetchJSON(API, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'updateConfig', token, config: c })
        }, 15000);
        await loadDashboard(true);
        showToast("Pengaturan disimpan", "success");
    } catch (e) {
        showToast("Gagal: " + e.message, "error");
    } finally {
        setLoading(false);
    }
}

// ============ FILE HANDLING ============
function handleFile(input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    if (!file.type.startsWith('image/')) {
        showToast("Hanya file gambar yang diizinkan!", "error");
        input.value = '';
        return;
    }
    if (file.size > APP_CONFIG.MAX_FILE_SIZE_MB * 1024 * 1024) {
        showToast(`Ukuran file terlalu besar! Maksimal ${APP_CONFIG.MAX_FILE_SIZE_MB}MB.`, "error");
        input.value = '';
        return;
    }

    setLoading(true, "Mengompres Gambar...");
    const r = new FileReader();
    r.onload = e => {
        const img = new Image();
        img.onload = () => {
            const c = document.createElement('canvas');
            let w = img.width, h = img.height;
            if (w > APP_CONFIG.IMAGE_MAX_WIDTH) {
                h = h * (APP_CONFIG.IMAGE_MAX_WIDTH / w);
                w = APP_CONFIG.IMAGE_MAX_WIDTH;
            }
            c.width = w;
            c.height = h;
            const ctx = c.getContext('2d');

            const isPng = file.type === 'image/png';
            const isWebp = file.type === 'image/webp';
            const hasTransparency = isPng || isWebp;

            if (hasTransparency) {
                ctx.clearRect(0, 0, w, h);
                ctx.drawImage(img, 0, 0, w, h);
                base64Foto = c.toDataURL('image/png');
            } else {
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, w, h);
                ctx.drawImage(img, 0, 0, w, h);
                base64Foto = c.toDataURL('image/jpeg', APP_CONFIG.IMAGE_QUALITY);
            }

            const previewImg = document.getElementById('p-preview-img');
            if (previewImg) { previewImg.src = base64Foto; previewImg.style.display = 'block'; }
            const placeholder = document.getElementById('p-placeholder');
            if (placeholder) placeholder.style.display = 'none';
            setLoading(false);
        };
        img.onerror = () => { setLoading(false); showToast("Gagal memuat gambar", "error"); };
        img.src = e.target.result;
    };
    r.onerror = () => { setLoading(false); showToast("Gagal membaca file", "error"); };
    r.readAsDataURL(file);
}

// ============ UI HELPERS ============
function handleFabClick() {
    const a = document.querySelector('.b-nav-item.active');
    if (!a) return;
    const o = a.getAttribute('onclick') || '';
    if (o.includes("'pegawai'")) openPModal('pegawai');
    else if (o.includes("'korlap'")) openPModal('korlap');
    else if (o.includes("'tools'")) openToolModal();
    else if (o.includes("'logs'")) openLogModal('add');
} // END handleFabClick

function updateFabVisibility() {
    const f = document.getElementById('fabAdd');
    if (f) f.style.display = window.innerWidth <= 768 ? 'flex' : 'none';
} // END updateFabVisibility

window.addEventListener('resize', updateFabVisibility);

// ============================================================
// ✅ FINAL CHECKPOINT - HAPUS JIKA MASIH ADA ERROR
// ============================================================
// Jika error "Unexpected end of input" masih muncul, 
// tambahkan karakter ini di baris paling akhir:
// }}}}}}
// ============================================================
// END OF ADMIN.JS v2.3.0
// ============================================================
