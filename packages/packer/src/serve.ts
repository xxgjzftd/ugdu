import { URL } from 'url'

import { mergeConfig, createServer } from 'vite'
import { series, TaskOptions } from '@ugdu/processor'

import { setContext } from './context'
import { entry } from './plugins/entry'
import { routes } from './plugins/routes'

import type { AddressInfo } from 'net'
import type { Plugin } from 'vite'

export const serve = series(
  new TaskOptions(
    function setBuilding () {
      this.manager.context.building = false
    }
  ),
  setContext,
  new TaskOptions(
    async function () {
      const an2om: Record<string, string> = {}
      const {
        manager: {
          context,
          context: {
            config,
            project: { alias },
            utils: { getRoutesMoudleNames, getNormalizedPath }
          }
        }
      } = this
      await Promise.all(
        config.apps.map(
          async (app) => {
            const { ws, watcher, moduleGraph, listen } = await createServer(
              mergeConfig(
                {
                  resolve: {
                    alias
                  },
                  plugins: [
                    routes('', context),
                    entry(context),
                    {
                      name: 'ugdu:serve',
                      configureServer (server) {
                        server.middlewares.use(
                          (req, res, next) => {
                            if (req.headers.accept?.includes('text/html')) {
                              const pathname = new URL(req.url!, `http://${req.headers.host}`).pathname
                              const target = context.config.apps.find((app) => app.predicate!(pathname))
                              if (!target) {
                                throw new Error(`There is no corresponding app of '${pathname}'.`)
                              }
                              if (target.name === app.name) {
                                next()
                              } else {
                                res.writeHead(301, { Location: an2om[target.name] + pathname })
                                res.end()
                              }
                            } else {
                              next()
                            }
                          }
                        )
                      }
                    } as Plugin
                  ]
                },
                mergeConfig(config.vite, app.vite)
              )
            )

            const refresh = (ap: string) =>
              getRoutesMoudleNames(getNormalizedPath(ap)).forEach(
                (rmn) => (
                  moduleGraph.invalidateModule(moduleGraph.getModuleById(rmn)!), ws.send({ type: 'full-reload' })
                )
              )

            watcher.on('add', refresh)
            watcher.on('unlink', refresh)

            const server = await listen()
            const { address, port } = server.httpServer!.address() as AddressInfo
            const protocol = server.config.server.https ? 'https' : 'http'
            an2om[app.name] = `${protocol}://${address}:${port}`
          }
        )
      )
    }
  )
)
