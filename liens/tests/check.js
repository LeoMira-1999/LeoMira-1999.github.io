#!/usr/bin/env node
/* Vérifie la page liens/index.html et fait les captures d'écran.
   Usage : node liens/tests/check.js <dossier-captures> [--og]
     --og : régénère d'abord liens/og.jpg (1200x630) depuis liens/tests/og-template.html
   Code de sortie non nul si une vérification échoue. */
"use strict";

const path = require("path");
const fs = require("fs");
const { pathToFileURL } = require("url");

function loadPlaywright() {
  try { return require("playwright"); } catch (e) { /* essai suivant */ }
  const root = require("child_process").execSync("npm root -g").toString().trim();
  return require(path.join(root, "playwright"));
}
const { chromium } = loadPlaywright();

const args = process.argv.slice(2);
const outDir = args.find((a) => !a.startsWith("--"));
const makeOg = args.includes("--og");
if (!outDir) {
  console.error("Usage : node liens/tests/check.js <dossier-captures> [--og]");
  process.exit(2);
}
fs.mkdirSync(outDir, { recursive: true });

const LIENS = path.resolve(__dirname, "..");
const PAGE_URL = pathToFileURL(path.join(LIENS, "index.html")).href;
const OG_URL = pathToFileURL(path.join(__dirname, "og-template.html")).href;
const OG_JPG = path.join(LIENS, "og.jpg");
const THUMB_HOST = "i.ytimg.com";

const VIEWPORTS = [[320, 640], [390, 844], [768, 1024], [1440, 900]];
const failures = [];
const thumbs = { ok: 0, failed: 0 };
let ignoredImageErrors = 0;

function check(cond, msg) {
  console.log((cond ? "  ok   " : "  FAIL ") + msg);
  if (!cond) failures.push(msg);
}

// Dimensions d'un JPEG (lecture du marqueur SOF)
function jpegSize(file) {
  const b = fs.readFileSync(file);
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xFF) { i++; continue; }
    const m = b[i + 1];
    if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) {
      return { w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) };
    }
    i += 2 + b.readUInt16BE(i + 2);
  }
  return { w: 0, h: 0 };
}

// Vérifie liens/videos.js avant tout (chargé dans Node, sans navigateur)
function validateData() {
  console.log("Données (videos.js) :");
  const vm = require("vm");
  const sandbox = { window: {} };
  try {
    vm.runInNewContext(fs.readFileSync(path.join(LIENS, "videos.js"), "utf8"), sandbox, { filename: "videos.js" });
  } catch (e) {
    check(false, "videos.js se charge sans erreur de syntaxe → " + e.message);
    return;
  }
  const data = sandbox.window.BT_DATA;
  if (!data || !Array.isArray(data.videos)) {
    check(false, "videos.js définit window.BT_DATA avec une liste « videos »");
    return;
  }
  check(typeof data.channelUrl === "string" && data.channelUrl.startsWith("https://"),
    "channelUrl commence par https://");
  const seen = new Set();
  const bad = [];
  data.videos.forEach((v, i) => {
    const name = `vidéo n°${i + 1}` + (v && v.id ? ` (id « ${v.id} »)` : "") + (v && v.title ? ` « ${v.title} »` : "");
    if (!v || typeof v !== "object") { bad.push(`${name} : ce n'est pas un bloc { ... }`); return; }
    if (typeof v.id !== "string" || !/^[\w-]{11}$/.test(v.id)) bad.push(`${name} : id invalide (11 caractères : lettres, chiffres, - ou _)`);
    else if (seen.has(v.id)) bad.push(`${name} : id en double`);
    else seen.add(v.id);
    if (typeof v.title !== "string" || !v.title.trim()) bad.push(`${name} : titre vide ou manquant`);
    if (typeof v.publishedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(v.publishedAt) || isNaN(Date.parse(v.publishedAt)))
      bad.push(`${name} : publishedAt doit être exactement au format "AAAA-MM-JJTHH:MM:SSZ" (ex. "2026-11-04T17:00:00Z"), reçu ${JSON.stringify(v.publishedAt)}`);
    if (v.type !== undefined && v.type !== "trailer") bad.push(`${name} : type doit être absent ou "trailer", reçu ${JSON.stringify(v.type)}`);
  });
  check(bad.length === 0, `${data.videos.length} vidéos : id, titre, date et type valides` + (bad.length ? "\n         → " + bad.join("\n         → ") : ""));
}

