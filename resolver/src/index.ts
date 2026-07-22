import Fastify from "fastify";
import { registerRoutes, shutdown } from "./routes.js";

const PORT = parseInt(process.env.MOVVIZ_RESOLVER_PORT ?? "9830", 10);
const HOST = process.env.MOVVIZ_RESOLVER_HOST ?? "0.0.0.0";

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
