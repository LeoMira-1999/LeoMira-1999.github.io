/* Budget Talk · page de liens. Rendu des vidéos à partir de videos.js.
   Ne pas modifier pour ajouter une vidéo : tout se fait dans videos.js. */
(function () {
  "use strict";

  var featuredBox = document.getElementById("featured");
  var ID_RE = /^[\w-]{11}$/;
  var CHANNEL = "https://www.youtube.com/@BudgetTalk_FR";

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function fallback(channelUrl) {
    var p = el("p", "note", "Toutes les vidéos sont sur ");
    var a = el("a", null, "la chaîne YouTube");
    a.href = channelUrl || CHANNEL;
    a.rel = "noopener";
    p.appendChild(a);
    p.appendChild(document.createTextNode("."));
    featuredBox.appendChild(p);
  }

  // 1. Garde
  var data = window.BT_DATA;
  if (!data || !Array.isArray(data.videos)) {
    fallback();
    return;
  }
  var channelUrl = typeof data.channelUrl === "string" && data.channelUrl.indexOf("https://") === 0 ? data.channelUrl : CHANNEL;

  // 2. Vidéos publiées, plus récentes d'abord
  var now = Date.now();
  var published = data.videos.filter(function (v) {
    if (!v || typeof v.id !== "string" || !ID_RE.test(v.id)) return false;
    var t = Date.parse(v.publishedAt);
    return !isNaN(t) && t <= now;
  }).sort(function (a, b) {
    return Date.parse(b.publishedAt) - Date.parse(a.publishedAt);
  });

  // 3. Répartition
  var trailers = published.filter(function (v) { return v.type === "trailer"; });
  var videos = published.filter(function (v) { return v.type !== "trailer"; });
  var featured = videos[0];
  var others = videos.slice(1);

  function watchUrl(id) { return "https://www.youtube.com/watch?v=" + id; }
  function thumb(id, name) { return "https://i.ytimg.com/vi/" + id + "/" + name + ".jpg"; }

  // Vignette introuvable : on garde le fond de la carte (pas d'icône d'image cassée).
  function giveUp(img) {
    img.onerror = img.onload = null;
    if (img.parentNode) img.parentNode.classList.add("is-empty");
    img.hidden = true;
  }

  function title(v) { return String(v.title || "Vidéo Budget Talk"); }

  // 4–5. Carte vedette
  function renderFeatured(v) {
    var a = el("a", "card featured");
    a.href = watchUrl(v.id);
    a.rel = "noopener";
    a.setAttribute("data-id", v.id);

    var media = el("div", "media");
    var img = el("img");
    img.width = 1280;
    img.height = 720;
    img.alt = ""; // le titre est déjà dans le même lien
    img.decoding = "async";
    img.setAttribute("fetchpriority", "high");
    var triedHq = false;
    var toHq = function () {
      if (triedHq) return giveUp(img);
      triedHq = true;
      img.src = thumb(v.id, "hqdefault");
    };
    img.onerror = toHq;
    // YouTube renvoie parfois une image grise 120x90 au lieu d'une erreur.
    img.onload = function () { if (img.naturalWidth && img.naturalWidth <= 120) toHq(); };
    img.src = thumb(v.id, "maxresdefault");
    media.appendChild(img);
    media.appendChild(el("span", "play"));

    var body = el("div", "body");
    body.appendChild(el("h3", "title", title(v)));
    a.appendChild(media);
    a.appendChild(body);
    featuredBox.appendChild(a);
  }

  // Carte compacte
  function renderRow(v, label, sizes) {
    var li = el("li");
    var a = el("a", "card row");
    a.href = watchUrl(v.id);
    a.rel = "noopener";
    a.setAttribute("data-id", v.id);

    var media = el("div", "media");
    var img = el("img");
    img.width = 320;
    img.height = 180;
    img.alt = ""; // le titre est déjà dans le même lien
    img.loading = "lazy";
    img.decoding = "async";
    img.onerror = function () { giveUp(img); };
    // mqdefault (320x180) ; hqdefault (480x360, recadrée en 16/9) pour les grandes cartes
    img.srcset = thumb(v.id, "mqdefault") + " 320w, " + thumb(v.id, "hqdefault") + " 480w";
    img.sizes = sizes || "112px";
    img.src = thumb(v.id, "mqdefault");
    media.appendChild(img);

    var body = el("div", "body");
    if (label) body.appendChild(el("span", "label", label));
    body.appendChild(el("h3", "title", title(v)));

    var chev = el("span", "chev");
    chev.setAttribute("aria-hidden", "true");

    a.appendChild(media);
    a.appendChild(body);
    a.appendChild(chev);
    li.appendChild(a);
    return li;
  }

  function fill(sectionId, listId, items, label, sizes) {
    var section = document.getElementById(sectionId);
    var list = document.getElementById(listId);
    if (!items.length) { section.hidden = true; return; }
    items.forEach(function (v) { list.appendChild(renderRow(v, label, sizes)); });
    section.hidden = false;
  }

  if (featured) renderFeatured(featured);
  else if (!trailers.length) fallback(channelUrl);
  else featuredBox.parentNode.hidden = true;

  fill("sec-autres", "list-autres", others, null, "(min-width: 720px) 360px, 112px");
  fill("sec-debut", "list-debut", trailers, "Bande-annonce", "(min-width: 720px) 160px, 112px");
})();
