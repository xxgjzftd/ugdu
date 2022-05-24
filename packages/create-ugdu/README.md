# create-ugdu

## Scaffolding Your First Ugdu Project

> **Compatibility Note:**
> Ugdu requires [Node.js](https://nodejs.org/en/) version >=14.6.0. However, some templates require a higher Node.js version to work, please upgrade if your package manager warns about it.

With NPM:

```bash
$ npm i pnpm -g
```

With PNPM:

```bash
$ pnpm create ugdu
```

Then follow the prompts!

You can also directly specify the project name and the template you want to use via additional command line options. For example, to scaffold a Vite + Vue project, run:

```bash

# pnpm
pnpm create ugdu my-vue-app -- --template vue
```

Currently supported template presets include:

- `vue`
- `vue-ts`

## Official Templates

ugdu is a collection of tools for developing micro frontends projects. Check out Awesome [Ugdy](https://github.com/xxgjzftd/ugdu) and check out vue-template for [official maintained vue-template](https://github.com/xxgjzftd/ugdu-vue-next-example).
