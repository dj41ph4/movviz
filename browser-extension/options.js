const t = (key, ...subs) => chrome.i18n.getMessage(key, subs) || key;
const $ = (id) => document.getElementById(id);

document.querySelectorAll("[data-i18n]").forEach((node) => { node.textContent = t(node.dataset.i18n); });

const status = $("status");
function show(kind, message) {
  status.className = `pill ${kind}`;
  status.textContent = message;
  status.hidden = false;
}

function normalize(raw) {
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `http://${raw}`);
    return url.origin + url.pathname.replace(/\/+$/, "");
  } catch {
    return null;
  }
}

async function testConnection() {
  show("dim", t("optTesting"));
  const res = await new Promise((resolve) => chrome.runtime.sendMessage({ type: "me" }, resolve));
  if (res && res.ok) return show("ok", t("optConnected", res.data.username));
  const key = {
    unauthorized: "errUnauthorized", network: "errNetwork",
    no_permission: "errNoPermission", outdated: "errOutdated",
  }[res && res.error] || "errGeneric";
  show("down", t(key));
}

chrome.storage.sync.get(["serverUrl", "token"]).then(({ serverUrl, token }) => {
  $("serverUrl").value = serverUrl || "";
  $("token").value = token || "";
  if (serverUrl && token) testConnection();
});

$("form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const serverUrl = normalize($("serverUrl").value.trim());
  const token = $("token").value.trim();
  if (!serverUrl) return show("down", t("optBadUrl"));

  // L'autorisation d'appeler ce serveur précis est demandée ici (geste de
  // l'utilisateur) : l'extension n'a aucun accès réseau large par défaut.
  const origin = new URL(serverUrl).origin;
  let granted = false;
  try {
    granted = await chrome.permissions.request({ origins: [`${origin}/*`] });
  } catch {
    // Certains navigateurs refusent un motif avec port : on retente sans.
    try {
      granted = await chrome.permissions.request({ origins: [`${new URL(serverUrl).protocol}//${new URL(serverUrl).hostname}/*`] });
    } catch {
      granted = false;
    }
  }
  if (!granted) return show("down", t("optPermissionDenied"));

  $("save").disabled = true;
  await chrome.storage.sync.set({ serverUrl, token });
  $("serverUrl").value = serverUrl;
  await testConnection();
  $("save").disabled = false;
});
