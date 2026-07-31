/* ===========================================================
   E-PUSDA app.js | Main Controller
=========================================================== */

"use strict";

const App = (() => {

    const GITHUB_LOGO_URL = "assets/logo.png";
    let appData = {};
    let slideIndex = 0;

    /* ===========================================================
       START APPLICATION
    =========================================================== */
    async function init() {
        try {
            UI.showLoading();
            initClock();
            bindModalEvents();
            
            // Ambil data dari API
            appData = await API.getDashboard();
            if (!appData) throw new Error("Dashboard data kosong.");

            // Render komponen
            renderLogo();
            renderTools();
            renderLapkin();
            renderAgenda();
            startHeroSlide();
            
            UI.hideLoading();
        } catch (err) {
            console.error("Init Error:", err);
            UI.hideLoading();
            alert("Gagal memuat aplikasi.");
        }
    }

    /* ===========================================================
       RENDER LOGO
    =========================================================== */
    function renderLogo() {
        const logo = appData.config?.Logo || GITHUB_LOGO_URL;
        const sidebar = document.getElementById("sidebarLogo");
        const splash = document.getElementById("splashBgLogo");

        if (sidebar) sidebar.src = logo;
        if (splash) splash.src = logo;
    }

    /* ===========================================================
       HERO SLIDER
    =========================================================== */
    function startHeroSlide() {
        updateHero();
        setInterval(updateHero, 6000);
    }

    function updateHero() {
        if (!appData.korlap || appData.korlap.length === 0) return;

        const person = appData.korlap[slideIndex % appData.korlap.length];
        const img = document.getElementById("heroPhoto");
        const title = document.getElementById("welcomeText");
        
        if (!img) return;

        title.innerHTML = `Selamat Datang,<br>${person.nama || 'Rekan PUSDA'}`;

        const url = person.link_foto_profile || person.Link_Foto_Profile || "";

        if (url.includes("googleusercontent")) {
            img.src = url.split("=")[0] + "=s500";
        } else {
            img.src = GITHUB_LOGO_URL;
        }

        img.onerror = () => { img.src = GITHUB_LOGO_URL; };
        slideIndex++;
    }

    /* ===========================================================
       RENDER TOOLS (Menu Dashboard)
    =========================================================== */
    function renderTools() {
        const container = document.getElementById("dashboardMenu");
        if (!container) return;

        const tools = [
            { nama: "E-Presensi", icon: "fingerprint", color: "#2563eb", url: "presensi.html" },
            { nama: "E-Raport", icon: "file-bar-chart", color: "#16a34a", url: "raport.html" },
            { nama: "Wilayah", icon: "map", color: "#ea580c", url: "wilayah.html" },
            { nama: "Agenda", icon: "calendar", color: "#7c3aed", modal: "agendaModal" },
            { nama: "LAPKIN", icon: "layers", color: "#0ea5e9", modal: "lapkinModal" },
            { nama: "SMOPI", icon: "activity", color: "#dc2626", external: "https://smopi.info/" }
        ];

        container.innerHTML = "";
        tools.forEach(tool => {
            const card = document.createElement("div");
            card.className = "tool-card";
            card.innerHTML = `
                <div class="tool-icon-box" style="background:${tool.color};">
                    <i data-lucide="${tool.icon}"></i>
                </div>
                <div class="tool-name">${tool.nama}</div>
            `;

            card.onclick = () => {
                if (tool.url) location.href = tool.url;
                else if (tool.modal) UI.openModal(tool.modal);
                else if (tool.external) window.open(tool.external, "_blank");
            };

            container.appendChild(card);
        });

        lucide.createIcons();
    }

    /* ===========================================================
       RENDER LAPKIN
    =========================================================== */
    function renderLapkin() {
        const container = document.getElementById("lapkinGrid");
        if (!container) return;

        container.innerHTML = "";
        if (!appData.tools) return;

        appData.tools.forEach(tool => {
            if (!tool.Nama) return;

            const card = document.createElement("div");
            card.className = "tool-card";
            card.innerHTML = `
                <div class="tool-icon-box" style="background:${tool.Warna};">
                    <i data-lucide="${tool.Icon}"></i>
                </div>
                <div class="tool-name">${tool.Nama}</div>
            `;

            card.onclick = () => window.open(tool.Link_URL, "_blank");
            container.appendChild(card);
        });

        lucide.createIcons();
    }

    /* ===========================================================
       RENDER AGENDA DROPDOWN
    =========================================================== */
    function renderAgenda() {
        const select = document.getElementById("pegawai");
        if (!select) return;

        select.innerHTML = "";
        if (appData.pegawai) {
            appData.pegawai.forEach(item => {
                const option = document.createElement("option");
                option.value = item.ID;
                option.innerText = item.Nama;
                select.appendChild(option);
            });
        }
    }

    /* ===========================================================
       LIVE CLOCK
    =========================================================== */
    function initClock() {
        updateClock();
        setInterval(updateClock, 1000);
    }

    function updateClock() {
        const el = document.getElementById("liveClock");
        if (!el) return;
        el.innerHTML = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
    }

    /* ===========================================================
       MODAL CONTROLS
    =========================================================== */
    function bindModalEvents() {
        document.querySelectorAll(".modal").forEach(modal => {
            modal.addEventListener("click", e => {
                if (e.target === modal) modal.style.display = "none";
            });
        });
    }

    /* ===========================================================
       PUBLIC EXPORTS
    =========================================================== */
    return { init };

})();
