import { argv } from 'process'

import { Processor } from '@ugdu/processor'
import { serve, build } from '@ugdu/packer'

import vue from '@vitejs/plugin-vue'

import type { UserConfig } from '@ugdu/packer'


const arg = argv[2] || 'local'

const config: UserConfig = {
  extensions: ['vue', 'ts', 'js'],
  apps: [
    {
      name: '@enocloud/container',
      packages: (lps) => lps.map((lp) => lp.name)
    }
  ],
  meta: '/dist/', // It's wrong, there should be startswith `http://xxxxx` or `https://xxxxx`
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
  // @ts-ignore
  .task(['local', 'qa', 'prod'].includes(arg) ? build : serve)
  .hook('get-config', () => config)
  .run()
