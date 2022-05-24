import { argv } from 'process'

import { Processor } from '@ugdu/processor'
import { serve, build } from '@ugdu/packer'

import vue from '@vitejs/plugin-vue'

const arg = argv[2] || 'local'

const config = {
  extensions: ['vue', 'ts', 'js'],
  apps: [
    {
      name: '@ugdu-vue/container', // There should be changed to your project scope package
      packages: (lps) => lps.map((lp) => lp.name)
    }
  ],
  meta: '/dist/', // It's not right, there should be startswith `http://xxxxx` or `https://xxxxx`
  vite: {
    build: {
      commonjsOptions: {
        esmExternals: ['vue']
      }
    },
    plugins: [vue()]
  }
}

new Processor()
  .task(['local', 'qa', 'prod'].includes(arg) ? build : serve)
  .hook('get-config', () => config)
  .run()
