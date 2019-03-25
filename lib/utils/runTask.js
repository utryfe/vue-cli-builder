const util = require('util')
const logger = require('./logger')

// 串行化任务执行器
class TaskRunner {
  //
  constructor(tasks) {
    if (!Array.isArray(tasks)) {
      tasks = []
    }
    this.tasks = [].concat(tasks)
    this.sequenceTasks = []
    this.completed = false
    this.runner = null
    this.breaker = null
  }

  //
  initRunner(tasks) {
    return Promise.race([
      // 初始化 taskSequence
      Promise.all(
        tasks.map((task) => {
          if (typeof task === 'function' || task instanceof Promise) {
            return this.getTaskPromise(task)
          }
          logger.log('Task must be a promise or a function which return promise.')
          return Promise.resolve()
        })
      ),
      // 初始化 breaker
      new Promise((resolve, reject) => {
        this.breaker = (error) => {
          if (!this.completed) {
            this.completed = true
            // 清空未执行完的任务
            this.sequenceTasks.length = 0
            logger.log('Task has been broken.')
            reject(error)
          }
        }
      }),
    ])
  }

  //
  getTaskPromise(task) {
    if (Array.isArray(task)) {
      // 并行任务
      task = Promise.all(task.map((parallel) => util.promisify(parallel)))
    }
    const taskType = typeof task
    return new Promise((resolve, reject) => {
      const nextTask = (res) => {
        if (task) {
          // 清除task，防止重复执行
          task = null
          resolve()
          if (!this.completed) {
            this.next(res)
          }
        }
      }
      const terminate = (err) => {
        if (task) {
          task = null
          this.completed = true
          this.sequenceTasks.length = 0
          reject(err)
        }
      }
      // 添加至串行任务队列
      this.sequenceTasks.push((prevResult) => {
        let res
        if (taskType === 'function') {
          res = task(prevResult, nextTask, terminate)
        } else {
          res = task
        }
        if (res instanceof Promise) {
          res.then(nextTask).catch(terminate)
        }
      })
    })
  }

  //
  next(prevResult) {
    const tasks = this.sequenceTasks
    const task = tasks.shift()
    this.completed = !tasks.length
    if (task) {
      task(prevResult)
    }
  }

  //
  run() {
    if (!this.runner) {
      this.runner = this.initRunner(this.tasks)
      this.next()
    }
    return this.runner
  }

  //
  stop(reason) {
    this.breaker(reason)
  }
}

// 可自动打断的执行器
function breakify() {
  let runner = null
  return (tasks) => {
    if (runner) {
      // 中断上一个任务队列
      runner.stop()
    }
    runner = new TaskRunner(tasks)
    return runner.run()
  }
}

module.exports = exports = function(tasks) {
  return new TaskRunner(tasks).run()
}

exports.breakifyRunner = breakify()

exports.TaskRunner = TaskRunner
