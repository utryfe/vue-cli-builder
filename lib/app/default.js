module.exports = {
  // 模块入口（传统构建模式）
  BUILD_MODULE_ENTRY: 'src/main.js',
  // html模板页面路径
  BUILD_HTML_TEMPLATE: 'public/index.html',
  // 是否构建多页应用（所有路由生成对应的文件）
  BUILD_MPA: false,
  // 只构建指定的模块
  BUILD_MODULE_FILTER: '',
  // 模块的根节点（根据目录生成路由配置）
  BUILD_MODULE_ROOT: 'src/views/',
  // 路由扩展名
  BUILD_ROUTE_EXTENSIONS: '.route.vue',
  // 路由名称和页面名称使用连字符格式
  BUILD_KEBAB_CASE_PATH: true,
  // 是否使用模块懒加载
  BUILD_CODE_SPLITTING: true,
  // 使用vuex
  BUILD_APP_USE_VUEX: true,
  // 使用vue router
  BUILD_APP_USE_ROUTER: true,
  // 默认的路由模式
  BUILD_APP_ROUTER_MODE: 'hash',
  // 动态参数路由组件标识符
  BUILD_ROUTER_PARAMS_SYMBOL: '_',
  // 命名路由视图组件标识符
  BUILD_ROUTER_VIEW_SYMBOL: '#',
  // 映射路由参数到组件属性（params、query、all、none）
  BUILD_ROUTER_MAP_PROPS: 'all',
  // 根App路径（布局组件）
  BUILD_ROOT_APP_PATH: 'src/App.vue',
  // 模块router文件名称（可以是相对于模块目录的子目录文件路径）
  BUILD_MODULE_ROUTER_NAME: 'router.js',
  // 模块store文件名称（可以是相对于模块目录的子目录文件路径）
  BUILD_MODULE_STORE_NAME: 'store.js',
}
