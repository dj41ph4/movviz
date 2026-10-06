// Service worker : seul endroit qui parle au serveur Movviz. Les scripts de
// contenu (injectés dans les sites de cinéma) lui envoient des messages ; le
// jeton ne quitte donc jamais le contexte de l'extension.

async function readConfig() {
  const { serverUrl, token } = await chrome.storage.sync.get(["serverUrl", "token"]);
  return { serverUrl: (serverUrl || "").replace(/\/+$/, ""), token: token || "" };
}

/** Autorisation accordée pour ce serveur, avec ou sans port dans le motif. */
async function hasAccess(serverUrl) {
  try {
    const url = new URL(serverUrl);
    const withPort = `${url.origin}/*`;
    const withoutPort = `${url.protocol}//${url.hostname}/*`;
    return (
      (await chrome.permissions.contains({ origins: [withPort] })) ||
      (await chrome.permissions.contains({ origins: [withoutPort] }))
    );
  } catch {
    return false;
  }
}

async function call(path, init) {
  const { serverUrl, token } = await readConfig();
  if (!serverUrl || !token) return { ok: false, error: "not_configured" };
  if (!(await hasAccess(serverUrl))) return { ok: false, error: "no_permission" };
  try {
    const res = await fetch(serverUrl + path, {
      ...init,
      headers: { ...(init && init.headers), Authorization: "Bearer " + token },
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, data, serverUrl };
    // Un 401 sans la signature de nos routes vient du proxy de Movviz : le
    // serveur ne connaît pas encore l'extension (version trop ancienne).
    let error = data.error || "http_" + res.status;
    if (res.status === 401) error = data.source === "extension" ? "unauthorized" : "outdated";
    else if (res.status === 404 && !data.error) error = "outdated";
    return { ok: false, error, status: res.status, serverUrl };
  } catch {
    return { ok: false, error: "network" };
  }
}

const handlers = {
  me: () => call("/api/extension/me"),
  lookup: (msg) => call("/api/extension/lookup?" + new URLSearchParams(msg.query).toString()),
  request: (msg) =>
    call("/api/extension/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: msg.mediaType, tmdbId: msg.tmdbId }),
    }),
};

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === "openOptions") {
    chrome.runtime.openOptionsPage();
    return false;
  }
  const handler = msg && handlers[msg.type];
  if (!handler) return false;
  handler(msg).then(sendResponse);
  return true; // réponse asynchrone
});

chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") chrome.runtime.openOptionsPage();
});
