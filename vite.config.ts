import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
// Writes dist/sw.js with a versioned cache + precache list of the built files.
const sw = () => ({
  name: 'sw', apply: 'build' as const,
  writeBundle(opts: { dir?: string }, bundle: Record<string, unknown>) {
    const dir = opts.dir!; const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const files = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/apple-touch-icon.png', ...Object.keys(bundle).filter(f => !f.endsWith('.map'))];
    const version = `hanzi-path-v${pkg.version}-${Date.now().toString(36)}`;
    const src = fs.readFileSync('src/sw-template.js', 'utf8').replace('__CACHE__', version).replace('__FILES__', JSON.stringify([...new Set(files)]));
    fs.writeFileSync(`${dir}/sw.js`, src);
  },
});
export default defineConfig({ base: './', plugins: [react(), sw()], build: { chunkSizeWarningLimit: 1000 }, test: { include: ['src/**/*.test.ts'] } } as any);
