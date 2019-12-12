var config = {
  http_port: '3004',
  redis: {
    port: '6379',
    host: '127.0.0.1',
    sortedSet: {
      key: 'sorted-anchors',
      loadTimeInterval: 1000,
      deleteTimeInterval: 3000,
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
    levels: {
      DIAG: { value: 3000, colour: 'magenta' }
    },
    appenders: {
      console: {
        type: 'console'
      },
      customed: {
        type: 'console',
        layout: {
          type: 'pattern',
          pattern: '%[[%d] [%p] %c - %m%]'
        }
      },
      aboveDiag: {
        type: 'logLevelFilter',
        appender: 'console',
        level: 'TRACE'
      },
      diag: {
        type: 'logLevelFilter',
        appender: 'customed',
        level: 'DIAG',
        maxLevel: 'DIAG'
      },
      '/app': {
        type: 'file',
        maxLogSize: 1 * 1024 * 1024,
        filename: 'logs/routes-app-logs.log',
        compress: false
      },
      '/root': {
        type: 'file',
        maxLogSize: 1 * 1024 * 1024,
        filename: 'logs/routes-root-logs.log',
        compress: false,
      },
      '/map': {
        type: 'file',
        maxLogSize: 1 * 1024 * 1024,
        filename: 'logs/routes-map-logs.log',
        compress: false
      },
      cycLoad: {
        type: 'dateFile',
        maxLogSize: 5 * 1024 * 1024,
        filename: 'logs/cycleLoad-logs.log',
        pattern: '.yyyyMMddhh',
        compress: true,
        daysToKeep: 7
      },
      solving: {
        type: 'dateFile',
        maxLogSize: 10 * 1024 * 1024,
        filename: 'logs/solving-logs.log',
        pattern: '.yyyyMMddhh',
        compress: true,
        daysToKeep: 7
      }
    },
    categories: {
      default:    { level: 'INFO', appenders: ['console']},
      '/app':     { level: 'INFO', appenders: ['console', '/app']},
      '/root':    { level: 'INFO', appenders: ['console', '/root']},
      '/map':     { level: 'INFO', appenders: ['console', '/map']},
      locManager: { level: 'DEBUG', appenders: ['console', 'solving']},
      cycLoad:    { level: 'DIAG', appenders: ['aboveDiag', 'diag']}
    },
    pm2: true,
    pm2InstanceVar: 'INSTANCE_ID'
  }
};

module.exports = config;