// Build riproducibile di Biaflix Nebula:
//   dist/nebula.css   foglio unico (token + componenti), minificato
//   dist/nebula.js    add-on JS (IIFE), minificato
//   dist/js-injector-snippet.js  snippet da incollare in JS Injector (carica nebula.js una volta sola)
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import { bundleAsync, browserslistToTargets } from 'lightningcss';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const watch = process.argv.includes('--watch');
const banner = `/*! Biaflix Nebula v${pkg.version} | MIT | https://github.com/ (vedi README) */`;

// Firefox ESR e Chromium/Safari recenti: i client che caricano Jellyfin Web 12.
const targets = browserslistToTargets(['firefox >= 115', 'chrome >= 109', 'safari >= 16']);

async function buildCss() {
  const { code } = await bundleAsync({
    filename: resolve(root, 'src/styles/index.css'),
    minify: true,
    targets,
    errorRecovery: false,
  });
  await writeFile(resolve(root, 'dist/nebula.css'), `${banner}\n${code}`);
}

const jsOptions = {
  entryPoints: [resolve(root, 'src/scripts/main.ts')],
  bundle: true,
  format: 'iife',
  target: ['firefox115', 'chrome109', 'safari16'],
  minify: true,
  sourcemap: 'linked',
  banner: { js: banner },
  define: { __NEBULA_VERSION__: JSON.stringify(pkg.version) },
  outfile: resolve(root, 'dist/nebula.js'),
  logLevel: 'warning',
};

async function buildSnippet() {
  const template = await readFile(resolve(root, 'src/scripts/injector-snippet.js'), 'utf8');
  await writeFile(resolve(root, 'dist/js-injector-snippet.js'), template.replaceAll('__NEBULA_VERSION__', pkg.version));
}

async function copyAssets() {
  await mkdir(resolve(root, 'dist/assets'), { recursive: true });
  for (const f of ['biaflix-logo.png', 'biaflix-logo-128.png', 'biaflix-logo-256.png']) {
    try {
      await copyFile(resolve(root, 'src/assets', f), resolve(root, 'dist/assets', f));
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
  }
}

await mkdir(resolve(root, 'dist'), { recursive: true });
if (watch) {
  const ctx = await esbuild.context(jsOptions);
  await ctx.watch();
  const { watch: fsWatch } = await import('node:fs');
  fsWatch(resolve(root, 'src/styles'), { recursive: true }, () => buildCss().catch(console.error));
  await buildCss();
  console.log('Watch attivo su src/');
} else {
  await Promise.all([buildCss(), esbuild.build(jsOptions), buildSnippet(), copyAssets()]);
  console.log(`Build Biaflix Nebula v${pkg.version} completata in dist/`);
}
