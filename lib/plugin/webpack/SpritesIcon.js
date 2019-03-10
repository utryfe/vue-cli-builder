const fs = require('fs')
const path = require('path')
//
const WebpackSpritesmith = require('webpack-spritesmith')
//
const logger = require('../../utils/logger')
const fileUtil = require('../../utils/file')

class SpritesIcon {
  // 雪碧图生成
  constructor(options) {
    this.options = Object.assign(
      {
        iconClass: 'icon', // 图标样式命名空间
        classPrefix: 'icon', // 图标样式前缀
        kebabCaseName: true, // 样式名称格式
        templateHandler: null,
      },
      options
    )
  }

  // 取得插件配置项
  getPluginOptions() {
    const {
      src,
      target,
      retina,
      templateHandler,
      spritesmithOptions,
      iconClass,
      classPrefix,
      kebabCaseName,
    } = this.options
    //
    const { image, css } = target
    //
    const setup = {
      src: Object.assign(
        {
          // 默认处理小图片路径
          cwd: this.getDefaultIconsDirectory(),
          glob: '**/*.png',
        },
        src
      ),
      target: {
        // 生成的图片资源路径
        image,
        // 设置生成CSS背景及其定位的文件或方式
        css: [
          [
            css,
            {
              format: 'function_based_template',
            },
          ],
        ],
      },
      customTemplates: {
        // 模板处理函数
        function_based_template:
          typeof templateHandler === 'function'
            ? templateHandler
            : this.getTemplateHandler(iconClass, classPrefix),
      },
      apiOptions: {
        // css文件中引用雪碧图的相对位置路径配置
        cssImageRef: fileUtil.relativePath(css, image),
        generateSpriteName(file) {
          const baseName = fileUtil.getFileBaseName(file, true)
          return kebabCaseName
            ? baseName.replace(/[A-Z]+/g, (t, index) =>
                (!index ? t : `-${t}`).toLowerCase()
              )
            : baseName
        },
      },
      // spritesmith配置
      spritesmithOptions: Object.assign(
        {
          padding: 4,
        },
        spritesmithOptions
      ),
    }

    let cwd = setup.src.cwd
    if (typeof cwd !== 'string' || !(cwd = cwd.trim())) {
      logger.error('\nThe directory of icons for sprites must be a valid path.\n')
      process.exit(1)
    }

    if (!fileUtil.isAbsolute(cwd)) {
      cwd = path.resolve(cwd)
    }
    setup.src.cwd = cwd

    if (retina && typeof retina === 'object') {
      setup.retina = retina
    }

    return setup
  }

  getDefaultIconsDirectory() {
    const {} = this.options
    const defaultDirs = [
      'src/assets/images/icons/',
      'src/assets/images/icon/',
      'src/assets/img/icons/',
      'src/assets/img/icon/',
      'src/assets/icons/',
      'src/assets/icon/',
    ]
    let absPath
    for (const dir of defaultDirs) {
      absPath = path.resolve(dir)
      if (fs.existsSync(absPath)) {
        break
      }
    }
    return absPath
  }

  // 获取默认的样式模板处理函数
  getTemplateHandler(className, prefix) {
    className = typeof className === 'string' ? className.trim() : ''
    prefix = typeof prefix === 'string' ? `${prefix.trim().replace(/[-]+$/, '')}-` : ''

    return (data) => {
      const { sprites } = Object.assign({}, data)
      if (!Array.isArray(sprites) || !sprites.length) {
        return ''
      }

      const backgroundImage = ` { background-image: url(${sprites[0].image}) }\n`

      const sharedClass = sprites
        .map(
          (sprite) =>
            `:global(${className ? `.${className}` : ''}.${prefix}${sprite.name})`
        )
        .join(',\n')

      const cssRuleTemplate = `:global(${
        className ? '.C' : ''
      }.PN) { width: Wpx; height: Hpx; background-position: Xpx Ypx; }`

      const perSprite = sprites
        .map((sprite) => {
          const slots = {
            C: className,
            P: prefix,
            N: sprite.name,
            W: sprite.width,
            H: sprite.height,
            X: sprite.offset_x,
            Y: sprite.offset_y,
          }
          //
          return cssRuleTemplate.replace(/([CPNWHXY])/g, (t, n) => slots[n])
        })
        .join('\n')

      return `${sharedClass}${backgroundImage}${perSprite}`
    }
  }

  apply(compiler) {
    // 应用sprites插件
    new WebpackSpritesmith(this.getPluginOptions()).apply(compiler)
  }
}

SpritesIcon.default = SpritesIcon
module.exports = SpritesIcon
