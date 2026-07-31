/* ==========================================================
   utils.js
========================================================== */

const Utils = (()=>{

    //----------------------------------------------------
    // Escape HTML
    //----------------------------------------------------

    function escape(text){

        if(text===null || text===undefined)
            return "";

        const div=document.createElement("div");

        div.textContent=text;

        return div.innerHTML;

    }

    //----------------------------------------------------
    // Format tanggal Indonesia
    //----------------------------------------------------

    function tanggal(date){

        return new Date(date)
            .toLocaleDateString(
                "id-ID",
                {
                    day:"2-digit",
                    month:"long",
                    year:"numeric"
                }
            );

    }

    //----------------------------------------------------
    // Format jam
    //----------------------------------------------------

    function jam(){

        return new Date()
            .toLocaleTimeString(
                "id-ID",
                {
                    hour:"2-digit",
                    minute:"2-digit"
                }
            );

    }

    //----------------------------------------------------
    // UUID
    //----------------------------------------------------

    function uuid(){

        return Date.now()+"-"+Math.random();

    }

    //----------------------------------------------------
    // Export
    //----------------------------------------------------

    return{

        escape,

        tanggal,

        jam,

        uuid

    };

})();
