/* Budget Talk · statistiques de clics (Vercel Web Analytics, sans cookie).
   Envoie un évènement « lien_clic » à chaque clic sur un lien sortant. */
(function () {
  "use strict";
  document.addEventListener("click", function (e) {
    try {
      var a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
      if (!a || typeof window.va !== "function") return;
      var h = a.href, cible = "autre", id;
      if (/youtube\.com\/watch/.test(h)) { cible = "video"; id = a.getAttribute("data-id") || ""; }
      else if (/youtube\.com\/@/.test(h)) cible = "chaine_youtube";
      else if (/instagram\.com/.test(h)) cible = "instagram";
      else if (/tiktok\.com/.test(h)) cible = "tiktok";
      else if (/facebook\.com/.test(h)) cible = "facebook";
      var data = { cible: cible };
      if (id) data.video = id;
      window.va("event", { name: "lien_clic", data: data });
    } catch (_) {}
  }, true);
})();
