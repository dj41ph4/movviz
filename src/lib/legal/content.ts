/**
 * Contenu des pages publiques /privacy et /help.
 *
 * Chaque affirmation de confidentialité ici est vérifiée contre le code (voir
 * docs/ugreen-review/PRIVACY_DATAFLOW_SUMMARY.md) : en cas de changement du
 * comportement réel, mettre à jour ce texte ET PRIVACY_POLICY_VERSION
 * (src/lib/privacy/consent.ts).
 */

export interface LegalSection {
  title: string;
  /** Paragraphes de texte. */
  paragraphs?: string[];
  /** Puces, affichées après les paragraphes. */
  bullets?: string[];
}

export interface LegalDocument {
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
}

export type LegalLocale = "en" | "fr";

const REPO = "https://github.com/dj41ph4/movviz";
export const SUPPORT_URL = `${REPO}/issues`;
export const SOURCE_URL = REPO;
export const LICENSE_URL = `${REPO}/blob/main/LICENSE`;

export const PRIVACY: Record<LegalLocale, LegalDocument> = {
  en: {
    title: "MOVVIZ Privacy Policy",
    updated: "Last updated: 30 October 2026",
    intro:
      "MOVVIZ is free, open-source software (GPL-3.0) that you install on a server or NAS that you control. The developer does not operate a MOVVIZ service that receives your data: what MOVVIZ stores stays on your own machine, and the only data that leaves it goes to the third-party services you choose to use, as described below.",
    sections: [
      {
        title: "1. Who is responsible",
        paragraphs: [
          "The administrator of each MOVVIZ installation decides which accounts exist, which integrations are enabled and who can reach the server, and is the controller of the data stored on it. The MOVVIZ project provides the software only.",
        ],
      },
      {
        title: "2. Data stored on your server",
        paragraphs: ["MOVVIZ writes the following to the configuration folder you chose at installation (and to the media folder, for files):"],
        bullets: [
          "Accounts: username, role, a password hash (scrypt) — never the password itself — and, if you sign in with Plex, the linked Plex account identifier, token and avatar.",
          "Sessions: a login session identifier, kept in a cookie named movviz_session (HTTP-only, same-site).",
          "Library data: your movies and series, the paths of your media files, requests, watchlist, ratings, viewing history, watched state and playback resume positions.",
          "Settings and credentials you enter: API keys and tokens for the services you enable (for example TMDb, TheTVDB, OMDb, indexers, notification channels, the AI provider and Plex). They are stored as plain-text files in the configuration folder; MOVVIZ does not encrypt them. Protect that folder with your NAS access rights and backups.",
          "AI assistant data, only if you use it: your conversations with the assistant and the taste profile derived from your library and history, kept locally.",
          "Logs and diagnostics: container output, download-engine output and search/activity diagnostics, kept on the server for troubleshooting. They are not sent anywhere automatically.",
          "In your browser: the session cookie above and a few preferences in local storage (language, interface options, a device identifier, recent searches). There are no advertising or tracking cookies.",
        ],
      },
      {
        title: "3. Telemetry and analytics",
        paragraphs: [
          "MOVVIZ contains no analytics, advertising, crash-reporting or usage-tracking code, and it does not send usage statistics to the developer. The framework's own telemetry is disabled in the packaged application. This was verified in the source code and dependency list for this version and is re-checked when the policy is revised.",
          "One request goes to a service operated by a third party for the project: while an administrator has the MOVVIZ interface open (it checks periodically) or checks manually for updates, the server contacts the public GitHub releases API (api.github.com) to read the latest release number. No account data is sent; GitHub receives the server's IP address and standard request headers, as for any web request.",
        ],
      },
      {
        title: "4. Third-party services you may use",
        paragraphs: [
          "Nothing below is used until the administrator configures it or a user uses the feature. What is sent depends on the feature; the third party's own privacy policy applies to what it receives.",
        ],
        bullets: [
          "Metadata and artwork — TMDb (api.themoviedb.org, image.tmdb.org), TheTVDB, OMDb: titles, identifiers and searches, with the API key you provide. Posters are served by your server, or loaded from TMDb's image CDN by the browser if the administrator enables CDN images.",
          "Skip markers — TheIntroDB (api.theintrodb.org): when the administrator chooses \"All\" or \"API only\" in Settings → Metadata (or when Plex is not linked), the TMDb id of the title being played, plus its season and episode, are sent to fetch intro, recap, credits and preview timings. No user, account or file information is sent.",
          "Plex (plex.tv and Plex metadata services): sign-in, watchlist and library linking, if you choose to connect Plex.",
          "Indexers and sources you configure (Torznab/Newznab or other trackers): search terms and release requests, with your credentials. You are responsible for configuring only legitimate sources.",
          "Import lists: the list addresses you provide (for example Trakt, IMDb or Letterboxd lists) are fetched by the server.",
          "Release calendars and public web sources: for example AlloCiné and a public anime dubbing calendar are read by the server to build discovery rows.",
          "Trailers: the Apple iTunes search service is queried with the title to find trailers, and trailers may play through an embedded YouTube player, in which case your browser connects to Google/YouTube.",
          "Notifications — Discord, Slack, Telegram, Pushbullet, Gotify: the message text (titles, user names) is sent to the channel you configure.",
          "AI assistant — Google Gemini with your own key, and optionally Tavily web search: your messages and the library context needed to answer are sent to the provider. The assistant is off until you add a key.",
          "Seerr, if you connect it: requests and status updates.",
        ],
      },
      {
        title: "5. Media folders",
        paragraphs: [
          "MOVVIZ reads and writes only the configuration folder and the media folder you selected for it, to organise, download, import and play your content. It does not scan other folders of your NAS.",
        ],
      },
      {
        title: "6. Peer-to-peer downloads",
        paragraphs: [
          "If you use the download engine, the BitTorrent protocol makes your connection's public IP address visible to the other peers and trackers of each torrent. This is inherent to the protocol. You are responsible for using download features lawfully and for respecting the rights attached to the content.",
        ],
      },
      {
        title: "7. Your control and deletion",
        paragraphs: ["The administrator can, from the MOVVIZ interface:"],
        bullets: [
          "delete a user account (Users page);",
          "reset a profile's viewing history and resume positions (profile page);",
          "remove or replace any stored API key or token, and disconnect Plex, in the corresponding Settings tab;",
          "turn optional integrations off by clearing their configuration;",
          "export a backup of the configuration (Settings > About);",
          "perform a factory reset that erases MOVVIZ's stored data (Settings > Danger zone).",
        ],
      },
      {
        title: "8. Security",
        paragraphs: [
          "Passwords are hashed and sessions use HTTP-only cookies. The security of the NAS, the network exposure of the application, the permissions on the configuration folder (which holds integration credentials in clear text) and your backups remain the administrator's responsibility. Do not expose MOVVIZ to the internet without protection.",
        ],
      },
      {
        title: "9. Children",
        paragraphs: ["MOVVIZ is not a service directed at children. The administrator of an instance decides who may use it."],
      },
      {
        title: "10. Consent and changes",
        paragraphs: [
          "When this is required by the distribution channel (for example the UGREEN App Center package), MOVVIZ asks for your explicit acceptance of this policy and of the software license at first setup, and records the policy version and the date and time of acceptance on your server. This policy may change when the software or the law changes; the version date above identifies the current text.",
        ],
      },
      {
        title: "11. Contact and sources",
        bullets: [`Technical support: ${SUPPORT_URL}`, `Source code: ${SOURCE_URL}`, `License (GNU GPL v3): ${LICENSE_URL}`],
      },
    ],
  },
  fr: {
    title: "Politique de confidentialité de MOVVIZ",
    updated: "Dernière mise à jour : 30 octobre 2026",
    intro:
      "MOVVIZ est un logiciel libre et gratuit (GPL-3.0) que vous installez sur un serveur ou un NAS que vous contrôlez. Le développeur n'exploite aucun service MOVVIZ qui recevrait vos données : ce que MOVVIZ enregistre reste sur votre machine, et les seules données qui en sortent vont vers les services tiers que vous choisissez d'utiliser, comme décrit ci-dessous.",
    sections: [
      {
        title: "1. Qui est responsable",
        paragraphs: [
          "L'administrateur de chaque installation décide des comptes existants, des intégrations activées et de l'accès au serveur ; il est responsable des données qui y sont stockées. Le projet MOVVIZ fournit uniquement le logiciel.",
        ],
      },
      {
        title: "2. Données stockées sur votre serveur",
        paragraphs: ["MOVVIZ écrit ce qui suit dans le dossier de configuration choisi à l'installation (et dans le dossier multimédia, pour les fichiers) :"],
        bullets: [
          "Comptes : nom d'utilisateur, rôle, empreinte du mot de passe (scrypt) — jamais le mot de passe lui-même — et, si vous vous connectez avec Plex, l'identifiant, le jeton et l'avatar du compte Plex lié.",
          "Sessions : un identifiant de session conservé dans un cookie nommé movviz_session (HTTP-only, same-site).",
          "Données de bibliothèque : vos films et séries, les chemins de vos fichiers, les demandes, la liste de suivi, les notes, l'historique de lecture, l'état vu/non vu et les positions de reprise.",
          "Réglages et identifiants que vous saisissez : clés d'API et jetons des services que vous activez (par exemple TMDb, TheTVDB, OMDb, indexeurs, canaux de notification, fournisseur d'IA et Plex). Ils sont enregistrés en clair dans des fichiers du dossier de configuration ; MOVVIZ ne les chiffre pas. Protégez ce dossier par les droits d'accès et les sauvegardes de votre NAS.",
          "Données de l'assistant IA, seulement si vous l'utilisez : vos conversations avec l'assistant et le profil de goûts dérivé de votre bibliothèque et de votre historique, conservés localement.",
          "Journaux et diagnostics : sortie du conteneur, du moteur de téléchargement et diagnostics de recherche et d'activité, conservés sur le serveur pour le dépannage. Rien n'est envoyé automatiquement.",
          "Dans votre navigateur : le cookie de session ci-dessus et quelques préférences en stockage local (langue, options d'interface, identifiant d'appareil, recherches récentes). Il n'y a aucun cookie publicitaire ni de suivi.",
        ],
      },
      {
        title: "3. Télémétrie et statistiques",
        paragraphs: [
          "MOVVIZ ne contient aucun code d'analyse, de publicité, de rapport de plantage ou de suivi d'usage, et n'envoie aucune statistique d'utilisation au développeur. La télémétrie propre au framework est désactivée dans l'application packagée. Cela a été vérifié dans le code source et la liste des dépendances de cette version, et l'est de nouveau à chaque révision de la politique.",
          "Une requête vise un service exploité par un tiers pour le projet : tant qu'un administrateur a l'interface MOVVIZ ouverte (elle vérifie périodiquement) ou qu'il vérifie manuellement les mises à jour, le serveur interroge l'API publique des versions de GitHub (api.github.com) pour lire le numéro de la dernière version. Aucune donnée de compte n'est envoyée ; GitHub reçoit l'adresse IP du serveur et les en-têtes habituels, comme pour toute requête web.",
        ],
      },
      {
        title: "4. Services tiers que vous pouvez utiliser",
        paragraphs: [
          "Rien de ce qui suit n'est utilisé tant que l'administrateur ne l'a pas configuré ou qu'un utilisateur n'emploie pas la fonction. Ce qui est envoyé dépend de la fonction ; la politique du tiers s'applique à ce qu'il reçoit.",
        ],
        bullets: [
          "Métadonnées et visuels — TMDb (api.themoviedb.org, image.tmdb.org), TheTVDB, OMDb : titres, identifiants et recherches, avec la clé d'API que vous fournissez. Les affiches sont servies par votre serveur, ou chargées par le navigateur depuis le CDN d'images de TMDb si l'administrateur active les images CDN.",
          "Repères de saut — TheIntroDB (api.theintrodb.org) : lorsque l'administrateur choisit « Tout » ou « API uniquement » dans Réglages → Métadonnées (ou que Plex n'est pas lié), l'identifiant TMDb du titre lu, avec sa saison et son épisode, est envoyé pour obtenir les repères d'intro, de récap, de générique et d'aperçu. Aucune information sur l'utilisateur, le compte ou les fichiers n'est envoyée.",
          "Plex (plex.tv et services de métadonnées Plex) : connexion, liste de suivi et liaison de la bibliothèque, si vous choisissez de connecter Plex.",
          "Indexeurs et sources que vous configurez (Torznab/Newznab ou autres trackers) : termes de recherche et demandes de releases, avec vos identifiants. Vous êtes responsable de ne configurer que des sources légitimes.",
          "Listes d'import : les adresses de listes que vous fournissez (par exemple Trakt, IMDb ou Letterboxd) sont téléchargées par le serveur.",
          "Calendriers de sorties et sources web publiques : par exemple AlloCiné et un calendrier public des sorties d'animés en VF sont lus par le serveur pour composer les rangées de découverte.",
          "Bandes-annonces : le service de recherche Apple iTunes est interrogé avec le titre pour trouver des bandes-annonces, qui peuvent aussi se lire via un lecteur YouTube intégré ; votre navigateur se connecte alors à Google/YouTube.",
          "Notifications — Discord, Slack, Telegram, Pushbullet, Gotify : le texte du message (titres, noms d'utilisateurs) est envoyé au canal que vous configurez.",
          "Assistant IA — Google Gemini avec votre propre clé, et en option la recherche web Tavily : vos messages et le contexte de bibliothèque nécessaire pour répondre sont envoyés au fournisseur. L'assistant reste inactif tant que vous n'ajoutez pas de clé.",
          "Seerr, si vous le connectez : demandes et mises à jour de statut.",
        ],
      },
      {
        title: "5. Dossiers multimédia",
        paragraphs: [
          "MOVVIZ lit et écrit uniquement le dossier de configuration et le dossier multimédia que vous lui avez désignés, pour organiser, télécharger, importer et lire vos contenus. Il ne parcourt pas les autres dossiers de votre NAS.",
        ],
      },
      {
        title: "6. Téléchargements pair à pair",
        paragraphs: [
          "Si vous utilisez le moteur de téléchargement, le protocole BitTorrent rend l'adresse IP publique de votre connexion visible des autres pairs et des trackers de chaque torrent. C'est inhérent au protocole. Vous êtes responsable d'un usage licite des fonctions de téléchargement et du respect des droits attachés aux contenus.",
        ],
      },
      {
        title: "7. Votre contrôle et la suppression",
        paragraphs: ["L'administrateur peut, depuis l'interface MOVVIZ :"],
        bullets: [
          "supprimer un compte utilisateur (page Utilisateurs) ;",
          "réinitialiser l'historique de lecture et les positions de reprise d'un profil (page du profil) ;",
          "retirer ou remplacer toute clé d'API ou jeton enregistré, et déconnecter Plex, dans l'onglet de réglages correspondant ;",
          "désactiver les intégrations optionnelles en effaçant leur configuration ;",
          "exporter une sauvegarde de la configuration (Réglages > À propos) ;",
          "effectuer une réinitialisation d'usine qui efface les données enregistrées par MOVVIZ (Réglages > Zone de danger).",
        ],
      },
      {
        title: "8. Sécurité",
        paragraphs: [
          "Les mots de passe sont hachés et les sessions utilisent des cookies HTTP-only. La sécurité du NAS, l'exposition réseau de l'application, les droits sur le dossier de configuration (qui contient en clair les identifiants des intégrations) et vos sauvegardes restent sous la responsabilité de l'administrateur. N'exposez pas MOVVIZ sur Internet sans protection.",
        ],
      },
      {
        title: "9. Enfants",
        paragraphs: ["MOVVIZ n'est pas un service destiné aux enfants. L'administrateur d'une instance décide de qui peut l'utiliser."],
      },
      {
        title: "10. Consentement et modifications",
        paragraphs: [
          "Lorsque le canal de distribution l'exige (par exemple le paquet de l'App Center UGREEN), MOVVIZ demande votre acceptation explicite de cette politique et de la licence du logiciel à la première configuration, et enregistre sur votre serveur la version de la politique ainsi que la date et l'heure de l'acceptation. Cette politique peut évoluer avec le logiciel ou la loi ; la date de version ci-dessus identifie le texte en vigueur.",
        ],
      },
      {
        title: "11. Contact et sources",
        bullets: [`Support technique : ${SUPPORT_URL}`, `Code source : ${SOURCE_URL}`, `Licence (GNU GPL v3) : ${LICENSE_URL}`],
      },
    ],
  },
};

