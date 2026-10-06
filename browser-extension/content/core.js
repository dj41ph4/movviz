// Widget Movviz injecté dans les pages de cinéma. Rendu dans un shadow DOM
// pour que ni le CSS du site hôte ni le nôtre ne se contaminent.
(() => {
  const t = (key, ...subs) => chrome.i18n.getMessage(key, subs) || key;

  const CSS = `
    :host { all: initial; display: block; }
    * { box-sizing: border-box; }
    .wrap {
      display: inline-flex; align-items: center; gap: 10px; flex-wrap: wrap;
      margin: 10px 0; font-family: Inter, "Segoe UI", system-ui, sans-serif;
      font-size: 13px; line-height: 1.2; color: #eef1ff;
    }
    .wrap.float {
      position: fixed; left: 16px; bottom: 16px; z-index: 2147483647; margin: 0;
      padding: 8px 10px; border-radius: 16px;
      background: color-mix(in oklab, #131836 88%, transparent);
      border: 1px solid color-mix(in oklab, #a06bff 38%, #fff 13%);
      box-shadow: 0 12px 30px -12px rgba(124, 58, 237, .6);
      backdrop-filter: blur(14px);
    }
    .mark { width: 26px; height: 26px; border-radius: 8px; flex: none; }
    .btn, .pill {
      display: inline-flex; align-items: center; gap: 7px; text-decoration: none;
      font: inherit; font-weight: 700; white-space: nowrap; cursor: pointer;
    }
    .btn {
      padding: 9px 16px; border-radius: 12px; border: 0; color: #fff;
      background: linear-gradient(120deg, #ff4bd0, #c04bff, #7c3aed);
      box-shadow: 0 8px 22px -10px rgba(192, 75, 255, .8);
      transition: transform .15s ease, filter .15s ease;
    }
    .btn:hover { transform: scale(1.05); filter: brightness(1.1); }
    .btn:disabled { opacity: .6; cursor: default; transform: none; }
    .btn.ghost {
      background: color-mix(in oklab, #131836 62%, transparent); color: #eef1ff;
      border: 1px solid color-mix(in oklab, #a06bff 28%, #fff 10%); box-shadow: none;
    }
    .pill { padding: 5px 11px; border-radius: 999px; border: 1px solid; font-size: 11px; cursor: default; }
    a.pill { cursor: pointer; }
    .ok { color: #43e6a0; background: rgba(67, 230, 160, .13); border-color: rgba(67, 230, 160, .3); }
    .amber { color: #ffb84b; background: rgba(255, 184, 75, .13); border-color: rgba(255, 184, 75, .3); }
    .cyan { color: #34e2ff; background: rgba(52, 226, 255, .13); border-color: rgba(52, 226, 255, .3); }
    .down { color: #ff5b78; background: rgba(255, 91, 120, .13); border-color: rgba(255, 91, 120, .3); }
    .dim { color: #aeb4d6; background: rgba(255, 255, 255, .06); border-color: rgba(255, 255, 255, .14); }
    svg { width: 14px; height: 14px; flex: none; }
    .spin { animation: spin .8s linear infinite; }
    .pulse { animation: pulse 1.6s ease-in-out infinite; }
    .skeleton { width: 150px; height: 34px; border-radius: 12px; background: rgba(255, 255, 255, .08); animation: pulse 1.4s ease-in-out infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes pulse { 50% { opacity: .45; } }
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
  };

  const send = (message) => new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(message, (res) => resolve(chrome.runtime.lastError ? { ok: false, error: "network" } : res));
    } catch {
      resolve({ ok: false, error: "network" }); // extension rechargée : le contexte est orphelin
    }
  });

  let host = null;
  let wrap = null;
  let token = 0; // invalide les réponses d'une page déjà quittée

  function unmount() {
    token++;
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
    wrap.className = "wrap" + (placement.mode === "float" ? " float" : "");
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
    img.src = chrome.runtime.getURL("icons/icon48.png");
    img.alt = "Movviz";
    return img;
  }

  const pill = (cls, icon, text, href) => {
    const node = el(href ? "a" : "span", `pill ${cls}`, `${icon}<span></span>`);
    node.lastChild.textContent = text;
    if (href) { node.href = href; node.target = "_blank"; node.rel = "noopener"; }
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

  function renderError(error) {
    render(pill(error === "not_found" ? "dim" : "down", ICONS.alert, t(ERRORS[error] || "errGeneric")));
  }

  function renderMedia(media, serverUrl) {
    const href = `${serverUrl}/title/${media.type}/${media.tmdbId}`;
    switch (media.status) {
      case "available":
        render(pill("ok", ICONS.check, t("statusAvailable")), pill("dim", ICONS.play, t("btnOpen"), href));
        break;
      case "processing":
        render(pill("cyan pulse", ICONS.loader, t("statusProcessing"), href));
        break;
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
    wrap.replaceChildren(mark(), el("span", "skeleton"));

    const res = await send({ type: "lookup", query });
    if (mine !== token) return;
    if (res.ok) return renderMedia(res.data.media, res.serverUrl);
    if (res.error === "not_configured" || res.error === "unauthorized") {
      const btn = button("ghost", ICONS.cog, t("btnSetup"));
      btn.addEventListener("click", () => send({ type: "openOptions" }));
      return render(btn);
    }
    renderError(res.error);
  }

  window.MovvizCompanion = { mount, unmount };
})();
