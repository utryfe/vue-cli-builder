//
const path = require('path')
const lodash = require('lodash')

// 接收父进程消息
process.on('message', (message) => {
  //
  const { type, payload } = Object.assign({}, message)
  if (type === 'build') {
    // 设置环境变量
    const mode = 'production'
    process.env.NODE_ENV = mode
    // 重设vue配置文件路径
    process.env.VUE_CLI_SERVICE_CONFIG_PATH = path.join(__dirname, 'config.dll.js')
    //
    const webpack = require('webpack')
    //
    const {
      context,
      output: { path: output, library },
    } = payload
    //
    const config = require(path.join(
      context,
      'node_modules/@vue/cli-service/webpack.config.js'
    ))
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
        lodash.throttle((percent, msg) => {
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

    //
    // 使用webpack打包
    webpack(
      //
      Object.assign(
        config,
        {
          // 默认的构建设置
          mode,
          devtool: 'none',
          optimization: {},
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
