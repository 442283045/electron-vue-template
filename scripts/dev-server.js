import { cpSync } from 'fs'
import { EOL } from 'os'
import path from 'path'
import { fileURLToPath } from 'url'
import { spawn } from 'child_process'
import chalk from 'chalk'
import chokidar from 'chokidar'
import electron from 'electron'
import { createServer } from 'vite'
import compileTs from './private/tsc.js'

// Resolve __dirname in ESM
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

process.env.NODE_ENV = 'development'

let viteServer = null
let electronProcess = null
let electronProcessLocker = false
let rendererPort = 0

async function startRenderer() {
  viteServer = await createServer({
    configFile: path.join(__dirname, '..', 'vite.config.js'),
    mode: 'development',
  })

  return viteServer.listen()
}

async function startElectron() {
  if (electronProcess) {
    // single instance lock
    return
  }

  try {
    await compileTs(path.join(__dirname, '..', 'src', 'main'))
  } catch {
    console.log(
      chalk.redBright(
        'Could not start Electron because of the above typescript error(s).'
      )
    )
    electronProcessLocker = false
    return
  }

  const args = [
    path.join(__dirname, '..', 'build', 'main', 'main.js'),
    rendererPort,
  ]
  electronProcess = spawn(electron, args)
  electronProcessLocker = false

  electronProcess.stdout.on('data', (data) => {
    if (data === EOL) {
      return
    }

    process.stdout.write(
      chalk.blueBright(`[electron] `) + chalk.white(data.toString())
    )
  })

  electronProcess.stderr.on('data', (data) =>
    process.stderr.write(
      chalk.blueBright(`[electron] `) + chalk.white(data.toString())
    )
  )

  electronProcess.on('exit', () => stop())
}

function restartElectron() {
  if (electronProcess) {
    electronProcess.removeAllListeners('exit')
    electronProcess.kill()
    electronProcess = null
  }

  if (!electronProcessLocker) {
    electronProcessLocker = true
    startElectron()
  }
}

function copyStaticFiles() {
  copy('static')
}

/*
The working dir of Electron is build/main instead of src/main because of TS.
tsc does not copy static files, so copy them over manually for dev server.
*/
function copy(targetPath) {
  cpSync(
    path.join(__dirname, '..', 'src', 'main', targetPath),
    path.join(__dirname, '..', 'build', 'main', targetPath),
    { recursive: true }
  )
}

function stop() {
  viteServer.close()
  process.exit()
}

async function start() {
  console.log(`${chalk.greenBright('=======================================')}`)
  console.log(`${chalk.greenBright('Starting Electron + Vite Dev Server...')}`)
  console.log(`${chalk.greenBright('=======================================')}`)

  const devServer = await startRenderer()
  rendererPort = devServer.config.server.port

  copyStaticFiles()
  startElectron()

  const watchPath = path.join(__dirname, '..', 'src', 'main')
  chokidar
    .watch(watchPath, {
      cwd: watchPath,
    })
    .on('change', (changedPath) => {
      console.log(
        chalk.blueBright(`[electron] `) +
          `Change in ${changedPath}. reloading... 🚀`
      )

      if (changedPath.startsWith(path.join('static', '/'))) {
        copy(changedPath)
      }

      restartElectron()
    })
}

start()
