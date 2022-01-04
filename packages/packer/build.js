import { rm } from 'fs/promises'
import { createRequire } from 'module'

import esbuild from 'esbuild'

const require = createRequire(import.meta.url)
const pi = require('./package.json')

const outdir = 'dist'

await rm(outdir, { recursive: true, force: true })

esbuild.build(
  {
    bundle: true,
    splitting: true,
    define: { VERSION: JSON.stringify(pi.version), TEST: 'false' },
    entryPoints: ['src/index.ts'],
    external: Object.keys(pi.dependencies),
    format: 'esm',
    outdir,
    platform: 'node',
    target: 'node14.17.0',
    write: true,
    entryNames: '[dir]/[name]'
  }
)
