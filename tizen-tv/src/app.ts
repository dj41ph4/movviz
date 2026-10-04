interface TvDictionary { [key: string]: string | TvDictionary }
interface TvAvPlay {
  open(url: string): void; close(): void; stop(): void; play(): void; pause(): void;
  getState(): string; getCurrentTime(): number; getDuration(): number;
  setDisplayRect(x: number, y: number, w: number, h: number): void;
  setDisplayMethod(method: string): void;
  setStreamingProperty(key: string, value: string): void;
  setListener(listener: { oncurrentplaytime: (ms: number) => void; onstreamcompleted: () => void; onerror: (error: string) => void; onbufferingstart: () => void; onbufferingcomplete: () => void }): void;
  prepareAsync(success: () => void, error: (error: unknown) => void): void;
  seekTo(ms: number, success?: () => void, error?: (error: unknown) => void): void;
}
interface Window {
  qrcode: (version: number, level: string) => { addData(value: string): void; make(): void; getModuleCount(): number; isDark(row: number, col: number): boolean };
  MovvizLocales: Record<string, TvDictionary>; MOVVIZ_VERSION: string;
  webapis?: { avplay: TvAvPlay };
  tizen?: { tvinputdevice: { registerKey(key: string): void }; application: { getCurrentApplication(): { exit(): void } } };
}

