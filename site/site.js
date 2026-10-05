/* Site vitrine Borin'Old Cars : contenu lu dans les mêmes fichiers que l'application (app/data/).
   Pages internes par ancre : #sorties, #sortie-<id>, #voitures, #voiture-<id>, #albums, #album-<id>. */
(function () {
  "use strict";

  const DATA = "../app/data/";
  const $ = (s, root) => (root || document).querySelector(s);
  const $$ = (s, root) => [...(root || document).querySelectorAll(s)];
  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  // Chemins du type « app/garage/… » : relatifs à la racine du site.
  const asset = (u) => !u ? "" : /^(https?:|data:|\/)/i.test(u) ? u : "../" + u;
  const isUrl = (u) => /^https?:\/\//i.test(u || "");
  const cap = (x) => (x ? String(x).charAt(0).toUpperCase() + String(x).slice(1) : "");
  const link = (kind, id) => `#${kind}-${encodeURIComponent(id)}`;

  async function load(file) {
    try {
      const r = await fetch(DATA + file + ".json", { cache: "no-cache" });
      return r.ok ? await r.json() : {};
    } catch (e) {
      return {};
    }
  }

  const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  const DAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
  function parseDate(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || "");
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }
  function longDate(s) {
    const d = parseDate(s);
    return d ? `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}` : "";
  }
  const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const isPast = (ev) => parseDate(ev.date) < today();

  const carName = (v) => [v.marque, v.modele].filter(Boolean).join(" ") || "Véhicule";
  // Vitrine publique : prénom et initiale du nom.
  const owner = (v) => [v.prenom, v.nom ? v.nom.trim()[0] + "." : ""].filter(Boolean).join(" ");

  const CAR_ICON = '<svg class="car-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 15.5 5.6 10a2 2 0 0 1 1.9-1.4h9a2 2 0 0 1 1.9 1.4l1.6 5.5"/><rect x="3" y="13.5" width="18" height="4.5" rx="1.5"/><circle cx="7" cy="18.5" r="1.5"/><circle cx="17" cy="18.5" r="1.5"/></svg>';
  const SOCIAL = [
    ["facebook", "Facebook", '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="fill" d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.2H8v3h2.4V21z"/></svg>'],
    ["instagram", "Instagram", '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle class="fill" cx="17.2" cy="6.8" r="1.1"/></svg>'],
    ["tiktok", "TikTok", '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="fill" d="M16.4 3c.3 2.2 1.6 3.6 3.8 3.8v3c-1.4.1-2.6-.3-3.8-1.1v6.1c0 3.4-2.6 5.7-5.6 5.7-3.2 0-5.4-2.6-5.2-5.6.2-2.9 2.8-5.1 5.9-4.7v3.1c-1.4-.4-2.9.5-3 2-.1 1.4 1 2.4 2.3 2.4 1.4 0 2.3-1 2.3-2.5V3z"/></svg>'],
  ];

  // ---------- Données ----------
  const D = { cfg: {}, members: {}, events: [], albums: [], shop: {}, cars: [] };

  function prepare(cfg, members, events, photos, shop) {
    D.cfg = cfg; D.members = members; D.shop = shop;
    D.events = (events.events || []).filter((e) => !e.exemple && parseDate(e.date)).sort((a, b) => a.date.localeCompare(b.date));
    D.albums = (photos.albums || []).filter((a) => !a.exemple).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    const extra = cfg.photos_vehicules || {};
    D.cars = (members.vehicules || []).map((v) => Object.assign({}, v, { photo: extra[v.id] || v.photo }))
      // Comité d'abord (dans l'ordre de config.json), puis les voitures en photo, puis par nom.
      .sort((a, b) => rank(a) - rank(b) || (b.photo ? 1 : 0) - (a.photo ? 1 : 0) || carName(a).localeCompare(carName(b), "fr"));
  }

  const driveImg = (id, w) => `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w${w}`;
  const pics = (a) => (a.photos || []).map((u) => ({ thumb: u, full: u }))
    .concat((a.drive || []).map((id) => ({ thumb: driveImg(id, 400), full: driveImg(id, 1600) })));
  const eventOfAlbum = (a) => D.events.find((e) => a.evenement === e.id || (a.date && a.date === e.date));
  const albumOfEvent = (ev) => D.albums.find((a) => a.evenement === ev.id || (a.date && a.date === ev.date));
  function albumCover(a) {
    if (a.couverture) return asset(a.couverture);
    const ev = eventOfAlbum(a);
    if (ev && ev.image) return ev.image;
    const p = pics(a)[0];
    return p ? p.thumb : "";
  }

  // ---------- Éléments réutilisés ----------
  function eventCard(ev, isNext) {
    const past = isPast(ev);
    const form = !past && isUrl(ev.inscription) ? ev.inscription : "";
    const album = past && albumOfEvent(ev);
    const hours = [ev.heure, ev.fin].filter(Boolean).join(" – ");
    return `<article class="event${isNext ? " next" : ""}${past ? " past" : ""}">
      ${ev.ruban === "rose" ? '<span class="rose">Octobre rose</span>' : ""}
      ${ev.image ? `<a class="poster" href="${link("sortie", ev.id)}" tabindex="-1"><img src="${esc(ev.image)}" alt="Affiche : ${esc(ev.titre)}" loading="lazy" onerror="this.parentNode.remove()"></a>` : ""}
      <div class="body">
        <span class="date">${esc(longDate(ev.date))}</span>
        <h3><a href="${link("sortie", ev.id)}">${esc(ev.titre)}</a></h3>
        <div class="meta">${[hours, ev.lieu].filter(Boolean).map(esc).join(" · ")}</div>
        ${ev.prix ? `<div class="price">${esc(ev.prix)}</div>` : ""}
        <div class="actions">
          ${form ? `<a class="btn" href="${esc(form)}" target="_blank" rel="noopener">S'inscrire</a>` : ""}
          ${album ? `<a class="btn outline" href="${link("album", album.id)}">Voir les photos</a>` : ""}
          <a class="btn outline" href="${link("sortie", ev.id)}">Détails</a>
        </div>
      </div>
    </article>`;
  }

  // Fonction au comité (config.json → comite) : rang et intitulé.
  function roleOf(v) {
    const list = D.cfg.comite || [];
    const i = list.findIndex((r) => r.membre === v.slug);
    return i < 0 ? null : { rang: i, fonction: list[i].fonction };
  }
  const rank = (v) => { const r = roleOf(v); return r ? r.rang : 999; };

  function carCard(v) {
    const r = roleOf(v);
    return `<a class="car" href="${link("voiture", v.id)}" data-s="${esc([carName(v), v.version, v.couleur, v.annee, owner(v)].join(" ").toLowerCase())}" data-b="${esc((v.marque || "").trim().toLowerCase())}">
        <div class="ph">${v.photo ? `<img src="${esc(asset(v.photo))}" alt="${esc(carName(v))}" loading="lazy">` : CAR_ICON}</div>
        <div class="info">${r ? `<span class="role">${esc(r.fonction)}</span>` : ""}<strong>${esc(carName(v))}</strong><span>${[v.annee, owner(v)].filter(Boolean).map(esc).join(" · ")}</span></div>
      </a>`;
  }

  function albumCard(a) {
    const n = pics(a).length;
    const c = albumCover(a);
    return `<a class="album" href="${link("album", a.id)}">
        ${c ? `<img src="${esc(c)}" alt="" loading="lazy" onerror="this.remove()">` : ""}
        <div class="cap"><strong>${esc(a.titre)}</strong><span>${esc(longDate(a.date))}${n ? ` · ${n} photos` : ""}</span></div>
      </a>`;
  }

  // ---------- Visionneuse ----------
  const lb = $("#lightbox");
  const lbImg = $("img", lb);
  let lbList = [], lbIndex = 0;
  function showPhoto(i) {
    lbIndex = (i + lbList.length) % lbList.length;
    lbImg.src = lbList[lbIndex];
    $(".lb-count", lb).textContent = lbList.length > 1 ? `${lbIndex + 1} / ${lbList.length}` : "";
    $$(".lb-nav", lb).forEach((b) => { b.hidden = lbList.length < 2; });
  }
  function openPhotos(list, i) { lbList = list; showPhoto(i || 0); lb.hidden = false; document.body.classList.add("noscroll"); }
  function closePhoto() { lb.hidden = true; lbImg.src = ""; document.body.classList.remove("noscroll"); }
  lb.addEventListener("click", (e) => {
    if (e.target.closest(".lb-prev")) showPhoto(lbIndex - 1);
    else if (e.target.closest(".lb-next")) showPhoto(lbIndex + 1);
    else if (e.target !== lbImg) closePhoto();
  });
  document.addEventListener("keydown", (e) => {
    if (lb.hidden) return;
    if (e.key === "Escape") closePhoto();
    if (e.key === "ArrowLeft") showPhoto(lbIndex - 1);
    if (e.key === "ArrowRight") showPhoto(lbIndex + 1);
  });
  let touchX = null;
  lb.addEventListener("touchstart", (e) => { touchX = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener("touchend", (e) => {
    if (touchX == null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    touchX = null;
    if (Math.abs(dx) > 50 && lbList.length > 1) showPhoto(lbIndex + (dx < 0 ? 1 : -1));
  });

  // ---------- Accueil ----------
  function renderHome() {
    const { cfg, members } = D;
    if (cfg.slogan) $("[data-slogan]").textContent = cfg.slogan;
    if (cfg.email) {
      $$("[data-mail]").forEach((a) => {
        a.href = a.href.replace(/^mailto:[^?]*/, "mailto:" + cfg.email);
        if (a.hasAttribute("data-mail-text")) a.textContent = cfg.email;
      });
    }
    if (cfg.adresse) $("[data-adresse]").textContent = cfg.adresse;
    const r = cfg.reseaux || {};
    $("#social").innerHTML = SOCIAL.filter(([k]) => isUrl(r[k])).map(([k, label, icon]) =>
      `<a href="${esc(r[k])}" target="_blank" rel="noopener">${icon}<span>${label}</span></a>`).join("");

    const bySlug = new Map((members.members || []).map((m) => [m.slug, m]));
    $("#comite").innerHTML = (cfg.comite || []).map((c) => {
      const m = bySlug.get(c.membre);
      if (!m) return "";
      // Toutes ses voitures, chacune vers sa fiche.
      const cars = D.cars.filter((v) => v.slug === c.membre).sort((x, y) => carName(x).localeCompare(carName(y), "fr"));
      const list = cars.length ? cars.map((v) => `<li><a href="${link("voiture", v.id)}">${esc(carName(v))}</a></li>`).join("")
        : m.marque ? `<li>${esc(carName(m))}</li>` : "";
      return `<div class="member"><strong>${esc(m.prenom)} ${esc(m.nom)}</strong><span>${esc(c.fonction)}</span>${list ? `<ul class="member-cars">${list}</ul>` : ""}</div>`;
    }).join("");

    // Chiffres
    const year = new Date().getFullYear();
    const set = (k, v) => { const el = $(`[data-stat="${k}"]`); if (el) el.textContent = v; };
    set("membres", (members.members || []).length || "—");
    set("vehicules", D.cars.length || "—");
    set("sorties", D.events.filter((e) => e.date.startsWith(String(year))).length || "—");
    set("annee", year);
    const n = D.albums.reduce((t, a) => t + pics(a).length, 0);
    set("photos", n ? n.toLocaleString("fr-BE") : "—");

    // Agenda : prochaines sorties, sinon les dernières.
    const upcoming = D.events.filter((e) => !isPast(e));
    const list = upcoming.length ? upcoming.slice(0, 6) : D.events.slice(-3).reverse();
    $("#events").innerHTML = list.length
      ? (upcoming.length ? "" : '<p class="muted wide">Pas de sortie annoncée pour le moment. Nos dernières sorties :</p>') + list.map((ev, i) => eventCard(ev, upcoming.length && i === 0)).join("")
      : '<p class="muted">L\'agenda sera bientôt publié.</p>';

    // Garage : les voitures du comité (à défaut, les premières en photo).
    const comite = D.cars.filter(roleOf);
    $("#cars").innerHTML = (comite.length ? comite : D.cars.filter((v) => v.photo).slice(0, 8)).map(carCard).join("")
      + `<div class="more"><a class="btn outline" href="#voitures">Voir les voitures des membres</a></div>`;

    // Albums + quelques photos de la dernière sortie.
    $("#albums").innerHTML = D.albums.slice(0, 3).map(albumCard).join("");
    const last = D.albums.find((a) => pics(a).length);
    if (last) {
      const strip = document.createElement("div");
      strip.className = "strip";
      const list12 = pics(last).slice(0, 12);
      strip.innerHTML = list12.map((p, i) =>
        `<button data-i="${i}" aria-label="Agrandir la photo ${i + 1}"><img src="${esc(p.thumb)}" alt="" loading="lazy" onerror="this.parentNode.remove()"></button>`).join("");
      strip.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) openPhotos(list12.map((p) => p.full), +b.dataset.i); });
      $("#albums").after(strip);
    }

    // Boutique
    const shop = D.shop;
    if (isUrl(shop.commande)) $("#order").href = shop.commande;
    $("#shop-note").textContent = shop.note || "";
    $("#shop").innerHTML = (shop.articles || []).map((a) => `<div class="item">
        <div class="ph">${a.image ? `<img src="${esc(asset(a.image))}" alt="${esc(a.nom)}" loading="lazy">` : ""}</div>
        <div class="info"><strong>${esc(a.nom)}</strong>
          <span class="price">${typeof a.prix === "number" ? a.prix.toLocaleString("fr-BE") + " €" : esc(a.prix)}</span>
          ${(a.tailles || []).length ? `<span class="sizes">${a.tailles.map(esc).join(" · ")}</span>` : ""}
        </div>
      </div>`).join("");
  }

  // ---------- Pages ----------
  const back = (href, label) => `<a class="back" href="${href}">‹ ${esc(label)}</a>`;
  const notFound = (href, label, what) => `${back(href, label)}<p class="empty">${what} introuvable.</p>`;

  function pageEvents() {
    const upcoming = D.events.filter((e) => !isPast(e));
    const past = D.events.filter(isPast).reverse();
    return {
      title: "Agenda",
      html: `${back("#agenda", "Accueil")}
        <div class="page-head"><p class="kicker">Agenda</p><h1>Les sorties du club</h1>
        <p class="muted">Balades, rassemblements et expositions : toutes les dates de la saison.</p></div>
        <h2 class="list-title">À venir</h2>
        <div class="events">${upcoming.length ? upcoming.map((ev, i) => eventCard(ev, i === 0)).join("") : '<p class="muted wide">Pas de sortie annoncée pour le moment.</p>'}</div>
        ${past.length ? `<h2 class="list-title">Sorties passées</h2><div class="events">${past.map((ev) => eventCard(ev)).join("")}</div>` : ""}`,
    };
  }

  function pageEvent(id) {
    const ev = D.events.find((e) => e.id === id);
    if (!ev) return { title: "Sortie", html: notFound("#sorties", "Agenda", "Sortie") };
    const past = isPast(ev);
    const form = !past && isUrl(ev.inscription) ? ev.inscription : "";
    const album = albumOfEvent(ev);
    const hours = ev.heure ? (ev.fin ? `de ${ev.heure} à ${ev.fin}` : `à partir de ${ev.heure}`) : "";
    const maps = ev.lieu ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ev.lieu)}` : "";
    return {
      title: ev.titre,
      html: `${back("#sorties", "Agenda")}
        <article class="detail">
          ${ev.image ? `<button class="detail-poster" data-zoom="${esc(ev.image)}" aria-label="Agrandir l'affiche"><img src="${esc(ev.image)}" alt="Affiche : ${esc(ev.titre)}" onerror="this.parentNode.remove()"></button>` : ""}
          <div class="detail-body">
            ${ev.ruban === "rose" ? '<span class="pill rose-pill">Octobre rose</span>' : ""}
            ${past ? '<span class="pill">Sortie passée</span>' : ""}
            <h1>${esc(ev.titre)}</h1>
            <dl class="facts">
              <dt>Date</dt><dd>${esc(cap(longDate(ev.date)))}</dd>
              ${hours ? `<dt>Horaire</dt><dd>${esc(hours)}</dd>` : ""}
              ${ev.lieu ? `<dt>Lieu</dt><dd>${esc(ev.lieu)}${maps ? ` · <a href="${esc(maps)}" target="_blank" rel="noopener">Itinéraire</a>` : ""}</dd>` : ""}
              ${ev.prix ? `<dt>Prix</dt><dd>${esc(ev.prix)}</dd>` : ""}
            </dl>
            ${ev.description ? `<p class="story">${esc(ev.description).replace(/\n/g, "<br>")}</p>` : ""}
            <div class="actions">
              ${form ? `<a class="btn" href="${esc(form)}" target="_blank" rel="noopener">S'inscrire</a>` : ""}
              ${album ? `<a class="btn outline" href="${link("album", album.id)}">Voir les photos (${pics(album).length || "album"})</a>` : ""}
            </div>
          </div>
        </article>`,
      bind(root) {
        const z = $("[data-zoom]", root);
        if (z) z.addEventListener("click", () => openPhotos([z.dataset.zoom], 0));
      },
    };
  }

  function pageCars() {
    const byKey = new Map();
    D.cars.forEach((v) => { const b = (v.marque || "").trim(); if (b && !byKey.has(b.toLowerCase())) byKey.set(b.toLowerCase(), cap(b)); });
    const brands = [...byKey.entries()].sort((a, b) => a[1].localeCompare(b[1], "fr"));
    return {
      title: "Le garage",
      html: `${back("#garage", "Accueil")}
        <div class="page-head"><p class="kicker">Le garage</p><h1>Les voitures de nos membres</h1>
        <p class="muted">${D.cars.length} véhicules, des années 50 aux youngtimers.</p></div>
        <div class="search"><input id="q" type="search" placeholder="Rechercher une marque, un modèle…" aria-label="Rechercher une voiture"></div>
        <div class="chips" id="brands"><button class="chip on" data-b="">Toutes</button>${brands.map(([k, b]) => `<button class="chip" data-b="${esc(k)}">${esc(b)}</button>`).join("")}</div>
        <div class="cars" id="all-cars">${D.cars.map(carCard).join("")}</div>
        <p class="empty" id="nocar" hidden>Aucune voiture ne correspond.</p>`,
      bind(root) {
        let brand = "";
        const q = $("#q", root);
        const filter = () => {
          const t = q.value.trim().toLowerCase();
          let n = 0;
          $$(".car", root).forEach((c) => {
            const ok = (!brand || c.dataset.b === brand) && (!t || c.dataset.s.includes(t));
            c.hidden = !ok;
            if (ok) n++;
          });
          $("#nocar", root).hidden = n > 0;
        };
        q.addEventListener("input", filter);
        $("#brands", root).addEventListener("click", (e) => {
          const b = e.target.closest(".chip");
          if (!b) return;
          brand = b.dataset.b;
          $$(".chip", root).forEach((c) => c.classList.toggle("on", c === b));
          filter();
        });
      },
    };
  }

  function pageCar(id) {
    const v = D.cars.find((x) => x.id === id);
    if (!v) return { title: "Voiture", html: notFound("#voitures", "Garage", "Voiture") };
    const moteur = [
      v.moteur ? (/[,.]/.test(v.moteur) || +v.moteur < 20 ? v.moteur + " L" : v.moteur + " cm³") : "",
      v.cylindres ? v.cylindres + " cylindres" : "",
      v.puissance ? v.puissance + " ch" : "",
    ].filter(Boolean).join(" · ");
    const boite = [cap(v.boite), v.rapports ? v.rapports + " rapports" : ""].filter(Boolean).join(", ");
    const facts = [
      ["Année", v.annee], ["Couleur", cap(v.couleur)], ["Moteur", moteur],
      ["Carburant", cap(v.carburant)], ["Boîte", boite], ["Origine", cap(v.pays)], ["État", cap(v.etat)],
    ].filter((f) => f[1]);
    const autres = D.cars.filter((x) => x.slug && x.slug === v.slug && x.id !== v.id);
    return {
      title: carName(v),
      html: `${back("#voitures", "Garage")}
        <article class="detail car-detail">
          <div class="car-hero">${v.photo ? `<img src="${esc(asset(v.photo))}" alt="${esc(carName(v))}">` : CAR_ICON}</div>
          <div class="detail-body">
            <h1>${esc(carName(v))}</h1>
            ${v.version ? `<p class="version">${esc(v.version)}</p>` : ""}
            <p class="muted">Voiture de ${esc(owner(v))}, membre du club</p>
            ${facts.length ? `<dl class="facts">${facts.map((f) => `<dt>${f[0]}</dt><dd>${esc(f[1])}</dd>`).join("")}</dl>` : ""}
            ${v.histoire ? `<h2 class="list-title">Son histoire</h2><p class="story">${esc(v.histoire).replace(/\n/g, "<br>")}</p>` : ""}
          </div>
        </article>
        ${autres.length ? `<h2 class="list-title">Également dans son garage</h2><div class="cars">${autres.map(carCard).join("")}</div>` : ""}`,
    };
  }

  function pageAlbums() {
    return {
      title: "Photos",
      html: `${back("#photos", "Accueil")}
        <div class="page-head"><p class="kicker">En images</p><h1>Les albums photos</h1>
        <p class="muted">Les souvenirs de nos sorties.</p></div>
        ${D.albums.length ? `<div class="albums">${D.albums.map(albumCard).join("")}</div>` : '<p class="empty">Aucun album pour le moment.</p>'}`,
    };
  }

  function pageAlbum(id) {
    const a = D.albums.find((x) => x.id === id);
    if (!a) return { title: "Album", html: notFound("#albums", "Albums", "Album") };
    const list = pics(a);
    const ev = eventOfAlbum(a);
    const folder = a.dossier ? `https://drive.google.com/drive/folders/${encodeURIComponent(a.dossier)}` : "";
    return {
      title: a.titre,
      html: `${back("#albums", "Albums")}
        <div class="page-head"><p class="kicker">Album photos</p><h1>${esc(a.titre)}</h1>
        <p class="muted">${esc(cap(longDate(a.date)))}${list.length ? ` · ${list.length} photos` : ""}</p>
        ${ev ? `<p><a class="link" href="${link("sortie", ev.id)}">À propos de cette sortie ›</a></p>` : ""}</div>
        ${list.length ? `<div class="mosaic">${list.map((p, i) => `<button data-i="${i}" aria-label="Agrandir la photo ${i + 1}"><img src="${esc(p.thumb)}" alt="" loading="lazy" onerror="this.parentNode.remove()"></button>`).join("")}</div>`
          : folder ? `<p><a class="btn" href="${esc(folder)}" target="_blank" rel="noopener">Voir les photos sur Google Drive</a></p>`
          : '<p class="empty">Pas encore de photos dans cet album.</p>'}`,
      bind(root) {
        const full = list.map((p) => p.full);
        const m = $(".mosaic", root);
        if (m) m.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) openPhotos(full, +b.dataset.i); });
      },
    };
  }

  // ---------- Navigation ----------
  const ROUTES = [
    [/^sorties$/, pageEvents], [/^sortie-(.+)$/, pageEvent],
    [/^voitures$/, pageCars], [/^voiture-(.+)$/, pageCar],
    [/^albums$/, pageAlbums], [/^album-(.+)$/, pageAlbum],
  ];
  const main = $("main"), page = $("#page");
  const baseTitle = document.title;
  let ready = false;

  function route() {
    let h = location.hash.slice(1);
    try { h = decodeURIComponent(h); } catch (e) { /* ancre mal formée */ }
    for (const [re, fn] of ROUTES) {
      const m = re.exec(h);
      if (!m) continue;
      if (!ready) { main.hidden = true; page.hidden = false; page.innerHTML = '<div class="wrap"><p class="muted">Chargement…</p></div>'; return; }
      const p = fn(m[1]);
      page.innerHTML = `<div class="wrap">${p.html}</div>`;
      if (p.bind) p.bind(page);
      main.hidden = true;
      page.hidden = false;
      document.title = `${p.title} · Borin'Old Cars`;
      window.scrollTo(0, 0);
      return;
    }
    // Accueil (ou une de ses sections).
    const fromPage = !page.hidden;
    page.hidden = true;
    page.innerHTML = "";
    main.hidden = false;
    document.title = baseTitle;
    if (fromPage) {
      const target = h && document.getElementById(h);
      if (target) target.scrollIntoView(); else window.scrollTo(0, 0);
    }
  }
  window.addEventListener("hashchange", route);

  // ---------- Menu mobile ----------
  const menu = $("#menu"), menuBtn = $(".menu-btn");
  menuBtn.addEventListener("click", () => {
    const open = menu.classList.toggle("open");
    menuBtn.setAttribute("aria-expanded", open);
  });
  menu.addEventListener("click", (e) => {
    if (e.target.closest("a")) { menu.classList.remove("open"); menuBtn.setAttribute("aria-expanded", "false"); }
  });
  $("#year").textContent = new Date().getFullYear();

  route();
  Promise.all(["config", "members", "events", "photos", "boutique"].map(load)).then((all) => {
    prepare(...all);
    // Une partie en erreur n'empêche pas le reste de s'afficher.
    try { renderHome(); } catch (e) { console.error(e); }
    ready = true;
    route();
  });
})();