async function openPage(browser, viewport, opts = {}) {
  const context = await browser.newContext({
    viewport: { width: viewport[0], height: viewport[1] },
    deviceScaleFactor: opts.dpr || 1,
    javaScriptEnabled: opts.js !== false,
  });
  if (opts.now != null) {
    await context.addInitScript((t) => { Date.now = () => t; }, opts.now);
  }
  const page = await context.newPage();
  const errors = [];
  const foreign = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const url = (m.location() && m.location().url) || "";
    // Vignettes YouTube bloquées par le réseau (bac à sable) : signalé à part, pas une erreur de la page.
    if (url.includes(THUMB_HOST) && /Failed to load resource/.test(m.text())) { ignoredImageErrors++; return; }
    errors.push("console: " + m.text() + (url ? " (" + url + ")" : ""));
  });
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (u.protocol === "file:" || u.protocol === "data:") return;
    if (u.hostname !== THUMB_HOST) foreign.push(r.url());
  });
  page.on("response", (r) => {
    if (new URL(r.url()).hostname === THUMB_HOST) (r.ok() ? thumbs.ok++ : thumbs.failed++);
  });
  page.on("requestfailed", (r) => {
    if (new URL(r.url()).hostname === THUMB_HOST) thumbs.failed++;
  });
  await page.goto(PAGE_URL, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  return { context, page, errors, foreign };
}

async function layoutChecks(page, label) {
  const r = await page.evaluate(() => {
    const short = [];
    for (const a of document.querySelectorAll("a")) {
      const box = a.getBoundingClientRect();
      const st = getComputedStyle(a);
      const visible = box.width > 0 && box.height > 0 && st.visibility !== "hidden" && a.offsetParent !== null;
      if (visible && box.height < 44) short.push((a.textContent.trim() || a.href).slice(0, 40) + " = " + box.height.toFixed(1) + "px");
    }
    return {
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      short,
      links: document.querySelectorAll("a").length,
    };
  });
  check(r.scrollWidth <= r.innerWidth, `${label} : pas de défilement horizontal (scrollWidth ${r.scrollWidth} <= ${r.innerWidth})`);
  check(r.short.length === 0, `${label} : tous les liens visibles font au moins 44 px de haut` + (r.short.length ? " → " + r.short.join(" ; ") : ""));
}

async function featuredId(page) {
  return page.evaluate(() => {
    const a = document.querySelector("#featured a.featured");
    return a ? a.getAttribute("data-id") : null;
  });
}

