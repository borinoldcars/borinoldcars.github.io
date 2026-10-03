/* Borin'Old Cars — application du club (PWA statique, sans serveur). */
(function () {
  "use strict";

  const APP_VERSION = "3 oct. 2026 · 10";
  const DATA = "app/data/";
  const view = document.getElementById("view");
  const state = { config: null, events: null, members: null, photos: null, shop: null };

  // ---------- Utilitaires ----------
  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

  const store = {
    get(k, d) { try { const v = localStorage.getItem("boc_" + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("boc_" + k, JSON.stringify(v)); } catch (e) { /* stockage indisponible */ } },
    del(k) { try { localStorage.removeItem("boc_" + k); } catch (e) { /* idem */ } },
  };

  async function load(name) {
    if (state[name]) return state[name];
    const file = { config: "config", events: "events", members: "members", photos: "photos", shop: "boutique" }[name];
    try {
      const r = await fetch(DATA + file + ".json", { cache: "no-cache" });
      if (!r.ok) throw new Error(r.status);
      state[name] = await r.json();
    } catch (e) {
      state[name] = {};
    }
    return state[name];
  }

  function toast(msg) {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove("show"), 2400);
  }

  const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  function parseDate(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || "");
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }
  function today() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function longDate(s) {
    const d = parseDate(s);
    return d ? d.toLocaleDateString("fr-BE", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : s;
  }
  function fmtPrice(p) {
    const n = Number(p);
    return n > 0 ? n.toLocaleString("fr-BE", { style: "currency", currency: "EUR" }) : "Prix à confirmer";
  }

  const exBadge = (o) => (o && o.exemple ? ' <span class="badge ex">Exemple</span>' : "");

  const ICON = {
    car: '<svg viewBox="0 0 120 70" aria-hidden="true"><path d="M8 48c0-6 3-9 9-10l14-3 14-14c3-3 7-4 11-4h22c5 0 9 2 12 6l10 12 9 2c4 1 6 4 6 8v5c0 2-2 4-4 4h-8"/><path d="M38 56H28"/><path d="M90 56H44"/><circle cx="22" cy="55" r="8"/><circle cx="96" cy="55" r="8"/><path d="M48 35h50M66 19v16"/></svg>',
    photo: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="m4 18 5.5-5 4 3.5 2.5-2 4 3.5"/></svg>',
    shirt: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 4 4 6.5 5.5 11 7 10.3V20h10v-9.7l1.5.7L20 6.5 15.5 4a3.5 3.5 0 0 1-7 0z"/></svg>',
    cal: '<svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
    garage: '<svg viewBox="0 0 24 24"><path d="M4 15.5 5.6 10a2 2 0 0 1 1.9-1.4h9a2 2 0 0 1 1.9 1.4l1.6 5.5"/><rect x="3" y="13.5" width="18" height="4.5" rx="1.5"/><circle cx="7" cy="18.5" r="1.5"/><circle cx="17" cy="18.5" r="1.5"/></svg>',
    card: '<svg viewBox="0 0 24 24"><rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M6 15h5M6 11.5h3"/><rect x="14" y="9" width="4.5" height="4.5" rx=".5"/></svg>',
  };



  // ---------- Rendu des éléments ----------
  function eventItem(ev) {
    const d = parseDate(ev.date);
    const past = d && d < today();
    const meta = [ev.heure, ev.lieu].filter(Boolean).map(esc).join(" · ");
    const form = !past && formLink(ev);
    return `<div class="card event-card${past ? " past" : ""}"><a class="event" href="#/agenda/${encodeURIComponent(ev.id)}">
      <div class="datebox">
        <div class="m">${d ? MONTHS[d.getMonth()] : ""}</div>
        <div class="d">${d ? d.getDate() : "?"}</div>
        <div class="y">${d ? d.getFullYear() : ""}</div>
      </div>
      <div class="event-body">
        <h3>${esc(ev.titre)}${exBadge(ev)}</h3>
        <div class="event-meta">${meta}</div>
      </div>
      ${ev.image ? `<img class="event-thumb" src="${esc(ev.image)}" alt="Affiche" loading="lazy" onerror="this.remove()">` : ""}
    </a>${form ? `<a class="btn block event-cta" href="${esc(form)}" target="_blank" rel="noopener">S'inscrire</a>` : ""}</div>`;
  }

  // Lien d'inscription (formulaire Tally, Google Forms…) : uniquement une adresse web.
  function formLink(ev) { return /^https?:\/\//i.test(ev.inscription || "") ? ev.inscription : ""; }

  function carName(m) { return [m.marque, m.modele].filter(Boolean).join(" ") || "Véhicule"; }
  function carFullName(v) { return [carName(v), v.version && v.version.length <= 24 ? v.version : ""].filter(Boolean).join(" "); }
  const cap = (x) => (x ? String(x).charAt(0).toUpperCase() + String(x).slice(1) : x);

  // Fonction au sein du club (config.json → "comite"), dans l'ordre où le comité y est listé.
  function roleOf(m) {
    const list = (state.config && state.config.comite) || [];
    const i = list.findIndex((r) => r.membre === m.slug);
    return i < 0 ? null : { rang: i, fonction: list[i].fonction };
  }

  // ---------- Pages ----------
  async function pageHome() {
    const [cfg, evs] = await Promise.all([load("config"), load("events")]);
    const upcoming = (evs.events || []).filter((e) => { const d = parseDate(e.date); return d && d >= today(); })
      .sort((a, b) => a.date.localeCompare(b.date));
    const me = memberFromStore();
    return `
      <section class="hero">
        <h1>${esc(cfg.club || "Borin'Old Cars")}</h1>
        <p>${esc(cfg.slogan || "")}</p>
        <svg class="deco" viewBox="0 0 120 70" aria-hidden="true"><path d="M8 48c0-6 3-9 9-10l14-3 14-14c3-3 7-4 11-4h22c5 0 9 2 12 6l10 12 9 2c4 1 6 4 6 8v5c0 2-2 4-4 4h-8"/><path d="M90 56H44"/><circle cx="22" cy="55" r="8"/><circle cx="96" cy="55" r="8"/></svg>
      </section>

      <section class="section">
        <div class="section-head"><h2>Prochaine sortie</h2><a href="#/agenda">Tout l'agenda</a></div>
        ${upcoming.length ? eventItem(upcoming[0]) : '<div class="card empty">Aucune sortie programmée pour le moment.</div>'}
      </section>

      <section class="section">
        <div class="quick">
          <a class="card" href="#/carte">${ICON.card}${me ? "Ma carte" : "Ma carte de membre"}</a>
          <a class="card" href="#/garage">${ICON.garage}Le garage</a>
          <a class="card" href="#/photos">${ICON.photo}Photos</a>
          <a class="card" href="#/boutique">${ICON.shirt}Boutique</a>
        </div>
      </section>

      ${(cfg.liens || []).filter((l) => l.url).length ? `
      <section class="section">
        <h2>Liens</h2>
        <div class="btn-row">${cfg.liens.filter((l) => l.url).map((l) => `<a class="btn secondary" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.titre)}</a>`).join("")}</div>
      </section>` : ""}

      <section class="section small muted" id="install-hint"></section>
      <section class="section small muted app-version">
        Version ${APP_VERSION} · <button class="linkbtn" id="force-update">Mettre à jour l'application</button>
      </section>
    `;
  }

  function bindHome() {
    const b = document.getElementById("force-update");
    if (b) b.addEventListener("click", forceUpdate);
  }

  // Efface la copie hors ligne de l'app et recharge la dernière version depuis le site.
  // La carte de membre (gardée dans le stockage du navigateur) n'est pas effacée.
  async function forceUpdate() {
    toast("Mise à jour…");
    try {
      if (navigator.serviceWorker) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if (window.caches) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch (e) { /* on recharge quand même */ }
    location.replace(location.pathname + "?v=" + Date.now() + "#/");
  }

  async function pageAgenda() {
    const evs = (await load("events")).events || [];
    const showPast = store.get("agenda_past", false);
    const t = today();
    const list = evs.filter((e) => { const d = parseDate(e.date); return showPast ? d && d < t : !d || d >= t; })
      .sort((a, b) => showPast ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date));
    return `
      <div class="page-head"><h1>Agenda</h1><p>Balades, expos et réunions du club.</p></div>
      <div class="chips">
        <button class="chip${showPast ? "" : " on"}" data-past="0">À venir</button>
        <button class="chip${showPast ? " on" : ""}" data-past="1">Passés</button>
      </div>
      <div class="stack">${list.length ? list.map(eventItem).join("") : `<div class="card empty">${showPast ? "Aucun événement passé." : "Aucune sortie programmée pour le moment."}</div>`}</div>
    `;
  }
  function bindAgenda() {
    view.querySelectorAll("[data-past]").forEach((b) => b.addEventListener("click", () => {
      store.set("agenda_past", b.dataset.past === "1");
      render();
    }));
  }


  async function pageEvent(id) {
    await Promise.all([load("config"), load("photos")]);
    const ev = ((await load("events")).events || []).find((e) => e.id === id);
    if (!ev) return `<a class="back" href="#/agenda">‹ Agenda</a><div class="card empty">Événement introuvable.</div>`;
    const d = parseDate(ev.date);
    const past = d && d < today();
    const facts = [
      ["Date", longDate(ev.date)],
      ["Heure", [ev.heure, ev.fin].filter(Boolean).join(" – ")],
      ["Lieu", ev.lieu],
      ["Prix", ev.prix],
    ].filter((f) => f[1]);
    const mapLink = ev.lieu ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ev.lieu)}` : "";

    // L'inscription se fait uniquement sur le formulaire (Tally) noté dans le Sheet.
    const form = !past && formLink(ev);
    const inscription = past
      ? `<div class="card muted">Cet événement est terminé.</div>`
      : form ? `<a class="btn block" href="${esc(form)}" target="_blank" rel="noopener">S'inscrire</a>` : "";

    return `
      <a class="back" href="#/agenda">‹ Agenda</a>
      <h1>${esc(ev.titre)}${exBadge(ev)}</h1>
      <dl class="facts">${facts.map((f) => `<dt>${f[0]}</dt><dd>${esc(f[1])}</dd>`).join("")}</dl>
      ${ev.description ? `<p>${esc(ev.description).replace(/\n/g, "<br>")}</p>` : ""}
      <div class="btn-row" style="margin-bottom:20px">
        ${past ? "" : `<button class="btn secondary" id="ics">${ICON.cal.replace("<svg", '<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7"')} Ajouter à mon agenda</button>`}
        ${mapLink ? `<a class="btn secondary" href="${mapLink}" target="_blank" rel="noopener">Itinéraire</a>` : ""}
      </div>
      ${inscription}
      ${albumForEvent(ev) ? `<a class="btn block event-photos" href="#/photos/${encodeURIComponent(albumForEvent(ev).id)}">${ICON.photo.replace("<svg", '<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7"')} Voir les photos de l'événement</a>` : ""}
      ${ev.image ? `<button class="poster" id="poster" aria-label="Agrandir l'affiche"><img src="${esc(ev.image)}" alt="Affiche : ${esc(ev.titre)}" onerror="this.parentNode.remove()"></button>` : ""}
    `;
  }
  function bindEvent(id) {
    const ev = ((state.events || {}).events || []).find((e) => e.id === id);
    if (!ev) return;
    const ics = document.getElementById("ics");
    if (ics) ics.addEventListener("click", () => downloadIcs(ev));
    const poster = document.getElementById("poster");
    if (poster) poster.addEventListener("click", () => openLightbox([ev.image], 0));
  }

  function downloadIcs(ev) {
    const dt = ev.date.replace(/-/g, "");
    const time = (t) => (t && /^\d{1,2}[:h]\d{2}$/.test(t) ? t.replace("h", ":").padStart(5, "0").replace(":", "") + "00" : "");
    const start = time(ev.heure);
    const end = time(ev.fin);
    const icsEsc = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/[,;]/g, (c) => "\\" + c).replace(/\n/g, "\\n");
    let dates;
    if (start) {
      dates = [`DTSTART;TZID=Europe/Brussels:${dt}T${start}`];
      if (end) dates.push(`DTEND;TZID=Europe/Brussels:${dt}T${end}`);
    } else {
      const d = parseDate(ev.date); d.setDate(d.getDate() + 1);
      const next = d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0");
      dates = [`DTSTART;VALUE=DATE:${dt}`, `DTEND;VALUE=DATE:${next}`];
    }
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
    const ics = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Borin'Old Cars//App//FR", "BEGIN:VEVENT",
      `UID:${ev.id}@borinoldcars.github.io`, `DTSTAMP:${stamp}`, ...dates,
      `SUMMARY:${icsEsc(ev.titre)}`, ev.lieu ? `LOCATION:${icsEsc(ev.lieu)}` : "",
      ev.description ? `DESCRIPTION:${icsEsc(ev.description)}` : "",
      "END:VEVENT", "END:VCALENDAR",
    ].filter(Boolean).join("\r\n");
    const a = document.createElement("a");
    a.href = "data:text/calendar;charset=utf-8," + encodeURIComponent(ics);
    a.download = ev.id + ".ics";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  // Un véhicule par carte : data.vehicules (généré par build.py) ou, à défaut, le véhicule principal de chaque membre.
  function vehicles(data) {
    if (Array.isArray(data.vehicules)) return data.vehicules;
    return (data.members || []).filter((m) => m.marque || m.modele).map((m) => Object.assign({ id: m.slug }, m));
  }

  async function pageGarage() {
    await load("config");
    const vs = vehicles(await load("members")).slice()
      .sort((a, b) => {
        const ra = roleOf(a), rb = roleOf(b);
        if (ra || rb) return ra && rb ? ra.rang - rb.rang : ra ? -1 : 1;
        return (a.nom + " " + a.prenom).localeCompare(b.nom + " " + b.prenom, "fr");
      });
    const byKey = new Map();
    vs.forEach((v) => { const b = (v.marque || "").trim(); if (b && !byKey.has(b.toLowerCase())) byKey.set(b.toLowerCase(), b[0].toUpperCase() + b.slice(1)); });
    const brands = [...byKey.values()].sort((a, b) => a.localeCompare(b, "fr"));
    let featuredDone = false;
    return `
      <div class="page-head"><h1>Le garage</h1><p>${vs.length} véhicules de nos membres.</p></div>
      <div class="search"><input id="q" type="search" placeholder="Rechercher une marque, un modèle, un membre…" aria-label="Rechercher"></div>
      <div class="chips" id="brands"><button class="chip on" data-b="">Toutes</button>${brands.map((b) => `<button class="chip" data-b="${esc(b.toLowerCase())}">${esc(b)}</button>`).join("")}</div>
      <div class="grid" id="cars">
        ${vs.map((v) => {
          const r = roleOf(v);
          const featured = r && r.rang === 0 && !featuredDone;
          if (featured) featuredDone = true;
          return `
          <a class="card car${r ? " comite" : ""}${featured ? " featured" : ""}" href="#/garage/${encodeURIComponent(v.id)}" data-s="${esc([carName(v), v.version, v.couleur, v.annee, v.prenom, v.nom, r ? r.fonction : ""].join(" ").toLowerCase())}" data-b="${esc((v.marque || "").trim().toLowerCase())}">
            <div class="ph">${v.photo ? `<img src="${esc(v.photo)}" alt="${esc(carName(v))}" loading="lazy">` : ICON.car}</div>
            <div class="info">
              ${r ? `<span class="role">${esc(r.fonction)}</span>` : ""}
              <strong>${esc(carFullName(v))}</strong><span>${v.annee ? esc(v.annee) + " · " : ""}${esc(v.prenom)} ${esc(v.nom)}</span>
            </div>
          </a>`; }).join("")}
      </div>
      <div class="card empty" id="nocar" hidden>Aucun véhicule ne correspond.</div>
    `;
  }
  async function pageCar(id) {
    await load("config");
    const v = vehicles(await load("members")).find((x) => x.id === id);
    if (!v) return `<a class="back" href="#/garage">‹ Garage</a><div class="card empty">Véhicule introuvable.</div>`;
    const r = roleOf(v);
    const moteur = [
      v.moteur ? (/[,.]/.test(v.moteur) || +v.moteur < 20 ? v.moteur + " L" : v.moteur + " cm³") : "",
      v.cylindres ? v.cylindres + " cylindres" : "",
      v.puissance ? v.puissance + " ch" : "",
    ].filter(Boolean).join(" · ");
    const boite = [v.boite, v.rapports ? v.rapports + " rapports" : ""].filter(Boolean).join(", ");
    const facts = [
      ["Année", v.annee], ["Couleur", cap(v.couleur)], ["Moteur", moteur],
      ["Carburant", cap(v.carburant)], ["Boîte", cap(boite)], ["Origine", cap(v.pays)], ["État", cap(v.etat)],
    ].filter((f) => f[1]);
    const autres = vehicles(state.members).filter((x) => x.slug && x.slug === v.slug && x.id !== v.id);
    return `
      <a class="back" href="#/garage">‹ Garage</a>
      <div class="car-hero">${v.photo ? `<img src="${esc(v.photo)}" alt="${esc(carName(v))}">` : ICON.car}</div>
      <h1>${esc(carName(v))}${v.version ? ` <span class="muted" style="font-weight:400">${esc(v.version)}</span>` : ""}</h1>
      <p class="owner">${r ? `<span class="badge role-badge">${esc(r.fonction)}</span> ` : ""}${esc(v.prenom)} ${esc(v.nom)}</p>
      ${facts.length ? `<dl class="facts card">${facts.map((f) => `<dt>${f[0]}</dt><dd>${esc(f[1])}</dd>`).join("")}</dl>` : ""}
      ${v.histoire ? `<section class="section"><h2>Son histoire</h2><p class="story">${esc(v.histoire).replace(/\n/g, "<br>")}</p></section>` : ""}
      ${v.lien ? `<p><a class="btn secondary" href="${esc(v.lien)}" target="_blank" rel="noopener">Voir sur les réseaux</a></p>` : ""}
      ${autres.length ? `<section class="section"><h2>Aussi dans son garage</h2><div class="stack">${autres.map((x) => `<a class="card other-car" href="#/garage/${encodeURIComponent(x.id)}"><strong>${esc(carFullName(x))}</strong><span class="muted small">${esc(x.annee || "")}</span></a>`).join("")}</div></section>` : ""}
    `;
  }

  function bindGarage() {
    const q = document.getElementById("q");
    let brand = "";
    const apply = () => {
      const term = q.value.trim().toLowerCase();
      let n = 0;
      view.querySelectorAll(".car").forEach((c) => {
        const ok = (!term || c.dataset.s.includes(term)) && (!brand || c.dataset.b === brand);
        c.hidden = !ok; if (ok) n++;
      });
      document.getElementById("nocar").hidden = n > 0;
    };
    q.addEventListener("input", apply);
    view.querySelectorAll("#brands .chip").forEach((b) => b.addEventListener("click", () => {
      view.querySelectorAll("#brands .chip").forEach((x) => x.classList.toggle("on", x === b));
      brand = b.dataset.b;
      apply();
    }));
  }

  // Photos d'un album : liens d'images (« photos ») ou fichiers Google Drive partagés (« drive »).
  function albumPhotos(a) {
    const drive = (a.drive || []).map((id) => ({
      thumb: `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w480`,
      full: `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w1600`,
    }));
    return (a.photos || []).map((u) => ({ thumb: u, full: u })).concat(drive);
  }
  // Couverture d'un album : « couverture », sinon l'affiche de la sortie liée, sinon la première photo.
  function albumCover(a) {
    if (a.couverture) return a.couverture;
    const ev = ((state.events && state.events.events) || []).find((e) => a.evenement === e.id || (a.date && a.date === e.date));
    if (ev && ev.image) return ev.image;
    const list = albumPhotos(a);
    return list[0] ? list[0].thumb : "";
  }
  // Album lié à une sortie : même date (ou « evenement » = id de la sortie).
  function albumForEvent(ev) {
    return ((state.photos && state.photos.albums) || []).find((a) => a.evenement === ev.id || (a.date && a.date === ev.date));
  }

  async function pagePhotos() {
    await load("events");
    const albums = ((await load("photos")).albums || []).slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    return `
      <div class="page-head"><h1>Photos</h1><p>Les souvenirs de nos sorties.</p></div>
      ${albums.length ? `<div class="grid">${albums.map((a) => {
        const list = albumPhotos(a);
        const cover = albumCover(a);
        const n = list.length;
        return `<a class="card album" href="#/photos/${encodeURIComponent(a.id)}">
          <div class="cover">${cover ? `<img src="${esc(cover)}" alt="" loading="lazy" onerror="this.remove()">` : ICON.photo}</div>
          <div class="info"><strong>${esc(a.titre)}${exBadge(a)}</strong><span>${a.date ? esc(longDate(a.date)) : ""}${n ? ` · ${n} photo${n > 1 ? "s" : ""}` : ""}</span></div>
        </a>`;
      }).join("")}</div>` : '<div class="card empty">Aucun album pour le moment.</div>'}
    `;
  }

  async function pageAlbum(id) {
    const a = ((await load("photos")).albums || []).find((x) => x.id === id);
    if (!a) return `<a class="back" href="#/photos">‹ Photos</a><div class="card empty">Album introuvable.</div>`;
    const photos = albumPhotos(a);
    const folder = a.dossier ? `https://drive.google.com/drive/folders/${encodeURIComponent(a.dossier)}` : a.lien;
    return `
      <a class="back" href="#/photos">‹ Photos</a>
      <div class="page-head"><h1>${esc(a.titre)}${exBadge(a)}</h1><p>${a.date ? esc(longDate(a.date)) : ""}</p></div>
      ${folder ? `<p><a class="btn secondary" href="${esc(folder)}" target="_blank" rel="noopener">Ouvrir l'album dans Google Drive</a></p>` : ""}
      ${photos.length ? `<div class="mosaic">${photos.map((p, i) => `<button data-i="${i}" aria-label="Agrandir la photo ${i + 1}"><img src="${esc(p.thumb)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'"></button>`).join("")}</div>`
        : a.dossier ? `<iframe class="drive-folder" src="https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(a.dossier)}#grid" title="Photos : ${esc(a.titre)}" loading="lazy"></iframe>
        <p class="small muted">Touchez une photo pour l'ouvrir en grand.</p>`
        : '<div class="card empty">Pas encore de photos dans cet album.</div>'}
    `;
  }
  function bindAlbum(id) {
    const a = ((state.photos || {}).albums || []).find((x) => x.id === id);
    if (!a) return;
    const full = albumPhotos(a).map((p) => p.full);
    view.querySelectorAll(".mosaic button").forEach((b) => b.addEventListener("click", () => openLightbox(full, +b.dataset.i)));
  }
  function openLightbox(list, i) {
    const box = document.createElement("div");
    box.className = "lightbox";
    box.innerHTML = `<img alt=""><button class="close" aria-label="Fermer">×</button>${list.length > 1 ? '<button class="prev" aria-label="Précédente">‹</button><button class="next" aria-label="Suivante">›</button>' : ""}`;
    const img = box.querySelector("img");
    const show = () => { img.src = list[i]; };
    const move = (d) => { i = (i + d + list.length) % list.length; show(); };
    const close = () => { box.remove(); document.removeEventListener("keydown", onKey); };
    const onKey = (e) => { if (e.key === "Escape") close(); if (e.key === "ArrowLeft") move(-1); if (e.key === "ArrowRight") move(1); };
    box.addEventListener("click", (e) => {
      if (e.target.classList.contains("prev")) move(-1);
      else if (e.target.classList.contains("next")) move(1);
      else if (e.target !== img) close();
    });
    let x0 = null;
    box.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    box.addEventListener("touchend", (e) => {
      if (x0 == null) return;
      const dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 50) move(dx < 0 ? 1 : -1);
      x0 = null;
    });
    document.addEventListener("keydown", onKey);
    show();
    document.body.appendChild(box);
  }

  async function pageShop() {
    const shop = await load("shop");
    const items = shop.articles || [];
    const order = /^https?:\/\//i.test(shop.commande || "") ? shop.commande : "";
    const cta = order ? `<a class="btn block" href="${esc(order)}" target="_blank" rel="noopener">Commander</a>` : "";
    return `
      <div class="page-head"><h1>Boutique du club</h1><p>${esc(shop.note || "")}</p></div>
      ${items.length ? `<div class="grid shop-grid">${items.map((a) => `
        <div class="card product">
          <div class="ph">${a.image ? `<img src="${esc(a.image)}" alt="${esc(a.nom)}" width="600" height="600" decoding="async">` : ICON.shirt}</div>
          <div class="info">
            <strong>${esc(a.nom)}${exBadge(a)}</strong>
            <span class="price">${fmtPrice(a.prix)}</span>
            ${a.tailles && a.tailles.length ? `<span class="small muted">Tailles ${esc(a.tailles[0])} à ${esc(a.tailles[a.tailles.length - 1])}</span>` : ""}
          </div>
        </div>`).join("")}</div>` : '<div class="card empty">La boutique est vide pour le moment.</div>'}
      ${cta ? `<div class="shop-cta">${cta}<p class="small muted">Le bon de commande s'ouvre dans une nouvelle page.</p></div>` : ""}
    `;
  }

  // Carte de membre : le membre ouvre une fois son lien personnel (#/carte/<clé>).
  // La clé reste sur ce téléphone ; l'app ne publie que son empreinte (members.json → "cle").
  async function sha256(text) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  async function memberForKey(key) {
    if (!key || !window.crypto || !crypto.subtle) return null;
    const lock = await sha256(key);
    return ((state.members && state.members.members) || []).find((m) => m.cle && m.cle === lock) || null;
  }
  async function resolveMe() {
    store.del("member"); // ancien choix « par nom », abandonné
    state.me = await memberForKey(store.get("carte", null));
    return state.me;
  }
  function memberFromStore() { return state.me || null; }
  // « 2025-08-04 » -> « août 2025 » ; « 2026 » -> « 2026 »
  function sinceText(v) {
    const m = /^(\d{4})(?:-(\d{2}))?/.exec(v || "");
    if (!m) return "";
    return m[2] ? new Date(+m[1], +m[2] - 1, 1).toLocaleDateString("fr-BE", { month: "long", year: "numeric" }) : m[1];
  }

  async function pageCard(key) {
    const [cfg, data] = await Promise.all([load("config"), load("members")]);
    let invalid = false;
    if (key) {
      const m = await memberForKey(key);
      if (m) { store.set("carte", key); state.me = m; } else invalid = true;
      history.replaceState(null, "", "#/carte"); // la clé ne reste pas dans la barre d'adresse
    }
    const me = await resolveMe();
    if (!me) {
      const mail = esc(cfg.email || "borinoldcars@gmail.com");
      return `
        <div class="page-head"><h1>Ma carte de membre</h1></div>
        ${invalid ? '<div class="card" style="margin-bottom:12px"><span class="badge ko">Lien non reconnu</span> <span class="small">Ce lien de carte n\'est pas (ou plus) valide.</span></div>' : ""}
        <div class="card stack">
          <p>Votre carte s'ouvre avec le <strong>lien personnel</strong> que le club vous a envoyé.</p>
          <p>Ouvrez ce lien une fois sur ce téléphone : la carte y restera enregistrée, même sans connexion.</p>
          <p class="small muted">Pas reçu de lien ? Demandez-le à <a href="mailto:${mail}">${mail}</a>.</p>
        </div>
        <form class="card stack" id="key-form" style="margin-top:12px">
          <p><strong>La carte ne s'affiche pas ?</strong> Copiez le lien reçu par email et collez-le ici :</p>
          <input id="key-input" type="text" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="https://borinoldcars.github.io/#/carte/…" aria-label="Lien personnel de la carte">
          <button class="btn block" type="submit">Afficher ma carte</button>
          <p class="small" id="key-error" hidden><span class="badge ko">Lien non reconnu</span> Vérifiez que vous avez copié le lien en entier.</p>
        </form>`;
    }
    const myCars = vehicles(data).filter((v) => v.slug === me.slug);
    if (!myCars.length) myCars.push(me);
    const cot = { oui: ["ok", "Cotisation en ordre"], non: ["ko", "Cotisation non réglée"] }[me.cotisation] || ["na", "Cotisation à vérifier"];
    return `
      <div class="page-head"><h1>Ma carte de membre</h1></div>
      <div class="member-card">
        <div class="mc-head">
          <div class="mc-club"><img src="app/icons/logo.png" alt="" width="45" height="40">${esc(cfg.club || "Borin'Old Cars")}</div>
          <div class="mc-year">Membre ${esc(cfg.annee_carte || new Date().getFullYear())}</div>
        </div>
        <div class="mc-body">
          <div>
            <div class="mc-label">Membre</div>
            <div class="mc-name">${esc(me.prenom)}<br>${esc(me.nom)}</div>
            ${roleOf(me) ? `<div class="mc-role">${esc(roleOf(me).fonction)}</div>` : ""}
            <div class="mc-car">${myCars.map((v) => esc(carName(v)) + (v.annee ? " · " + esc(v.annee) : "")).join("<br>")}</div>
            ${(cfg.fondateurs || []).includes(me.slug) ? '<div class="mc-since">Membre fondateur</div>'
              : sinceText(me.depuis) ? `<div class="mc-since">Membre depuis ${esc(sinceText(me.depuis))}</div>` : ""}
            <span class="badge ${cot[0]}">${cot[1]}</span>
          </div>
          <a class="qr" href="members/${encodeURIComponent(me.slug)}.html" aria-label="Ouvrir ma fiche membre"><img src="qrs/${encodeURIComponent(me.slug)}.png" alt="QR code de vérification"></a>
        </div>
      </div>
      <p class="small muted" style="margin-top:14px">Présentez ce QR code lors des événements : il ouvre votre fiche officielle et l'état de votre cotisation.</p>
      <p class="small"><button class="linkbtn" id="forget">Retirer ma carte de ce téléphone</button></p>
    `;
  }
  function bindCard() {
    const form = document.getElementById("key-form");
    if (form) form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const m = /([0-9a-f]{20})/i.exec(document.getElementById("key-input").value || "");
      const me = m && await memberForKey(m[1].toLowerCase());
      if (!me) { document.getElementById("key-error").hidden = false; return; }
      store.set("carte", m[1].toLowerCase());
      state.me = me;
      render();
    });
    const forget = document.getElementById("forget");
    if (forget) forget.addEventListener("click", () => {
      store.del("carte");
      state.me = null;
      render();
    });
  }


  // ---------- Routeur ----------
  const routes = [
    [/^$/, "accueil", pageHome, bindHome],
    [/^agenda$/, "agenda", pageAgenda, bindAgenda],
    [/^agenda\/(.+)$/, "agenda", pageEvent, bindEvent],
    [/^garage$/, "garage", pageGarage, bindGarage],
    [/^garage\/(.+)$/, "garage", pageCar, null],
    [/^photos$/, "photos", pagePhotos, null],
    [/^photos\/(.+)$/, "photos", pageAlbum, bindAlbum],
    [/^boutique$/, "boutique", pageShop, null],
    [/^carte(?:\/(.+))?$/, "carte", pageCard, bindCard],
  ];

  let renderId = 0;
  async function render(keepScroll) {
    const id = ++renderId;
    const path = location.hash.replace(/^#\/?/, "").replace(/\/$/, "");
    let match = null;
    for (const r of routes) { const m = r[0].exec(path); if (m) { match = [r, m]; break; } }
    if (!match) { location.hash = "#/"; return; }
    const [[, tab, page, bind], m] = match;
    const arg = m[1] ? decodeURIComponent(m[1]) : undefined;
    await load("members");
    if (state.me === undefined) await resolveMe(); // carte enregistrée sur ce téléphone
    const html = await page(arg);
    if (id !== renderId) return;
    const y = window.scrollY;
    view.innerHTML = html;
    if (bind) bind(arg);
    document.querySelectorAll(".tabbar a").forEach((a) => a.classList.toggle("active", a.dataset.tab === tab));
    if (keepScroll) window.scrollTo(0, y); else window.scrollTo(0, 0);
    if (tab === "accueil") installHint();
  }

  // ---------- Installation (PWA) ----------
  let deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferredPrompt = e; installHint(); });
  function installHint() {
    const el = document.getElementById("install-hint");
    if (!el) return;
    const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;
    if (standalone) { el.innerHTML = ""; return; }
    if (deferredPrompt) {
      el.innerHTML = `<button class="btn secondary block" id="install">Installer l'application sur ce téléphone</button>`;
      document.getElementById("install").onclick = async () => { deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; installHint(); };
    } else if (/iphone|ipad|ipod/i.test(navigator.userAgent)) {
      el.innerHTML = `<div class="card">Pour installer l'application : touchez <strong>Partager</strong> puis <strong>« Sur l'écran d'accueil »</strong>.</div>`;
    } else {
      el.innerHTML = "";
    }
  }

  store.del("cart"); store.del("profil"); // anciennes données (panier, formulaires)
  window.addEventListener("hashchange", () => render());
  render();

  if ("serviceWorker" in navigator) {
    // Quand une nouvelle version de l'app prend la main, recharger une fois pour l'afficher.
    const hadController = !!navigator.serviceWorker.controller;
    let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (hadController && !reloaded) { reloaded = true; location.reload(); }
    });
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").then((r) => r.update()).catch(() => {}));
  }

  // Vérifie auprès du site si une version plus récente existe ; si oui, recharge l'app
  // (une seule tentative par version, pour ne jamais boucler).
  async function checkVersion() {
    try {
      const r = await fetch("app/version.json?t=" + Date.now(), { cache: "no-store" });
      const v = (await r.json()).version;
      if (!v || v === APP_VERSION) return;
      let tried = null;
      try { tried = sessionStorage.getItem("boc_reload_for"); } catch (e) { /* ignoré */ }
      if (tried === v) return;
      try { sessionStorage.setItem("boc_reload_for", v); } catch (e) { /* ignoré */ }
      if (navigator.serviceWorker && navigator.serviceWorker.getRegistration) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) await reg.update().catch(() => {});
      }
      if (window.caches) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      location.reload();
    } catch (e) { /* hors ligne : on garde la version actuelle */ }
  }
  window.addEventListener("load", checkVersion);

  // Au retour dans l'app (téléphone déverrouillé, app réouverte), relire les données à jour.
  let hiddenAt = 0;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { hiddenAt = Date.now(); return; }
    checkVersion();
    if (Date.now() - hiddenAt > 60000) {
      ["config", "events", "members", "photos", "shop"].forEach((k) => { state[k] = null; });
      state.me = undefined;
      render(true);
      if (navigator.serviceWorker && navigator.serviceWorker.getRegistration) {
        navigator.serviceWorker.getRegistration().then((r) => r && r.update()).catch(() => {});
      }
    }
  });
})();
