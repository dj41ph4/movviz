// Adaptateurs par site : chacun dit comment identifier le titre de la page
// (identifiant TMDb/IMDb/TVDB si le site l'expose, sinon titre + année) et où
// poser le widget. Si aucun point d'ancrage n'existe, le widget flotte en bas
// à gauche plutôt que de disparaître quand un site change son HTML.
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const text = (sel) => ($(sel)?.textContent || "").trim();
  const year = (s) => { const m = /\b(19|20)\d{2}\b/.exec(s || ""); return m ? Number(m[0]) : undefined; };
  const tmdbFromHref = (href) => {
    const m = /themoviedb\.org\/(movie|tv)\/(\d+)/.exec(href || "");
    return m ? { type: m[1] === "movie" ? "movie" : "series", tmdbId: m[2] } : null;
  };

  /** Premier sélecteur présent → { el, where }, sinon null. */
  const anchor = (...candidates) => {
    for (const [sel, where = "after"] of candidates) {
      const el = $(sel);
      if (el) return { el, where };
    }
    return null;
  };

  const sites = {
    "www.themoviedb.org"() {
      const m = /^\/(movie|tv)\/(\d+)/.exec(location.pathname);
      if (!m) return null;
      return {
        query: { type: m[1] === "movie" ? "movie" : "series", tmdbId: m[2] },
        anchor: anchor(["ul.auto.actions"], ["section.images .title h2", "after"], ["h2 a"]),
      };
    },

    "www.imdb.com"() {
      const m = /\/title\/(tt\d+)/.exec(location.pathname);
      if (!m) return null;
      return {
        query: { imdbId: m[1] },
        anchor: anchor(["div:has(> .ipc-split-button__btn)"], ["[data-testid='hero__pageTitle']"]),
      };
    },

    "www.allocine.fr"() {
      const isFilm = location.pathname.startsWith("/film");
      const title = text("div.titlebar-title.titlebar-title-xl") || text("h1");
      if (!title) return null;
      return {
        query: { type: isFilm ? "movie" : "series", title, year: isFilm ? year(text("a.xXx.date.blue-link")) : undefined },
        anchor: anchor(["div.bam-container"], ["div.titlebar-title.titlebar-title-xl"]),
      };
    },

    "www.senscritique.com"() {
      const m = /^\/(film|serie)\/[^/]+\/\d+/.exec(location.pathname);
      const title = text("h1");
      if (!m || !title) return null;
      const credits = text("p[data-testid='creators']").split("·");
      return {
        query: { type: m[1] === "film" ? "movie" : "series", title, year: year(credits[2]) },
        anchor: anchor(["div[data-testid='product-infos']"], ["h1"]),
      };
    },

    "thetvdb.com"() {
      const isMovie = location.pathname.startsWith("/movies");
      const links = [...document.querySelectorAll("#series_basic_info a[href]")].map((a) => a.href);
      const tmdb = links.map(tmdbFromHref).find(Boolean);
      const imdb = links.map((h) => /\/title\/(tt\d+)/.exec(h)?.[1]).find(Boolean);
      const type = isMovie ? "movie" : "series";
      if (!tmdb && !imdb) return null;
      return {
        query: tmdb ? { type, tmdbId: tmdb.tmdbId } : { type, imdbId: imdb },
        anchor: anchor(["#translations"], ["#series_basic_info"], ["h1"]),
      };
    },

    "letterboxd.com"() {
      const tmdb = tmdbFromHref($("a[data-track-action=TMDB]")?.href);
      if (!tmdb) return null;
      return {
        query: tmdb,
        anchor: anchor(["div.review.body-text"], ["section.film-header-lockup"], ["h1"]),
      };
    },

    "www.rottentomatoes.com"() {
      const isMovie = location.pathname.startsWith("/m/");
      const title = text("rt-text[slot=title]") || text("h1");
      if (!title) return null;
      return {
        query: { type: isMovie ? "movie" : "series", title },
        anchor: anchor(["media-hero"], ["h1"]),
      };
    },

    "www.justwatch.com"() {
      const m = /\/(movie|tv-show)\/[^/]+$/.exec(location.pathname);
      const heading = $("div.title-detail-hero h1");
      if (!m || !heading) return null;
      const raw = heading.textContent.trim();
      return {
        query: {
          type: m[1] === "movie" ? "movie" : "series",
          title: raw.replace(/\s*\(\d{4}\)\s*$/, ""),
          year: year(raw) || year(text("div.title-detail-hero h1 + span")),
        },
        anchor: anchor(["div.title-sidebar > div > button.basic-button"], ["div.title-sidebar"], ["div.title-detail-hero h1"]),
      };
    },

    "trakt.tv"() {
      const isMovie = location.pathname.startsWith("/movies");
      const tmdb = tmdbFromHref($("#external-link-tmdb")?.href);
      const imdb = /\/title\/(tt\d+)/.exec($("#external-link-imdb")?.href || "")?.[1];
      const type = isMovie ? "movie" : "series";
      if (!tmdb && !imdb) return null;
      return {
        query: tmdb ? { type, tmdbId: tmdb.tmdbId } : { type, imdbId: imdb },
        anchor: anchor(["div.readmore"], ["#overview"], ["h1"]),
      };
    },

    "www.taste.io"() {
      const title = text("h1");
      if (!title) return null;
      return {
        query: { type: location.pathname.startsWith("/movies") ? "movie" : "series", title },
        anchor: anchor(["div[class^='styles_container']"], ["h1"]),
      };
    },
  };

  const adapter = sites[location.hostname];
  if (!adapter) return;

  // Les sites sont des SPA pour la plupart : on surveille l'URL, et on
  // retente quelques secondes tant que la page n'a pas affiché son contenu.
  let lastHref = "";
  let attempts = 0;
  let mountedKey = "";

  function attempt() {
    if (location.href !== lastHref) {
      lastHref = location.href;
      attempts = 0;
      mountedKey = "";
      window.MovvizCompanion.unmount();
    }
    if (mountedKey || attempts > 20) return;
    attempts++;
    const found = adapter();
    if (!found) return;
    // Sans ancre au bout de 5 s (10 essais), on bascule en widget flottant.
    if (!found.anchor && attempts < 10) return;
    mountedKey = lastHref;
    const placement = found.anchor ? { mode: "anchor", ...found.anchor } : { mode: "float" };
    window.MovvizCompanion.mount(placement, found.query);
  }

  attempt();
  setInterval(attempt, 500);
})();
