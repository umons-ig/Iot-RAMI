/**
 * Polyfills à charger AVANT tout autre module.
 *
 * `SlowBuffer` est supprimé depuis Node 24. `jsonwebtoken` en dépend de façon
 * transitive (`buffer-equal-constant-time`), et le module lève à l'IMPORT :
 * `TypeError: Cannot read properties of undefined (reading 'prototype')`. Le
 * backend ne démarre alors plus du tout, sans message exploitable.
 *
 * Ce correctif doit vivre dans un module séparé, importé en premier : placer le
 * `require` en tête de `server.ts` ne fonctionnait PAS, car TypeScript hisse les
 * `import` au-dessus du code du fichier — `jsonwebtoken` était donc chargé avant
 * que la ligne de polyfill ne s'exécute.
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const buffer = require("buffer");
if (!buffer.SlowBuffer) {
  buffer.SlowBuffer = buffer.Buffer;
}

export {};
