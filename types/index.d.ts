import { ProjectOptions } from '@vue/cli-service'
import ChainableWebpackConfig from 'webpack-chain'
import * as HtmlWebpackPlugin from 'html-webpack-plugin'
import * as WebpackNotifierPlugin from 'webpack-notifier'

import {
  WebpackPluginFunction,
  WebpackPluginInstance,
} from 'webpack/declarations/WebpackOptions'

// 预处理配置对象
interface PreprocessConfig {
  mpa?: boolean
  moduleEntry?: string
  moduleRoot?: string
  htmlTemplate?: string
  moduleFilter?: string
  routeExtensions?: string
  kebabCasePath?: boolean
  codeSplitting?: boolean
  appPlugins?: string
  appUseVuex?: boolean
  appUseRouter?: boolean
  appNestedRoutes?: 'auto' | 'manual' | 'none'
  appRouterMode?: 'hash' | 'history'
  routerParamsSymbol?: string
  routerViewSymbol?: string
  routerMapProps?: 'all' | 'params' | 'query' | 'none'
  rootAppPath?: string
  moduleRouterName?: string
  moduleStoreName?: string
}

// 拷贝
type CopyOptions = { [from: string]: string } | { from: string; to: string }[]

// 压缩
type CompressTaskOptions = { name?: string; dot?: boolean; copy?: CopyOptions }
type CompressOptions = boolean | string | CompressTaskOptions | CompressTaskOptions[]

// 环境变量定义
type DefineOptions = {
  [env: string]: string | boolean | number
}

// DLL
type DllOptions = boolean | { [bundleName: string]: string | string[] }

// eject
type EjectOptions = boolean | string | string[]

// html
type HTMLOptions = { [pageName: string]: HtmlWebpackPlugin.Options }

// mock
type WebsocketMockOptions = {
  context?: ''
  debugContext?: ''
  channel?: string | string[]
  client?: string
  port?: number
}
type MockOptions =
  | boolean
  | {
      http?: boolean
      path?: string
      delay?: number
      defaultDelay?: number
      init?: boolean
      locate?: boolean
      defaultDisabled?: boolean
      pathHandler?: (path: string) => string | void
      exclude?: string | ((path: string) => boolean) | RegExp
      data: { input?: string; output?: string }
      ws: boolean | WebsocketMockOptions
    }

type SpritesOptions =
  | boolean
  | {
      iconClass?: string
      classPrefix?: string
      kebabCaseName?: string
      src?: { cwd?: string; glob?: string; options?: object }
      target?: { image?: string; css?: string }
      templateHandler?: (data: object) => string
      spritesmithOptions?: object
      retina?: object
    }

// unused
type UnusedOptions =
  | boolean
  | {
      patterns: string[]
      failOnUnused?: boolean
      globOptions?: { ignore?: string; cwd?: string }
    }

// watch
type WatchOptions = {
  done?: () => void | Promise<any>
  watchRun?: () => void | Promise<any>
  invalid?: () => void
}

// 可用服务配置
interface ServiceConfig {
  copy: CopyOptions
  compress: CompressOptions
  define: DefineOptions
  dll: DllOptions
  eject: EjectOptions
  html: HTMLOptions
  mock: MockOptions
  notifier: WebpackNotifierPlugin.Options
  removeConsole: boolean | { exclude: string[] }
  removeDebugger: boolean
  sprites: SpritesOptions
  timeCost: boolean
  unused: UnusedOptions
  watch: WatchOptions
  [service: string]: any
}

// 自定义服务运行时上下文对象
interface ServiceContext {
  api: object
  plugin: { use: () => {} }
  config: ChainableWebpackConfig
  isDev: boolean
  isDevelopment: boolean
  isTest: boolean
  isProd: boolean
  isProduction: boolean
  env: object
  args: object
  rawArgv: string[]
  command: string
  commandList: string[]
  modernApp: boolean
  modernBuild: boolean
  merge: () => any
  registerShutdown: () => any
  watch: () => any
}

declare module '@vue/cli-service' {
  export namespace ProjectOptions {
    export interface pluginOptions {
      htmlTemplate?: string
      moduleEntry?: string
      pageNameMap?: object
      preprocess?: PreprocessConfig
      service?: ServiceConfig
      registerService?: {
        [key: string]: {
          (context: ServiceContext, options: any, projectOptions: ProjectOptions): any
        }
      }
      registerPlugin?: {
        [plugin: string]: WebpackPluginFunction | WebpackPluginInstance
      }
    }
  }
}
