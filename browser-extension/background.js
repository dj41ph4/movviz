// Service worker : seul endroit qui parle au serveur Movviz. Les scripts de
// contenu (injectés dans les sites de cinéma) lui envoient des messages ; le
// jeton ne quitte donc jamais le contexte de l'extension.

async function readConfig() {
  const { serverUrl, token } = await chrome.storage.sync.get(["serverUrl", "token"]);
  return { serverUrl: (serverUrl || "").replace(/\/+$/, ""), token: token || "" };
}

async function call(path, init) {
  const { serverUrl, token } = await readConfig();
  if (!serverUrl || !token) return { ok: false, error: "not_configured" };
  try {
    const res = await fetch(serverUrl + path, {
      ...init,
      headers: { ...(init && init.headers), Authorization: "Bearer " + token },
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, data, serverUrl };
    const error = res.status === 401 ? "unauthorized" : data.error || "http_" + res.status;
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
