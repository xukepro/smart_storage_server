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
    'redis_host': '127.0.0.1'
  }
}

module.exports = config;