export const HELP: Record<LegalLocale, LegalDocument> = {
  en: {
    title: "MOVVIZ Help",
    updated: "Applies to the UGREEN NAS package and the web application.",
    intro:
      "MOVVIZ is a self-hosted media platform: discover movies and series, request them, search your sources, download, import into a library, then play them from any device.",
    sections: [
      {
        title: "Install on a UGREEN NAS (UGOS Pro)",
        bullets: [
          "Install the MOVVIZ package from the UGREEN App Center (or the UPK provided for testing). The Docker suite must be installed.",
          "Choose the configuration folder (CONFIG_PATH): MOVVIZ keeps its settings and data there, and updates keep it.",
          "Choose the media folder (DATA_PATH): one shared root for downloads and the library, so imports are instant moves. Pick a folder on a normal storage volume, not a temporary application folder.",
          "Set PUID and PGID to the numeric user and group that own both folders and may write to them (the NAS administrator account's IDs usually work).",
          "Click Enable, then open MOVVIZ from UGOS Pro. It listens on port 9810; BitTorrent uses ports 55000 and 55001 (TCP/UDP).",
        ],
      },
      {
        title: "First launch",
        bullets: [
          "The setup wizard opens on first access.",
          "On the UGREEN package, review the Privacy Policy and the license and tick the consent box to continue; it is never pre-ticked.",
          "Create the administrator account, then follow the steps: language, metadata key, download folders, optional integrations.",
          "Optional integrations (TMDb, indexers, Plex, notifications, AI) stay off until you configure them.",
        ],
      },
      {
        title: "Folders and permissions",
        bullets: [
          "MOVVIZ only uses the two folders you selected. Downloads and the library live under the media folder.",
          "If you see a message that /config or /data is not writable, the PUID/PGID do not match the owner of the folder: change the IDs in the application settings or the owner of the folder.",
          "If MOVVIZ cannot start, check that ports 9810, 55000 and 55001 are free on the NAS.",
        ],
      },
      {
        title: "Library",
        bullets: [
          "Add titles from Discover or Search, or import existing files with the library scan in Settings.",
          "Movies and series appear in Library with their artwork and metadata; mark titles you do not want searched.",
        ],
      },
      {
        title: "Downloads",
        bullets: [
          "Configure your own indexers or sources in Settings. MOVVIZ then searches, picks a release according to your quality rules, downloads it and imports it into the library.",
          "Follow progress in Activity and Downloads. You are responsible for using only legitimate sources and respecting content rights.",
        ],
      },
      {
        title: "Playback",
        bullets: [
          "MOVVIZ prefers Direct Play. When the device cannot play a file as is, it remuxes or transcodes it with FFmpeg (software transcoding on the UGREEN package).",
          "Your place and watched state are saved per profile; resume from Home.",
        ],
      },
      {
        title: "Optional integrations",
        bullets: [
          "Settings lists each integration (metadata keys, indexers, Plex, notifications, AI assistant). Each one needs your own credentials.",
          "Remove an integration's key to turn it off. See the Privacy Policy for what each one sends.",
        ],
      },
      {
        title: "Diagnostics",
        bullets: [
          "Settings > Diagnostics runs an installation health check.",
          "Settings > Logs shows the latest engine and search logs; copy them when asking for support. Check them for secrets before sharing.",
        ],
      },
      {
        title: "Updating",
        bullets: [
          "Update through the UGREEN App Center. Configuration and media folders are kept.",
          "Settings > About shows the current version and checks GitHub for newer releases.",
        ],
      },
      {
        title: "Uninstalling",
        bullets: [
          "Uninstall from the UGOS Pro app manager. Your configuration and media folders are not deleted by MOVVIZ; remove them yourself if you want to erase everything.",
          "Export a backup (Settings > About) first if you may reinstall later.",
        ],
      },
      {
        title: "Support",
        bullets: [`Report problems or ask questions: ${SUPPORT_URL}`, `Source code: ${SOURCE_URL}`],
      },
    ],
  },
  fr: {
    title: "Aide de MOVVIZ",
    updated: "Valable pour le paquet UGREEN NAS et l'application web.",
    intro:
      "MOVVIZ est une plateforme multimédia auto-hébergée : découvrir des films et séries, les demander, interroger vos sources, télécharger, importer dans une bibliothèque, puis les lire depuis n'importe quel appareil.",
    sections: [
      {
        title: "Installation sur un NAS UGREEN (UGOS Pro)",
        bullets: [
          "Installez le paquet MOVVIZ depuis l'App Center UGREEN (ou l'UPK fourni pour test). La suite Docker doit être installée.",
          "Choisissez le dossier de configuration (CONFIG_PATH) : MOVVIZ y conserve ses réglages et ses données, et les mises à jour le gardent.",
          "Choisissez le dossier multimédia (DATA_PATH) : une racine unique pour téléchargements et bibliothèque, afin que les imports soient de simples déplacements. Prenez un dossier sur un volume de stockage normal, pas un dossier temporaire d'application.",
          "Renseignez PUID et PGID : l'identifiant numérique de l'utilisateur et du groupe propriétaires des deux dossiers et autorisés à y écrire (ceux du compte administrateur du NAS conviennent en général).",
          "Cliquez sur Activer, puis ouvrez MOVVIZ depuis UGOS Pro. Il écoute sur le port 9810 ; BitTorrent utilise les ports 55000 et 55001 (TCP/UDP).",
        ],
      },
      {
        title: "Premier lancement",
        bullets: [
          "L'assistant de configuration s'ouvre au premier accès.",
          "Sur le paquet UGREEN, lisez la politique de confidentialité et la licence puis cochez la case de consentement pour continuer ; elle n'est jamais pré-cochée.",
          "Créez le compte administrateur, puis suivez les étapes : langue, clé de métadonnées, dossiers de téléchargement, intégrations optionnelles.",
          "Les intégrations optionnelles (TMDb, indexeurs, Plex, notifications, IA) restent inactives tant que vous ne les configurez pas.",
        ],
      },
      {
        title: "Dossiers et permissions",
        bullets: [
          "MOVVIZ n'utilise que les deux dossiers choisis. Téléchargements et bibliothèque se trouvent sous le dossier multimédia.",
          "Si un message indique que /config ou /data n'est pas accessible en écriture, le PUID/PGID ne correspond pas au propriétaire du dossier : changez les identifiants dans les réglages de l'application ou le propriétaire du dossier.",
          "Si MOVVIZ ne démarre pas, vérifiez que les ports 9810, 55000 et 55001 sont libres sur le NAS.",
        ],
      },
      {
        title: "Bibliothèque",
        bullets: [
          "Ajoutez des titres depuis Découvrir ou la recherche, ou importez des fichiers existants avec l'analyse de bibliothèque dans les Réglages.",
          "Films et séries apparaissent dans la Bibliothèque avec visuels et métadonnées ; décochez le suivi des titres que vous ne voulez pas voir recherchés.",
        ],
      },
      {
        title: "Téléchargements",
        bullets: [
          "Configurez vos propres indexeurs ou sources dans les Réglages. MOVVIZ cherche alors, choisit une release selon vos règles de qualité, la télécharge et l'importe dans la bibliothèque.",
          "Suivez l'avancement dans Activité et Téléchargements. Vous êtes responsable de n'utiliser que des sources légitimes et de respecter les droits des contenus.",
        ],
      },
      {
        title: "Lecture",
        bullets: [
          "MOVVIZ privilégie la lecture directe. Quand l'appareil ne peut pas lire un fichier tel quel, il le remuxe ou le transcode avec FFmpeg (transcodage logiciel sur le paquet UGREEN).",
          "Votre position et l'état vu sont enregistrés par profil ; reprenez depuis l'accueil.",
        ],
      },
      {
        title: "Intégrations optionnelles",
        bullets: [
          "Les Réglages listent chaque intégration (clés de métadonnées, indexeurs, Plex, notifications, assistant IA). Chacune demande vos propres identifiants.",
          "Retirez la clé d'une intégration pour la désactiver. Voir la politique de confidentialité pour ce que chacune envoie.",
        ],
      },
      {
        title: "Diagnostics",
        bullets: [
          "Réglages > Diagnostics lance un contrôle de santé de l'installation.",
          "Réglages > Journaux affiche les derniers journaux du moteur et des recherches ; copiez-les pour demander de l'aide, après avoir vérifié qu'ils ne contiennent aucun secret.",
        ],
      },
      {
        title: "Mise à jour",
        bullets: [
          "Mettez à jour par l'App Center UGREEN. Les dossiers de configuration et multimédia sont conservés.",
          "Réglages > À propos affiche la version courante et vérifie sur GitHub si une version plus récente existe.",
        ],
      },
      {
        title: "Désinstallation",
        bullets: [
          "Désinstallez depuis le gestionnaire d'applications d'UGOS Pro. MOVVIZ ne supprime pas vos dossiers de configuration et multimédia ; supprimez-les vous-même pour tout effacer.",
          "Exportez d'abord une sauvegarde (Réglages > À propos) si vous comptez réinstaller.",
        ],
      },
      {
        title: "Support",
        bullets: [`Signaler un problème ou poser une question : ${SUPPORT_URL}`, `Code source : ${SOURCE_URL}`],
      },
    ],
  },
};
