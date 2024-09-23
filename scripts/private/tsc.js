import { exec } from 'child_process'
import chalk from 'chalk'
import path from 'path'

function compile(directory) {
  return new Promise((resolve, reject) => {
    const tsconfigPath = path.join(directory, 'tsconfig.json')
    const tsconfigPreloadPath = path.join(directory, 'tsconfig.preload.json')

    const tscProcess = exec(
      `tsc --project ${tsconfigPath} && tsc --project ${tsconfigPreloadPath}`,
      {
        cwd: directory,
      }
    )

    tscProcess.stdout.on('data', (data) =>
      process.stdout.write(
        chalk.yellowBright(`[tsc] `) + chalk.white(data.toString())
      )
    )

    tscProcess.stderr.on('data', (data) =>
      process.stderr.write(
        chalk.yellowBright(`[tsc] `) + chalk.red(data.toString())
      )
    )

    tscProcess.on('exit', (exitCode) => {
      if (exitCode > 0) {
        reject(exitCode)
      } else {
        resolve()
      }
    })
  })
}

export default compile
