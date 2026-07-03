import {
  isNewerVersion,
  pickFirmwareAsset,
  FirmwareUpdater,
  GithubRelease,
} from "../firmwareUpdater";

describe("isNewerVersion", () => {
  it("compare en semver light, tolère le préfixe v", () => {
    expect(isNewerVersion("v1.2.0", "v1.1.9")).toBe(true);
    expect(isNewerVersion("1.0.1", "1.0.0")).toBe(true);
    expect(isNewerVersion("v2.0.0", "v1.9.9")).toBe(true);
    expect(isNewerVersion("1.0.0", "1.0.0")).toBe(false);
    expect(isNewerVersion("v1.0", "v1.0.0")).toBe(false); // équivalents
    expect(isNewerVersion("v1.0.0", "v1.0.1")).toBe(false);
  });
});

describe("pickFirmwareAsset", () => {
  const release: GithubRelease = {
    tag_name: "v1.0.0",
    assets: [
      { name: "notes.txt", browser_download_url: "u0" },
      { name: "ramifirmware-dht22.bin", browser_download_url: "u1" },
      { name: "ramifirmware-universal.bin", browser_download_url: "u2" },
    ],
  };

  it("choisit le .bin correspondant à l'env", () => {
    expect(pickFirmwareAsset(release, "universal")?.browser_download_url).toBe("u2");
  });

  it("fallback sur le premier .bin si l'env est absent", () => {
    expect(pickFirmwareAsset(release, "introuvable")?.browser_download_url).toBe("u1");
  });
});

describe("FirmwareUpdater.check", () => {
  const makeRes = (release: GithubRelease | null, ok = true) =>
    ({
      ok,
      json: async () => release,
    }) as Response;

  it("déclenche onUpdateAvailable si une version plus récente existe", async () => {
    const onUpdate = jest.fn();
    const fetchFn = jest.fn().mockResolvedValue(
      makeRes({
        tag_name: "v1.1.0",
        assets: [{ name: "ramifirmware-universal.bin", browser_download_url: "URL" }],
      }),
    );
    const up = new FirmwareUpdater({
      repo: "x/y",
      envName: "universal",
      currentVersion: "v1.0.0",
      intervalMs: 1000,
      onUpdateAvailable: onUpdate,
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    await up.check();
    expect(onUpdate).toHaveBeenCalledWith("v1.1.0", "URL");

    // Un second check ne re-déclenche pas (version courante mise à jour).
    await up.check();
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it("ne déclenche rien si pas plus récent", async () => {
    const onUpdate = jest.fn();
    const fetchFn = jest.fn().mockResolvedValue(
      makeRes({ tag_name: "v1.0.0", assets: [] }),
    );
    const up = new FirmwareUpdater({
      repo: "x/y",
      envName: "universal",
      currentVersion: "v1.0.0",
      intervalMs: 1000,
      onUpdateAvailable: onUpdate,
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    await up.check();
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("ne déclenche rien si le fetch rejette (réseau/timeout)", async () => {
    const onUpdate = jest.fn();
    const fetchFn = jest.fn().mockRejectedValue(new Error("network down"));
    const up = new FirmwareUpdater({
      repo: "x/y",
      envName: "universal",
      currentVersion: "v1.0.0",
      intervalMs: 1000,
      onUpdateAvailable: onUpdate,
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    await expect(up.check()).resolves.toBeUndefined();
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("ne déclenche rien si l'API échoue (ok=false)", async () => {
    const onUpdate = jest.fn();
    const fetchFn = jest.fn().mockResolvedValue(makeRes(null, false));
    const up = new FirmwareUpdater({
      repo: "x/y",
      envName: "universal",
      currentVersion: "v1.0.0",
      intervalMs: 1000,
      onUpdateAvailable: onUpdate,
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    await up.check();
    expect(onUpdate).not.toHaveBeenCalled();
  });
});
