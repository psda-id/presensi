// ============ KONFIGURASI GLOBAL ============
const GITHUB_LOGO_URL = "https://raw.githubusercontent.com/tpopbwi/presensi-pusda/main/assets/logo.png";
const API_URL = "https://script.google.com/macros/s/AKfycbx9QYwnT9Be3vv7wlg1WAcrR-8rxBUvEM4gsPieUj7r19S8eZc-QLKRfxtnxNHxlmSsEQ/exec";
const FALLBACK_IMAGE = GITHUB_LOGO_URL;
const logsMap = new Map();
let fetchDebounceTimer = null;

// ============ PWA MANIFEST ============
try {
    const mf = { name:"E-PUSDA UPT Management", short_name:"E-PUSDA", start_url:"raport.html", scope:"./", display:"standalone", background_color:"#0d1b3e", theme_color:"#1e40af", icons:[{src:GITHUB_LOGO_URL,sizes:"192x192",type:"image/png"},{src:GITHUB_LOGO_URL,sizes:"512x512",type:"image/png",purpose:"any maskable"}] };
    const uri = 'data:application/manifest+json;base64,' + btoa(unescape(encodeURIComponent(JSON.stringify(mf))));
    const el = document.getElementById('pwaManifest');
    if (el) el.setAttribute('href', uri);
    else { const l = document.createElement('link'); l.rel='manifest'; l.href=uri; document.head.appendChild(l); }
} catch(e) { console.warn('Manifest init failed:', e); }

// ============ LAZY LOAD OBSERVER ============
const imageObserver = new IntersectionObserver((entries, obs) => {
    entries.forEach(en => { if (en.isIntersecting) { const img = en.target; if (img.dataset.src) img.src = img.dataset.src; img.classList.remove('lazy-img'); obs.unobserve(img); } });
}, { rootMargin: '200px' });

