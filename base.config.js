const path = require('path');
const { CheckerPlugin } = require('awesome-typescript-loader')

const plugins = process.env.SLOBS_FORKED_TYPECHECKING ? [new CheckerPlugin()] : [];

// uncomment and install to watch circular dependencies
// const CircularDependencyPlugin = require('circular-dependency-plugin');
// plugins.push(new CircularDependencyPlugin({
//   // exclude detection of files based on a RegExp
//   exclude: /a\.js|node_modules/,
//   // add errors to webpack instead of warnings
//   //failOnError: true
// }));

// uncomment and install to analyze bundle size
// const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
// plugins.push(new BundleAnalyzerPlugin());

module.exports = {
  output: {
    path: __dirname + '/bundles',
    filename: '[name].js'
  },

  target: 'electron-renderer',

  resolve: {
    extensions: ['.js', '.ts', '.json', '.tsx'],
    modules: [path.resolve(__dirname, 'app'), 'node_modules'],
    symlinks: false,
  },

  // We want to dynamically require native addons
  externals: {
    'font-manager': 'require("font-manager")',

    // Not actually a native addons, but for one reason or another
    // we don't want them compiled in our webpack bundle.
    'aws-sdk': 'require("aws-sdk")',
    'asar': 'require("asar")',
    'backtrace-node': 'require("backtrace-node")',
    'node-fontinfo': 'require("node-fontinfo")',
    'socket.io-client': 'require("socket.io-client")',
    'rimraf': 'require("rimraf")',
    'backtrace-js': 'require("backtrace-js")',
    'request': 'require("request")',
    'archiver': 'require("archiver")',
    '@streamlabs/game-overlay': 'require("@streamlabs/game-overlay")',
    'extract-zip': 'require("extract-zip")'
  },

  module: {
    rules: [
      {
        test: /\.vue$/,
        loader: 'vue-loader',
        include: [path.resolve(__dirname, 'app/components'), path.resolve(__dirname, 'updater')],
        options: {
          esModule: true,
          transformToRequire: {
            video: 'src',
            source: 'src'
          },
          loaders: { ts: 'awesome-typescript-loader' }
        }
      },
      {
        test: /\.ts$/,
        loader: 'awesome-typescript-loader',
        options: { useCache: true, reportFiles: ['app/**/*.ts'] },
        exclude: /node_modules|vue\/src/
      },
      {
        test: /\.tsx$/,
        include: path.resolve(__dirname, 'app/components'),
        loader: [
          'babel-loader',
          {
            loader: 'awesome-typescript-loader',
            options: { useCache: true, reportFiles: ['app/components/**/*.tsx'], configFileName: 'tsxconfig.json', instance: 'tsx-loader' }
          }
        ],
        exclude: /node_modules/,
      },
      {
        test: /\.js$/,
        loader: 'babel-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.m\.less$/, // Local style modules
        include: path.resolve(__dirname, 'app/components'),
        use: [
          { loader: 'style-loader' },
          {
            loader: 'css-loader',
            options: { camelCase: true, localIdentName: '[local]___[hash:base64:5]', modules: true, importLoaders: 1 }
          },
          { loader: 'less-loader' }
        ]
      },
      {
        test: /\.g\.less$/, // Global styles
        include: [
          path.resolve(__dirname, 'app/app.g.less'),
          path.resolve(__dirname, 'app/themes.g.less')
        ],
        use: [
          'style-loader',
          {
            loader: 'css-loader',
            options: {
              importLoaders: 1
            }
          },
          'less-loader'
        ]
      },
      {
        test: /\.(png|jpe?g|gif|svg|mp4|ico|wav|webm)(\?.*)?$/,
        loader: 'file-loader',
        options: {
          name: '[name]-[hash].[ext]',
          outputPath: 'media/',
          publicPath: 'bundles/media/'
        }
      },
      // Handles custom fonts. Currently used for icons.
      {
        test: /\.woff$/,
        loader: 'file-loader',
        options: {
          name: '[name].[ext]',
          outputPath: 'fonts/',
          publicPath: 'bundles/fonts/'
        }
      },
      // Used for loading WebGL shaders
      {
        test: /\.(vert|frag)$/,
        loader: 'raw-loader'
      }
    ]
  },

  plugins
};
