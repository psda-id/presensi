/* ===========================================================
   dashboard.js | Dashboard Controller
=========================================================== */

const Dashboard = (() => {

    let dashboardData = {};

    //==========================================
    // INIT
    //==========================================
    async function init() {
        try {
            UI.showLoading();
            dashboardData = await API.getDashboard();
            
            renderLogo();
            renderHero();
            renderTools();
            renderLapkin();
            renderAgenda();
            startClock();
            
            UI.hideLoading();
        } catch (err) {
            console.error(err);
            UI.hideLoading();
            alert("Gagal mengambil data dashboard.");
        }
    }

    //==========================================
    // LOGO
    //==========================================
    function renderLogo() {
        const logo = dashboardData.config?.Logo || "assets/logo.png";
        const sidebar = document.getElementById("sidebarLogo");
        const splash = document.getElementById("splashBgLogo");

        if (sidebar) sidebar.src = logo;
        if (splash) splash.src = logo;
    }

    //==========================================
    // HERO
    //==========================================
    function renderHero() {
        if (!dashboardData.korlap) return;
        
        const hero = document.getElementById("heroImage");
        const title = document.getElementById("greetName");
        
        if (!hero) return;
        
        const data = dashboardData.korlap[0];
        title.innerHTML = `Selamat Datang,<br>${data.nama}`;
        hero.src = data.link_foto_profile || "assets/logo.png";
    }

    //==========================================
    // TOOLS
    //==========================================
    function renderTools() {
        const container = document.getElementById("mainTools");
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
                else if (tool.external) window.open(tool.external);
            };

            container.appendChild(card);
        });

        lucide.createIcons();
    }

    //==========================================
    // LAPKIN
    //==========================================
    function renderLapkin() {
        const container = document.getElementById("lapkinContainer");
        if (!container) return;

        container.innerHTML = "";
        if (!dashboardData.tools) return;

        dashboardData.tools.forEach(tool => {
            if (!tool.Nama) return;

            const card = document.createElement("div");
            card.className = "lapkin-card";
            card.innerHTML = `
                <div class="icon-box" style="background:${tool.Warna};">
                    <i data-lucide="${tool.Icon}"></i>
                </div>
                <span>${tool.Nama}</span>
            `;

            card.onclick = () => window.open(tool.Link_URL);
            container.appendChild(card);
        });

        lucide.createIcons();
    }

    //==========================================
    // AGENDA
    //==========================================
    function renderAgenda() {
        const select = document.getElementById("agnNama");
        if (!select) return;

        select.innerHTML = "";
        dashboardData.pegawai.forEach(item => {
            const option = document.createElement("option");
            option.value = item.ID;
            option.innerText = item.Nama;
            select.appendChild(option);
        });
    }

    //==========================================
    // CLOCK
    //==========================================
    function startClock() {
        setInterval(() => {
            const jam = document.getElementById("liveClock");
            if (!jam) return;
            jam.innerHTML = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
        }, 1000);
    }

    //==========================================
    // PUBLIC
    //==========================================
    return { init };

})();
