/* ==========================================================
   ui.js
   UI Helper
========================================================== */

const UI = (() => {

    //--------------------------------------------------------
    // Loading
    //--------------------------------------------------------

    function showLoading() {

        const loading =
            document.getElementById("loadingOverlay");

        if (!loading) return;

        loading.style.display = "flex";
        loading.style.opacity = "1";

    }

    function hideLoading() {

        const loading =
            document.getElementById("loadingOverlay");

        if (!loading) return;

        loading.style.opacity = "0";

        setTimeout(() => {

            loading.style.display = "none";

        },500);

    }

    //--------------------------------------------------------
    // Modal
    //--------------------------------------------------------

    function openModal(id){

        const modal =
            document.getElementById(id);

        if(modal)
            modal.style.display="flex";

    }

    function closeModal(id){

        const modal =
            document.getElementById(id);

        if(modal)
            modal.style.display="none";

    }

    //--------------------------------------------------------
    // Toast
    //--------------------------------------------------------

    function toast(message){

        alert(message);

    }

    //--------------------------------------------------------
    // Confirm
    //--------------------------------------------------------

    function confirmBox(message){

        return confirm(message);

    }

    //--------------------------------------------------------
    // Export
    //--------------------------------------------------------

    return{

        showLoading,

        hideLoading,

        openModal,

        closeModal,

        toast,

        confirmBox

    };

})();
