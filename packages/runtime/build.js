import esbuild from 'esbuild'

esbuild.build(
  {
    bundle: true,
    define: { TEST: 'false' },
    entryPoints: ['src/index.ts'],
    format: 'iife',
    minify: true,
    outdir: 'dist',
    platform: 'browser',
    target: 'es2017',
    write: true,
    entryNames: '[dir]/[name]'
  }
)
