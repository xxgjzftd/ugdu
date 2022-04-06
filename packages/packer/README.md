A packer powered by the [task processor](https://github.com/xxgjzftd/ugdu/blob/main/packages/processor/README.md) and the [runtime helper](https://github.com/xxgjzftd/ugdu/blob/main/packages/runtime/README.md) to help develop and build micro frontends projects.

## Overview

This packer provide some `task options` such as `build`, `serve` etc.
You can use these `task options`, for example `build`, to create a task which could build your project for production.
For features, check [features](#features).
For a simple example, check [usage](#usage).
The phrases like `vendor package` are terms. Their brief explanation is [here](#terms).
For more detail, check our [API docs](https://github.com/xxgjzftd/ugdu/blob/main/docs/packer.md).

## Features

- Minimal build time.
  - For your source code, only files changed will be rebuilt.
  - For `vendor package`, only packages whose version changes will be rebuilt.
- Minimal generated files.
  - For `vendor package`, Only packages imported by multiple `module`s or `local module` will be built separately.
- Minimal generated size.
  - For `vendor package`, only code used in your source code will be built into the generated files.
- Security.
  - The package will be rebuilt when you import `binding`s that the corresponding generated module haven't export.
  - We will throw a meaningful error in build time other than runtime when you accidentally make a mistake.
- Extensible
  - You can hook into the stage you are interested in when you develop an application.
  - You can enhance our built-in `task options`, or create your own. And then share to others.

## Usage

Below is a quick start.

Note: `@ugdu/processor` and `@ugdu/packer` are exported in esm format. So we requires Node.js version >=14.17.0.

### Install

#### Install pnpm

`@ugdu/packer` needs your project to be based on [pnpm](https://pnpm.io/).

```
npm install -g pnpm
```

#### Install ugdu and vite

`@ugdu/packer` is powered by [vite](https://vitejs.dev/).

```
pnpm add @ugdu/processor @ugdu/packer vite -DW
```

### Recommend project structure

```
- packages  // Your `local package`s
  - container // The entry package of app. You may need multiple entry package if your project has more than one app.
  - components  // Common used components
  - utils // Common used utils
  - purchase  // Business packages
  - sale  // Business packages
- public  // Assets in this directory will be served at root path / during dev, and copied to the root of the dist directory as-is.
- scripts // task scripts
  - task.js
- index.html  // The info that will be used at runtime such as `importmap` and `ur.modules` will be injected to `index.html` automatically. We can consider it as our template. Note: Different with vue, we don't seem `index.html` as entry point. So we don't need to add corresponding script tag to references our source code.
- package.json  // To use the native esm on nodejs, we should specify the `type` field as `module`.
- pnpm-workspace.yaml // The pnpm workspace config file
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
pnpm vite preview
```

This command will start a dev server.

```bash
node scripts/task.js serve
```

## Terms

- `task options`
  A definition of a `task`.
- `task`
  A `task` is an instance of [Task](https://github.com/xxgjzftd/ugdu/blob/main/docs/processor.task.md) which is a subclass of [HookDriver](https://github.com/xxgjzftd/ugdu/blob/main/docs/processor.hookdriver.md).
- `vendor package`
  The `package` you installed in your node_modules.
- `module`
  In general, a generated js file is a `module`. For more detail, check [here](https://github.com/xxgjzftd/ugdu/blob/main/docs/packer.metamodule.md).
- `local module`
  The `module` comes from `local package`.
- `binding`
  The variable the `module` import and export.
