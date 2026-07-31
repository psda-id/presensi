/* =====================================================
   auth.js
===================================================== */

const Auth = (() => {

    async function login(username, password) {
        const result = await API.login(username, password);
        
        if (result.status === "success") {
            localStorage.setItem("token", result.token);
            return true;
        }
        
        return false;
    }

    function logout() {
        localStorage.removeItem("token");
        location.href = "index.html";
    }

    function isLogin() {
        return localStorage.getItem("token") !== null;
    }

    return { login, logout, isLogin };

})();
