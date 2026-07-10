import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

function hashClassicScript() {
  return {
    name: 'hash-classic-script',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const content = readFileSync('app.js');
        const hash = createHash('sha256').update(content).digest('hex').slice(0, 8);
        const newName = `app.${hash}.js`;
        return html.replace('src="./app.js"', `src="./${newName}"`);
      }
    },
    generateBundle() {
      const content = readFileSync('app.js');
      const hash = createHash('sha256').update(content).digest('hex').slice(0, 8);
      const newName = `app.${hash}.js`;
      this.emitFile({ type: 'asset', fileName: newName, source: content });
    }
  };
}

export default {
  base: '/pazar-app/',
  publicDir: 'public',
  plugins: [hashClassicScript()],
  build: {
    outDir: 'dist'
  }
};
