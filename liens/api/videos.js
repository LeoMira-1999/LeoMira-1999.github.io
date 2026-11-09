// Vercel Function : dernières vidéos LONGUES de la chaîne, lues dans le flux RSS public de YouTube.
// Liste « UULF… » = onglet Vidéos de la chaîne, sans les Shorts. Une vidéo programmée n'y figure qu'à sa sortie.
// Réponse mise en cache 15 min par Vercel ; en cas d'échec la page garde videos.js.
const FEED = "https://www.youtube.com/feeds/videos.xml?playlist_id=UULF9cv4LeInVA1817MVWyA1dw";

function decode(s) {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'");
}

module.exports = async function handler(req, res) {
  try {
    const r = await fetch(FEED, { headers: { "user-agent": "budgettalk-liens" } });
    if (!r.ok) throw new Error("feed " + r.status);
    const xml = await r.text();
    const videos = [];
    for (const m of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
      const e = m[1];
      const id = (e.match(/<yt:videoId>([\w-]{11})<\/yt:videoId>/) || [])[1];
      const title = (e.match(/<title>([\s\S]*?)<\/title>/) || [])[1];
      const pub = (e.match(/<published>([^<]+)<\/published>/) || [])[1];
      const t = Date.parse(pub);
      if (id && title && !isNaN(t)) {
        videos.push({ id, title: decode(title).trim(), publishedAt: new Date(t).toISOString().replace(/\.\d{3}Z$/, "Z") });
      }
    }
    if (!videos.length) throw new Error("empty feed");
    res.setHeader("Cache-Control", "public, s-maxage=900, stale-while-revalidate=86400");
    res.status(200).json({ videos });
  } catch (err) {
    res.setHeader("Cache-Control", "no-store");
    res.status(502).json({ error: "feed unavailable" });
  }
};
