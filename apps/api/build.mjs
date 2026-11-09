// Production bundle of the API. Workspace packages (TypeScript source, incl. the generated
// Prisma client) are bundled in; npm dependencies stay external and load from node_modules.
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

const { dependencies = {} } = JSON.parse(readFileSync('package.json', 'utf8'));
const external = Object.keys(dependencies)
  .filter((name) => !name.startsWith('@survey-dynata/'))
  .flatMap((name) => [name, `${name}/*`]);

await build({
  entryPoints: ['src/server.ts'],
  outfile: 'dist/server.js',
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  external,
});
