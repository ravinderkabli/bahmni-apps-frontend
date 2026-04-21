const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const { NxReactWebpackPlugin } = require('@nx/react/webpack-plugin');
const { InjectManifest } = require('workbox-webpack-plugin');
const webpack = require('webpack');
const { join } = require('path');
const fs = require('fs');
const https = require('https');

module.exports = (env, argv) => {
  //TODO to read this from docker compose
  //TODO should we hardcode?
  const publicPath = env.PUBLIC_PATH || process.env.PUBLIC_PATH || '/bahmni-new/';
  const isDevelopment = argv.mode !== 'production';

  return {
    output: {
      path: join(__dirname, 'dist'),
      publicPath: publicPath,
      clean: true,
    },
    resolve: {
      alias: isDevelopment ? {
        '@bahmni/clinical-app': join(__dirname, '../apps/clinical/src'),
        '@bahmni/registration-app': join(__dirname, '../apps/registration/src'),
        '@bahmni/appointments-app': join(__dirname, '../apps/appointments/src'),
      } : {},
    },
    devServer: {
      port: 3000,
historyApiFallback: {
        index: '/bahmni-new/index.html',
        disableDotRule: true,
        htmlAcceptHeaders: ['text/html', 'application/xhtml+xml'],
      },
      proxy: [
        {
          context: ['/bahmni_config', '/openmrs'],
          target: 'https://localhost/',
          changeOrigin: true,
          secure: false,
          logLevel: 'debug',
        },
        {
          context: ['/bahmni-ai'],
          target: 'http://localhost:8090',
          pathRewrite: { '^/bahmni-ai': '' },
          changeOrigin: true,
          secure: false,
        },
        {
          context: ['/whisper-stt'],
          target: 'http://localhost:8765',
          pathRewrite: { '^/whisper-stt': '' },
          changeOrigin: true,
          secure: false,
        },
      ],
      setupMiddlewares: (middlewares, devServer) => {
        // Serve the local AI config file (contains Anthropic API key for demo)
        devServer.app.get('/anthropic-proxy/ai-config', (_req, res) => {
          const configPath = join(__dirname, '..', 'ai-config.json');
          try {
            if (fs.existsSync(configPath)) {
              const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
              res.json(config);
            } else {
              res.json({ anthropicApiKey: null });
            }
          } catch {
            res.json({ anthropicApiKey: null });
          }
        });

        // Custom Anthropic middleware: builds a fresh Node.js HTTPS request
        // with only the required headers — no browser/CORS headers ever reach Anthropic.
        devServer.app.post('/anthropic-proxy/v1/messages', (req, res) => {
          let body = '';
          req.on('data', (chunk) => { body += chunk; });
          req.on('end', () => {
            const apiKey = req.headers['x-api-key'];
            const anthropicVersion = req.headers['anthropic-version'] || '2023-06-01';

            console.log(`[anthropic-proxy] → POST /v1/messages  key=${String(apiKey).slice(0, 12)}...`);

            const options = {
              hostname: 'api.anthropic.com',
              port: 443,
              path: '/v1/messages',
              method: 'POST',
              headers: {
                'content-type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': anthropicVersion,
                'content-length': Buffer.byteLength(body),
              },
            };

            const anthropicReq = https.request(options, (anthropicRes) => {
              console.log(`[anthropic-proxy] ← ${anthropicRes.statusCode}`);
              res.statusCode = anthropicRes.statusCode;
              res.setHeader('content-type', 'application/json');
              anthropicRes.pipe(res);
            });

            anthropicReq.on('error', (err) => {
              console.error('[anthropic-proxy] Request error:', err.message);
              res.statusCode = 502;
              res.end(JSON.stringify({ error: { type: 'proxy_error', message: err.message } }));
            });

            anthropicReq.write(body);
            anthropicReq.end();
          });
        });
        return middlewares;
      },
    },
    plugins: [
      new webpack.DefinePlugin({
        'process.env.PUBLIC_URL': JSON.stringify(publicPath),
        'process.env.PUBLIC_PATH': JSON.stringify(publicPath),
      }),
      new NxAppWebpackPlugin({
        tsConfig: './tsconfig.app.json',
        compiler: 'babel',
        main: './src/main.tsx',
        index: './src/index.html',
        baseHref: publicPath,
        assets: [
          './src/assets',
          { input: isDevelopment ? '../apps/clinical/public/locales' : '../apps/clinical/dist/locales', glob: '**/*', output: 'clinical/locales' },
          { input: isDevelopment ? '../apps/registration/public/locales' : '../apps/registration/dist/locales', glob: '**/*', output: 'registration/locales' },
          { input: isDevelopment ? '../apps/appointments/public/locales' : '../apps/appointments/dist/locales', glob: '**/*', output: 'appointments/locales' },
        ],
        styles: ['./src/styles.scss'],
        outputHashing:
          process.env['NODE_ENV'] === 'production' ? 'all' : 'none',
        optimization: process.env['NODE_ENV'] === 'production',
      }),
      new NxReactWebpackPlugin({
        // Uncomment this line if you don't want to use SVGR
        // See: https://react-svgr.com/
        // svgr: false
      }),
      ...(!isDevelopment ? [
        new InjectManifest({
          swSrc: join(__dirname, 'src/service-worker.ts'),
          swDest: 'service-worker.js',
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          exclude: [/\.map$/, /^manifest.*\.js$/],
        }),
      ] : []),
    ],
  };
};
