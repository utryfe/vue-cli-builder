## Vue 命令行插件

定制化的配置服务，进一步精简开发配置。

与vue-cli服务深度整合，可基于环境变量文件定制构建需求。

多页应用下，可基于路径配置自动生成pages配置。

定制的脚手架，构建发布流程，待开发中...

### 安装

    npm install vue-cli-plugin-ut-builder -D

### 使用示例

> 生成配置

````javascript
// 构建器配置服务
const config = require('vue-cli-plugin-ut-builder/config')

const outputDir = 'dist'
const assetsDir = ''
const devServerPort = 8080

module.exports = config({
  outputDir,
  assetsDir,
  // 开发服务器配置项
  devServer: {
    // 开发服务器的端口号
    port: devServerPort,
  },
  // 插件配置选项
  pluginOptions: {
    // 对根据目录名称生成的HTML文件进行改名（主要应用于多页应用）
    indexMap: {
      csa: 'index',
    },
    // 扩展构建服务配置
    service: {
      // 拷贝资源
      copy: {
        'src/assets/img': `${outputDir}/${assetsDir}/img`,
      },
      // 未使用的代码文件提示
      unused: true,
      // 构建耗时提示
      timeCost: true,
      // html插件配置
      html: {},
      // 其他更多小工具开发中
    },
  },
})
```` 
 
 ### 插件服务（Service）
 
 开发中...
 
 ### 脚手架生成（Generator）
 
 开发中...
 
 ### 开发与发布流程定制
 
 开发中...
