/* ===========================================================
   api.js
   E-PUSDA Hybrid Architecture
   Frontend <-> Google Apps Script
=========================================================== */

const API = (() => {

    // ==========================================================
    // KONFIGURASI
    // ==========================================================

    const BASE_URL =
        "https://script.google.com/macros/s/AKfycbx9QYwnT9Be3vv7wlg1WAcrR-8rxBUvEM4gsPieUj7r19S8eZc-QLKRfxtnxNHxlmSsEQ/exec";

    // ==========================================================
    // PRIVATE
    // ==========================================================

    async function request(action, method = "GET", data = null) {

        try {

            let url = BASE_URL;

            const option = {
                method: method
            };

            if (method === "GET") {

                url += "?action=" + action;

            } else {

                option.headers = {
                    "Content-Type": "application/json"
                };

                option.body = JSON.stringify({
                    action,
                    ...data
                });

            }

            const response = await fetch(url, option);

            if (!response.ok) {

                throw new Error(
                    "HTTP Error " + response.status
                );

            }

            const json = await response.json();

            return json;

        } catch (err) {

            console.error("API Error :", err);

            throw err;

        }

    }

    // ==========================================================
    // DASHBOARD
    // ==========================================================

    async function getDashboard() {

        return await request(
            "getDashboardData",
            "GET"
        );

    }

    // ==========================================================
    // PRESENSI
    // ==========================================================

    async function getPegawai() {

        const data = await getDashboard();

        return data.pegawai || [];

    }

    async function submitPresensi(payload) {

        return await request(
            "submitPresensi",
            "POST",
            payload
        );

    }

    // ==========================================================
    // RAPORT
    // ==========================================================

    async function getRaport(id) {

        return await request(
            "getRaport&id=" + id,
            "GET"
        );

    }

    // ==========================================================
    // AGENDA
    // ==========================================================

    async function submitAgenda(payload) {

        return await request(
            "submitAgenda",
            "POST",
            payload
        );

    }

    // ==========================================================
    // WILAYAH
    // ==========================================================

    async function getWilayah() {

        return await request(
            "getWilayah",
            "GET"
        );

    }

    // ==========================================================
    // TOOLS
    // ==========================================================

    async function getTools() {

        const data = await getDashboard();

        return data.tools || [];

    }

    // ==========================================================
    // ADMIN
    // ==========================================================

    async function login(username, password) {

        return await request(
            "login",
            "POST",
            {
                username,
                password
            }
        );

    }

    async function savePegawai(data) {

        return await request(
            "savePegawai",
            "POST",
            data
        );

    }

    async function saveKorlap(data) {

        return await request(
            "saveKorlap",
            "POST",
            data
        );

    }

    async function saveTool(data) {

        return await request(
            "saveTool",
            "POST",
            data
        );

    }

    async function deletePegawai(id) {

        return await request(
            "deletePegawai",
            "POST",
            {
                id
            }
        );

    }

    async function deleteKorlap(id) {

        return await request(
            "deleteKorlap",
            "POST",
            {
                id
            }
        );

    }

    async function deleteTool(id) {

        return await request(
            "deleteTool",
            "POST",
            {
                id
            }
        );

    }

    // ==========================================================
    // EXPORT
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
