module.exports = (pkg) => {
  return []
    .concat([
      {
        name: 'init',
        type: 'list',
        message: '选择初始化类型:',
        choices: [
          {
            name: '项目',
            short: '项目',
            value: 'project',
          },
          {
            name: '模块',
            short: '模块',
            value: 'module',
          },
        ],
      },
    ])
    .concat(require('./project')(pkg))
    .concat(require('./module')(pkg))
    .concat(require('./git')(pkg))
  //
}
