/**
 * Vérificateur de mises à jour firmware — « Watchtower du firmware ».
 *
 * Le fog interroge périodiquement l'API GitHub Releases du dépôt (public → pas
 * d'auth, comme les images GHCR). Dès qu'une version plus récente que celle
 * actuellement déployée apparaît, il déclenche un callback (typiquement : pousser
 * une commande OTA aux ESP via MQTT).
 *
 * Cf. docs OTA / gestion à distance.
 */

export interface GithubAsset {
  name: string;
  browser_download_url: string;
}

export interface GithubRelease {
  tag_name: string;
  assets: GithubAsset[];
}

/**
 * Compare deux versions « semver light » (v1.2.3 / 1.2.3). Renvoie true si
 * `remote` est strictement plus récente que `local`. Tolère le préfixe « v » et
 * les longueurs différentes.
 */
export function isNewerVersion(remote: string, local: string): boolean {
  const norm = (v: string): number[] =>
    String(v)
      .trim()
      .replace(/^v/i, "")
      .split(".")
      .map((n) => parseInt(n, 10) || 0);
  const r = norm(remote);
  const l = norm(local);
  for (let i = 0; i < Math.max(r.length, l.length); i++) {
    const a = r[i] ?? 0;
    const b = l[i] ?? 0;
    if (a !== b) return a > b;
  }
  return false;
}

/**
 * Choisit l'asset .bin correspondant à l'environnement (ex. "universal").
 * Fallback : le premier .bin trouvé.
 */
export function pickFirmwareAsset(
  release: GithubRelease,
  envName: string,
): GithubAsset | undefined {
  const bins = (release.assets ?? []).filter((a) => a.name.endsWith(".bin"));
  return bins.find((a) => a.name.includes(envName)) ?? bins[0];
}

export interface FirmwareUpdaterOptions {
  repo: string; // "GaspardMenou/Iot-RAMI"
  envName: string; // "universal"
  intervalMs: number;
  // Mode RECOMMANDÉ (par appareil) : remonte le tag de la dernière release à
  // chaque check ; le fog compare ensuite la version de CHAQUE ESP et cible les
  // appareils en retard. Pas de version à fixer dans le .env.
  onLatestRelease?: (latestTag: string) => void;
  // Mode legacy (version unique) : déclenché si latest > currentVersion.
  currentVersion?: string;
  onUpdateAvailable?: (version: string, downloadUrl: string) => void;
  // Injectable pour les tests (par défaut : fetch global Node 18+).
  fetchFn?: typeof fetch;
}

export class FirmwareUpdater {
  private current: string;
  private timer: NodeJS.Timeout | undefined;
  private readonly fetchFn: typeof fetch;

  constructor(private readonly opts: FirmwareUpdaterOptions) {
    this.current = opts.currentVersion ?? "";
    this.fetchFn = opts.fetchFn ?? fetch;
  }

  start(): void {
    this.check().catch((e) => console.error("❌ [firmwareUpdater] check", e));
    this.timer = setInterval(() => {
      this.check().catch((e) => console.error("❌ [firmwareUpdater] check", e));
    }, this.opts.intervalMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async fetchLatestRelease(): Promise<GithubRelease | null> {
    const url = `https://api.github.com/repos/${this.opts.repo}/releases/latest`;
    // Timeout 10 s : sans ça un appel GitHub qui pend bloquerait le check.
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    try {
      const res = await this.fetchFn(url, {
        headers: { Accept: "application/vnd.github+json", "User-Agent": "rami-fog" },
        signal: ctrl.signal,
      });
      if (!res.ok) return null;
      return (await res.json()) as GithubRelease;
    } catch {
      return null; // réseau KO / timeout / JSON invalide -> réessai au prochain tick
    } finally {
      clearTimeout(timer);
    }
  }

  /** Un tick : récupère la dernière release et déclenche l'OTA. */
  async check(): Promise<void> {
    const release = await this.fetchLatestRelease();
    if (!release?.tag_name) return;

    const asset = pickFirmwareAsset(release, this.opts.envName);
    if (!asset) {
      console.warn(
        `⚠️ [firmwareUpdater] ${release.tag_name} dispo mais aucun .bin pour "${this.opts.envName}"`,
      );
      return;
    }

    // Mode par appareil : on remonte le tag, le fog décide qui mettre à jour.
    if (this.opts.onLatestRelease) this.opts.onLatestRelease(release.tag_name);

    // Mode legacy (version unique) : OTA si plus récent que currentVersion.
    if (
      this.opts.onUpdateAvailable &&
      this.opts.currentVersion !== undefined &&
      isNewerVersion(release.tag_name, this.current)
    ) {
      console.log(
        `⬆️ [firmwareUpdater] nouvelle version ${release.tag_name} (actuelle ${this.current}) → OTA`,
      );
      this.current = release.tag_name; // évite de re-déclencher en boucle
      this.opts.onUpdateAvailable(release.tag_name, asset.browser_download_url);
    }
  }
}
