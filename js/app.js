// ============================================================
// KONFIGURASI GLOBAL
// ============================================================
const GITHUB_LOGO_URL = "https://raw.githubusercontent.com/tpopbwi/presensi-pusda/main/assets/logo.png";
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx9QYwnT9Be3vv7wlg1WAcrR-8rxBUvEM4gsPieUj7r19S8eZc-QLKRfxtnxNHxlmSsEQ/exec";
let appData = { pegawai: [], korlap: [], tools: [], config: {} };
let slideIdx = 0;

// ============================================================
// INISIALISASI PWA MANIFEST (FIXED: start_url valid)
// ============================================================
const manifest = {
    "name": "E-PUSDA UPT Management",
    "short_name": "E-PUSDA",
    "start_url": "index.html",           // ✅ FIX: URL valid
    "scope": ".",
    "display": "standalone",
    "background_color": "#0d1b3e",
    "theme_color": "#1e40af",
    "orientation": "any",
    "icons": [
        { "src": GITHUB_LOGO_URL, "sizes": "192x192", "type": "image/png" },
        { "src": GITHUB_LOGO_URL, "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
    ]
};

try {
    const manifestBlob = new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' });
    const manifestUrl = URL.createObjectURL(manifestBlob);
    const manifestEl = document.getElementById('pwaManifest');
    if (manifestEl) {
        manifestEl.setAttribute('href', manifestUrl);
    } else {
        // Fallback: buat element manifest dinamis
        const link = document.createElement('link');
        link.rel = 'manifest';
        link.href = manifestUrl;
        document.head.appendChild(link);
    }
} catch (e) {
    console.warn('Manifest init failed:', e);
}

// ============================================================
// FETCH DENGAN TIMEOUT (Anti hang)
// ============================================================
function fetchWithTimeout(url, options = {}, timeout = 15000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    return fetch(url, { ...options, signal: controller.signal })
        .finally(() => clearTimeout(id));
}

// ============================================================
// FUNGSI SEMBUNYIKAN SPLASH (DIPANGGIL SELALU)
// ============================================================
function hideSplashScreen() {
    const overlay = document.getElementById('loadingOverlay');
    if (!overlay) return;
    overlay.style.opacity = '0';
    setTimeout(() => {
        overlay.style.display = 'none';
    }, 1000);
}

// ============================================================
// START APP
// ============================================================
window.onload = () => {
    lucide.createIcons();
    fetchData();
    
    setInterval(() => { 
        const el = document.getElementById('liveClock');
        if (el) el.innerText = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }); 
    }, 1000);
    
    // ✅ SAFETY NET: Paksa splash hilang maksimal 8 detik
    setTimeout(() => {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay && overlay.style.display !== 'none' && overlay.style.opacity !== '0') {
            console.warn('Safety net: Force hide splash after 8s');
            hideSplashScreen();
        }
    }, 8000);
};

// ============================================================
// ✅ FETCH DATA (FIXED: Anti stuck, validasi JSON, fallback)
// ============================================================
async function fetchData() {
    try {
        const res = await fetchWithTimeout(SCRIPT_URL + '?action=getDashboardData', { 
            redirect: 'follow',
            cache: 'no-cache'
        }, 15000);
        
        // ✅ Validasi response HTTP
        if (!res.ok) {
            throw new Error(`HTTP Error ${res.status}`);
        }
        
        // ✅ Baca sebagai TEXT dulu, lalu parse manual
        // Ini mencegah SyntaxError jika GAS kembalikan HTML error
        const responseText = await res.text();
        
        if (!responseText || responseText.trim().length === 0) {
            throw new Error('Response kosong');
        }
        
        // Cek apakah response adalah HTML (error page dari Google)
        if (responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<html')) {
            throw new Error('Server mengembalikan HTML error, bukan JSON');
        }
        
        // Parse JSON dengan try-catch
        try {
            appData = JSON.parse(responseText);
        } catch (parseErr) {
            throw new Error('Gagal parse JSON: ' + parseErr.message);
        }
        
        // Validasi struktur data minimal
        if (typeof appData !== 'object' || appData === null) {
            appData = { pegawai: [], korlap: [], tools: [], config: {} };
        }
        
        // Setup logo
        const logoToUse = appData.config?.Logo || GITHUB_LOGO_URL;
        const sidebarLogo = document.getElementById('sidebarLogo');
        const splashBgLogo = document.getElementById('splashBgLogo');
        if (sidebarLogo) sidebarLogo.src = logoToUse;
        if (splashBgLogo) splashBgLogo.src = logoToUse;
        
        // Render dashboard
        renderMainDashboard();
        populateAgendaDropdown();
        startHeroSlide();
        
    } catch (err) { 
        console.error('Fetch Data Error:', err.message || err);
        
        // ✅ FALLBACK: Gunakan data kosong, jangan stuck
        appData = { pegawai: [], korlap: [], tools: [], config: {} };
        
        // Setup logo default
        const sidebarLogo = document.getElementById('sidebarLogo');
        const splashBgLogo = document.getElementById('splashBgLogo');
        if (sidebarLogo) sidebarLogo.src = GITHUB_LOGO_URL;
        if (splashBgLogo) splashBgLogo.src = GITHUB_LOGO_URL;
        
        // Tetap render dashboard dengan data kosong
        renderMainDashboard();
        populateAgendaDropdown();
        
        // Tampilkan notifikasi error kepada user
        showToastError('Koneksi Terputus', 'Gagal memuat data. Menggunakan mode offline.');
    } finally {
        // ✅ SELALU sembunyikan splash screen
        setTimeout(() => hideSplashScreen(), 2000);
    }
}

