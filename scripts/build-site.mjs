import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const rootDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(rootDir, '..');
const viteBin = join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js');
const mainDist = join(projectRoot, 'dist');
const obrasRoot = join(projectRoot, 'beelbem-obras');
const obrasDist = join(obrasRoot, 'dist');
const onlineObrasDist = join(mainDist, 'obras');

function runVite(args, cwd) {
  const result = spawnSync(process.execPath, [viteBin, ...args], {
    cwd,
    stdio: 'inherit',
    shell: false,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

runVite(['build'], projectRoot);
runVite(['build', '--base=/obras/'], obrasRoot);

if (existsSync(onlineObrasDist)) {
  rmSync(onlineObrasDist, { recursive: true, force: true });
}

mkdirSync(onlineObrasDist, { recursive: true });
cpSync(obrasDist, onlineObrasDist, { recursive: true });
