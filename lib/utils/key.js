const os = require('os')
const fs = require('fs')
const { promisify } = require('util')

const { getQuestionAnswers, escape } = require('./cli')
const fileUtil = require('./file')
const homedir = os.homedir()

// 生成密钥对交互
const generateKeyPairsQuestions = [
  {
    type: 'confirm',
    name: 'generate',
    default: true,
    message: 'Private key for ssh could not be found, do you want to generate it now?',
  },
  {
    type: 'password',
    name: 'passphrase',
    message: 'Enter passphrase (empty for no passphrase):',
    when: (answers) => !!answers['generate'],
    filter: (answer) => answer.trim(),
    validate: (answer) => {
      answer = answer.trim()
      return (
        !answer ||
        answer.length >= 5 ||
        'Passphrase is too short (minimum five characters). Try again.'
      )
    },
  },
  {
    type: 'password',
    name: 'passphrase2',
    message: 'Enter same passphrase again:',
    when: (answers) => !!answers['passphrase'],
    filter: (answer) => answer.trim(),
    validate: (answer, answers) =>
      answers['passphrase'] === answer.trim() || 'Passphrases do not match. Try again.',
  },
]

// 校验密码交互
const validatePassphraseQuestions = (validator, path) => [
  {
    type: 'password',
    name: 'token',
    message: `Enter passphrase for key '${path}': `,
    filter: (token) => token.trim(),
    validate: (token) =>
      validator(token) || 'The passphrase is incorrect. Please try again.',
  },
]

// ssh key
module.exports = exports = {
  // 默认的私钥路径
  defaultPrivateKeyPath: fileUtil.joinPath(homedir, '.ssh', 'id_rsa'),

  // 生成密钥对
  async generateKeyPairs(path = 'id_rsa', passphrase = '', type = 'rsa') {
    // 确定路径
    const keyPath = fileUtil.resolveUserPath(path)

    if (!keyPath || fileUtil.existsSync(keyPath)) {
      return keyPath
    }

    const dirname = fileUtil.getDirName(keyPath)
    if (!fileUtil.existsSync(dirname)) {
      fileUtil.mkdir(dirname)
    }

    const { which } = require('shelljs')

    const cmd = 'ssh-keygen'
    const args = `-t ${escape(type)} -N ${escape(passphrase)} -f ${escape(keyPath)}`

    try {
      if (!which(cmd)) {
        throw new Error(`Cannot found ${cmd}, you may need to install it manually.`)
      }

      console.log()

      const { exec } = require('./cli')
      await exec(`${cmd} ${args}`)

      console.log()
    } catch (e) {
      // 清理生成失败的文件
      if (fileUtil.existsSync(keyPath)) {
        fs.unlinkSync(keyPath)
      }
      return Promise.reject(e)
    }

    return keyPath
  },

  // 读取私钥，没有则自动生成
  async readPrivateKey(
    path = exports.defaultPrivateKeyPath,
    privateToken = '',
    interactive = true
  ) {
    const keyPath = fileUtil.resolveUserPath(path)
    if (!keyPath) {
      return {
        path: '',
        content: '',
        privateKey: null,
        passphrase: null,
      }
    }

    if (fileUtil.existsSync(keyPath) && !fileUtil.isDirectory(keyPath)) {
      return await exports.parseKey(keyPath, privateToken, interactive)
    }

    const { generate, passphrase } = interactive
      ? await getQuestionAnswers(generateKeyPairsQuestions)
      : {}

    if (!generate) {
      return {
        path: '',
        content: '',
        privateKey: null,
        passphrase: null,
      }
    }

    await exports.generateKeyPairs(keyPath, passphrase)
    return await exports.parseKey(keyPath, passphrase)
  },

  // 解析私钥
  async parseKey(keyPath, passphrase, interactive = true) {
    const keyContent = await promisify(fs.readFile)(keyPath)
    const { utils } = require('ssh2').Client
    const { parseKey } = utils

    let parsed = parseKey(keyContent, passphrase)

    if (parsed instanceof Error) {
      if (!interactive) {
        // 非交互场景，静默失败
        throw new Error(`Cannot parse private key: ${parsed.message}`)
      }

      // 5次重复校验机会
      let count = 5
      let breaker = null
      const watcher = new Promise((resolve, reject) => {
        breaker = reject
      })

      // 终端交互校验密码
      const { token } = await Promise.race([
        getQuestionAnswers(
          validatePassphraseQuestions((str) => {
            parsed = parseKey(keyContent, str.trim())
            const invalid = parsed instanceof Error
            if (invalid && !--count) {
              breaker(
                new Error(`Cannot parse private key '${keyPath}': ${parsed.message}`)
              )
              return true
            }
            return !invalid
          }, keyPath)
        ),
        watcher,
      ])
      // 正确的密码
      passphrase = token
    }

    parsed = Array.isArray(parsed) ? parsed[0] : parsed
    // 校验内容正确性
    if (!parsed || parsed.getPrivatePEM() === null) {
      throw new Error(
        `The file named by '${keyPath}' does not contain a (valid) private key.`
      )
    }

    // 解析后的密钥及对应的密文
    return {
      passphrase,
      path: keyPath,
      content: keyContent,
      privateKey: parsed,
    }
  },
}
