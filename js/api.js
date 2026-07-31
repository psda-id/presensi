/* ===========================================================
   api.js | E-PUSDA Hybrid Architecture
   Frontend <-> Google Apps Script
=========================================================== */

const API = (() => {

    // ==========================================================
    // KONFIGURASI
    // ==========================================================
    const BASE_URL = "https://script.google.com/macros/s/AKfycbx9QYwnT9Be3vv7wlg1WAcrR-8rxBUvEM4gsPieUj7r19S8eZc-QLKRfxtnxNHxlmSsEQ/exec";

    // ==========================================================
    // PRIVATE: Core Request Function
    // ==========================================================
    async function request(action, method = "GET", data = null) {
        try {
            let url = BASE_URL;
            const option = { method };

            if (method === "GET") {
                url += "?action=" + action;
            } else {
                option.headers = { "Content-Type": "application/json" };
                option.body = JSON.stringify({ action, ...data });
            }

            const response = await fetch(url, option);
            
            if (!response.ok) throw new Error("HTTP Error " + response.status);
            
            return await response.json();
        } catch (err) {
            console.error("API Error:", err);
            throw err;
        }
    }

    // ==========================================================
    // DASHBOARD
    // ==========================================================
    const getDashboard = () => request("getDashboardData", "GET");

    // ==========================================================
    // PRESENSI
    // ==========================================================
    const getPegawai = async () => (await getDashboard()).pegawai || [];
    const submitPresensi = (payload) => request("submitPresensi", "POST", payload);

    // ==========================================================
    // RAPORT
    // ==========================================================
    const getRaport = (id) => request("getRaport&id=" + id, "GET");

    // ==========================================================
    // AGENDA
    // ==========================================================
    const submitAgenda = (payload) => request("submitAgenda", "POST", payload);

    // ==========================================================
    // WILAYAH
    // ==========================================================
    const getWilayah = () => request("getWilayah", "GET");

    // ==========================================================
    // TOOLS
    // ==========================================================
    const getTools = async () => (await getDashboard()).tools || [];

    // ==========================================================
    // ADMIN
    // ==========================================================
    const login = (username, password) => request("login", "POST", { username, password });
    const savePegawai = (data) => request("savePegawai", "POST", data);
    const saveKorlap = (data) => request("saveKorlap", "POST", data);
    const saveTool = (data) => request("saveTool", "POST", data);
    const deletePegawai = (id) => request("deletePegawai", "POST", { id });
    const deleteKorlap = (id) => request("deleteKorlap", "POST", { id });
    const deleteTool = (id) => request("deleteTool", "POST", { id });

    // ==========================================================
    // EXPORT PUBLIC METHODS
    // ==========================================================
    return {
        getDashboard,
        getPegawai,
        getRaport,
        getWilayah,
        getTools,
        submitPresensi,
        submitAgenda,
        login,
        savePegawai,
        saveKorlap,
        saveTool,
        deletePegawai,
        deleteKorlap,
        deleteTool
    };

})();
