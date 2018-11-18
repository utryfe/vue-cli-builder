const isProd = process.env.NODE_ENV === 'production'

// 默认的配置
module.exports = {
  // project deployment base
  baseUrl: '/',

  // where to output built files
  outputDir: 'dist',

  // where to put static assets (js/css/img/font/...)
  assetsDir: '',

  // filename for index.html (relative to outputDir)
  indexPath: 'index.html',

  // whether filename will contain hash part
  filenameHashing: true,

  // boolean, use full build?
  runtimeCompiler: false,

  // deps to transpile
  transpileDependencies: [
    /* string or regex */
  ],

  // sourceMap for production build?
  productionSourceMap: false,

  // use thread-loader for babel & TS in production build
  // enabled by default if the machine has more than 1 cores
  // parallel: true,

  // multi-page config
  pages: undefined,

  // <script type="module" crossorigin="use-credentials">
  // #1656, #1867, #2025
  crossorigin: undefined,

  // subresource integrity
  integrity: false,

  css: {
    // extract: true,
    modules: true,
    // localIdentName: '[name]_[local]_[hash:base64:5]',
    sourceMap: !isProd,
    // loaderOptions: {}
  },

  // whether to use eslint-loader
  lintOnSave: !isProd,

  devServer: {
    open: true,
    // host: '0.0.0.0',
    port: 8080,
    https: false,
    // hotOnly: false,
    // proxy: null, // string | Object
    // before: app => {}
  },

  // 插件选项
  pluginOptions: {
    // 对输出对页面名称进行映射
    indexMap: {},
    // 扩展的构建服务配置
    service: {
      // 查找未使用的文件
      unused: isProd,
      timeCost: true,
      html: {},
      copy: {},
    },
  },
}
