var fs = require('fs');

var config = {
  http_port: '3004',
  https_port: '3005',
  sec: {
    key: fs.readFileSync(`${__dirname}/../../../server_certificates/server.key`),
    crt: fs.readFileSync(`${__dirname}/../../../server_certificates/server.crt`)
  },
  redis: {
    port: '6379',
    host: '127.0.0.1',
    sortedSet: {
      key: 'sorted-anchors',
      loadTimeInterval: 1000,
      deleteTimeInterval: 60000,
      offset: 3000
    },
  },
  mongodb: {
    port: '27017',
    host: '127.0.0.1',
    database: 'smart_storage',
    request_collection: 'request',
    results_collection: 'results',
    coords_collection: 'coords'
  },
  log4js: {
    appenders: {
      console: {
        type: 'console'
      },
      solving: {
        type: 'dateFile',
        maxLogSize: 10 * 1024 * 1024,
        filename: 'logs/solving-logs.log',
        pattern: '.yyyyMMddhh',
        compress: true,
        daysToKeep: 7
      },
    },
    categories: {
      default:    { level: 'INFO', appenders: ['console'] },
      '/app':     { level: 'INFO', appenders: ['console'] },
      '/root':    { level: 'INFO', appenders: ['console'] },
      '/map':     { level: 'INFO', appenders: ['console'] },
      locManager: { level: 'INFO', appenders: ['solving'] },
      cycLoad:    { level: 'INFO', appenders: ['console'] }
    },
    pm2: true,
    pm2InstanceVar: 'INSTANCE_ID'
  }
};

module.exports = config;