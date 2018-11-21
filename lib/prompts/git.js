//
const validator = require('../utils/validator')
// git仓库创建
module.exports = (pkg) => {
  return [
    //
    {
      name: 'git',
      type: 'confirm',
      message: '是否需要创建git仓库？',
      default: true,
    },
    // 选择仓库地址
    {
      name: 'git-repository',
      type: 'list',
      when: (answers) => answers['git'],
      message: '请选择仓库地址',
      choices: [
        {
          name: '10.0.2.6（研发部）',
          short: '研发部',
          value: '10.0.2.6',
        },
        {
          name: '10.0.2.173（智能产品部）',
          short: '智能产品部',
          value: '10.0.2.173',
        },
        {
          name: '其它地址',
          short: '其它',
          value: '',
        },
      ],
    },
    {
      name: 'git-repository-custom',
      type: 'input',
      when: (answers) => answers['git'] && !answers['git-repository'],
      message: '请输入仓库IP地址',
      validate: (answer) => validator.isIP(answer) || '非有效IP地址，请重新输入',
    },
  ]
}
