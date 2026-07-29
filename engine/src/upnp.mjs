import pkg from "nat-upnp";
const { createClient } = pkg;

let client = null;

function getClient() {
  if (!client) client = createClient();
  return client;
}

export async function addMapping(port, description = "Movviz") {
  if (!port || port < 1024 || port > 65535) return;
  try {
    await getClient().portMapping({
      public: port,
      private: port,
      ttl: 0,
      protocol: "TCP",
      description: `${description} (TCP ${port})`,
    });
    console.log(`[upnp] mapped TCP ${port}`);
  } catch (e) {
    console.error(`[upnp] failed to map TCP ${port}: ${e.message ?? e}`);
  }
}

export async function removeMapping(port) {
  if (!port || port < 1024 || port > 65535) return;
  try {
    await getClient().portUnmapping({ public: port, protocol: "TCP" });
    console.log(`[upnp] unmapped TCP ${port}`);
  } catch {
    // Silently ignore — the mapping may expire on its own
  }
}

export function close() {
  if (client) {
    try { client.close(); } catch {}
    client = null;
  }
}
