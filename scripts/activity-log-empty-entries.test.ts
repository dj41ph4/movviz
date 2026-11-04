import { test } from "node:test";
import assert from "node:assert/strict";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";

test("un événement du moteur sans kind ni media n'entre plus dans l'historique", async () => {
  const config = await fsp.mkdtemp(path.join(os.tmpdir(), "movviz-activity-"));
  const previous = process.env.MOVVIZ_CONFIG_DIR;
  process.env.MOVVIZ_CONFIG_DIR = config;
  try {
    // État réel relevé en prod : des lignes réduites à actor, id et timestamp.
    await fsp.writeFile(path.join(config, "activity-v2.json"), JSON.stringify([
      { actor: "system", id: "ac_vide", timestamp: 2 },
      { id: "ac_film", kind: "imported", actor: "system", timestamp: 1, media: { id: "1", title: "Film", type: "movie", href: "/title/movie/1" } },
    ]));
    const [{ loadActivityV2, logActivityV2 }, { POST }, { getEngineToken }, { flushPendingJsonWritesSync }] = await Promise.all([
      import("@/lib/activity/v2/store"),
      import("@/app/api/activity/log/route"),
      import("@/lib/engine/token"),
      import("@/lib/fsJsonCache"),
    ]);
    assert.deepEqual(loadActivityV2().map((entry) => entry.id), ["ac_film"], "une ligne vide déjà enregistrée n'est plus servie");

    const post = (body: unknown) => POST(new NextRequest("http://x/api/activity/log", {
      method: "POST",
      headers: { "x-movviz-token": getEngineToken() },
      body: JSON.stringify(body),
    }));
    const ignored = await post({ type: "torrent-added", data: { infoHash: "abc" }, source: "engine", clientType: "movies" });
    assert.equal(ignored.status, 200);
    assert.equal(loadActivityV2().length, 1, "le format du moteur n'écrit plus de ligne vide");

    const media = { id: "2", title: "Série", type: "series", href: "/title/series/2" };
    assert.equal((await post({ kind: "grabbed", media })).status, 200);
    assert.equal(loadActivityV2().length, 2, "une vraie entrée reste enregistrée");

    logActivityV2({ kind: "failed", media: media as never, actor: "system" });
    flushPendingJsonWritesSync();
    const written = JSON.parse(await fsp.readFile(path.join(config, "activity-v2.json"), "utf8")) as { id: string }[];
    assert.equal(written.some((entry) => entry.id === "ac_vide"), false, "la ligne vide disparaît du fichier à la prochaine écriture");
    assert.equal(written.length, 3);
  } finally {
    if (previous == null) delete process.env.MOVVIZ_CONFIG_DIR;
    else process.env.MOVVIZ_CONFIG_DIR = previous;
    await fsp.rm(config, { recursive: true, force: true }).catch(() => {});
  }
});
