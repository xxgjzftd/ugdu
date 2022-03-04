`ugdu` is a collection of tools for developing micro frontends projects.

## Features

- When building
  - Minimal build time.
    - For your source code, only files changed will be rebuilt.
    - For `vendor package`, only packages whose version changes will be rebuilt.
  - Minimal generated files.
    - Only modules imported by multiple modules or `local module` will be built separately.
  - Minimal generated size.
    - For `vendor package`, only code used in your source code will be built into the generated files.
  - Security.
    - The package will be rebuilt when you import `binding`s that the corresponding generated module haven't export.
    - We will throw a meaningful error in build time other than runtime when you accidentally make a mistake.
  - Extensible
    - You can hook into the stage you are interested in when you develop an application.
    - You can enhance our built-in `task options`, or create your own. And then share to others. Check our [API docs](https://github.com/xxgjzftd/ugdu/blob/main/docs/index.md) for more detail.
- At runtime
  - Independent deployment.
    - All `module`s can be deployed independently.
  - Multiple frameworks in one project.
    - Different `app`s can be based on different frameworks. This means that you can upgrade or refactor your project incrementally. For example, develop new feature with vue3 and the other code remain vue2.
  - Style security.
    - To avoid [FOUC](https://en.wikipedia.org/wiki/Flash_of_unstyled_content), the `module` will only be evaluated after the css it required is loaded.
    - The css of the `app`s which should be unload will be removed from the document.
  - Lazy load.
    - Only the `module`s which are used by the active `app`s will be loaded.
  - Preload assets
    - When load a `module`, all `module`s this `module` imports will be [preload](https://developer.mozilla.org/en-US/docs/Web/HTML/Link_types/preload).

In addition, all packages are well typed. So you will be prompted when using the API.

## Usage

Below is a quick start. For more detail, check our [API docs](https://github.com/xxgjzftd/ugdu/blob/main/docs/index.md).

Note: `@ugdu/processor` and `@ugdu/packer` are exported in esm format. So we requires Node.js version >=14.17.0.

### Install

#### Install pnpm

`@ugdu/packer` needs your project to be based on [pnpm](https://pnpm.io/).

```
npm install -g pnpm
```

#### Install ugdu and vite

`@ugdu/packer` is powered by vite.

```
pnpm add @ugdu/processor @ugdu/packer vite -DW
```

### Recommend project structure

```
// Your `local package`s
- packages
  // The entry package of app. You may need multiple entry package if your project has more than one app.
  - container
  - components
  - utils
  // Other business packages
  - purchase
  - sale

// Assets in this directory will be served at root path / during dev, and copied to the root of the dist directory as-is.
- public

// task scripts
- scripts
  - task.js

// The info that will be used at runtime such as `importmap` and `ur.modules` will be injected to `index.html` automatically.
// We can consider it as our template.
// Note: Different with vue, we don't seem `index.html` as entry point. So we don't need to add corresponding script tag to references our source code.
- index.html

// To use the native esm on nodejs, we should specify the `type` field as `module`.
- package.json

// The pnpm workspace config file
- pnpm-workspace.yaml
```

### Our index.html

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" href="/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ugdu</title>
    <!-- Below script is our runtime lib -->
    <script async src="https://unpkg.com/@ugdu/runtime/dist/index.js"></script>
  </head>
  <body>
    <div id="app"></div>
  </body>
</html>
```

### Create and run task

Below is our task script.

```js
import { argv } from 'process'

/**
 * @ugdu/packer is powered by vite. So we can use vite plugin.
 */
import vue from '@vitejs/plugin-vue'
import { Processor } from '@ugdu/processor'
/**
 * `serve` and `build` are `task options` which is used to create `task`.
 * `serve` is used to start a dev server.
 * `build` is used to build for production.
 */
import { serve, build } from '@ugdu/packer'

const task = new Processor().task(argv[2] === 'serve' ? serve : build)

task.hook(
  'get-config',
  // The return value of this function will be seemed as config.
  () => {
    return {
      extensions: ['vue', 'ts', 'js'],
      apps: [
        {
          name: '@xx/container',
          packages (lps) {
            return lps.map((lp) => lp.name)
          }
        }
      ],
      routes: {
        container: {
          patterns: 'packages/*/src/pages/**/*.vue',
          base: '/',
          depth: 0
        }
      },
      meta: 'local',
      vite: {
        plugins: [vue()]
      }
    }
  }
)

task.run()
```

This command will build the project for production and launch a server to preview the production build.

```bash
node scripts/task.js
npx vite preview
```

This command will start a dev server.

```bash
node scripts/task.js serve
```
