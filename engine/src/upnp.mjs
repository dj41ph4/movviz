import pkg from "nat-upnp";
const { createClient } = pkg;

let client = null;

function getClient() {
  if (!client) client = createClient();
  return client;
}

function createMapping(options) {
  return new Promise((resolve, reject) => {
    getClient().portMapping(options, (error) => error ? reject(error) : resolve());
  });
}

function deleteMapping(options) {
  return new Promise((resolve, reject) => {
    getClient().portUnmapping(options, (error) => error ? reject(error) : resolve());
  });
}

export async function addMapping(port, description = "Movviz") {
  if (!port || port < 1024 || port > 65535) return;
  await Promise.all(["TCP", "UDP"].map(async (protocol) => {
    try {
      await createMapping({
        public: port,
        private: port,
        ttl: 0,
        protocol,
        description: `${description} (${protocol} ${port})`,
      });
      console.log(`[upnp] mapped ${protocol} ${port}`);
    } catch (e) {
      console.error(`[upnp] failed to map ${protocol} ${port}: ${e.message ?? e}`);
    }
  }));
}

export async function removeMapping(port) {
  if (!port || port < 1024 || port > 65535) return;
  await Promise.all(["TCP", "UDP"].map(async (protocol) => {
    try {
      await deleteMapping({ public: port, protocol });
      console.log(`[upnp] unmapped ${protocol} ${port}`);
    } catch {
      // Silently ignore — the mapping may expire on its own.
    }
  }));
}

export function close() {
  if (client) {
    try { client.close(); } catch {}
    client = null;
  }
}
