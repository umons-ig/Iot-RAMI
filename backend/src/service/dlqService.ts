import fs from "fs";
import path from "path";

// Dead Letter Queue persistée en NDJSON (un message JSON par ligne).
//
// Refonte (PLAN_AMELIORATIONS §1.3) — l'ancienne version :
//  - relisait + réécrivait TOUT le fichier à chaque push (readFileSync +
//    writeFileSync) -> O(n²) sous incident massif et event loop bloqué ;
//  - n'avait aucune borne de taille -> saturation disque du Pi ;
//  - n'avait aucun verrou -> push (callback Kafka) et flush (démarrage)
//    pouvaient se réécrire mutuellement et perdre des messages.
//
// Ici : append O(1) par ligne, borne dure (drop des plus anciens), et verrou
// de flush (les push concurrents sont bufferisés puis réappendus après flush).

const DLQ_PATH = path.resolve(process.cwd(), "dlq.json");
const MAX_LINES = 10_000; // borne dure : au-delà, on droppe les plus anciens
const TRIM_CHECK_EVERY = 500; // on ne vérifie la borne que périodiquement

let pushesSinceTrim = 0;
let flushing = false;
const bufferedDuringFlush: any[] = [];

const serialize = (record: any): string => JSON.stringify(record) + "\n";

const readRecords = (): any[] => {
  try {
    if (!fs.existsSync(DLQ_PATH)) return [];
    return fs
      .readFileSync(DLQ_PATH, "utf-8")
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null; // ligne corrompue : ignorée
        }
      })
      .filter((r) => r !== null);
  } catch {
    return [];
  }
};

const appendRecord = (record: any): void => {
  fs.appendFileSync(DLQ_PATH, serialize(record), "utf-8");
};

// Applique la borne : ne garde que les MAX_LINES plus récents.
const trimIfNeeded = (): void => {
  const records = readRecords();
  if (records.length <= MAX_LINES) return;
  const kept = records.slice(records.length - MAX_LINES);
  fs.writeFileSync(DLQ_PATH, kept.map(serialize).join(""), "utf-8");
  console.warn(
    `[DLQ] Borne atteinte : ${
      records.length - MAX_LINES
    } message(s) le(s) plus ancien(s) supprimé(s)`
  );
};

const push = (message: any): void => {
  const record = { ...message, _dlqTimestamp: new Date().toISOString() };
  // Pendant un flush, on bufferise pour ne pas être écrasé par la réécriture.
  if (flushing) {
    bufferedDuringFlush.push(record);
    return;
  }
  try {
    appendRecord(record);
    if (++pushesSinceTrim >= TRIM_CHECK_EVERY) {
      pushesSinceTrim = 0;
      trimIfNeeded();
    }
  } catch (error) {
    console.error("[DLQ] Échec d'écriture:", error);
  }
};

const flush = async (
  handler: (message: any) => Promise<void>
): Promise<void> => {
  if (flushing) return; // un seul flush à la fois
  const records = readRecords();
  if (records.length === 0) return;

  flushing = true;
  console.log(`[DLQ] ${records.length} message(s) à retraiter...`);
  const failed: any[] = [];
  try {
    // On repart d'un fichier vide ; les échecs sont réécrits ensuite.
    fs.writeFileSync(DLQ_PATH, "", "utf-8");
    for (const record of records) {
      try {
        const { _dlqTimestamp: _ignored, ...original } = record;
        await handler(original);
      } catch {
        failed.push(record);
      }
    }
    for (const f of failed) appendRecord(f);
  } finally {
    flushing = false;
    // Réinjecte les push survenus pendant le flush.
    for (const b of bufferedDuringFlush) appendRecord(b);
    bufferedDuringFlush.length = 0;
  }

  console.log(
    `[DLQ] Retraitement terminé — ${records.length - failed.length} ok, ${
      failed.length
    } encore en échec`
  );
};

// Nombre de messages actuellement en attente dans la DLQ (utile pour les
// métriques d'observabilité, cf. §3.x).
const count = (): number => readRecords().length;

export { push, flush, count };