// ============ FETCH DENGAN TIMEOUT (FIXED RACE CONDITION) ============
function fetchWithTimeout(url, opts = {}, timeout = 15000) {
    // ✅ Buat controller lokal agar tidak saling membatalkan antar request
    const localController = new AbortController();
    const tid = setTimeout(() => localController.abort(new DOMException('Timeout ' + timeout + 'ms', 'AbortError')), timeout);
    return fetch(url, { ...opts, signal: localController.signal }).finally(() => clearTimeout(tid));
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
function getLocalDateString(d) { return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function getSmartUrl(url) { if (!url) return FALLBACK_IMAGE; if (url.includes("googleusercontent")) return url.split("=")[0]+"=s500"; if (url.includes("drive.google.com")) return url.replace("/view","/preview"); return url; }
function initFilters() { const now = new Date(), firstDay = new Date(now.getFullYear(), now.getMonth(), 1); document.getElementById('startD').value = getLocalDateString(firstDay); document.getElementById('endD').value = getLocalDateString(now); }

// ============ TOAST ============
function showToast(msg, type = 'info') {
    let c = document.getElementById('toastContainer');
    if (!c) { c = document.createElement('div'); c.id = 'toastContainer'; c.style.cssText = 'position:fixed;top:20px;right:20px;z-index:100000;display:flex;flex-direction:column;gap:10px;pointer-events:none;'; document.body.appendChild(c); }
    const t = document.createElement('div');
    const colors = { success:'#10b981', error:'#ef4444', warning:'#f59e0b', info:'#3b82f6' };
    const color = colors[type] || colors.info;
    t.style.cssText = `background:rgba(15,23,42,0.95);backdrop-filter:blur(15px);color:white;padding:14px 20px;border-radius:14px;border-left:4px solid ${color};box-shadow:0 10px 30px rgba(0,0,0,0.4);font-size:0.9rem;font-weight:600;max-width:380px;pointer-events:auto;animation:slideInRight 0.3s ease-out;`;
    t.innerHTML = `<div style="font-weight:800;text-transform:uppercase;font-size:0.7rem;color:${color};margin-bottom:4px;letter-spacing:1px">${type}</div><div>${msg}</div>`;
    c.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity 0.4s'; setTimeout(() => t.remove(), 400); }, 4000);
}

// ============ LOADING SKELETON ============
function toggleLoading(show) {
    const grid = document.getElementById('raportGrid');
    if (!grid) return;
    if (show) {
        let s = '';
        for (let i = 0; i < 6; i++) s += `<div class="skeleton-card"><div class="skel-top"><div class="skel-photo shimmer"></div><div class="skel-info"><div class="skel-line w-60 shimmer"></div><div class="skel-line w-40 shimmer"></div></div><div class="skel-grade shimmer"></div></div><div class="skel-body"><div class="skel-score shimmer"></div><div class="skel-stats"><div class="skel-stat-pill shimmer"></div><div class="skel-stat-pill shimmer"></div><div class="skel-stat-pill shimmer"></div><div class="skel-stat-pill shimmer"></div></div></div></div>`;
        grid.innerHTML = s;
    }
}

function buildReportUrl() {
    const start = document.getElementById('startD').value, end = document.getElementById('endD').value, reg = document.getElementById('wilF').value;
    const searchEl = document.getElementById('searchName'), search = searchEl ? searchEl.value.trim() : '';
    return `${API_URL}?action=getReportData&start=${start}&end=${end}&region=${encodeURIComponent(reg)}&detail=true&limit=9999&search=${encodeURIComponent(search)}`;
}

// ============ APP INIT ============
async function initApp() {
    lucide.createIcons(); initFilters();
    const printDate = document.getElementById('printDate');
    if (printDate) printDate.innerText = new Date().toLocaleDateString('id-ID', { day:'numeric', month:'long', year:'numeric' });
    setInterval(() => { const el = document.getElementById('liveClock'); if(el) el.innerText = new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'}); }, 1000);
    
    if (!document.getElementById('raport-toast-style')) {
        const style = document.createElement('style'); style.id = 'raport-toast-style';
        style.innerHTML = '@keyframes slideInRight{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}';
        document.head.appendChild(style);
    }
    
    logsMap.clear();
    triggerReportFetch();
    fetchDashboardDataInBackground();
    
    setTimeout(() => {
        const grid = document.getElementById('raportGrid');
        if (grid && grid.querySelector('.skeleton-card')) {
            console.warn('Safety net: Force hide skeleton');
            renderCards([]);
            showToast('Koneksi lambat. Menggunakan mode offline.', 'warning');
        }
    }, 12000);
}

// ============ FETCH REPORT ============
async function fetchReportDataInBackground(attempt = 1) {
    try {
        const result = await safeFetchJSON(buildReportUrl(), {}, 15000);
        if (result.status === 'success' || Array.isArray(result.data)) {
            renderCards(result.data || []);
            toggleLoading(false);
        } else {
            renderCards([]);
            toggleLoading(false);
        }
    } catch(e) {
        const isAbort = e.name === 'AbortError' || (e.message && e.message.includes('Timeout'));
        if (isAbort && attempt < 3) {
            showToast(`Koneksi lambat, mencoba ulang (${attempt}/3)...`, 'warning');
            setTimeout(() => fetchReportDataInBackground(attempt + 1), 1500);
            return;
        }
        if (!isAbort) showToast('Gagal memuat laporan: ' + e.message, 'error');
        else showToast('Koneksi timeout. Periksa jaringan Anda.', 'error');
        renderCards([]);
        toggleLoading(false);
    }
}

async function fetchDashboardDataInBackground() {
    try {
        const dashData = await safeFetchJSON(API_URL + "?action=getDashboardData", {}, 10000);
        if (dashData && dashData.config?.Logo) {
            const sl = document.getElementById('sidebarLogo'), pl = document.getElementById('printKopLogo');
            if(sl) sl.src = dashData.config.Logo; if(pl) pl.src = dashData.config.Logo;
        }
        if (dashData && Array.isArray(dashData.pegawai)) {
            const sel = document.getElementById('wilF');
            if (sel) {
                const currentOptions = Array.from(sel.options).map(o => o.value);
                const wilayahList = [...new Set(dashData.pegawai.map(p => p.Wilayah||p.wilayah).filter(w => w))];
                wilayahList.forEach(w => { if (!currentOptions.includes(w)) { const opt = document.createElement('option'); opt.value = w; opt.innerText = w; sel.appendChild(opt); } });
            }
        }
    } catch(e) { console.warn('Dashboard fetch gagal:', e.message); }
}

// ============ DEBOUNCE TRIGGER ============
function triggerReportFetch() {
    clearTimeout(fetchDebounceTimer);
    fetchDebounceTimer = setTimeout(() => {
        logsMap.clear();
        toggleLoading(true);
        fetchReportDataInBackground();
    }, 300);
}

// ============ CALENDAR BUILDER ============
function buildCalendarHTML(logs, startDateStr) {
    const startDate = new Date(startDateStr), year = startDate.getFullYear(), month = startDate.getMonth();
    const totalDays = new Date(year, month+1, 0).getDate();
    const firstDayDate = new Date(year, month, 1);
    let firstDayOfWeek = firstDayDate.getDay();
    firstDayOfWeek = (firstDayOfWeek === 0) ? 6 : firstDayOfWeek - 1;
    
    const logMap = {};
    (logs||[]).forEach(l => { const d = new Date(l.date); if(!isNaN(d)) logMap[d.getDate()] = l; });
    
    const frag = document.createDocumentFragment();
    const wrap = document.createElement('div'); wrap.className = 'calendar-wrapper';
    const header = document.createElement('div'); header.className = 'calendar-header';
    ['Sen','Sel','Rab','Kam','Jum','Sab','Min'].forEach(d => { const el = document.createElement('div'); el.textContent = d; header.appendChild(el); });
    wrap.appendChild(header);
    
    const grid = document.createElement('div'); grid.className = 'calendar-micro-grid';
    for (let i = 0; i < firstDayOfWeek; i++) { const el = document.createElement('div'); el.className = 'day-box'; el.style.visibility = 'hidden'; grid.appendChild(el); }
    
    // ✅ Tambahkan validasi dinamis
    const validStatuses = ['hadir','terlambat','terlambat ringan','terlambat berat','izin','sakit','dinas','qr','qr hadir','qr pulang','pulang','quick response','quick response 1','quick response 2','lupa pulang'];
    
    for (let i = 1; i <= totalDays; i++) {
        const currentDate = new Date(year, month, i);
        const dayOfWeek = currentDate.getDay();
        const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
        const log = logMap[i];
        const box = document.createElement('div');
        box.className = 'day-box';
        box.textContent = String(i).padStart(2,'0');
        
        if (log) {
            const status = (log.status||"").toLowerCase().trim();
            // ✅ Gunakan includes agar "Quick Response 1 (Hadir)" terdeteksi
            const isValid = validStatuses.includes(status) || status.includes('quick response') || status.includes('qr');
            
            if ((log.score > 0) || isValid) {
                box.style.background = log.color; box.style.borderColor = log.color; box.style.color = 'white';
                const ket = log.ket || log.keterangan || '-';
                const tooltip = document.createElement('div'); tooltip.className = 'day-tooltip';
                tooltip.innerHTML = `<div class="tooltip-status">${log.status||'-'}</div><div class="tooltip-nilai">Nilai: ${log.score||0}</div><div class="tooltip-ket">${ket}</div>`;
                box.appendChild(tooltip);
                if (isWeekend && !status.includes('qr') && !status.includes('quick')) box.classList.add('weekend');
            } else if (isWeekend) {
                box.classList.add('weekend');
            }
        } else {
            if (isWeekend) {
                box.classList.add('weekend');
            } else {
                box.style.background = '#fee2e2'; box.style.color = '#dc2626';
                const tooltip = document.createElement('div'); tooltip.className = 'day-tooltip';
                tooltip.innerHTML = '<div class="tooltip-status">Alpha (Tidak Hadir)</div><div class="tooltip-nilai">Nilai: 0</div>';
                box.appendChild(tooltip);
            }
        }
        grid.appendChild(box);
    }
    wrap.appendChild(grid);
    frag.appendChild(wrap);
    
    const temp = document.createElement('div'); temp.appendChild(frag);
    return temp.innerHTML;
}

// ============ RENDER CARDS ============
function renderCards(data) {
    const container = document.getElementById('raportGrid');
    if (!container) return;
    
    if (!data || !data.length) {
        container.innerHTML = `<div class="empty-state"><i data-lucide="file-x" size="48"></i><h3>Tidak Ada Data Kinerja</h3><p>Tidak ditemukan data presensi untuk periode dan wilayah yang dipilih.</p></div>`;
        const printGrid = document.getElementById('printGrid');
        if(printGrid) printGrid.innerHTML = '';
        lucide.createIcons();
        return;
    }
    
    data.sort((a, b) => (b.score||0) - (a.score||0));
    const fragment = document.createDocumentFragment();
    
    data.forEach(p => {
        const card = document.createElement('div');
        card.className = 'pegawai-card';
        card.dataset.pegawaiId = p.id || p.ID;
        const telatTotal = (p.stats?.telatRingan||0) + (p.stats?.telatBerat||0);
        const sidTotal = (p.stats?.izin||0) + (p.stats?.sakit||0) + (p.stats?.dinas||0) + (p.stats?.qrHadir||0) + (p.stats?.qrPulang||0);
        if (p.logs && p.logs.length > 0) logsMap.set(String(p.id||p.ID), p.logs);
        const scoreColor = (p.score||0) >= 75 ? 'var(--success)' : ((p.score||0) >= 60 ? 'var(--warning)' : 'var(--danger)');
        
        card.innerHTML = `<div class="card-top"><div class="photo-frame-pro"><img data-src="${getSmartUrl(p.foto)}" class="lazy-img" src="${FALLBACK_IMAGE}" onerror="this.src='${FALLBACK_IMAGE}'"></div><div class="id-group"><h3>${p.nama||'N/A'}</h3><p>${p.jabatan||'N/A'}</p><p>${p.wilayah||'N/A'}</p></div><div class="grade-badge">${p.grade||'-'}</div></div><div class="card-body"><div class="performance-main"><span>Kinerja Kumulatif</span><b>${p.score||0}</b><div class="progress-track"><div class="progress-fill" style="width:${Math.min(p.score||0,100)}%;background:${scoreColor}"></div></div></div><div class="stats-summary"><div class="stat-pill stat-hadir"><b>${p.stats?.hadir||0}</b><span>Hadir</span></div><div class="stat-pill stat-telat"><b>${telatTotal}</b><span>Telat</span></div><div class="stat-pill stat-alpha"><b>${p.stats?.alpha||0}</b><span>Alpha</span></div><div class="stat-pill stat-sid"><b>${sidTotal}</b><span>S/I/D/QR</span></div></div></div><button class="detail-toggle-btn"><i data-lucide="chevron-down" size="14"></i> Detail Aktivitas Bulanan</button><div class="hidden-calendar-panel"></div>`;
        fragment.appendChild(card);
    });
    
    container.innerHTML = '';
    container.appendChild(fragment);
    document.querySelectorAll('.lazy-img').forEach(img => imageObserver.observe(img));
    lucide.createIcons();
    
    document.querySelectorAll('.detail-toggle-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const card = this.closest('.pegawai-card');
            toggleDetail(this, card, card.dataset.pegawaiId);
        });
    });
}

function toggleDetail(btn, card, pegawaiId) {
    const panel = card.querySelector('.hidden-calendar-panel');
    const isActive = panel.classList.toggle('active');
    if (isActive) {
        btn.innerHTML = '<i data-lucide="chevron-up" size="14"></i> Sembunyikan Aktivitas';
        const logs = logsMap.get(String(pegawaiId)) || [];
        const startDate = document.getElementById('startD').value;
        panel.innerHTML = buildCalendarHTML(logs, startDate);
    } else {
        btn.innerHTML = '<i data-lucide="chevron-down" size="14"></i> Detail Aktivitas Bulanan';
    }
    lucide.createIcons({ node: btn });
}

// ============ PRINT & PDF ============
window.onbeforeprint = () => { const pg = document.getElementById('printGrid'); if(pg) { pg.innerHTML = document.getElementById('raportGrid').innerHTML; lucide.createIcons(); } };
function openPDFGenerator() { const start = document.getElementById('startD').value, end = document.getElementById('endD').value, reg = document.getElementById('wilF').value; window.open(`generate-pdf.html?start=${start}&end=${end}&region=${encodeURIComponent(reg)}`, '_blank'); }

// ============ START ============
window.onload = initApp;
