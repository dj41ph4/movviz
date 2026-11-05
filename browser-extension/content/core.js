// Widget Movviz injecté dans les pages de cinéma. Rendu dans un shadow DOM
// pour que ni le CSS du site hôte ni le nôtre ne se contaminent.
(() => {
  const t = (key, ...subs) => chrome.i18n.getMessage(key, subs) || key;

  const CSS = `
    :host { all: initial; display: block; }
    * { box-sizing: border-box; }
    .wrap {
      display: inline-flex; align-items: center; gap: 12px; flex-wrap: wrap;
      margin: 12px 0; padding: 10px 14px; border-radius: 18px;
      font-family: Inter, "Segoe UI", system-ui, sans-serif;
      font-size: 14px; line-height: 1.2; color: #f5f2eb;
      background: linear-gradient(135deg, #1b1e27, #0a0c15);
      border: 1px solid color-mix(in oklab, #b892ff 40%, #fff 8%);
      box-shadow: 0 0 0 1px rgba(116, 88, 232, .22), 0 12px 32px -10px rgba(116, 88, 232, .6);
    }
    .wrap.float { position: fixed; left: 16px; bottom: 16px; z-index: 2147483647; margin: 0; }
    .mark { width: 34px; height: 34px; flex: none; }
    .btn, .pill {
      display: inline-flex; align-items: center; gap: 8px; text-decoration: none;
      font: inherit; font-weight: 700; white-space: nowrap; cursor: pointer;
    }
    .btn {
      padding: 11px 20px; border-radius: 12px; border: 0; color: #211830; font-size: 14px;
      background: #e4d9ff;
      box-shadow: 0 8px 22px -10px rgba(184, 146, 255, .7);
      transition: transform .15s ease, filter .15s ease;
    }
    .btn:hover { transform: scale(1.05); background: #f0e9ff; }
    .btn:disabled { opacity: .6; cursor: default; transform: none; }
    .pill { padding: 7px 13px; border-radius: 999px; border: 1px solid; font-size: 12px; cursor: default; }
    a.pill { cursor: pointer; }
    .ok { color: #43e6a0; background: rgba(67, 230, 160, .15); border-color: rgba(67, 230, 160, .4); }
    .amber { color: #ffb84b; background: rgba(255, 184, 75, .15); border-color: rgba(255, 184, 75, .4); }
    .cyan { color: #b892ff; background: rgba(167, 123, 255, .15); border-color: rgba(167, 123, 255, .4); }
    .down { color: #ff5b78; background: rgba(255, 91, 120, .15); border-color: rgba(255, 91, 120, .4); }
    .dim { color: #aaa7bd; background: rgba(255, 255, 255, .08); border-color: rgba(255, 255, 255, .2); }
    svg { width: 16px; height: 16px; flex: none; }
    .spin { animation: spin .8s linear infinite; }
    .pulse { animation: pulse 1.6s ease-in-out infinite; }
    .pill.progress { position: relative; overflow: hidden; }
    .pill .bar {
      position: absolute; left: 0; bottom: 0; height: 3px; border-radius: 999px;
      background: linear-gradient(90deg, #7458e8, #b892ff); transition: width .6s ease;
    }
    .nf .skeleton { width: var(--size, 40px); height: var(--size, 40px); border-radius: 50%; }
    .skeleton { width: 170px; height: 40px; border-radius: 12px; background: rgba(255, 255, 255, .08); animation: pulse 1.4s ease-in-out infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes pulse { 50% { opacity: .45; } }
    /* Mode compact : un bouton rond posé dans la rangée d'actions du site hôte */
    .wrap.nf { display: inline-flex; margin: 0 0 0 .6em; padding: 0; gap: 0; background: none; border: 0; box-shadow: none; border-radius: 50%; vertical-align: middle; }
    .nf .round {
      position: relative; display: inline-flex; align-items: center; justify-content: center; flex: none;
      width: var(--size, 40px); height: var(--size, 40px); padding: 0; border-radius: 50%; cursor: pointer;
      border: 2px solid rgba(255, 255, 255, .5); background: rgba(42, 42, 42, .6); transition: border-color .15s ease, background .15s ease;
    }
    .nf .round:hover, .nf .round:focus-visible { border-color: #fff; background: rgba(255, 255, 255, .12); outline: none; }
    .nf .round:disabled { cursor: default; opacity: .7; }
    .nf .round .mark { width: 56%; height: 56%; }
    .nf .round svg { width: 50%; height: 50%; color: #fff; }
    .nf .dot { position: absolute; right: -1px; bottom: -1px; width: 11px; height: 11px; border-radius: 50%; border: 2px solid #181818; background: #b892ff; }
    .nf .dot.ok { background: #43e6a0; } .nf .dot.amber { background: #ffb84b; } .nf .dot.down { background: #ff5b78; }
    .nf .dot.pulse { animation: pulse 1.6s ease-in-out infinite; }
    @media (max-width: 480px) { .wrap.float { left: 8px; right: 8px; bottom: 8px; } }
  `;

  const ICONS = {
    download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>',
    loader: '<svg class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 3a9 9 0 109 9"/></svg>',
    alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v5m0 3.5v.01"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
    cog: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/></svg>',
  };

  const ERRORS = {
    unauthorized: "errUnauthorized",
    network: "errNetwork",
    blocked: "errBlocked",
    quota: "errQuota",
    not_found: "notFound",
    no_permission: "errNoPermission",
    outdated: "errOutdated",
  };

  const send = (message) => new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(message, (res) => resolve(chrome.runtime.lastError ? { ok: false, error: "network" } : res));
    } catch {
      resolve({ ok: false, error: "network" }); // extension rechargée : le contexte est orphelin
    }
  });

  let compact = false; // bouton rond discret (Netflix) au lieu du bandeau
  let host = null;
  let wrap = null;
  let token = 0; // invalide les réponses d'une page déjà quittée

  function unmount() {
    token++;
    clearTimeout(pollTimer);
    if (host) host.remove();
    host = wrap = null;
  }

  function create(placement) {
    unmount();
    host = document.createElement("div");
    host.id = "movviz-companion";
    const root = host.attachShadow({ mode: "closed" });
    const style = document.createElement("style");
    style.textContent = CSS;
    wrap = document.createElement("div");
    compact = !!placement.compact;
    wrap.className = "wrap" + (placement.mode === "float" ? " float" : "") + (compact ? " nf" : "");
    if (compact) {
      const h = placement.el.getBoundingClientRect().height;
      if (h >= 24 && h <= 72) wrap.style.setProperty("--size", Math.round(h) + "px");
    }
    root.append(style, wrap);
    if (placement.mode === "float") document.body.appendChild(host);
    else if (placement.where === "inside") placement.el.appendChild(host);
    else placement.el.insertAdjacentElement("afterend", host);
  }

  const el = (tag, className, html) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (html) node.innerHTML = html;
    return node;
  };

  function mark() {
    const img = el("img", "mark");
    img.src = chrome.runtime.getURL("icons/mark48.png");
    img.alt = "Movviz";
    return img;
  }

  const pill = (cls, icon, text, href) => {
    const node = el(href ? "a" : "span", `pill ${cls}`, `${icon}<span></span>`);
    node.lastChild.textContent = text;
    if (href) { node.href = href; node.target = "_blank"; node.rel = "noopener"; }
    return node;
  };

  const link = (cls, icon, text, href) => {
    const node = el("a", cls, `${icon}<span></span>`);
    node.lastChild.textContent = text;
    node.href = href; node.target = "_blank"; node.rel = "noopener";
    return node;
  };

  const button = (cls, icon, text) => {
    const node = el("button", `btn ${cls}`, `${icon}<span></span>`);
    node.type = "button";
    node.lastChild.textContent = text;
    return node;
  };

  function render(...nodes) {
    wrap.replaceChildren(mark(), ...nodes);
  }

  /** Bouton rond : l'état tient dans une pastille de couleur et une infobulle. */
  function round(title, dot, onClick, href) {
    const node = el(href ? "a" : "button", "round");
    node.appendChild(mark());
    node.title = title;
    node.setAttribute("aria-label", title);
    if (href) { node.href = href; node.target = "_blank"; node.rel = "noopener"; }
    else { node.type = "button"; node.addEventListener("click", onClick); }
    if (dot) node.appendChild(el("i", "dot " + dot));
    wrap.replaceChildren(node);
    return node;
  }

  function renderCompact(media, serverUrl) {
    const href = `${serverUrl}/title/${media.type}/${media.tmdbId}`;
    switch (media.status) {
      case "available": return round(t("btnOpen"), "ok", null, href);
      case "processing": return round(t("statusProcessing"), "pulse", null, href);
      case "pending": return round(t("statusPending"), "amber", null, href);
      default: {
        const btn = round(t("btnRequest"), "", async () => {
          const mine = token;
          btn.disabled = true;
          const res = await send({ type: "request", mediaType: media.type, tmdbId: media.tmdbId });
          if (mine !== token) return;
          if (!res.ok) return renderError(res.error);
          renderMedia(res.data.media || { ...media, status: "pending" }, res.serverUrl || serverUrl);
        });
      }
    }
  }

  function renderError(error) {
    if (compact) {
      const setup = error === "not_configured" || error === "unauthorized";
      const msg = setup ? t("btnSetup") : t(ERRORS[error] || "errGeneric");
      return round(msg, "down", () => send({ type: "openOptions" }));
    }
    render(pill(error === "not_found" ? "dim" : "down", ICONS.alert, t(ERRORS[error] || "errGeneric")));
  }

  let pollTimer = null;

  /** Tant que le titre n'est ni disponible ni inconnu, on suit son avancement. */
  function schedulePoll(media, serverUrl) {
    clearTimeout(pollTimer);
    if (media.status !== "processing" && media.status !== "pending") return;
    const mine = token;
    const delay = media.status === "processing" ? 2500 : 15000;
    pollTimer = setTimeout(async () => {
      if (mine !== token) return;
      if (document.hidden) return schedulePoll(media, serverUrl); // onglet masqué : on patiente
      const res = await send({ type: "lookup", query: { type: media.type, tmdbId: media.tmdbId } });
      if (mine !== token) return;
      if (res.ok) return renderMedia(res.data.media, res.serverUrl || serverUrl);
      schedulePoll(media, serverUrl); // erreur passagère : on réessaie
    }, delay);
  }

  function renderMedia(media, serverUrl) {
    schedulePoll(media, serverUrl);
    if (compact) return renderCompact(media, serverUrl);
    const href = `${serverUrl}/title/${media.type}/${media.tmdbId}`;
    switch (media.status) {
      case "available":
        render(pill("ok", ICONS.check, t("statusAvailable")), link("btn", ICONS.play, t("btnOpen"), href));
        break;
      case "processing": {
        const hasPct = typeof media.progress === "number";
        const label = hasPct ? `${t("statusProcessing")} · ${media.progress} %` : t("statusProcessing");
        const node = pill(hasPct ? "cyan progress" : "cyan pulse", ICONS.loader, label, href);
        if (hasPct) {
          const bar = el("i", "bar");
          bar.style.width = `${media.progress}%`;
          node.appendChild(bar);
        }
        render(node);
        break;
      }
      case "pending":
        render(pill("amber", ICONS.clock, t("statusPending"), href));
        break;
      default: {
        const btn = button("", ICONS.download, t("btnRequest"));
        btn.addEventListener("click", async () => {
          const mine = token;
          btn.disabled = true;
          btn.firstChild.outerHTML = ICONS.loader;
          const res = await send({ type: "request", mediaType: media.type, tmdbId: media.tmdbId });
          if (mine !== token) return;
          if (!res.ok) return renderError(res.error);
          renderMedia(res.data.media || { ...media, status: "pending" }, res.serverUrl || serverUrl);
        });
        render(btn);
      }
    }
  }

  async function mount(placement, query) {
    create(placement);
    const mine = token;
    if (compact) wrap.replaceChildren(el("span", "skeleton")); else wrap.replaceChildren(mark(), el("span", "skeleton"));

    const res = await send({ type: "lookup", query });
    if (mine !== token) return;
    if (res.ok) return renderMedia(res.data.media, res.serverUrl);
    if (!compact && (res.error === "not_configured" || res.error === "unauthorized")) {
      const btn = button("ghost", ICONS.cog, t("btnSetup"));
      btn.addEventListener("click", () => send({ type: "openOptions" }));
      return render(btn);
    }
    renderError(res.error);
  }

  window.MovvizCompanion = { mount, unmount };
})();
