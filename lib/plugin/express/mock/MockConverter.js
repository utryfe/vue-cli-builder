const fs = require('fs')
//
const lodash = require('lodash')
const urlRegex = require('url-regex')
const isEmail = require('isemail')
//
const logger = require('../../../utils/logger')
const fileUtil = require('../../../utils/file')
//f
const helper = require('./helper')
//
const URL_REG_EXP = urlRegex()
const UUID_REG_EXP = /(([\da-z]{8})(-)?([\da-z]{4})\3([\da-z]{4})\3([\da-z]{4})\3([\da-z]{12}))/i
//

/**
 * 转换JSON为Mockjs
 */
class MockConverter {
  //
  constructor(options) {
    this.options = Object.assign({}, options)
    this.init()
  }

  //
  init() {
    let { path: mockPath, data } = this.options
    const { input: dataFile } = data
    mockPath = helper.getRelMockPath(mockPath)
    const absDataFile = fileUtil.resolvePath(mockPath, dataFile)
    // 监听文件变化，实时转换json为mockjs格式
    this.watch(mockPath, absDataFile)
    // 初始化转换文件
    if (!fs.existsSync(absDataFile)) {
      try {
        fs.writeFileSync(absDataFile, '{}', { encoding: 'utf8' })
        logger.log(`Generated for convert. [${absDataFile}]`)
      } catch (e) {
        logger.error(e.message)
      }
    }
  }

  // 监听转换文件的变化，输出转换后的结果
  watch(mockPath, absDataFile) {
    const { input: dataFile, output: tplFile } = this.options.data
    const absTplFile = fileUtil.resolvePath(mockPath, tplFile)
    const relDataFile = fileUtil.joinPath(mockPath, dataFile)
    const relTplFile = fileUtil.joinPath(mockPath, tplFile)
    helper.watch(absDataFile, (event) => {
      if (event !== 'unlink') {
        MockConverter.writeMockTemplate(
          absDataFile,
          relDataFile,
          absTplFile,
          (err) => {
            if (!err) {
              logger.log(
                `[${event}] ${relDataFile}, converted mock template to ${relTplFile}`
              )
            } else {
              logger.error(err.message)
            }
          }
        )
      } else {
        try {
          if (fs.existsSync(absTplFile)) {
            fs.unlink(absTplFile, (err) => {
              if (!err) {
                logger.log(`Mock template file has been removed`)
              } else {
                logger.error(err.message)
              }
            })
          }
        } catch (e) {
          logger.error(e.method)
        }
      }
    })
  }
  //
}

// 转换成mock.js调用
MockConverter.toMockJS = function(data, callback) {
  const dataType = typeof data
  if (dataType === 'string') {
    data = data.trim() || '{}'
  } else if (dataType === 'function' || dataType === 'undefined') {
    data = '{}'
  }
  if (typeof data === 'string') {
    data = JSON.parse(data)
  }
  const type = Array.isArray(data) ? 'array' : typeof data
  const [template, value] = MockConverter.toTemplate(type, data)
  const object = type === 'array' ? { [template]: value } : value
  return helper.formatCode(
    `Mock.mock(${JSON.stringify(object)})${type === 'array' ? `.${type}` : ''}`,
    {
      printWidth: 60,
    },
    callback
  )
}

// 转换JSON文件成Mock模板
MockConverter.writeMockTemplate = function(
  absDataFile,
  relDataFile,
  tplFile,
  callback
) {
  let err = null
  let data = ''
  try {
    data = JSON.parse(fs.readFileSync(absDataFile).toString('utf8'))
  } catch (e) {
    err = e
    logger.error(`${e.message} [${relDataFile}]`)
  }
  if (!err) {
    try {
      MockConverter.toMockJS(data, (code) => {
        fs.writeFileSync(tplFile, code, { encoding: 'utf8' })
      })
    } catch (e) {
      err = e
    }
  }
  callback(err)
}

// 转换成mock模板定义
MockConverter.toTemplate = function(name, value) {
  if (Array.isArray(value)) {
    // 转换数组
    return MockConverter.toArrayTemplate(name, value)
  } else if (value && typeof value === 'object') {
    // 转换对象
    return [
      name,
      Object.keys(value).reduce((obj, key) => {
        // 对象属性值逐一转换
        const [tpl, val] = MockConverter.toTemplate(key, value[key])
        obj[tpl] = val
        return obj
      }, {}),
    ]
  } else {
    // 普通数据类型
    return MockConverter.toTemplateItem(name, value)
  }
}

