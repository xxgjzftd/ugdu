import { URL } from 'url'

import fg from 'fast-glob'
import { mergeConfig, createServer, createLogger } from 'vite'
import { series, TaskOptions } from '@ugdu/processor'

import { setContext } from './context'
import { entry } from '../plugins/entry'
import { routes } from '../plugins/routes'

import type { AddressInfo } from 'net'
import type { Plugin } from 'vite'

import type { BaseRoute } from '../tasks/project'

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
      const {
        manager: {
          context,
          context: {
            CONSTANTS: { ROUTES, ROOT, INDEX },
            config,
            project,
            project: { alias },
            utils: { appendSlash, getLocalPkgs, getPkgId }
          }
        }
      } = this

      const an2om: Record<string, string> = {}

      await Promise.all(
        config.apps.map(
          async (app) => {
            try {
              const vds = await createServer(
                mergeConfig(
                  {
                    resolve: { alias },
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
                const { hot, watcher, moduleGraph, listen, httpServer } = vds

                if (!httpServer) {
                  throw new Error('HTTP server not available')
                }

                const lps = getLocalPkgs().filter((item) => !item.main)

                const refresh = async () => {
                  project.routes = []

                  await Promise.all(
                    lps.map(
                      async (lp) => {
                        const pp = `${lp.path}/src/pages`
                        const pi = getPkgId(lp.name)
                        const paths = await fg(`${pp}/**/*`)
                        const brs = paths.map(
                          (path) => {
                            const br: BaseRoute = {
                              id: path,
                              path: path
                                .replace(pp, '/' + pi)
                                .replace(/\.[^\.]+$/, '')
                                .replace(/(?<=\/)\[(.+?)\](?=(\/|$))/g, ':$1')
                                .replace(new RegExp(`^(/${pi})\\1$`), '$1'),
                              name: '',
                              component: path
                            }
                            return br
                          }
                        )
                        const insert = (target: BaseRoute, list: BaseRoute[]) => {
                          for (let i = 0; i < list.length; i++) {
                            const current = list[i]
                            if (target.path.startsWith(appendSlash(current.path))) {
                              current.children = current.children || []
                              insert(target, current.children)
                              return
                            } else if (current.path.startsWith(appendSlash(target.path))) {
                              target.children = []
                              list.splice(i, 1, target)
                              insert(current, target.children)
                              return
                            }
                          }
                          list.push(target)
                        }
                        const sub: BaseRoute[] = []
                        brs.forEach((br) => insert(br, sub))
                        if (pi === ROOT) {
                          brs.forEach((br) => (br.path = br.path.replace(new RegExp(`^/${ROOT}/?`), '/')))
                        }
                        brs.forEach(
                          (br) => {
                            br.path = br.path.replace(new RegExp(`/${INDEX}$`), '')
                            br.name = br.path.slice(1).replace(/\/:?/g, '-')
                            if (br.path === '') {
                              br.path = '/'
                              br.name = ROOT
                            }
                          }
                        )
                        project.routes.push(...sub)
                      }
                    )
                  )
                  moduleGraph.invalidateModule(moduleGraph.getModuleById(ROUTES)!)
                  hot.send({ type: 'full-reload' })
                }

                watcher.add(lps.map((lp) => lp.ap))
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
              const logger = createLogger()
              logger.error(`error when starting dev server:\n${app.name}`)
              process.exit(1)
            }
          }
        )
      )
    }
  )
)
