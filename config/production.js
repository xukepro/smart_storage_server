var fs = require('fs');

var config = {
  'http_port': '3004',
  'https_port': '3005',
  'sec': {
    'key': fs.readFileSync(`${__dirname}/../../../server_certificates/server.key`),
    'crt': fs.readFileSync(`${__dirname}/../../../server_certificates/server.crt`)
  },
  'redis': {
    'redis_port': '6379',
    'redis_host': '127.0.0.1',
    'sortedSet': {
      'key': 'sorted-anchors',
      'loadTimeInterval': 1000,
      'deleteTimeInterval': 60000,
      'offset': 3000
    },
  },
  'mongodb': {
    'port': '27017',
    'host': '127.0.0.1',
    'database': 'smart_storage',
    'request_collection': 'request',
    'results_collection': 'results'
  }
}

module.exports = config;