// ============================================================
// TOAST ERROR (NON-BLOCKING, tidak ganggu UX)
// ============================================================
function showToastError(title, message) {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed; bottom: 100px; left: 50%; transform: translateX(-50%);
        background: rgba(239, 68, 68, 0.95); color: white; padding: 14px 24px;
        border-radius: 16px; font-size: 0.85rem; font-weight: 700;
        z-index: 99999; box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        backdrop-filter: blur(10px); max-width: 90%; text-align: center;
        animation: slideUp 0.3s ease-out;
    `;
    toast.innerHTML = `<strong>${title}</strong><br><span style="opacity:0.85;font-weight:500;font-size:0.75rem;">${message}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.5s';
        setTimeout(() => toast.remove(), 500);
    }, 5000);
}

// ============================================================
// XSS PROTECTION
// ============================================================
function sanitizeHTML(str) {
    if (str === null || str === undefined) return "";
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
}

// ============================================================
// HERO SLIDER
// ============================================================
function startHeroSlide() {
    const update = () => {
        if (!appData.korlap || appData.korlap.length === 0) return;
        const p = appData.korlap[slideIdx % appData.korlap.length];
        const img = document.getElementById('heroImage');
        if (img) {
            const imgUrl = p.link_foto_profile || p.Link_Foto_Profile;
            img.src = (imgUrl && imgUrl.includes('googleusercontent.com')) ? imgUrl.split('=')[0] + '=s500' : GITHUB_LOGO_URL;
            img.onerror = function() { this.src = GITHUB_LOGO_URL; };
        }
        slideIdx++;
    };
    update(); 
    setInterval(update, 6000);
}

// ============================================================
// RENDER DASHBOARD MENU
// ============================================================
function renderMainDashboard() {
    const container = document.getElementById('mainTools');
    if (!container) return;
    
    const fullMenu = [
        { n: 'E-Presensi', i: 'fingerprint', c: '#2563eb', u: 'presensi.html' },
        { n: 'E-Raport', i: 'file-bar-chart', c: '#059669', u: 'raport.html' },
        { n: 'Maps', i: 'map', c: '#ea580c', u: 'wilayah.html' },
        { n: 'E-Agenda', i: 'calendar', c: '#7c3aed', m: 'agendaModal' },
        { n: 'Lapor', i: 'megaphone', c: '#db2777', ext: 'https://www.lapor.go.id/' },
        { n: 'Smopi', i: 'waves', c: '#dc2625', ext: 'https://smopi.info/' },
        { n: 'LAPKIN', i: 'layout-dashboard', c: '#10b981', m: 'lapkinModal' }
    ];
    
    container.innerHTML = fullMenu.map(item => `
        <div class="tool-card" onclick="${item.u ? `location.href='${item.u}'` : item.ext ? `window.open('${item.ext}','_blank')` : `openModal('${item.m}')`}">
            <div class="tool-icon-box" style="background:${item.c}"><i data-lucide="${item.i}"></i></div>
            <div class="tool-name">${sanitizeHTML(item.n)}</div>
        </div>
    `).join('');
    
    renderLapkinPortal();
    lucide.createIcons();
}

// ============================================================
// RENDER LAPKIN MODAL
// ============================================================
function renderLapkinPortal() {
    const container = document.getElementById('lapkinContainer');
    if (!container) return;
    
    const dbTools = (appData.tools || []).filter(t => {
        const name = t.Nama || t.nama || t['Nama Tool'] || t['nama tool'];
        return name && String(name).toLowerCase().trim() !== 'nama';
    }).map(t => ({
        n: t.Nama || t.nama || t['Nama Tool'] || t['nama tool'] || 'Tanpa Nama',
        i: t.Icon || t.icon || 'external-link',
        c: t.Warna || t.warna || '#333',
        l: t.Link_URL || t.link_url || t.URL || t.url || '#'
    }));

    if (dbTools.length === 0) { 
        container.innerHTML = `
            <div style="text-align:center; opacity:0.5; grid-column:1/-1; padding:30px;">
                <i data-lucide="database" size="32" style="margin-bottom:10px; opacity:0.5;"></i>
                <p>Belum ada data di sheet <b>TOOLS</b>.<br>
                Pastikan header kolom: <b>Icon, Nama, Warna, Link_URL</b></p>
            </div>`; 
        lucide.createIcons();
        return; 
    }

    container.innerHTML = dbTools.map(item => `
        <div class="lapkin-card" onclick="window.open('${item.l}','_blank')">
            <div class="icon-box" style="background:${item.c}"><i data-lucide="${item.i}"></i></div>
            <span>${sanitizeHTML(item.n)}</span>
        </div>
    `).join('');
    lucide.createIcons();
}

