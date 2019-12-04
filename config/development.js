var config = {
  'http_port': '3004',
  'https_port': '3005',
  'redis': {
    'port': '6379',
    'host': '127.0.0.1',
    'sortedSet': {
      'key': 'sorted-anchors',
      'loadTimeInterval': 5000,
      'deleteTimeInterval': 60000
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