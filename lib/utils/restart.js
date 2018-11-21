const path = require('path')
const treeKill = require('tree-kill')
const spawn = require('cross-spawn')
const debug = require('debug')('builder:utils:restart')

const logger = require('./logger')

class Restart {
  //
  constructor() {
    this.process = null
    this.spawnArgs = []
    //
    const env = process.env
    this.command = env.npm_lifecycle_event
    const npmExec = env.npm_execpath
    const nodeExec = env.npm_node_execpath
    const npmPathIsJs =
      typeof npmExec === 'string' && /\.js/.test(path.extname(npmExec))
    //
    if (!npmPathIsJs) {
      this.execPath = npmExec
    } else {
      this.execPath = nodeExec || 'npm'
      this.spawnArgs.push(npmExec)
    }
  }

  async done(callback) {
    const res = await this.kill(this.process)
    if (res === 1) {
      logger.error('Error occurred while restarting the server.')
    } else {
      await this.spawning()
      if (typeof callback === 'function') {
        callback()
      }
    }
  }

  async kill(process) {
    if (process && process.pid) {
      const pid = process.pid
      debug('killing: [%s]', pid)
      return new Promise((resolve) => {
        treeKill(pid, 'SIGKILL', (err) => {
          if (!err) {
            debug('process has been killed.')
            resolve(0)
          } else {
            debug('Error occurred while kill the process. [%s]', pid)
            resolve(1)
          }
        })
      })
    }
  }

  async spawning() {
    const { command, execPath, spawnArgs } = this
    if (command) {
      const finalArgs = [...spawnArgs, 'run', command]
      debug('Spawning: "%s %o"', execPath, finalArgs)
      this.process = spawn(execPath, finalArgs, {
        stdio: 'inherit',
        env: this.getProcessEnv(),
      })
    }
  }

  getProcessEnv() {
    return {
      build_process_spawned_by: process.pid,
    }
  }
}

let instance = null

// 重启
module.exports = (callback) => {
  if (!instance) {
    instance = new Restart()
  }
  return instance.done(callback)
}