async function run() {
  validateData();
  const browser = await chromium.launch();
  try {
    if (makeOg) {
      console.log("Image de partage :");
      const ctx = await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
      const p = await ctx.newPage();
      await p.goto(OG_URL, { waitUntil: "networkidle" });
      await p.evaluate(() => document.fonts.ready);
      await p.screenshot({ path: OG_JPG, type: "jpeg", quality: 88 });
      fs.copyFileSync(OG_JPG, path.join(outDir, "og.jpg"));
      await ctx.close();
      console.log("  écrit " + OG_JPG + " (" + Math.round(fs.statSync(OG_JPG).size / 1024) + " Ko)");
    }

    console.log("Mise en page (date réelle) :");
    for (const vp of VIEWPORTS) {
      const label = `${vp[0]}x${vp[1]}`;
      const { context, page, errors, foreign } = await openPage(browser, vp, { dpr: vp[0] < 720 ? 2 : 1 });
      await layoutChecks(page, label);
      check(errors.length === 0, `${label} : aucune erreur console` + (errors.length ? " → " + errors.join(" | ") : ""));
      check(foreign.length === 0, `${label} : aucune ressource tierce hors ${THUMB_HOST}` + (foreign.length ? " → " + foreign.join(", ") : ""));
      check(!!(await featuredId(page)), `${label} : une vidéo vedette est affichée`);
      await page.screenshot({ path: path.join(outDir, `liens-${label}.png`), fullPage: true });
      await context.close();
    }

    console.log("Publication programmée (date simulée) :");
    {
      const now = Date.parse("2026-10-27T12:00:00Z");
      const { context, page, errors } = await openPage(browser, [390, 844], { now, dpr: 2 });
      const hasV5 = await page.locator('a[href*="NhA47m7eIZU"]').count();
      check(hasV5 === 0, "2026-10-27T12:00Z : aucun lien vers NhA47m7eIZU (pas encore sortie)");
      const f = await featuredId(page);
      check(f === "PMAmL6JKdU0", `2026-10-27T12:00Z : vedette = PMAmL6JKdU0 (obtenu ${f})`);
      const others = await page.$$eval("#list-autres a", (as) => as.map((a) => a.getAttribute("data-id")));
      check(others.join(",") === "PMQ6nxE1nZ4,rflMStJonHs", `2026-10-27T12:00Z : autres vidéos dans l'ordre (obtenu ${others.join(",")})`);
      const trailer = await page.$$eval("#list-debut a", (as) => as.map((a) => a.getAttribute("data-id")));
      check(trailer.join(",") === "EPiG4bRcP_I", `2026-10-27T12:00Z : « Commence ici » = bande-annonce (obtenu ${trailer.join(",")})`);
      check(errors.length === 0, "2026-10-27T12:00Z : aucune erreur console" + (errors.length ? " → " + errors.join(" | ") : ""));
      await context.close();
    }
    {
      const now = Date.parse("2026-10-28T17:00:01Z");
      const { context, page, errors } = await openPage(browser, [390, 844], { now, dpr: 2 });
      const f = await featuredId(page);
      check(f === "NhA47m7eIZU", `2026-10-28T17:00:01Z : vedette = NhA47m7eIZU (obtenu ${f})`);
      const n = await page.locator('a[href*="NhA47m7eIZU"]').count();
      check(n === 1, `2026-10-28T17:00:01Z : un seul lien vers NhA47m7eIZU (obtenu ${n})`);
      check(errors.length === 0, "2026-10-28T17:00:01Z : aucune erreur console" + (errors.length ? " → " + errors.join(" | ") : ""));
      await layoutChecks(page, "390x844 après");
      await page.screenshot({ path: path.join(outDir, "liens-390x844-apres.png"), fullPage: true });
      await context.close();
    }

    console.log("Sans JavaScript :");
    {
      const { context, page } = await openPage(browser, [390, 844], { js: false });
      const txt = await page.evaluate(() => document.body.innerText);
      check(/Voir la chaîne YouTube/.test(txt), "sans JS : bouton principal visible");
      check(/Instagram/.test(txt) && /TikTok/.test(txt) && /Facebook/.test(txt), "sans JS : boutons réseaux visibles");
      check(/Toutes les vidéos sont sur/.test(txt), "sans JS : message de repli <noscript> visible");
      await context.close();
    }

    console.log("Image de partage :");
    if (fs.existsSync(OG_JPG)) {
      const s = jpegSize(OG_JPG);
      check(s.w === 1200 && s.h === 630, `og.jpg fait 1200x630 (obtenu ${s.w}x${s.h})`);
    } else {
      check(false, "og.jpg existe (lancer avec --og pour le créer)");
    }
  } finally {
    await browser.close();
  }

  console.log("");
  if (thumbs.failed && !thumbs.ok) {
    console.log(`Vignettes YouTube : NON chargées (${thumbs.failed} échecs réseau vers ${THUMB_HOST}, ${ignoredImageErrors} messages console ignorés). Le fond de remplacement est affiché.`);
  } else {
    console.log(`Vignettes YouTube : ${thumbs.ok} chargées, ${thumbs.failed} en échec.`);
  }
  console.log(`Captures dans : ${path.resolve(outDir)}`);
  if (failures.length) {
    console.log(`\n${failures.length} vérification(s) en échec.`);
    process.exit(1);
  }
  console.log("\nTout est bon.");
}

run().catch((e) => { console.error(e); process.exit(1); });
