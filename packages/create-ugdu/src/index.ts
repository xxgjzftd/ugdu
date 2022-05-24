#!/usr/bin/env node
import { join, resolve, relative } from 'path'
import {
  existsSync,
  readdirSync,
  lstatSync,
  rmdirSync,
  unlinkSync,
  mkdirSync,
  writeFileSync,
  statSync,
  copyFileSync,
  readFileSync
} from 'fs'
import { fileURLToPath } from 'url'
import minimist from 'minimist'
import prompts from 'prompts'
import { reset, red, green, yellow, blue } from 'kolorist'

import type { Answers } from 'prompts'

const argv = minimist(process.argv.slice(2), { string: ['_'] })
const cwd = process.cwd()

const FRAMEWORKS = [
  {
    name: 'vue',
    color: green,
    variants: [
      {
        name: 'vue',
        display: 'JavaScript',
        color: yellow
      },
      {
        name: 'vue-ts',
        display: 'TypeScript',
        color: blue
      }
    ]
  }
]

const TEMPLATES = FRAMEWORKS.map((f) => (f.variants && f.variants.map((v) => v.name)) || [f.name]).reduce(
  (a, b) => a.concat(b),
  []
)

const renameFiles: Record<string, string> = {
  _gitignore: '.gitignore',
  _vscode: '.vscode'
}

function isEmpty (path: string) {
  const files = readdirSync(path)
  return files.length === 0 || (files.length === 1 && files[0] === '.git')
}

function isValidPackageName(projectName: string) {
  return /^(?:@[a-z0-9-*~][a-z0-9-*._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(
    projectName
  )
}

function toValidPackageName(projectName: string) {
  return projectName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/^[._]/, '')
    .replace(/[^a-z0-9-~]+/g, '-')
}

function emptyDir (dir: string) {
  if (!existsSync(dir)) {
    return
  }
  for (const file of readdirSync(dir)) {
    const abs = resolve(dir, file)
    // baseline is Node 12 so can't use rmSync :(
    if (lstatSync(abs).isDirectory()) {
      emptyDir(abs)
      rmdirSync(abs)
    } else {
      unlinkSync(abs)
    }
  }
}

function copyDir (srcDir: string, destDir: string) {
  mkdirSync(destDir, { recursive: true })
  for (const file of readdirSync(srcDir)) {
    const srcFile = resolve(srcDir, file)
    const destFile = resolve(destDir, file)
    copy(srcFile, destFile)
  }
}

function copy (src: string, dest: string) {
  const stat = statSync(src)
  if (stat.isDirectory()) {
    copyDir(src, dest)
  } else {
    copyFileSync(src, dest)
  }
}

const init = async () => {
  let targetDir = argv._[0]
  let template = argv.template || argv.t

  const defaultProjectName = targetDir ? targetDir.trim().replace(/\/+$/g, '') : 'ugdu-project'

  let result: Answers<string> = {}

  try {
    result = await prompts(
      [
        {
          type: targetDir ? null : 'text',
          name: 'projectName',
          message: reset('Project name:'),
          initial: defaultProjectName,
          onState: (state) => (targetDir = state.value.trim().replace(/\/+$/g, '') || defaultProjectName)
        },
        {
          type: () => (!existsSync(targetDir) || isEmpty(targetDir) ? null : 'confirm'),
          name: 'overwrite',
          message: () =>
            (targetDir === '.' ? 'Current directory' : `Target directory "${targetDir}"`) +
            ` is not empty. Remove existing files and continue?`
        },
        {
          type: (_, { overwrite } = {}) => {
            if (overwrite === false) {
              throw new Error(red('✖') + ' Operation cancelled')
            }
            return null
          },
          name: 'overwriteChecker'
        },
        {
          type: () => (isValidPackageName(targetDir) ? null : 'text'),
          name: 'packageName',
          message: reset('Package name:'),
          initial: () => toValidPackageName(targetDir),
          validate: (dir) =>
            isValidPackageName(dir) || 'Invalid package.json name'
        },
        {
          type: template && TEMPLATES.includes(template) ? null : 'select',
          name: 'framework',
          message:
            typeof template === 'string' && !TEMPLATES.includes(template)
              ? reset(`"${template}" isn't a valid template. Please choose from below: `)
              : reset('Select a framework:'),
          initial: 0,
          choices: FRAMEWORKS.map(
            (framework) => {
              const frameworkColor = framework.color
              return {
                title: frameworkColor(framework.name),
                value: framework
              }
            }
          )
        },
        {
          type: (framework) => (framework && framework.variants ? 'select' : null),
          name: 'variant',
          message: reset('Select a variant:'),
          choices: (framework) =>
            framework.variants.map(
              (variant: any) => {
                const variantColor = variant.color
                return {
                  title: variantColor(variant.name),
                  value: variant.name
                }
              }
            )
        },
        {
          //@ts-ignore
          onCancel: () => {
            throw new Error(red('✖') + ' Operation cancelled')
          }
        }
      ]
    )
  } catch (e) {
    console.log(e)
    return
  }

  const { framework, overwrite, packageName, variant } = result
  const root = join(cwd, targetDir)

  if (overwrite) {
    emptyDir(root)
  } else if (!existsSync(root)) {
    mkdirSync(root, { recursive: true })
  }

  template = variant || framework || template

  console.log(`\nScaffolding project in ${root}...`)

  const templateDir = resolve(fileURLToPath(import.meta.url), '..', `template-${template}`)

  const write = (file: string, content?: string) => {
    const targetPath = renameFiles[file] ? join(root, renameFiles[file]) : join(root, file)
    if (content) {
      writeFileSync(targetPath, content)
    } else {
      copy(join(templateDir, file), targetPath)
    }
  }


  const files = readdirSync(templateDir)
  for (const file of files.filter((f) => f !== 'package.json')) {
    write(file)
  }

  const pkg = JSON.parse(readFileSync(join(templateDir, `package.json`), 'utf-8'))
  pkg.name = packageName || targetDir
  write('package.json', JSON.stringify(pkg, null, 2))

  const packagesContainerPkg = JSON.parse(readFileSync(join(templateDir, 'packages', 'container', 'package.json'), 'utf-8'))
  const packagesRootPkg = JSON.parse(readFileSync(join(templateDir, 'packages', 'root', 'package.json'), 'utf-8'))
  packagesContainerPkg.name = `@${packageName || targetDir}/container`
  packagesRootPkg.name = `@${packageName || targetDir}/root`
  write('packages/container/package.json', JSON.stringify(packagesContainerPkg, null, 2))
  write('packages/root/package.json', JSON.stringify(packagesRootPkg, null, 2))


  console.log(`\nDone. Now run:\n`)
  if (root !== cwd) {
    console.log(`  cd ${relative(cwd, root)}`)
  }

  console.log(`  pnpm install`)
  console.log(`  pnpm run dev`)

  console.log()
}

init().catch(console.log)
