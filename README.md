## Vue 命令行插件

定制化的配置服务，进一步精简开发配置。

与 vue-cli 服务深度整合，可基于环境变量文件定制构建需求。

多页应用下，可基于路径配置自动生成 pages 配置。

定制的脚手架，构建发布流程，待开发中...

### 安装

    npm install vue-cli-plugin-ut-builder -D

### 使用示例

> 配置定义

```javascript
// vue.config.js

const outputDir = 'dist'
const assetsDir = ''

module.exports = {
  // vue-cli内置配置项（更多可查看vue-cli官网）
  outputDir,
  assetsDir,
  // vue-cli自定义插件的配置（下面配置项被vue-cli-plugin-ut-builder插件支持）
  pluginOptions: {
    // 对根据目录名称生成的HTML文件进行改名（主要应用于多页应用）
    indexMap: {
      csa: 'index',
    },
    // 使用到的服务配置（每一个配置项的值将作为参数传给相应的服务）
    // 服务可以将构建任务细化，一个服务内可以调用多个插件（webpack插件）来进行操作
    service: {
      // 导出webpack、vue-cli配置（不带webpack://则为导出vue-cli配置），也可以使用数组导出多个文件
      // 参数值为字符串时将被解析为导出文件的路径
      eject: 'webpack://build.webpack.js',
      // 拷贝资源
      // 也可以使用数组传参，参数值格式同'copy-webpack-plugin'的参数
      copy: {
        'src/assets/img': `${outputDir}/${assetsDir}/img`,
      },
      // 未使用的代码文件提示
      unused: true,
      // 构建耗时提示
      timeCost: true,
      // html插件配置，同'html-webpack-plugin'的参数配置
      html: {},
      // 产品压缩打包服务（仅产品模式有效，使用zip打包格式）
      // 打多个包可用数组传参
      compress: {
        // 可指定要拷贝并压缩的资源（不指定则使用构建输出目录下的所有资源）
        // 路径相对于outputDir，可使用glob路径语法
        copy: { '*.html': 'templates/', '!(*.html)/**/*': 'static/' },
        // 压缩包的路径名称，不指定则是npm包名加版本号（路径相对于工程根路径，也可指定为绝对路径）
        name: 'dist.zip',
      },
      // 接口mock服务
      mock: {
        // mock模块文件存放路径
        path: 'mock',
        // 全局接口返回延迟定义
        delay: 1000,
        // 自动初始化接口定义模块文件
        init: true,
        // 定位接口声明位置
        locate: true,
        // 是否开启http接口mock，默认开启
        // 如果只需要对socket进行mock，则可以通过此项关闭对http的mock
        http: true,
        // 开启websocket mock
        ws: {
          context: ['/foo'],
          channel: ['message', 'echo'],
          client: 'socket.io',
          port: 8080,
        },
      },
      // 调用自定义服务
      myService: {
        // 可以给服务传递相应参数
        xxx: true,
      },
    },
    // 注册自定义的服务
    registerService: {
      // 服务项为一个函数
      myService({ plugin, config, isDev, env }, options, projectOptions) {
        // 第一个参数是一个对象，可对其进行解构
        // 第二个参数options为调用服务时，传给服务的参数（上面service配置里面项的值）
        // 第三个参数projectOptions为整个工程的vue-cli构建配置项

        // plugin.use可以应用一个插件并修改插件的配置参数
        // 第一个参数作为插件名称来解析，如果加载不到插件，将尝试使用xxx-webpack-plugin的名称来加载插件
        // 比如plugin.use('html', ()=>{})，如果没有加载到名为 html 的插件，则会尝试加载 html-webpack-plugin
        plugin.use('myPlugin', (args) => {
          // plugin.use可使用相应的webpack插件
          // args为当前该插件的构建参数，可对其进行修改，或返回一个新的插件参数数组
          return args
        })
        // 同一个插件可以被多次使用（初始化为不同的插件实例）
        // 以连字符连接的名称，会将第一个连字符前的名称作为插件名称
        // 如果要将整个名称都作为插件名称，可以使用^前缀，比如 ^myPlugin-all 则告知要使用名称为myPlugin-all的插件
        // 或者还可以使用对象来指定插件名称（不会进行名称解析）： { pluginName:'myPlugin-all', configName: 'plugin-all' }
        // 其中 configName 将会作为config实例的插件key使用，其默认会使用第一个参数的完整（字符串）值
        plugin.use('myPlugin-another', (args) => {
          //
          return args
        })
        // 使用config.plugin也可以达到上面的目的，实际上plugin.use是对config.plugin的封装
        // 用config来修改插件配置时，未声明过的插件要使用use来指定构造函数，而已声明的插件再次修改时使用use则会报错
        // 所以推荐使用plugin.use来对插件配置进行修改（方法内对这些要求进行了处理）
        config.plugin('myPlugin').tap((args) => {
          return args
        })
        // config还可以修改其他更多的配置项，比如entry，rule等，可参考'webpack-chain'
        config
          .entry('index')
          .add('src/index.js')
          .end()
      },
    },
    // 注册自定义的插件（webpack插件），插件可被服务使用
    registerPlugin: {
      // webpack插件必须为一个构造函数（实例对象需包含apply方法）
      // 可以使用class来声明一个插件类
      myPlugin: class {
        constructor(options) {
          // options为插件的参数
        }
        // apply方法会被webpack调用
        apply(compiler) {
          // compiler为webpack的编译器实例
          // 更多的webpack插件开发内容，可参考webpack官方文档
        }
      },
    },
  },
}
```

### 环境变量文件

```dotenv
# .env

# 默认的环境变量配置文件

# HTML模板文件路径
HTML_TEMPLATE = index.html

# 多页应用入口脚本
# 可用逗号（,）分隔多个匹配模式
MPA_ENTRY = src/pages/*/main.js

# 单页应用入口脚本
SPA_ENTRY = src/main.js

# 是否构建单页应用
BUILD_SPA = true

# 是否构建多页应用
# 可用逗号（,）分隔目录名，指定只构建哪些页面
# BUILD_MPA = foo, boo
BUILD_MPA = false
```

### 插件服务（Service）

开发中...

### 脚手架生成（Generator）

开发中...

### 开发与发布流程定制

开发中...
