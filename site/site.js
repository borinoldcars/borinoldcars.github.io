/* Site vitrine Borin'Old Cars : contenu lu dans les mêmes fichiers que l'application (app/data/). */
(function () {
  "use strict";

  const DATA = "../app/data/";
  const APP = "../";
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  // Chemins du type « app/garage/… » : relatifs à la racine du site.
  const asset = (u) => !u ? "" : /^(https?:|data:|\/)/i.test(u) ? u : "../" + u;
  const isUrl = (u) => /^https?:\/\//i.test(u || "");

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

  const carName = (v) => [v.marque, v.modele].filter(Boolean).join(" ") || "Véhicule";
  // Vitrine publique : prénom et initiale du nom.
  const owner = (v) => [v.prenom, v.nom ? v.nom.trim()[0] + "." : ""].filter(Boolean).join(" ");

  const SOCIAL = [
    ["facebook", "Facebook", '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="fill" d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.2H8v3h2.4V21z"/></svg>'],
    ["instagram", "Instagram", '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle class="fill" cx="17.2" cy="6.8" r="1.1"/></svg>'],
    ["tiktok", "TikTok", '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="fill" d="M16.4 3c.3 2.2 1.6 3.6 3.8 3.8v3c-1.4.1-2.6-.3-3.8-1.1v6.1c0 3.4-2.6 5.7-5.6 5.7-3.2 0-5.4-2.6-5.2-5.6.2-2.9 2.8-5.1 5.9-4.7v3.1c-1.4-.4-2.9.5-3 2-.1 1.4 1 2.4 2.3 2.4 1.4 0 2.3-1 2.3-2.5V3z"/></svg>'],
  ];

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

  // ---------- Visionneuse ----------
  const lb = $("#lightbox");
  function openPhoto(src) { lb.querySelector("img").src = src; lb.hidden = false; }
  function closePhoto() { lb.hidden = true; lb.querySelector("img").src = ""; }
  lb.addEventListener("click", closePhoto);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !lb.hidden) closePhoto(); });

  // ---------- Contenu ----------
  function renderConfig(cfg, members) {
    if (cfg.slogan) $("[data-slogan]").textContent = cfg.slogan;
    if (cfg.email) {
      document.querySelectorAll("[data-mail]").forEach((a) => {
        a.href = a.href.replace(/^mailto:[^?]*/, "mailto:" + cfg.email);
        if (a.hasAttribute("data-mail-text")) a.textContent = cfg.email;
      });
    }
    const r = cfg.reseaux || {};
    $("#social").innerHTML = SOCIAL.filter(([k]) => isUrl(r[k])).map(([k, label, icon]) =>
      `<a href="${esc(r[k])}" target="_blank" rel="noopener">${icon}<span>${label}</span></a>`).join("");

    const bySlug = new Map((members.members || []).map((m) => [m.slug, m]));
    const cars = members.vehicules || [];
    $("#comite").innerHTML = (cfg.comite || []).map((c) => {
      const m = bySlug.get(c.membre);
      if (!m) return "";
      const car = cars.find((v) => v.slug === c.membre) || m;
      return `<div class="member"><strong>${esc(m.prenom)} ${esc(m.nom)}</strong><span>${esc(c.fonction)}</span>${car.marque ? `<em>${esc(carName(car))}</em>` : ""}</div>`;
    }).join("");
  }

  function renderStats(members, events, photos) {
    const year = new Date().getFullYear();
    const set = (k, v) => { const el = document.querySelector(`[data-stat="${k}"]`); if (el) el.textContent = v; };
    set("membres", (members.members || []).length || "—");
    set("vehicules", (members.vehicules || []).length || "—");
    set("sorties", (events.events || []).filter((e) => (e.date || "").startsWith(String(year))).length || "—");
    set("annee", year);
    const n = (photos.albums || []).reduce((t, a) => t + (a.drive || []).length + (a.photos || []).length, 0);
    set("photos", n ? n.toLocaleString("fr-BE") : "—");
  }

  function renderEvents(events, photos) {
    const all = (events.events || []).filter((e) => !e.exemple && parseDate(e.date)).sort((a, b) => a.date.localeCompare(b.date));
    const t = today();
    let list = all.filter((e) => parseDate(e.date) >= t).slice(0, 6);
    const upcoming = list.length > 0;
    if (!upcoming) list = all.slice(-3).reverse();
    const albums = photos.albums || [];
    $("#events").innerHTML = list.length ? (upcoming ? "" : '<p class="muted" style="grid-column:1/-1">Pas de sortie annoncée pour le moment. Nos dernières sorties :</p>') + list.map((ev, i) => {
      const form = upcoming && isUrl(ev.inscription) ? ev.inscription : "";
      const album = albums.find((a) => a.evenement === ev.id || a.date === ev.date);
      const hours = [ev.heure, ev.fin].filter(Boolean).join(" – ");
      return `<article class="event${upcoming && i === 0 ? " next" : ""}">
        ${ev.ruban === "rose" ? '<span class="rose">Octobre rose</span>' : ""}
        ${ev.image ? `<div class="poster"><img src="${esc(ev.image)}" alt="Affiche : ${esc(ev.titre)}" loading="lazy" onerror="this.parentNode.remove()"></div>` : ""}
        <div class="body">
          <span class="date">${esc(longDate(ev.date))}</span>
          <h3>${esc(ev.titre)}</h3>
          <div class="meta">${[hours, ev.lieu].filter(Boolean).map(esc).join(" · ")}</div>
          ${ev.description ? `<p class="desc">${esc(ev.description).replace(/\n/g, "<br>")}</p>` : ""}
          ${ev.prix ? `<div class="price">${esc(ev.prix)}</div>` : ""}
          <div class="actions">
            ${form ? `<a class="btn" href="${esc(form)}" target="_blank" rel="noopener">S'inscrire</a>` : ""}
            ${!upcoming && album ? `<a class="btn outline" href="${APP}#/photos/${encodeURIComponent(album.id)}">Voir les photos</a>` : ""}
            <a class="btn outline" href="${APP}#/agenda/${encodeURIComponent(ev.id)}">Détails</a>
          </div>
        </div>
      </article>`;
    }).join("") : '<p class="muted">L\'agenda sera bientôt publié.</p>';
  }

  function renderGarage(members, cfg) {
    const extra = cfg.photos_vehicules || {};
    const cars = (members.vehicules || []).map((v) => Object.assign({}, v, { photo: extra[v.id] || v.photo }))
      .filter((v) => v.photo)
      .sort((a, b) => carName(a).localeCompare(carName(b), "fr"));
    const SHOW = 8;
    const card = (v, i) => `<a class="car" href="${APP}#/garage/${encodeURIComponent(v.id)}"${i >= SHOW ? " hidden" : ""}>
        <div class="ph"><img src="${esc(asset(v.photo))}" alt="${esc(carName(v))}" loading="lazy"></div>
        <div class="info"><strong>${esc(carName(v))}</strong><span>${esc(owner(v))}</span></div>
      </a>`;
    $("#cars").innerHTML = cars.map(card).join("");
    if (cars.length > SHOW) {
      const more = document.createElement("div");
      more.className = "more";
      more.innerHTML = `<button class="btn outline">Voir les ${cars.length} voitures</button>`;
      $("#cars").after(more);
      more.querySelector("button").addEventListener("click", () => {
        document.querySelectorAll("#cars .car[hidden]").forEach((c) => { c.hidden = false; });
        more.remove();
      });
    }
  }

  const driveImg = (id, w) => `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w${w}`;
  function renderAlbums(photos, events) {
    const evs = events.events || [];
    const albums = (photos.albums || []).slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    const pics = (a) => (a.photos || []).map((u) => ({ thumb: u, full: u }))
      .concat((a.drive || []).map((id) => ({ thumb: driveImg(id, 400), full: driveImg(id, 1600) })));
    const cover = (a) => {
      if (a.couverture) return asset(a.couverture);
      const ev = evs.find((e) => a.evenement === e.id || (a.date && a.date === e.date));
      if (ev && ev.image) return ev.image;
      const p = pics(a)[0];
      return p ? p.thumb : "";
    };
    $("#albums").innerHTML = albums.slice(0, 3).map((a) => {
      const n = pics(a).length;
      const c = cover(a);
      return `<a class="album" href="${APP}#/photos/${encodeURIComponent(a.id)}">
        ${c ? `<img src="${esc(c)}" alt="" loading="lazy" onerror="this.remove()">` : ""}
        <div class="cap"><strong>${esc(a.titre)}</strong><span>${esc(longDate(a.date))}${n ? ` · ${n} photos` : ""}</span></div>
      </a>`;
    }).join("");
    // Quelques photos de la dernière sortie, à agrandir sur place.
    const last = albums.find((a) => pics(a).length);
    if (last) {
      const strip = document.createElement("div");
      strip.className = "strip";
      strip.innerHTML = pics(last).slice(0, 12).map((p, i) =>
        `<button data-full="${esc(p.full)}" aria-label="Agrandir la photo ${i + 1}"><img src="${esc(p.thumb)}" alt="" loading="lazy" onerror="this.parentNode.remove()"></button>`).join("");
      strip.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) openPhoto(b.dataset.full); });
      $("#albums").after(strip);
    }
  }

  function renderShop(shop) {
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

  Promise.all(["config", "members", "events", "photos", "boutique"].map(load)).then(([cfg, members, events, photos, shop]) => {
    const steps = [
      () => renderConfig(cfg, members),
      () => renderStats(members, events, photos),
      () => renderEvents(events, photos),
      () => renderGarage(members, cfg),
      () => renderAlbums(photos, events),
      () => renderShop(shop),
    ];
    // Une section en erreur n'empêche pas les autres de s'afficher.
    steps.forEach((f) => { try { f(); } catch (e) { console.error(e); } });
  });
})();
