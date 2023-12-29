import { defineProject } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

import pi from './package.json'

export default defineProject(
  {
    define: {
      VERSION: JSON.stringify(pi.version),
      TEST: true
    },
    plugins: [tsconfigPaths()],
    test: {
      setupFiles: './vitest.setup.ts'
    }
  }
)