// 转换数组类型数据
MockConverter.toArrayTemplate = function(name, value) {
  if (!value.length) {
    return [name, []]
  }
  const typeMap = {}
  for (const item of value) {
    const type = Array.isArray(item) ? 'array' : typeof item
    const list = typeMap[type] || []
    typeMap[type] = list
    list.push(item)
  }
  const types = Object.keys(typeMap)
  if (types.length === 1) {
    // 列表中为同一类型的元素
    // 进行合并转换
    const type = types[0]
    const items = typeMap[type]
    return MockConverter.toTemplateItem(name, [
      MockConverter.toTemplate(
        type,
        /array|object/.test(type) ? MockConverter.merge(items, type) : items[0]
      )[1],
    ])
  } else {
    // 列表中为不同类型的元素
    // 进行单独转换
    return [
      name,
      value.map((item, index) => MockConverter.toTemplate(index, item)[1]),
    ]
  }
}

// 合并数组或对象
MockConverter.merge = function(items, type) {
  if (type === 'array') {
    // 数组合并
    return items.reduce((list, item) => list.concat(item), [])
  }
  // 对象合并
  const hasOwnProperty = Object.prototype.hasOwnProperty
  return items.reduce((merged, obj) => {
    if (obj) {
      Object.keys(obj).forEach((key) => {
        const value = obj[key]
        if (!hasOwnProperty.call(merged, key)) {
          merged[key] = value
        } else {
          const mergedValue = merged[key]
          const fromType = Array.isArray(value) ? 'array' : typeof value
          const toType = Array.isArray(mergedValue) ? 'array' : typeof mergedValue
          if (fromType === 'array' || toType === 'array') {
            // 数组优先
            // 合并数组
            merged[key] = []
              .concat(fromType === 'array' ? value : [])
              .concat(toType === 'array' ? mergedValue : [])
          } else if (
            (fromType && fromType === 'object') ||
            (toType && toType === 'object')
          ) {
            // 对象优先
            merged[key] = fromType && fromType === 'object' ? value : mergedValue
          } else if (fromType === 'string' || toType === 'string') {
            const re = /[\u4e00-\u9fa5]/
            const fromCN = re.test(value)
            const toCN = re.test(mergedValue)
            if (fromCN || toCN) {
              merged[key] = fromCN ? value : mergedValue
            } else {
              //  字符串
              merged[key] = merged[key] =
                fromType && fromType === 'string' ? value : mergedValue
            }
          } else {
            merged[key] = value
          }
        }
      })
    }
    return merged
  }, {})
}

// 转换单个项
MockConverter.toTemplateItem = function(name, value) {
  const type = Array.isArray(value) ? 'array' : typeof value
  const rule = type === 'array' ? '5-10' : ''
  if (name === 'email') {
    value = '@email'
  } else if (name === 'url') {
    value = '@url'
  } else if (name === 'id') {
    value = '@id'
  } else if (/boolean|string|number/.test(type)) {
    if (UUID_REG_EXP.test(value)) {
      value = '@guid'
    } else if (type === 'number') {
      if (lodash.isInteger(value)) {
        if (value > 0 && `${value}`.length === 13 && +new Date(value)) {
          value = '@datetime("yyyy-MM-dd HH:mm:ss")'
        } else {
          value = `@integer(0, ${Math.abs(value)})`
        }
      } else {
        value = `@float(0, 1000, 0, ${`${value}`.split('.')[1].length})`
      }
    } else if (type === 'string') {
      if (isEmail.validate(value)) {
        value = '@email'
      } else if (URL_REG_EXP.test(value)) {
        value = '@url'
      } else {
        const length = value.length
        // 中文检测
        if (/[\u4e00-\u9fa5]/.test(value)) {
          if (length < 5) {
            value = `@cword(2, 4)`
          } else if (length > 4 && length < 11) {
            value = `@ctitle(5, 10)`
          } else if (length > 10 && length < 21) {
            value = `@csentence(11, 20)`
          } else {
            value = `@cparagraph(1, 2)`
          }
        } else {
          if (length < 25) {
            value = `@word(2, 4)`
          } else if (length > 24 && length < 60) {
            value = `@title(5, 10)`
          } else if (length > 59 && length < 100) {
            value = `@sentence(11, 20)`
          } else {
            value = `@paragraph(1, 2)`
          }
        }
      }
    } else {
      value = `@${type}`
    }
  }
  return [`${name}${rule ? `|${rule}` : ''}`, value]
}

//
module.exports = MockConverter
