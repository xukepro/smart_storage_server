var config;

/* load from config file */
switch (process.env.NODE_ENV) {
  case 'development':
    config = require('./development');
  break;
  case 'production':
    config = require('./production');
  break;
  default:
    config = require('./development');
  break;
}

module.exports = config;