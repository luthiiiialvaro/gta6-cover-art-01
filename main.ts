// Vice Cover Lab — the hand-in program (Node 22, standard library only).
//
// It copies this repository's app/ and screenshots/ into the grader's
// output directory and writes /output/dossier.json, the summary the judge
// reads, with the vendored make.fun library. Run it locally with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// (Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output.)

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

// The caps the scorer enforces on what this program writes: only
// text_max_bytes shapes the dossier's bytes; the rest refuse an entry the
// scorer would refuse, so passing them here makes a bad entry fail loudly
// instead of slipping through.
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
};

function handIn(repoRoot, outDir) {
  mkdirSync(outDir, { recursive: true });
  cpSync(join(repoRoot, 'app'), join(outDir, 'app'), { recursive: true });
  const shotsOut = join(outDir, 'screenshots');
  mkdirSync(shotsOut, { recursive: true });
  const shotsIn = join(repoRoot, 'screenshots');
  if (existsSync(shotsIn)) {
    cpSync(shotsIn, shotsOut, { recursive: true });
  }
  writeFileSync(join(outDir, 'dossier.json'), buildDossier(outDir, DOSSIER_CAPS));
}

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
handIn(repoRoot, outDir);