(() => {
  type MediaType = "movie" | "series";
  interface Media {
    id?: string; tmdbId: number; type?: MediaType; title: string; overview?: string; addedAt?: number;
    posterPath?: string; backdropPath?: string; year?: number; rating?: number;
    plexRatingKey?: string; playbackSource?: string; status?: string; file?: unknown;
    seasonNumber?: number; episodeNumber?: number; similar?: Media[]; runtime?: number; genres?: string[]; logoPath?: string;
    cast?: { id: number; name: string; character: string; profilePath?: string }[];
    seasons?: { seasonNumber: number; name: string; posterPath?: string; episodeCount?: number }[];
    progress?: number; positionMs?: number; durationMs?: number; episodeTitle?: string;
  }
  interface Episode { seasonNumber: number; episodeNumber: number; title: string; status: string; file?: unknown; playbackSource?: string; plexRatingKey?: string; stillPath?: string; runtime?: number; overview?: string }
  interface Series extends Media { seasons: { seasonNumber: number; name: string; episodes: Episode[] }[] }
  interface Track { index: number; language?: string; title?: string; codec: string }
  interface Prepared { sessionId: string; media: { durationMs?: number }; plan: { mode: string }; stream: { url: string; protocol: string }; tracks: { audio: Track[]; subtitle: Track[] } }
  interface Session { sessionId: string; resumeOffsetMs: number | null }
  interface PublicUser { id: string; username: string; role: string }
  interface Saved { server: string; session: string; cookieName: string; user: PublicUser; locale: string }
  interface Page { title: string; content: HTMLElement; focusId: string; scroll: number; context?: { tmdbId: number; type: MediaType; title: string } }
  interface DeckEntry extends Omit<Media, "type"> { type: "movie" | "episode"; progressPercent: number; offsetMs: number; episodeStillPath?: string; movvizId?: string }
  function normalizeDeck(entries: DeckEntry[]): Media[] { return entries.map(e => ({ ...e, type: e.type === "episode" ? "series" : "movie", id: e.movvizId, backdropPath: e.episodeStillPath || e.backdropPath, progress: e.progressPercent, positionMs: e.offsetMs })); }
  const app = document.getElementById("app")!;
  const toastNode = document.getElementById("toast")!;
  let saved: Saved | null = null;
  try { saved = JSON.parse(localStorage.getItem("movviz.tv.connection") || "null") as Saved | null; } catch { /* setup below */ }
  let locale = saved?.locale || "fr";
  let movies: Media[] = [], series: Media[] = [];
  let content: HTMLElement, heading: HTMLElement;
  let generation = 0, focusCounter = 0, toastTimer = 0;
  const history: Page[] = [];
  let activePlayer: { position: number; duration: number; progressId: string; engineId: string; sequence: number; timer: number; closing: boolean; page: Page; frame: Node[]; prepared: Prepared; base: number; media: Media; type: MediaType; episode?: Episode; audio?: number; subtitle: number | null; changing: boolean } | null = null;
  let startingPlayer = false;
  let pageContext: { tmdbId: number; type: MediaType; title: string } | undefined;
  let libraryType: MediaType = "movie";
  const libraryFilters = { movie: { query: "", sort: "title" }, series: { query: "", sort: "title" } };
  let progressQueue: Promise<unknown> = Promise.resolve();
  function progressCall(path: string, body: unknown) {
    const pending = progressQueue.catch(() => {}).then(() => call(path, body)); progressQueue = pending; return pending;
  }
  let closeModal: (() => void) | null = null;
  let lastContentFocus: HTMLElement | null = null;
  let loginServer = saved?.server || localStorage.getItem("movviz.tv.server") || "";
  function remember() {
    if (!saved?.session) return;
    localStorage.setItem("movviz.tv.connection", JSON.stringify(saved));
    let profiles = readProfiles();
    profiles = profiles.filter(p => !(p.server === saved!.server && p.user.id === saved!.user.id));
    profiles.push(saved); localStorage.setItem("movviz.tv.profiles", JSON.stringify(profiles));
  }
  function readProfiles(): Saved[] {
    try { const list = JSON.parse(localStorage.getItem("movviz.tv.profiles") || "[]"); return Array.isArray(list) ? list.filter(p => typeof p?.session === "string" && p.session && typeof p?.user?.id === "string" && typeof p?.server === "string") : []; } catch { return []; }
  }
  function savedProfiles(): Saved[] { return readProfiles().filter(p => p.server === loginServer); }

  function t(key: string): string {
    let value: string | TvDictionary = window.MovvizLocales[locale] || window.MovvizLocales.fr;
    for (const part of key.split(".")) {
      if (typeof value === "string") return key;
      value = value[part];
      if (value === undefined) return key;
    }
    return typeof value === "string" ? value : key;
  }
  function el<K extends keyof HTMLElementTagNameMap>(tag: K, text = "", className = ""): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag); node.textContent = text; node.className = className; return node;
  }
  function toast(message: string) {
    toastNode.textContent = message; toastNode.style.display = "block";
    window.clearTimeout(toastTimer); toastTimer = window.setTimeout(() => { toastNode.style.display = "none"; }, 6000);
  }
  function report(error: unknown) { toast(error instanceof Error ? error.message : t("tizen.requestFailed")); }
  function button(label: string, action: () => void | Promise<void>, className = "") {
    const node = el("button", label, className); node.type = "button"; node.dataset.focusId = String(++focusCounter);
    node.onclick = () => { Promise.resolve().then(action).catch(report); }; return node;
  }
  function field(label: string, type: string, initial = "") {
    const wrapper = el("label", label); const input = el("input"); input.type = type; input.value = initial;
    input.dataset.focusId = String(++focusCounter); wrapper.append(input); return { wrapper, input };
  }
  async function call<T>(path: string, body?: unknown, method?: "GET" | "POST" | "PATCH"): Promise<T> {
    if (!saved) throw new Error(t("tizen.signIn"));
    const controller = new AbortController(); const timeout = window.setTimeout(() => controller.abort(), path.includes("prepare") || path === "/api/ai/chat" ? 90000 : 30000);
    try {
      const response = await fetch(`${saved.server}/api/tv/client`, {
        method: "POST", credentials: "omit", signal: controller.signal,
        headers: { "Content-Type": "application/json", ...(saved.session ? { Authorization: `Bearer ${saved.session}` } : {}) },
        body: JSON.stringify({ path, method: method || (body === undefined ? "GET" : "POST"), body }),
      });
      const data = await response.json() as T & { error?: string };
      if (!response.ok) throw new Error(response.status === 401 ? t("tizen.sessionExpired") : `${t("tizen.requestFailed")} (${data.error || response.status})`);
      return data;
    } finally { window.clearTimeout(timeout); }
  }
  function imageUrl(path?: string) {
    if (!path) return "icon.png";
    if (path.startsWith("/")) return `https://image.tmdb.org/t/p/w500${path}`;
    try { const url = new URL(path); return /^https?:$/.test(url.protocol) ? url.href : "icon.png"; } catch { return "icon.png"; }
  }
  function card(item: Media, type: MediaType, landscape = false) {
    const node = button("", () => title(item, type), landscape ? "card resume-card" : "card"); node.setAttribute("aria-label", item.title); const image = el("img");
    image.src = imageUrl(landscape ? item.backdropPath || item.posterPath : item.posterPath); image.alt = ""; image.loading = "lazy";
    image.onerror = () => { image.onerror = null; image.src = "icon.png"; };
    node.append(image, el("span", item.title || String(item.tmdbId), "card-caption"));
    if (landscape) {
      const progress = el("progress"); progress.max = 100; progress.value = item.durationMs ? (item.positionMs || 0) / item.durationMs * 100 : (item.progress || 0); node.append(progress);
    } else {
      const preview = el("div", "", "focus-preview"); preview.style.backgroundImage = `linear-gradient(0deg,#05070ff2,transparent),url("${imageUrl(item.backdropPath || item.posterPath)}")`;
      preview.append(el("strong", item.title), el("p", [item.year, item.rating ? `★ ${item.rating.toFixed(1)}` : ""].filter(Boolean).join(" · ")));
      node.append(preview); let timer = 0;
      node.onfocus = () => { timer = window.setTimeout(() => {
        void call<Media>(`/api/tv/preview?type=${type}&tmdbId=${item.tmdbId}`).then(detail => {
          if (document.activeElement !== node) return;
          if (detail.backdropPath) preview.style.backgroundImage = `linear-gradient(0deg,#05070ff2,transparent),url("${imageUrl(detail.backdropPath)}")`;
        }).catch(() => {});
      }, 300); };
      node.onblur = () => window.clearTimeout(timer);
    }
    return node;
  }
  function row(label: string, items: Media[], type?: MediaType) {
    if (!items.length) return;
    const section = el("section", "", "media-section"); section.append(el("h2", label)); const list = el("div", "", "row");
    items.filter(Boolean).forEach(item => list.append(card(item, type || item.type || "movie", label === t("tizen.continueWatching")))); section.append(list); content.append(section);
  }
  function focusFirst() { content?.querySelector<HTMLElement>("button:not(:disabled), input, select")?.focus(); }
  function snapshot(): Page { return { title: heading.textContent || "", content, focusId: (document.activeElement as HTMLElement)?.dataset.focusId || "", scroll: window.scrollY, context: pageContext }; }
  function restore(page: Page) {
    generation++; content.replaceWith(page.content); content = page.content; heading.textContent = page.title;
    pageContext = page.context;
    heading.style.display = content.classList.contains("detail-page") ? "none" : "";
    document.querySelector(".shell")?.classList.toggle("home-shell", content.classList.contains("home-page"));
    window.scrollTo(0, page.scroll); content.querySelector<HTMLElement>(`[data-focus-id="${page.focusId}"]`)?.focus();
  }
  function begin(label: string, push = false): number {
    if (push) history.push(snapshot());
    pageContext = undefined;
    const next = el("div", "", "page-content"); content.replaceWith(next); content = next; heading.textContent = label; window.scrollTo(0, 0);
    heading.style.display = "";
    document.querySelector(".shell")?.classList.remove("home-shell");
    return ++generation;
  }
  function back() {
    if (closeModal) { closeModal(); return; }
    if (activePlayer) { void stopPlayer(false).catch(report); return; }
    const previous = history.pop();
    if (previous) restore(previous);
    else if (document.querySelector(".login")) void setup();
    else document.querySelector<HTMLElement>("nav button.active")?.focus();
  }
  function brand(size = "") {
    const node = el("div", "", `brand ${size}`); const mark = el("img"); mark.src = "icon.png"; mark.alt = "";
    node.append(mark, el("span", "Movviz", "wordmark")); return node;
  }
  async function setup() {
    generation++; app.replaceChildren(); history.length = 0;
    const screen = el("div", "", "auth-screen"), box = el("form", "", "setup"); box.append(brand("auth-brand"), el("div", "MEDIA CORE", "tagline"), el("p", t("tizen.serverQuestion"), "muted"));
    const server = field(t("tizen.server"), "url", loginServer || "http://");
    const submit = button(t("tizen.continue"), () => {} , "primary"); submit.type = "submit";
    box.append(server.wrapper, submit);
    box.onsubmit = event => {
      event.preventDefault();
      void (async () => {
        const url = new URL(server.input.value.trim());
        if (!/^https?:$/.test(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error(t("tizen.invalidServer"));
        loginServer = url.origin; saved = { server: loginServer, session: "", cookieName: "", user: { id: "", username: "", role: "" }, locale };
        submit.disabled = true;
        try {
          const status = await call<{ service: string; deviceAuth: number }>("/api/tv/status");
          if (status.service !== "movviz" || status.deviceAuth !== 1) throw new Error(t("tizen.invalidServer"));
          localStorage.setItem("movviz.tv.server", loginServer); await loginScreen();
        } finally { submit.disabled = false; }
      })().catch(report);
    };
    screen.append(box); app.append(screen); server.input.focus();
  }
  async function loginScreen() {
    generation++; app.replaceChildren();
    saved = { server: loginServer, session: "", cookieName: "", user: { id: "", username: "", role: "" }, locale };
    const screen = el("div", "", "auth-screen"), box = el("form", "", "login"); box.append(brand("auth-brand"), el("p", t("auth.welcomeTitle"), "welcome muted"));
    const user = field(t("auth.username"), "text"), password = field(t("auth.password"), "password");
    const submit = button(t("auth.login"), () => {}, "primary"); submit.type = "submit";
    const plex = button(t("auth.loginWithPlex"), plexLogin, "plex-button");
    box.append(user.wrapper, password.wrapper, submit, el("div", t("auth.or").toUpperCase(), "divider"), plex, el("p", `${t("auth.noAccount")} ${t("auth.switchToRegister")}`, "register-hint muted"), button(t("tizen.changeServer"), setup, "text-button"));
    box.onsubmit = event => {
      event.preventDefault(); submit.disabled = true;
      void call<{ user: PublicUser; session: string; cookieName: string }>("/api/auth/login", { username: user.input.value.trim(), password: password.input.value }).then(async data => {
        saved = { ...saved!, ...data }; password.input.value = ""; remember(); await profilesScreen();
      }).catch(report).finally(() => { submit.disabled = false; });
    };
    screen.append(box); app.append(screen); user.input.focus();
  }
  async function plexLogin() {
    if (closeModal) return;
    const pin = await call<{ id: number; code: string; authUrl: string; challenge: string }>("/api/auth/plex/tv-pin", {});
    const overlay = el("div", "", "modal plex-overlay"), box = el("section", "", "plex-dialog");
    box.append(el("h2", t("tizen.plexConnection")), el("p", t("tizen.plexHint"), "muted"));
    const body = el("div", "", "plex-code-body"), canvas = el("canvas"); canvas.width = canvas.height = 270; canvas.setAttribute("aria-label", t("tizen.plexHint"));
    const qr = window.qrcode(0, "M"); qr.addData(pin.authUrl); qr.make(); const count = qr.getModuleCount();
    const ctx = canvas.getContext("2d")!; ctx.fillStyle = "white"; ctx.fillRect(0, 0, 270, 270); ctx.fillStyle = "black";
    const size = 270 / (count + 2); for (let y = 0; y < count; y++) for (let x = 0; x < count; x++) if (qr.isDark(y, x)) ctx.fillRect(Math.round((x + 1) * size), Math.round((y + 1) * size), Math.ceil(size), Math.ceil(size));
    const text = el("div"); text.append(el("p", t("tizen.connectionCode"), "muted"), el("div", pin.code, "plex-code"), el("div", "plex.tv/link", "plex-link"), el("p", t("tizen.waiting"), "muted")); body.append(canvas, text); box.append(body);
    let canceled = false, timer = 0; const deadline = Date.now() + 120000;
    const cancel = () => { canceled = true; window.clearTimeout(timer); overlay.remove(); closeModal = null; document.querySelector<HTMLElement>(".plex-button")?.focus(); void call("/api/auth/plex/cancel", { id: pin.id, challenge: pin.challenge }).catch(() => {}); };
    closeModal = cancel; const cancelButton = button(t("tizen.cancel"), cancel); box.append(cancelButton); overlay.append(box); app.append(overlay); cancelButton.focus();
    async function poll() {
      if (canceled) return;
      if (Date.now() >= deadline) { cancel(); toast(t("auth.plexTimeout")); return; }
      try {
        const data = await call<{ done: boolean; user: PublicUser; session: string; cookieName: string }>("/api/auth/plex/poll", { id: pin.id, challenge: pin.challenge });
        if (canceled) {
          if (data.session) await fetch(`${loginServer}/api/tv/client`, { method: "POST", credentials: "omit", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session}` }, body: JSON.stringify({ path: "/api/auth/logout", method: "POST", body: {} }) });
          return;
        }
        if (data.done) { canceled = true; overlay.remove(); closeModal = null; saved = { ...saved!, ...data }; remember(); await profilesScreen(); return; }
        timer = window.setTimeout(() => void poll(), 2000);
      } catch (error) { cancel(); report(error); }
    }
    timer = window.setTimeout(() => void poll(), 2000);
  }
  async function profilesScreen() {
    generation++; history.length = 0; app.replaceChildren();
    const screen = el("div", "", "profile-picker"); screen.append(brand(), el("h1", t("tizen.whoWatching")), el("p", t("tizen.profileHint"), "muted"));
    const list = el("div", "", "profile-tiles");
    for (const candidate of savedProfiles()) {
      const tile = button("", async () => {
        saved = candidate;
        try {
          const me = await call<{ user: PublicUser }>("/api/auth/me");
          if (me.user.id !== candidate.user.id) throw new Error(t("tizen.sessionExpired"));
          saved.user = me.user; locale = saved.locale; movies = []; series = []; remember(); await shell();
        } catch (error) { await loginScreen(); report(error); }
      }, "profile-tile"); tile.append(el("div", candidate.user.username.slice(0, 1).toUpperCase(), "avatar"), el("span", candidate.user.username)); list.append(tile);
    }
    const add = button("", loginScreen, "profile-tile"); add.append(el("div", "+", "avatar add-avatar"), el("span", t("tizen.addProfile"))); list.append(add); screen.append(list); app.append(screen); list.querySelector("button")?.focus();
  }
  async function shell() {
    app.replaceChildren(); const frame = el("div", "", "shell"), nav = el("nav"), main = el("main");
    nav.append(brand()); heading = el("h1", "", "page-heading"); content = el("div", "", "page-content"); main.append(heading, content); frame.append(nav, main); app.append(frame);
    const destinations: [string, string, () => Promise<void>][] = [
      ["nav.home", "home", home], ["nav.discover", "compass", discover], ["nav.library", "library", library], ["nav.search", "search", search], ["nav.settings", "settings", settings],
    ];
    destinations.forEach(([key, icon, action]) => {
      const node = button("", async () => {
        history.length = 0; nav.querySelectorAll("button").forEach(n => n.classList.remove("active")); node.classList.add("active"); await action();
      }, "nav-item"); node.setAttribute("aria-label", t(key)); node.append(svgIcon(icon), el("span", t(key))); nav.append(node);
    });
    const footer = el("div", "", "nav-footer"); const profileButton = button("", profilesScreen, "nav-profile"); profileButton.setAttribute("aria-label", t("tizen.profile")); profileButton.append(el("div", saved!.user.username.slice(0, 1).toUpperCase(), "avatar"), el("span", saved!.user.username)); footer.append(profileButton, el("small", `v${window.MOVVIZ_VERSION}`)); nav.append(footer);
    nav.querySelector("button")?.classList.add("active");
    await home();
    void call<{ enabled: boolean }>("/api/ai/session").then(data => {
      if (data.enabled && frame.isConnected) { const chat = button("✦", aiChat, "ai-fab"); chat.setAttribute("aria-label", t("ai.title")); frame.append(chat); }
    }).catch(() => {});
  }
  function svgIcon(name: string) {
    const paths: Record<string, string> = { home: "M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-6v-7h-4v7H4a1 1 0 0 1-1-1Z", compass: "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0ZM16 8l-3 5-5 3 3-5Z", library: "M4 3v18M9 3v18M14 3v18M18 4l4 16", search: "M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z", settings: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM9 2h6l1 3 3 1 3 3v6l-3 1-1 3-3 3H9l-1-3-3-1-3-3V9l3-1 1-3Z" };
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"); svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("aria-hidden", "true"); const path = document.createElementNS(svg.namespaceURI, "path"); path.setAttribute("d", paths[name] || paths.home); svg.append(path); return svg;
  }
  async function home() {
    const version = begin(t("nav.home")); content.classList.add("home-page"); document.querySelector(".shell")?.classList.add("home-shell"); content.append(el("p", t("tizen.loading"), "muted"));
    const [dashboard, onDeck, slides] = await Promise.all([
      call<{ movies: Media[]; series: Media[] }>("/api/interface/dashboard"), call<{ items: DeckEntry[] }>("/api/plex/on-deck"),
      call<{ slides: { detail: Media }[] }>(`/api/dashboard/hero?locale=${locale}&rich=1`).catch(() => ({ slides: [] })),
    ]);
    if (version !== generation) return;
    content.replaceChildren();
    const featured = slides.slides?.map(slide => slide.detail).filter(Boolean) || [];
    if (featured.length) {
      const container = el("div", "", "home-hero-container"); content.append(container); let index = 0;
      const render = () => { container.replaceChildren(heroView(featured[index], featured[index].type || "movie", true)); const dots = el("div", "", "hero-dots"); featured.forEach((_, i) => { const dot = button("", () => { index = i; render(); container.querySelector<HTMLElement>(`[data-slide="${i}"]`)?.focus(); }, i === index ? "selected" : ""); dot.dataset.slide = String(i); dot.setAttribute("aria-label", `${t("tizen.featured")} ${i + 1}`); dots.append(dot); }); container.append(dots); }; render();
    }
    row(t("tizen.continueWatching"), normalizeDeck(onDeck.items || []));
    row(t("tizen.recentMovies"), (dashboard.movies || []).filter(Boolean).sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0)).slice(0, 25), "movie");
    row(t("tizen.recentSeries"), (dashboard.series || []).filter(Boolean).sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0)).slice(0, 25), "series");
    if (!content.childElementCount) content.append(el("p", t("tizen.empty"), "muted")); focusFirst();
    for (const type of ["movie", "series"] as const) {
      void call<{ rows: { key: string; results: Media[] }[] }>(`/api/metadata/rows?type=${type}&locale=${locale}`).then(data => {
        if (version !== generation) return;
        for (const entry of data.rows || []) if (["recommendedTop", "trendingPopular", "trending", "shortFormat"].includes(entry.key)) row(t(entry.key === "recommendedTop" ? "tizen.recommended" : entry.key === "shortFormat" ? "tizen.shortFormat" : "tizen.trending"), entry.results, type);
      }).catch(() => {});
    }
  }
  function heroView(detail: Media, type: MediaType, featured = false) {
    const hero = el("section", "", featured ? "hero home-hero" : "hero detail-hero");
    hero.style.backgroundImage = `url("${imageUrl(detail.backdropPath)}")`;
    const text = el("div", "", "hero-text");
    if (featured) text.append(el("div", `${t("tizen.featured")} · ${t(type === "movie" ? "tizen.movieLabel" : "tizen.seriesLabel")}`, "eyebrow"));
    const titleNode = el("h1", detail.title); text.append(titleNode);
    void call<{ logos: { path: string; filePath?: string }[] }>(`/api/metadata/images?type=${type}&tmdbId=${detail.tmdbId}&locale=${locale}`).then(data => {
      const logo = data.logos?.[0]; const path = logo?.path || logo?.filePath;
      if (path && hero.isConnected) { const image = el("img", "", "title-logo"); image.src = imageUrl(path); image.alt = detail.title; image.onerror = () => image.replaceWith(titleNode); titleNode.replaceWith(image); }
    }).catch(() => {});
    const meta = el("div", "", "hero-meta"); if (detail.rating) meta.append(el("span", `★ ${detail.rating.toFixed(1)}`, "rating")); meta.append(el("span", [detail.year, detail.runtime ? `${detail.runtime} min` : "", detail.genres?.slice(0, 2).join(" · ")].filter(Boolean).join(" · "))); text.append(meta, el("p", detail.overview || "", "overview"));
    const actions = el("div", "", "actions");
    if (featured) actions.append(button(`▶ ${t("tizen.play")}`, async () => {
      await loadLibrary(); const local = (type === "movie" ? movies : series).find(m => m.tmdbId === detail.tmdbId);
      if (local?.id && type === "movie" && (local.file || local.plexRatingKey)) await play(local, "movie"); else await title(detail, type);
    }, "primary"), button(t("tizen.moreInfo"), () => title(detail, type), "secondary"));
    hero.dataset.type = type; text.append(actions); hero.append(text); return hero;
  }
  async function loadLibrary() {
    const [m, s] = await Promise.all([call<{ movies: Media[] }>("/api/library/movies"), call<{ series: Media[] }>("/api/library/series")]);
    movies = m.movies || []; series = s.series || [];
  }
  async function library() {
    const version = begin(t("nav.library")); await loadLibrary(); if (version !== generation) return;
    const actions = el("div", "", "actions"), grid = el("div", "", "grid");
    const query = field(t("common.filterTitles"), "search", libraryFilters[libraryType].query), sort = el("select"); sort.setAttribute("aria-label", t("library.sortTitle")); sort.dataset.focusId = String(++focusCounter);
    [["title", "library.sortTitle"], ["recent", "library.sortRecent"], ["rating", "library.sortRating"]].forEach(([value, key]) => { const option = el("option", t(key)); option.value = value; sort.append(option); }); sort.value = libraryFilters[libraryType].sort;
    function render() {
      const filters = libraryFilters[libraryType]; grid.replaceChildren();
      const items = (libraryType === "movie" ? movies : series).filter(item => item.title.toLocaleLowerCase(locale).includes(filters.query.toLocaleLowerCase(locale))).sort((a, b) => filters.sort === "recent" ? (b.addedAt || 0) - (a.addedAt || 0) : filters.sort === "rating" ? (b.rating || 0) - (a.rating || 0) : a.title.localeCompare(b.title, locale));
      items.forEach(item => grid.append(card(item, libraryType)));
    }
    function select(type: MediaType) { libraryType = type; query.input.value = libraryFilters[type].query; sort.value = libraryFilters[type].sort; render(); }
    query.input.oninput = () => { libraryFilters[libraryType].query = query.input.value; render(); }; sort.onchange = () => { libraryFilters[libraryType].sort = sort.value; render(); };
    actions.append(button(t("tizen.movies"), () => select("movie")), button(t("tizen.series"), () => select("series")), query.wrapper, sort);
    content.append(actions, grid); render(); focusFirst();
  }
  async function discover() {
    const version = begin(t("nav.discover")); const actions = el("div", "", "actions");
    actions.append(button(t("tizen.movies"), () => show("movie")), button(t("tizen.series"), () => show("series"))); content.append(actions);
    const rows = el("div"); content.append(rows);
    let request = 0;
    async function show(type: MediaType) {
      const id = ++request; const data = await call<{ rows: { key: string; results: Media[] }[] }>(`/api/metadata/rows?type=${type}`);
      if (version !== generation || id !== request) return;
      rows.replaceChildren();
      for (const item of data.rows || []) {
        const labels: Record<string, string> = { recommendedTop: "tizen.recommended", "for-you": "tizen.recommended", trendingPopular: "tizen.trending", trending: "tizen.trending", upcoming: "tizen.upcoming", upcomingVod: "tizen.upcoming", shortFormat: "tizen.shortFormat", onAir: "discover.rowOnAir", newSeriesRenewed: "discover.rowNewSeriesRenewed", nowPlayingBoxOffice: "discover.rowNowPlayingBoxOffice", acclaimed: "discover.rowAcclaimed", anime: "discover.rowAnime", teen: "discover.rowTeen", genreAction: "discover.rowGenreAction", genreComedy: "discover.rowGenreComedy", genreHorror: "discover.rowGenreHorror", genreSciFi: "discover.rowGenreSciFi", popular: "discover.rowPopular", topRated: "discover.rowTopRated", newVod: "discover.rowNewVod", kids: "discover.rowKids" };
        rows.append(el("h2", labels[item.key] ? t(labels[item.key]) : t("tizen.suggestions"))); const list = el("div", "", "row");
        (item.results || []).forEach(media => list.append(card(media, type))); rows.append(list);
      }
    }
    await show("movie"); focusFirst();
  }
  async function search() {
    const version = begin(t("nav.search")); const form = el("form"), query = field(t("nav.search"), "search"), grid = el("div", "", "grid");
    const submit = el("button", t("nav.search")); submit.type = "submit"; form.append(query.wrapper, submit); content.append(form, grid);
    let request = 0;
    form.onsubmit = event => {
      event.preventDefault(); const text = query.input.value.trim(); if (!text) return; const id = ++request;
      void call<{ results: Media[] }>(`/api/metadata/search?q=${encodeURIComponent(text)}`).then(data => {
        if (version !== generation || id !== request) return;
        grid.replaceChildren(); (data.results || []).forEach(item => grid.append(card(item, item.type || "movie")));
        if (!grid.childElementCount) grid.append(el("p", t("tizen.empty")));
        grid.querySelector<HTMLElement>("button")?.focus();
      }).catch(report);
    }; query.input.focus();
  }
  async function title(item: Media, type: MediaType) {
    const version = begin(item.title, true);
    pageContext = { tmdbId: item.tmdbId, type, title: item.title };
    const detail = await call<Media>(`/api/metadata/detail?type=${type}&tmdbId=${item.tmdbId}`);
    if (version !== generation) return;
    content.classList.add("detail-page"); heading.style.display = "none";
    const hero = heroView(detail, type); const actions = hero.querySelector<HTMLElement>(".actions")!;
    actions.append(button(t("tizen.back"), back)); content.append(hero);
    const response = await call<{ movies?: Media[]; series?: Media[] }>(`/api/library/${type === "movie" ? "movies" : "series"}?tmdbId=${item.tmdbId}`);
    if (version !== generation) return;
    const local = (type === "movie" ? response.movies : response.series)?.find(media => media.tmdbId === item.tmdbId);
    let seriesWatchTargets: Episode[] = [];
    if (!local) actions.prepend(button(t("discover.addToLibrary"), async () => {
      const result = await call<{ pendingRequest?: unknown; id?: string }>(`/api/library/${type === "movie" ? "movies" : "series"}`, { tmdbId: item.tmdbId }); toast(t(result.pendingRequest ? "nav.requests" : "discover.added"));
    }, "primary"));
    else if (!(local.file || local.plexRatingKey) && local.id) actions.append(button(t("library.autoSearch"), async () => { await call(`/api/library/${type === "movie" ? "movies" : "series"}/${encodeURIComponent(local.id!)}/search`, {}); toast(t("discover.searchingRelease")); }));
    actions.append(button(t("tizen.watchlist"), async () => { await call("/api/watchlist", { tmdbId: item.tmdbId, type, title: detail.title, posterPath: detail.posterPath }); toast(t("tizen.watchlist")); }));
    if (local?.id && type === "movie" && (local.file || local.plexRatingKey)) actions.prepend(button(t("tizen.play"), () => play(local, "movie")));
    if (local?.id && type === "series") {
      const show = await call<Series>(`/api/library/series/${encodeURIComponent(local.id)}`);
      if (version !== generation) return;
      const deck = await call<{ items: DeckEntry[] }>("/api/plex/on-deck");
      if (version !== generation) return;
      const watched = await call<{ episodes: { tmdbId: number; season: number; episode: number }[] }>(`/api/watch-status?type=series&tmdbId=${item.tmdbId}`);
      if (version !== generation) return;
      const ordered = show.seasons.flatMap(s => s.episodes).sort((a, b) => a.seasonNumber - b.seasonNumber || a.episodeNumber - b.episodeNumber);
      seriesWatchTargets = ordered;
      const playable = ordered.filter(e => e.status === "available" && (e.file || e.plexRatingKey));
      const resume = normalizeDeck(deck.items).find(m => m.tmdbId === item.tmdbId && m.type === "series");
      const current = playable.find(e => e.seasonNumber === (item.seasonNumber ?? resume?.seasonNumber) && e.episodeNumber === (item.episodeNumber ?? resume?.episodeNumber)) || playable.find(e => !watched.episodes.some(w => w.tmdbId === item.tmdbId && w.season === e.seasonNumber && w.episode === e.episodeNumber));
      if (current) actions.prepend(button(`▶ ${t(resume ? "tizen.continueWatching" : "tizen.play")} · S${current.seasonNumber} E${current.episodeNumber}`, () => play(local, type, current), "primary"));
      const grid = el("div", "", "row");
      content.append(el("h2", t("tizen.season")), grid);
      for (const season of show.seasons) {
        const metadata = detail.seasons?.find(s => s.seasonNumber === season.seasonNumber);
        const tile = button("", () => seasonScreen(local, detail, season), "card"); const poster = el("img"); poster.src = imageUrl(metadata?.posterPath || detail.posterPath); poster.alt = "";
        tile.setAttribute("aria-label", season.name || `${t("tizen.season")} ${season.seasonNumber}`); tile.append(poster, el("span", season.name || `${t("tizen.season")} ${season.seasonNumber}`, "card-caption")); grid.append(tile);
      }
    }
    const watch = await call<{ movies: number[]; episodes: { tmdbId: number; season: number; episode: number }[] }>(`/api/watch-status?type=${type}&tmdbId=${item.tmdbId}`);
    if (version !== generation) return;
    let isWatched = type === "movie" ? watch.movies.includes(item.tmdbId) : seriesWatchTargets.length > 0 && seriesWatchTargets.every(e => watch.episodes.some(w => w.tmdbId === item.tmdbId && w.season === e.seasonNumber && w.episode === e.episodeNumber));
    const watchedButton = button(t(isWatched ? "tizen.markUnwatched" : "tizen.markWatched"), async () => {
      await call("/api/watch/toggle", { tmdbId: item.tmdbId, type, watched: !isWatched, title: detail.title, ...(type === "series" ? { scope: "series" } : {}) });
      isWatched = !isWatched; watchedButton.textContent = t(isWatched ? "tizen.markUnwatched" : "tizen.markWatched");
    }); actions.append(watchedButton);
    if (detail.cast?.length) {
      content.append(el("h2", t("tizen.cast"))); const cast = el("div", "", "row");
      detail.cast.slice(0, 20).forEach(person => { const tile = button("", () => personScreen(person.id), "cast-card"), photo = el("img"); photo.src = imageUrl(person.profilePath); photo.alt = ""; tile.append(photo, el("p", person.name)); cast.append(tile); }); content.append(cast);
    }
    row(t("tizen.similar"), detail.similar || [], type);
    focusFirst();
  }
  async function personScreen(id: number) {
    const version = begin(t("discover.peopleTitle"), true);
    const person = await call<{ name: string; biography: string; profilePath?: string; credits: Media[] }>(`/api/metadata/person?id=${id}`); if (version !== generation) return;
    content.append(el("h1", person.name), el("p", person.biography, "muted"), button(t("tizen.back"), back)); row(t("tizen.movies"), person.credits.filter(m => m.type === "movie"), "movie"); row(t("tizen.series"), person.credits.filter(m => m.type === "series"), "series"); focusFirst();
  }
  async function aiChat() {
    if (closeModal) return;
    interface Message { role: string; content: string; recommendations?: Media[]; suggestions?: string[]; linkedTitles?: Media[] }
    const data = await call<{ messages: Message[]; enabled: boolean }>("/api/ai/session"); if (!data.enabled) return;
    const overlay = el("div", "", "modal"), box = el("section", "", "chat-dialog"), messages = el("div", "", "chat-messages"), form = el("form"), query = field(t("ai.placeholder"), "text");
    const cancel = () => { overlay.remove(); closeModal = null; document.querySelector<HTMLElement>(".ai-fab")?.focus(); }; closeModal = cancel;
    box.append(el("h2", t("ai.title")), button(t("tizen.back"), cancel), messages, form); overlay.append(box); app.append(overlay);
    function render(message: Message) {
      const bubble = el("article", "", `chat-message ${message.role}`); bubble.append(el("p", message.content.replace(/\[\[(?:NOTE|FAIT|CHOIX):[^\]]*\]\]/g, "")));
      const cards = el("div", "", "row"); (message.recommendations || []).forEach(item => { const tile = card(item, item.type || "movie"); tile.onclick = () => { cancel(); void title(item, item.type || "movie").catch(report); }; cards.append(tile); }); bubble.append(cards);
      (message.linkedTitles || []).forEach(item => bubble.append(button(item.title, () => { cancel(); return title(item, item.type || "movie"); })));
      (message.suggestions || []).forEach(text => bubble.append(button(text, () => send(text)))); messages.append(bubble);
    }
    let busy = false; const submit = button(t("ai.send"), () => {}, "primary"); submit.type = "submit"; form.append(query.wrapper, submit);
    async function send(text: string) {
      if (busy || !text.trim()) return; busy = true; submit.disabled = true; render({ role: "user", content: text }); query.input.value = "";
      try { const response = await call<{ message: Message }>("/api/ai/chat", { message: text.trim(), pageContext }); if (box.isConnected) { render(response.message); messages.scrollTop = messages.scrollHeight; } }
      finally { busy = false; submit.disabled = false; }
    }
    form.onsubmit = event => { event.preventDefault(); void send(query.input.value).catch(report); }; data.messages.slice(-20).forEach(render); query.input.focus();
  }
  async function seasonScreen(local: Media, detail: Media, season: Series["seasons"][number]) {
    const version = begin(`${detail.title} · ${t("tizen.season")} ${season.seasonNumber}`, true);
    const [metadata, watched, deck] = await Promise.all([
      call<{ posterPath?: string; episodes: Episode[] }>(`/api/metadata/season?tmdbId=${detail.tmdbId}&season=${season.seasonNumber}&locale=${locale}`).catch(() => ({ episodes: [] as Episode[], posterPath: detail.posterPath })),
      call<{ episodes: { tmdbId: number; season: number; episode: number }[] }>(`/api/watch-status?type=series&tmdbId=${detail.tmdbId}`),
      call<{ items: DeckEntry[] }>("/api/plex/on-deck"),
    ]);
    if (version !== generation) return;
    const hero = el("div", "", "season-hero"), poster = el("img"); poster.src = imageUrl(metadata.posterPath || detail.posterPath); poster.alt = "";
    const text = el("div"); text.append(el("h1", detail.title), el("p", `${t("tizen.season")} ${season.seasonNumber} · ${season.episodes.length}`, "muted"), button(t("tizen.back"), back), button(t("library.searchSeason"), async () => { await call(`/api/library/series/${encodeURIComponent(local.id!)}/season/${season.seasonNumber}/search`, {}); toast(t("discover.searchingRelease")); })); hero.append(poster, text); content.append(hero);
    const available = [...season.episodes].filter(e => e.status === "available" && (e.file || e.plexRatingKey)).sort((a, b) => a.episodeNumber - b.episodeNumber);
    const resume = deck.items.find(e => e.tmdbId === detail.tmdbId && e.type === "episode" && e.seasonNumber === season.seasonNumber);
    const next = available.find(e => e.episodeNumber === resume?.episodeNumber) || available.find(e => !watched.episodes.some(w => w.tmdbId === detail.tmdbId && w.season === e.seasonNumber && w.episode === e.episodeNumber)) || available[0];
    const playButton = next ? button(`▶ ${t(resume ? "tizen.continueWatching" : "tizen.play")} · E${next.episodeNumber}`, () => play(local, "series", next), "primary") : null;
    if (playButton) text.insertBefore(playButton, text.querySelector("button"));
    const grid = el("div", "", "episode-grid");
    for (const episode of [...season.episodes].sort((a, b) => a.episodeNumber - b.episodeNumber)) {
      const meta = metadata.episodes.find(e => e.episodeNumber === episode.episodeNumber);
      const tile = button("", () => play(local, "series", episode), "episode"); const still = el("img"); still.src = imageUrl(meta?.stillPath || detail.backdropPath); still.alt = "";
      tile.append(still, el("strong", `${episode.episodeNumber}. ${meta?.title || episode.title}`), el("p", [meta?.runtime ? `${meta.runtime} min` : "", meta?.overview].filter(Boolean).join(" · ")));
      tile.disabled = episode.status !== "available" || !(episode.file || episode.plexRatingKey); grid.append(tile);
    }
    content.append(grid); if (playButton) playButton.focus(); else focusFirst();
  }
  async function downloads() {
    const version = begin(t("nav.downloads")); content.append(button(t("tizen.back"), settings)); const list = el("div"); content.append(list);
    async function refresh() {
      if (version !== generation) return;
      try {
        const data = await call<{ items?: { media?: { title?: string }; download?: { progress?: number }; status?: string }[] }>("/api/activity/v2?tab=queue");
        if (version !== generation) return; list.replaceChildren();
        for (const item of data.items || []) list.append(el("p", `${item.media?.title || ""} · ${Math.round((item.download?.progress || 0) * 100)} % · ${item.status || ""}`));
        if (!list.childElementCount) list.append(el("p", t("tizen.empty"), "muted"));
      } catch (error) { if (version === generation) report(error); }
      if (version === generation) window.setTimeout(() => void refresh(), 5000);
    }
    await refresh(); focusFirst();
  }
  async function profile() {
    const version = begin(saved?.user.username || t("tizen.profile"));
    const data = await call<{ continueWatching: Media[]; watchHistory: Media[]; watchlist: Media[] }>("/api/profile/media");
    if (version !== generation) return;
    function normalize(items: Media[]) { return items.map(item => ({ ...item, type: String(item.type) === "episode" ? "series" as const : item.type })); }
    row(t("tizen.continueWatching"), normalize(data.continueWatching || [])); row(t("tizen.history"), normalize(data.watchHistory || [])); row(t("tizen.watchlist"), normalize(data.watchlist || [])); focusFirst();
  }
  async function settings() {
    begin(t("nav.settings")); content.append(el("p", `Movviz ${window.MOVVIZ_VERSION} · Samsung Tizen`, "muted"), el("p", saved?.server || "", "muted"));
    content.append(button(t("tizen.signOut"), async () => {
      await call("/api/auth/logout", {}); const id = saved?.user.id;
      localStorage.setItem("movviz.tv.profiles", JSON.stringify(readProfiles().filter(p => !(p.server === loginServer && p.user.id === id)))); saved = null; movies = []; series = []; localStorage.removeItem("movviz.tv.connection"); await loginScreen();
    })); focusFirst();
    content.append(button(t("nav.downloads"), downloads), button(t("tizen.profile"), profile), button(t("tizen.whoWatching"), profilesScreen));
    const language = el("select"); language.setAttribute("aria-label", t("tizen.language")); language.dataset.focusId = String(++focusCounter);
    ["fr", "en", "de", "it", "nl"].forEach(code => { const option = el("option", code.toUpperCase()); option.value = code; language.append(option); }); language.value = locale;
    language.onchange = () => { locale = language.value; saved!.locale = locale; remember(); void call("/api/settings/preferences", { locale }, "PATCH").catch(report); }; content.append(language);
  }

  function playbackProfile() {
    let deviceId = localStorage.getItem("movviz.tv.deviceId");
    if (!deviceId) { deviceId = Array.from(crypto.getRandomValues(new Uint8Array(16)), v => v.toString(16).padStart(2, "0")).join(""); localStorage.setItem("movviz.tv.deviceId", deviceId); }
    // Conservative SDR baseline. Model-specific HEVC/HDR/audio capabilities
    // must be measured before widening this profile.
    return { clientType: "samsung-tizen", deviceId, appVersion: window.MOVVIZ_VERSION,
      protocols: { progressive: true, hls: true, dash: false, mse: false }, containers: ["mp4", "mpegts"],
      videoCapabilities: [{ codec: "h264", profiles: ["Baseline", "Constrained Baseline", "Main", "High"], bitDepths: [8], maxWidth: 1920, maxHeight: 1080, maxFps: 30, hdr: [] }],
      audioCapabilities: [{ codec: "aac", maxChannels: 2, decode: true, passthrough: false }],
      subtitleCapabilities: [], maxWidth: 1920, maxHeight: 1080,
    };
  }
  async function play(media: Media, type: MediaType, episode?: Episode) {
    if (startingPlayer || activePlayer) return;
    const av = window.webapis?.avplay; if (!av) throw new Error(t("tizen.devicePlayerOnly"));
    const startGeneration = generation;
    startingPlayer = true; let engineId = "", progressId = "";
    try {
      const localEpisode = episode && (episode.playbackSource === "movviz" || (!episode.playbackSource && !episode.plexRatingKey));
      const ratingKey = episode ? episode.plexRatingKey || `${media.id}:s${episode.seasonNumber}e${episode.episodeNumber}` : media.plexRatingKey || media.id!;
      const mediaId = episode ? `${media.id}:s${episode.seasonNumber}e${episode.episodeNumber}` : media.id!;
      const preferences = await call<{ prefs: { preferredAudioLanguage?: string } }>("/api/settings/preferences");
      const audioLanguage = preferences.prefs.preferredAudioLanguage && preferences.prefs.preferredAudioLanguage !== "auto" ? preferences.prefs.preferredAudioLanguage : locale;
      const prepared = await call<Prepared>("/api/playback/prepare", { mediaId, ratingKey: episode && localEpisode ? undefined : (episode?.plexRatingKey || media.plexRatingKey), clientProfile: playbackProfile(), quality: "1080p", subtitleTrack: null, audioLanguage });
      engineId = prepared.sessionId;
      if (generation !== startGeneration) throw new Error(t("tizen.playbackFailed"));
      if (prepared.plan.mode === "UNSUPPORTED") throw new Error(t("tizen.playbackFailed"));
      const url = new URL(prepared.stream.url, saved!.server);
      if (url.origin !== new URL(saved!.server).origin || !url.pathname.startsWith("/api/")) throw new Error(t("tizen.invalidStream"));
      av.open(url.href); av.setStreamingProperty("COOKIE", `${saved!.cookieName}=${saved!.session}`);
      av.setDisplayRect(0, 0, 1920, 1080); av.setDisplayMethod("PLAYER_DISPLAY_MODE_LETTER_BOX");
      av.setListener({
        oncurrentplaytime: ms => { if (activePlayer && !activePlayer.changing) { activePlayer.position = activePlayer.base + ms; updateTime(); } },
        onstreamcompleted: () => { if (!activePlayer?.changing) void nextEpisode(true).catch(report); },
        onerror: () => { toast(t("tizen.playbackFailed")); void stopPlayer(false).catch(report); },
        onbufferingstart: () => toast(t("tizen.loading")), onbufferingcomplete: () => { toastNode.style.display = "none"; },
      });
      await new Promise<void>((resolve, reject) => av.prepareAsync(resolve, reject));
      if (generation !== startGeneration) throw new Error(t("tizen.playbackFailed"));
      const duration = prepared.media.durationMs || av.getDuration();
      const session = await call<Session>("/api/playback/sessions", { ratingKey, mediaId, mediaType: episode ? "episode" : "movie", durationMs: duration, tmdbId: media.tmdbId, seasonNumber: episode?.seasonNumber, episodeNumber: episode?.episodeNumber, title: media.title });
      progressId = session.sessionId;
      if (generation !== startGeneration) throw new Error(t("tizen.playbackFailed"));
      const page = snapshot(); activePlayer = { position: 0, duration, progressId, engineId, sequence: 0, timer: 0, closing: false, page, frame: Array.from(app.childNodes), prepared, base: 0, media, type, episode, subtitle: null, changing: false };
      document.body.classList.add("playing"); document.documentElement.classList.add("playing"); app.replaceChildren();
      const overlay = el("div", "", "player-overlay"); overlay.append(el("h1", episode ? `${media.title} · ${episode.title}` : media.title));
      const progress = el("progress"); progress.id = "timeline"; progress.max = duration; overlay.append(progress, el("div", "", "player-time"));
      const controls = el("div", "", "actions"); controls.append(button(t("tizen.pausePlay"), togglePlay), button("−30 s", () => seek(-30000)), button("+30 s", () => seek(30000)), button(t("tizen.audio"), () => trackPicker("audio")), button(t("tizen.subtitles"), () => trackPicker("subtitle")), button(t("tizen.stop"), () => stopPlayer(false))); if (episode) controls.append(button(t("tizen.nextEpisode"), nextEpisode)); overlay.append(controls); app.append(overlay);
      if (session.resumeOffsetMs && session.resumeOffsetMs > 0) await reposition(session.resumeOffsetMs, false);
      if (av.getState() === "READY" || av.getState() === "PAUSED") av.play(); controls.querySelector("button")?.focus();
      if (activePlayer) activePlayer.timer = window.setInterval(() => { void heartbeat().catch(report); }, 10000);
    } catch (error) {
      if (activePlayer) await stopPlayer(false);
      else {
        try { av.close(); } catch { /* preparation may not have completed */ }
        if (progressId) await call(`/api/playback/sessions/${progressId}/stop`, {}).catch(() => {});
        if (engineId) await call(`/api/tv/engine/${engineId}/stop`, {}).catch(() => {});
      }
      throw error;
    } finally { startingPlayer = false; }
  }
  let heartbeatBusy = false;
  async function heartbeat() {
    const player = activePlayer; if (!player || player.closing || player.changing || heartbeatBusy) return;
    heartbeatBusy = true;
    try {
      await progressCall(`/api/playback/sessions/${player.progressId}/heartbeat`, { sequence: ++player.sequence, positionMs: player.position, isPlaying: window.webapis?.avplay.getState() === "PLAYING", playbackRate: 1 });
      if (!player.closing) await call(`/api/tv/engine/${player.engineId}/heartbeat`, {});
    } finally { heartbeatBusy = false; }
  }
  function updateTime() {
    if (!activePlayer) return;
    const progress = document.getElementById("timeline") as HTMLProgressElement | null; if (progress) progress.value = activePlayer.position;
    const time = document.querySelector(".player-time");
    function format(ms: number) { const seconds = Math.floor(ms / 1000); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`; }
    if (time) time.textContent = `${format(activePlayer.position)} / ${format(activePlayer.duration)}`;
  }
  function togglePlay() { const av = window.webapis?.avplay; if (av?.getState() === "PLAYING") av.pause(); else if (av?.getState() === "PAUSED") av.play(); }
  async function seek(delta: number) {
    const player = activePlayer, av = window.webapis?.avplay; if (!player || !av || player.changing || player.closing) return;
    const position = Math.min(Math.max(0, player.position + delta), Math.max(0, player.duration - 1000));
    await reposition(position, false);
    player.position = position; updateTime(); await progressCall(`/api/playback/sessions/${player.progressId}/seek`, { toMs: position });
  }
  async function reposition(position: number, replan: boolean) {
    const player = activePlayer, av = window.webapis?.avplay; if (!player || !av || player.changing || player.closing) return;
    player.changing = true; const paused = av.getState() === "PAUSED";
    try {
      if (!replan && player.prepared.plan.mode === "DIRECT_PLAY") {
        await new Promise<void>((resolve, reject) => av.seekTo(position, resolve, reject));
      } else {
        av.stop(); av.close();
        await call(`/api/tv/engine/${player.engineId}/stop`, {});
        const mediaId = player.episode ? `${player.media.id}:s${player.episode.seasonNumber}e${player.episode.episodeNumber}` : player.media.id!;
        const ratingKey = player.episode?.plexRatingKey || player.media.plexRatingKey;
        const prepared = await call<Prepared>("/api/playback/prepare", { mediaId, ratingKey, clientProfile: playbackProfile(), quality: "1080p", audioTrack: player.audio, subtitleTrack: player.subtitle, audioLanguage: locale });
        player.prepared = prepared; player.engineId = prepared.sessionId;
        const url = new URL(prepared.stream.url, saved!.server);
        if (url.origin !== new URL(saved!.server).origin || !url.pathname.startsWith("/api/") || prepared.plan.mode === "UNSUPPORTED") throw new Error(t("tizen.invalidStream"));
        player.base = prepared.plan.mode === "DIRECT_PLAY" ? 0 : position;
        if (player.base) url.searchParams.set("seekTo", String(position / 1000));
        av.open(url.href); av.setStreamingProperty("COOKIE", `${saved!.cookieName}=${saved!.session}`); av.setDisplayRect(0, 0, 1920, 1080); av.setDisplayMethod("PLAYER_DISPLAY_MODE_LETTER_BOX");
        av.setListener({
          oncurrentplaytime: ms => { if (activePlayer && !activePlayer.changing) { activePlayer.position = activePlayer.base + ms; updateTime(); } },
          onstreamcompleted: () => { if (!activePlayer?.changing) void nextEpisode(true).catch(report); },
          onerror: () => { if (!activePlayer?.changing) { toast(t("tizen.playbackFailed")); void stopPlayer(false).catch(report); } },
          onbufferingstart: () => toast(t("tizen.loading")), onbufferingcomplete: () => { toastNode.style.display = "none"; },
        });
        await new Promise<void>((resolve, reject) => av.prepareAsync(resolve, reject));
        if (!player.base && position) await new Promise<void>((resolve, reject) => av.seekTo(position, resolve, reject));
        av.play(); if (paused) av.pause();
      }
      player.position = position;
    } catch (error) { await stopPlayer(false); throw error; }
    finally { player.changing = false; }
  }
  function trackPicker(kind: "audio" | "subtitle") {
    const player = activePlayer; if (!player || closeModal) return;
    const overlay = el("div", "", "modal"), box = el("section", "", "plex-dialog"); box.append(el("h2", t(kind === "audio" ? "tizen.audio" : "tizen.subtitles")));
    const cancel = () => { overlay.remove(); closeModal = null; document.querySelector<HTMLElement>(".player-overlay button")?.focus(); }; closeModal = cancel;
    function option(track?: Track) { box.append(button(track ? [track.title, track.language, track.codec].filter(Boolean).join(" · ") : t("tizen.off"), async () => {
      if (!player || activePlayer !== player || player.closing) { cancel(); return; }
      if (kind === "audio") player.audio = track?.index; else player.subtitle = track?.index ?? null;
      cancel(); await reposition(player.position, true);
    })); }
    if (kind === "subtitle") option(); for (const track of player.prepared.tracks[kind]) option(track);
    box.append(button(t("tizen.cancel"), cancel)); overlay.append(box); app.append(overlay); box.querySelector("button")?.focus();
  }
  async function nextEpisode(ended = false) {
    const player = activePlayer; if (!player || player.changing) return;
    if (!player.episode) { await stopPlayer(ended); return; }
    const show = await call<Series>(`/api/library/series/${encodeURIComponent(player.media.id!)}`);
    const next = show.seasons.flatMap(s => s.episodes).filter(e => e.status === "available" && (e.file || e.plexRatingKey)).sort((a, b) => a.seasonNumber - b.seasonNumber || a.episodeNumber - b.episodeNumber).find(e => e.seasonNumber > player.episode!.seasonNumber || (e.seasonNumber === player.episode!.seasonNumber && e.episodeNumber > player.episode!.episodeNumber));
    if (activePlayer !== player || player.closing) return;
    await stopPlayer(ended); if (next) await play(player.media, "series", next);
  }
  async function stopPlayer(ended: boolean) {
    const player = activePlayer; if (!player || player.closing) return; player.closing = true; window.clearInterval(player.timer);
    if (closeModal) closeModal();
    const av = window.webapis?.avplay;
    try { if (av && !ended) player.position = player.base + av.getCurrentTime(); av?.stop(); } catch { /* already stopped */ }
    try { av?.close(); } catch { /* already closed */ }
    try {
      await progressCall(`/api/playback/sessions/${player.progressId}/${ended ? "ended" : "stop"}`, ended ? {} : { positionMs: player.position });
    } finally {
      await call(`/api/tv/engine/${player.engineId}/stop`, {}).catch(report);
      activePlayer = null; document.body.classList.remove("playing"); document.documentElement.classList.remove("playing"); app.replaceChildren(...player.frame);
      // Reattach the exact previous detail DOM, preserving callbacks and focus.
      restore(player.page);
    }
  }
  function moveFocus(key: number) {
    const current = document.activeElement as HTMLElement;
    if ((current instanceof HTMLInputElement || current instanceof HTMLSelectElement) && [37, 39].includes(key)) return;
    const rect = current?.getBoundingClientRect(); if (!rect) return;
    if (!closeModal && !activePlayer) {
      if (key === 39 && current.closest("nav")) {
        if (lastContentFocus?.isConnected && lastContentFocus.closest("main")) lastContentFocus.focus(); else focusFirst(); return;
      }
      const main = current.closest("main");
      if (key === 37 && main && rect.left <= main.getBoundingClientRect().left + 180) { document.querySelector<HTMLElement>("nav button.active")?.focus(); return; }
    }
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    let best: HTMLElement | null = null, score = Infinity;
    (document.querySelector(".modal") || document).querySelectorAll<HTMLElement>("button:not(:disabled),input,select").forEach(node => {
      if (node === current || !node.offsetWidth || !node.offsetHeight) return;
      const r = node.getBoundingClientRect(), dx = r.left + r.width / 2 - cx, dy = r.top + r.height / 2 - cy;
      const primary = key === 37 ? -dx : key === 39 ? dx : key === 38 ? -dy : dy;
      const cross = key === 37 || key === 39 ? Math.abs(dy) : Math.abs(dx);
      if (primary <= 4) return;
      const candidate = primary + cross * 4; if (candidate < score) { score = candidate; best = node; }
    });
    if (best) { (best as HTMLElement).focus(); (best as HTMLElement).scrollIntoView({ block: "nearest", inline: "nearest" }); }
  }
  document.addEventListener("keydown", event => {
    const key = event.keyCode;
    if ([37, 38, 39, 40].includes(key)) {
      if ((document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLSelectElement) && [37, 39].includes(key)) return;
      event.preventDefault(); moveFocus(key);
    } else if (key === 10009 || key === 27) { event.preventDefault(); back(); }
    else if (activePlayer && key === 415) { event.preventDefault(); if (window.webapis?.avplay.getState() === "PAUSED") window.webapis.avplay.play(); }
    else if (activePlayer && key === 19) { event.preventDefault(); if (window.webapis?.avplay.getState() === "PLAYING") window.webapis.avplay.pause(); }
    else if (activePlayer && key === 10252) { event.preventDefault(); togglePlay(); }
    else if (activePlayer && key === 413) { event.preventDefault(); void stopPlayer(false).catch(report); }
    else if (activePlayer && [412, 417].includes(key)) { event.preventDefault(); void seek(key === 412 ? -30000 : 30000).catch(report); }
  });
  document.addEventListener("focusin", event => { const node = event.target as HTMLElement; if (node.closest("main")) lastContentFocus = node; });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && activePlayer) { window.webapis?.avplay.pause(); void heartbeat().catch(report); }
  });
  for (const key of ["MediaPlay", "MediaPause", "MediaPlayPause", "MediaStop", "MediaRewind", "MediaFastForward"]) {
    try { window.tizen?.tvinputdevice.registerKey(key); } catch { /* browser preview or unsupported remote */ }
  }
  void (async () => {
    if (saved?.session) {
      try { const me = await call<{ user: PublicUser }>("/api/auth/me"); saved.user = me.user; remember(); await profilesScreen(); return; }
      catch { saved.session = ""; }
    }
    await setup();
  })().catch(report);
})();
