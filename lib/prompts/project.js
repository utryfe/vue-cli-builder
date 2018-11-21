const validator = require('../utils/validator')

module.exports = (pkg) => {
  return [
    {
      name: 'project-type',
      type: 'list',
      when: (answers) => answers['init'] === 'project',
      message: '选择应用类型:',
      default: false,
      choices: [
        {
          name: '单页应用',
          value: 'spa',
        },
        {
          name: '多页应用',
          value: 'mpa',
        },
      ],
    },
    {
      name: 'mpa-entry',
      type: 'list',
      when: (answers) => answers['project-type'] === 'mpa',
      message: '选择页面入口文件路径模式:',
      description: '相对于工程根目录的路径模式',
      link: 'https://www.npmjs.com/package/glob',
      choices: [
        {
          name: 'src/pages/*/App.vue',
          value: 'src/pages/*/App.vue',
        },
        {
          name: '自定义',
          value: 'custom',
        },
      ],
    },
    {
      name: 'mpa-entry-custom',
      type: 'input',
      when: (answers) => answers['mpa-entry'] === 'custom',
      message: '请输入页面入口文件路径模式:',
      filter: (input) => input.trim(),
      validate(answer) {
        return validator.isRelativePath(answer, true) || '路径格式不正确'
      },
    },
    {
      name: 'spa-entry',
      type: 'list',
      when: (answers) => !answers['mpa'],
      message: '选择应用入口文件路径:',
      description: '相对于工程根目录的确定路径',
      choices: [
        {
          name: 'src/main.js',
          value: 'src/main.js',
        },
        {
          name: '自定义',
          value: 'custom',
        },
      ],
    },
    {
      name: 'spa-entry-custom',
      type: 'input',
      when: (answers) => answers['spa-entry'] === 'custom',
      message: '请输入应用入口文件路径:',
      filter: (input) => input.trim(),
      validate(answer) {
        return validator.isRelativePath(answer) || '路径格式不正确'
      },
    },
  ]
}
