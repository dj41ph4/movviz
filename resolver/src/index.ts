import Fastify from "fastify";
import { registerRoutes, shutdown } from "./routes.js";

const PORT = parseInt(process.env.MOVVIZ_RESOLVER_PORT ?? "9830", 10);
// Écoute locale par défaut, comme le moteur : le résolveur n'a pas d'authentification et charge n'importe quelle
// adresse dans un navigateur — il ne doit être joignable que par Movviz. MOVVIZ_RESOLVER_HOST rouvre l'écoute si besoin.
const HOST = process.env.MOVVIZ_RESOLVER_HOST ?? "127.0.0.1";

const app = Fastify({ logger: true });

await registerRoutes(app);

const shutdownHandler = async () => {
  await app.close();
  await shutdown();
  process.exit(0);
};

process.on("SIGINT", shutdownHandler);
process.on("SIGTERM", shutdownHandler);

try {
  await app.listen({ port: PORT, host: HOST });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
