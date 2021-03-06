import { join } from 'path'
import { existsSync, writeFileSync, readFileSync } from 'fs'
import webpack from 'webpack'
import dora from 'dora'
import getWebpackConfig from './getWebpackConfig'
import { tplSet } from './constant'
import chokidar from 'chokidar'

const root = join(__dirname, '..')

module.exports = function (options) {
  const { source, dest, cwd, tpl, config, port, asset, index, init, publicPath, duoshuoName } = options
  const tplDefault = join(root, tplSet.github)
  let tplPath

  if (tpl) {
    if (tplSet[tpl]) {
      tplPath = join(root, tplSet[tpl])
    } else {
      tplPath = join(cwd, tpl)
      if (!existsSync(tplPath)) {
        console.warn(`There\'s no file in ${tpl}, creating one for you...`)
        writeFileSync(tplPath, readFileSync(tplDefault, 'utf-8'), 'utf-8')
      }
    }
  } else {
    tplPath = tplDefault
  }

  if (init) { // 初始化项目

  }

  let webpackConfig
  if (options.build) {
    webpackConfig = getWebpackConfig(source, asset, dest, cwd, tplPath, config, index, publicPath, duoshuoName)

    webpackConfig.plugins.push(new webpack.optimize.UglifyJsPlugin({
      compress: {
        unused: true,
        dead_code: true,
        warnings: false
      }
    }))

    const compiler = webpack(webpackConfig)

    if (options.watch) {
      compiler.watch(200, (err) => {
        if (err) {
          console.error(err)
        }
      })
    } else {
      compiler.run((err) => {
        if (err) {
          console.error(err)
        }
      })
    }
  } else {
    dora({
      port,
      resolveDir: join(root, 'node_modules'),
      plugins: [
        {
          'middleware.before' () {
            webpackConfig = getWebpackConfig(source, asset, dest, cwd, tplPath, config, index, publicPath, duoshuoName)
          },
          'middleware' () {
            const compiler = webpack(webpackConfig)
            this.set('compiler', compiler)
            compiler.plugin('done', stats => {
              if (stats.hasErrors()) {
                console.log(stats.toString({ colors: true }))
              }
            })
            return require('koa-webpack-dev-middleware')(compiler, {
              publicPath: '/',
              quiet: true,
              ...this.query
            })
          },
          'server.after' () {
            chokidar.watch([`${source}/**/*.md`, `${source}/**/*.js`], {
              ignored: /node_modules/,
              ignoreInitial: true
            }).on('add', path => {
              console.log()
              console.log(`kakashi-doc: add ${path}, restaring...`)
              process.send('restart')
            }).on('unlink', path => {
              console.log()
              console.log(`kakashi-doc: remove ${path}, restaring...`)
              process.send('restart')
            })
          }
        }
      ]
    })
  }
}
