//
const path = require('path')
const throttle = require('lodash/throttle')
const resolve = require('resolve')

// 接收父进程消息
process.on('message', (message) => {
  //
  const { type, payload } = Object.assign({}, message)
  if (type === 'build') {
    // 保存代码环境变量模式
    process.env.FORKED_NODE_ENV = process.env.NODE_ENV
    // 打包执行环境设置为产品模式
    const mode = 'production'
    process.env.NODE_ENV = mode
    // 重设vue配置文件路径
    process.env.VUE_CLI_SERVICE_CONFIG_PATH = path.join(__dirname, 'config.dll.js')
    //
    const {
      context,
      output: { path: output, library },
    } = payload
    // 这里要使用项目上的webpack打包
    const webpack = require(resolve.sync('webpack', { basedir: context }))
    //
    const config = require(resolve.sync('@vue/cli-service/webpack.config.js', {
      basedir: context,
    }))
    //
    config.plugins.push(
      // 生成动态库清单文件
      new webpack.DllPlugin({
        context,
        name: library,
        // 清单文件路径
        path: path.join(output, '[name].manifest.json'),
      }),
      // 进度
      new webpack.ProgressPlugin(
        throttle((percent, msg) => {
          // 发送构建进度
          process.send({
            type: 'progress',
            payload: {
              percent,
              message: msg,
            },
          })
        }, 60)
      )
    )

    const { optimization } = config
    let optimize = {}
    if (process.env.FORKED_NODE_ENV === 'production') {
      // 生产构建
      if (optimization.minimizer) {
        const minimizer = (optimize.minimizer = optimization.minimizer)
        const setTest = (mini) => {
          const options = mini.options
          if (options && typeof options === 'object') {
            // 压缩脚本文件
            options.test = /^[a-z\d]{16,32}$/i
          }
        }
        if (Array.isArray(minimizer)) {
          for (const m of minimizer) {
            setTest(m)
          }
        } else {
          setTest(minimizer)
        }
      } else if (optimization.minimize) {
        optimize.minimize = optimization.minimize
      }
    }

    // 使用webpack打包
    webpack(
      //
      Object.assign(
        config,
        {
          // 默认的构建设置
          mode,
          devtool: 'none',
          optimization: optimize,
        },
        // 可能存在多个entry
        payload
      ),
      //
      (err, stats) => {
        if (err || stats.hasErrors()) {
          // 构建失败
          process.send({
            type: 'failed',
          })
        } else {
          // 构建成功
          process.send({
            type: 'done',
          })
        }
      }
    )
    //
  } else if (type === 'close') {
    // 退出任务进程
    process.exit(0)
  }
})
