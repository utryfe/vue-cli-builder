module.exports = {
  // 模块入口（传统构建模式）
  build_module_entry: 'src/main.js',
  // html模板页面路径
  build_html_template: 'public/index.html',
  // 是否构建多页应用（所有路由生成对应的文件）
  build_mpa: false,
  // 只构建指定的模块
  build_module_filter: '',
  // 模块的根节点（根据目录生成路由配置）
  build_module_root: 'src/views/',
  // 路由扩展名
  build_route_extensions: '.route.vue',
  // 路由名称和页面名称使用连字符格式
  build_kebab_case_path: true,
  // 是否使用模块懒加载
  build_code_splitting: true,
  // 应用的vue内置插件
  build_app_plugins: 'debug, request',
  // 使用vuex
  build_app_use_vuex: true,
  // 使用vue router
  build_app_use_router: true,
  // 使用嵌套的路由（manual、auto、none）
  build_app_nested_routes: 'manual',
  // 默认的路由模式
  build_app_router_mode: '',
  // 动态参数路由组件标识符
  build_router_params_symbol: '_',
  // 命名路由视图组件标识符
  build_router_view_symbol: '@',
  // 映射路由参数到组件属性（params、query、all、none）
  build_router_map_props: 'all',
  // 根App路径（布局组件）
  build_root_app_path: 'src/App.vue',
  // 模块router文件名称（可以是相对于模块目录的子目录文件路径）
  build_module_router_name: 'router.js',
  // 模块store文件名称（可以是相对于模块目录的子目录文件路径）
  build_module_store_name: 'store.js',
}
