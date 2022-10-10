import { URL } from 'url'

import { mergeConfig, createServer } from 'vite'
import { series, TaskOptions } from '@ugdu/processor'

import { setContext } from './context'
import { entry } from '../plugins/entry'
import { routes } from '../plugins/routes'

import type { AddressInfo } from 'net'
import type { Plugin } from 'vite'

const setBuilding = new TaskOptions(
  function setBuilding () {
    this.manager.context.building = false
  }
)

/**
 * Starts dev server for `app`s.
 *
 * @public
 */
export const serve = series(
  setBuilding,
  setContext,
  new TaskOptions(
    async function () {
      const an2om: Record<string, string> = {}
      const {
        manager: {
          context,
          context: {
            CONSTANTS: { ROUTES },
            config,
            project: { alias },
            utils: { isPage, getNormalizedPath }
          }
        }
      } = this
      await Promise.all(
        config.apps.map(
          async (app) => {
            try {
              const vds = await createServer(
                mergeConfig(
                  {
                    resolve: {
                      alias
                    },
                    plugins: [
                      routes(context),
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

              if (!TEST) {
                const { ws, watcher, moduleGraph, listen, httpServer } = vds

                if (!httpServer) {
                  throw new Error('HTTP server not available')
                }

                const refresh = (ap: string) =>
                  isPage(getNormalizedPath(ap)) &&
                  (moduleGraph.invalidateModule(moduleGraph.getModuleById(ROUTES)!), ws.send({ type: 'full-reload' }))

                watcher.on('add', refresh)
                watcher.on('unlink', refresh)

                const server = await listen()
                const info = server.config.logger.info
                info(`\n 🚀 ${app.name} is ready`)
                server.printUrls()

                const { address, port } = server.httpServer!.address() as AddressInfo
                const protocol = server.config.server.https ? 'https' : 'http'
                an2om[app.name] = `${protocol}://${address}:${port}`
              }
            } catch (e) {
              process.exit(1)
            }
          }
        )
      )
    }
  )
)