// ============================================================
// AGENDA FORM LOGIC
// ============================================================
function populateAgendaDropdown() {
    const s = document.getElementById('agnNama');
    if (!s) return;
    s.innerHTML = '<option value="" disabled selected>-- Pilih Personel --</option>';
    [...(appData.pegawai || []), ...(appData.korlap || [])].forEach(p => {
        const name = sanitizeHTML(p.nama || p.Nama);
        const id = p.id || p.ID;
        s.insertAdjacentHTML('beforeend', `<option value="${id}">${name}</option>`);
    });
}

function updateAgendaFields() {
    const id = document.getElementById('agnNama').value;
    const p = [...(appData.pegawai || []), ...(appData.korlap || [])].find(x => String(x.id || x.ID) === String(id));
    if (p) document.getElementById('agnJabatan').value = sanitizeHTML(p.jabatan || p.Jabatan || "Staff Operasional");
}

async function submitAgendaAction() {
    const btn = document.getElementById('btnSendAgenda');
    const id = document.getElementById('agnNama').value;
    const judul = document.getElementById('agnJudul').value;
    
    if (!id || !judul) return alert("Harap lengkapi Nama dan Judul Agenda!");

    const p = [...(appData.pegawai || []), ...(appData.korlap || [])].find(x => String(x.id || x.ID) === String(id));
    const payload = {
        action: 'submitAgenda', 
        idPegawai: id, 
        nama: p ? (p.nama || p.Nama) : '',
        jabatan: document.getElementById('agnJabatan').value,
        tanggal: document.getElementById('agnTanggal').value,
        jamDatang: document.getElementById('agnDatang').value,
        jamPulang: document.getElementById('agnPulang').value,
        agenda: judul,
        keterangan: document.getElementById('agnKet').value,
        foto: null 
    };

    const originalBtnText = btn.innerHTML;
    btn.disabled = true; 
    btn.innerHTML = '<i data-lucide="loader-2" class="spin" size="18"></i> MENGIRIM...';
    lucide.createIcons();

    const fileInput = document.getElementById('agnFoto');
    if (fileInput.files.length > 0) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            payload.foto = e.target.result;
            await sendAgendaRequest(payload, btn, originalBtnText);
        };
        reader.readAsDataURL(fileInput.files[0]);
    } else {
        await sendAgendaRequest(payload, btn, originalBtnText);
    }
}

async function sendAgendaRequest(payload, btn, originalBtnText) {
    try {
        const r = await fetchWithTimeout(SCRIPT_URL, { 
            method: 'POST', 
            body: JSON.stringify(payload) 
        }, 20000);
        
        const text = await r.text();
        let d;
        try {
            d = JSON.parse(text);
        } catch(e) {
            throw new Error('Response server tidak valid');
        }
        
        if (d.status === 'success') { 
            alert("Agenda berhasil terkirim!"); 
            closeModal('agendaModal'); 
            document.getElementById('agnNama').selectedIndex = 0;
            document.getElementById('agnJabatan').value = '';
            document.getElementById('agnTanggal').value = '';
            document.getElementById('agnDatang').value = '';
            document.getElementById('agnPulang').value = '';
            document.getElementById('agnJudul').value = '';
            document.getElementById('agnKet').value = '';
            document.getElementById('agnFoto').value = '';
        } else { 
            alert("Gagal mengirim: " + (d.message || 'Unknown error')); 
        }
    } catch(e) { 
        alert("Terjadi kesalahan jaringan: " + (e.message || 'Timeout')); 
    } finally {
        btn.disabled = false; 
        btn.innerHTML = originalBtnText; 
        lucide.createIcons();
    }
}

// ============================================================
// VOICE TO TEXT
// ============================================================
function startMic(tid, btn) {
    const S = window.SpeechRecognition || window.webkitSpeechRecognition; 
    if (!S) return alert("Browser Anda tidak mendukung fitur suara.");
    const r = new S(); 
    r.lang = 'id-ID';
    r.onstart = () => btn.classList.add('active');
    r.onresult = (e) => { 
        const txt = e.results[0][0].transcript; 
        const el = document.getElementById(tid); 
        if (el) el.value = (el.value ? el.value + ' ' : '') + txt;
    };
    r.onend = () => btn.classList.remove('active'); 
    r.onerror = () => btn.classList.remove('active');
    r.start();
}

// ============================================================
// MODAL CONTROLS
// ============================================================
function openModal(id) { 
    const el = document.getElementById(id);
    if (el) el.style.display = 'flex'; 
}
function closeModal(id) { 
    const el = document.getElementById(id);
    if (el) el.style.display = 'none'; 
}
