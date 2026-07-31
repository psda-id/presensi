/* ===========================================================
   E-PUSDA
   app.js
   Entry Point
=========================================================== */

"use strict";

/* ===========================================================
   GLOBAL
=========================================================== */

let appData = {};
let slideIndex = 0;

/* ===========================================================
   START APPLICATION
=========================================================== */

window.addEventListener("DOMContentLoaded", initApp);

async function initApp() {

    try {

        initLucide();

        initClock();

        initToday();

        bindModalEvents();

        await loadApplication();

    } catch (err) {

        console.error("Init Error :", err);

        hideLoading();

        alert("Gagal memuat aplikasi.");

    }

}

/* ===========================================================
   LOAD APPLICATION
=========================================================== */

async function loadApplication() {

    showLoading();

    appData = await fetchDashboardData();

    if (!appData) {

        throw new Error("Dashboard data kosong.");

    }

    setLogo();

    renderDashboard(appData);

    renderLapkin(appData);

    populateAgendaDropdown(appData);

    startHeroSlide();

    hideLoading();

}

/* ===========================================================
   HERO SLIDER
=========================================================== */

function startHeroSlide() {

    updateHero();

    setInterval(updateHero, 6000);

}

function updateHero() {

    if (!appData.korlap) return;

    if (appData.korlap.length === 0) return;

    const person = appData.korlap[
        slideIndex % appData.korlap.length
    ];

    const img = document.getElementById("heroImage");

    if (!img) return;

    const url =
        person.link_foto_profile ||
        person.Link_Foto_Profile ||
        "";

    if (url.includes("googleusercontent")) {

        img.src = url.split("=")[0] + "=s500";

    } else {

        img.src = GITHUB_LOGO_URL;

    }

    img.onerror = () => {

        img.src = GITHUB_LOGO_URL;

    };

    slideIndex++;

}

/* ===========================================================
   LOGO
=========================================================== */

function setLogo() {

    const logo =
        appData.config?.Logo ||
        GITHUB_LOGO_URL;

    const sidebar = document.getElementById("sidebarLogo");

    const splash = document.getElementById("splashBgLogo");

    if (sidebar) sidebar.src = logo;

    if (splash) splash.src = logo;

}

/* ===========================================================
   LOADING
=========================================================== */

function showLoading() {

    const overlay =
        document.getElementById("loadingOverlay");

    if (!overlay) return;

    overlay.style.display = "flex";

    overlay.style.opacity = "1";

}

function hideLoading() {

    const overlay =
        document.getElementById("loadingOverlay");

    if (!overlay) return;

    setTimeout(() => {

        overlay.style.opacity = "0";

        setTimeout(() => {

            overlay.style.display = "none";

        }, 1000);

    }, 1200);

}

/* ===========================================================
   LUCIDE
=========================================================== */

function initLucide() {

    if (window.lucide) {

        lucide.createIcons();

    }

}

function refreshIcons() {

    if (window.lucide) {

        lucide.createIcons();

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

    const el =
        document.getElementById("liveClock");

    if (!el) return;

    el.innerHTML = new Date().toLocaleTimeString(
        "id-ID",
        {

            hour: "2-digit",

            minute: "2-digit"

        }

    );

}

/* ===========================================================
   DEFAULT DATE
=========================================================== */

function initToday() {

    const input =
        document.getElementById("agnTanggal");

    if (!input) return;

    input.valueAsDate = new Date();

}

/* ===========================================================
   MODAL
=========================================================== */

function bindModalEvents() {

    document.querySelectorAll(".modal-overlay")
        .forEach(modal => {

            modal.addEventListener("click", e => {

                if (e.target === modal) {

                    modal.style.display = "none";

                }

            });

        });

}

function openModal(id) {

    const modal =
        document.getElementById(id);

    if (!modal) return;

    modal.style.display = "flex";

}

function closeModal(id) {

    const modal =
        document.getElementById(id);

    if (!modal) return;

    modal.style.display = "none";

}

/* ===========================================================
   UTILITIES
=========================================================== */

function sanitizeHTML(text) {

    if (text === null || text === undefined)

        return "";

    const div = document.createElement("div");

    div.textContent = text;

    return div.innerHTML;

}

function openExternal(url) {

    window.open(url, "_blank");

}

function goPage(url) {

    location.href = url;

}

/* ===========================================================
   DEBUG
=========================================================== */

function debug() {

    console.log(appData);

}

window.debug = debug;
window.openModal = openModal;
window.closeModal = closeModal;
