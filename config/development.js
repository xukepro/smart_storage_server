var config = {
  http_port: '3004',
  redis: {
    port: '6379',
    host: '127.0.0.1',
    sortedSet: {
      key: 'sorted-anchors',
      loadTimeInterval: 1000, // ms
      deleteTimeInterval: 10000, // ms
      offset: 0 // ms
    },
  },
  mongodb: {
    port: '27017',
    host: '127.0.0.1',
    db: {
      name: 'smart_storage',
      request_collection: 'request',
      coords_collection: 'coords',
      tags_collection: 'tags',
      adminUser_collection: 'adminUsers',
      user_collection: 'users',
    },
    db_result: {
      name: 'smart_storage_result',
    }
  },
  solve: {
    defaultFactorA: -69.34, // dBm
    defaultFactorN: 1.221,
    deploymentHeight: 0, // m
    TRITimeout: 10, // s
    DOPWeight: 2,
    windowSize: 5 // windowSize + 1 = fullSize
  },
  enable_map: 1,
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
      '/coord': {
        type: 'file',
        maxLogSize: 1 * 1024 * 1024,
        filename: 'logs/routes-coord-logs.log',
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
      '/coord':   { level: 'INFO', appenders: ['console', '/coord']},
      locManager: { level: 'INFO', appenders: ['console', 'solving']},
      cycLoad:    { level: 'INFO', appenders: ['aboveDiag', 'diag']}
    },
    pm2: true,
    pm2InstanceVar: 'INSTANCE_ID'
  }
};

module.exports = config;