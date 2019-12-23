var express = require('express');
var router = express.Router();
var log;
var mongoClient;
var rcoords;

module.exports = function init (globalValues) {
  log = globalValues.log.getLogger("/coordinate");
  mongoClient = globalValues.mongoClient;
  rcoords = globalValues.rcoords;

  return router;
};

/* Respond function */
var respond = function (res, statusCode, params, msg, contentType) {
  var operationStatus = {};
  var ContentType = 'application/json';
  if (msg) { operationStatus.message = msg }

  for (var key in params) { operationStatus[key] = params[key] }

  res.contentType = ContentType;
  operationStatus.statusCode = statusCode;
  res.send(operationStatus);
};

router.route('/updateOne').post(function (req, res, next) {
  
  if (!Object.prototype.hasOwnProperty.call(req.body, 'id')) {
    return next(1);
  }

  let id = req.body.id;
  var rcoord = rcoords[id];
  if (Object.prototype.hasOwnProperty.call(req.body, 'x')) {
    rcoord[0] = req.body.x;
  }
  if (Object.prototype.hasOwnProperty.call(req.body, 'y')) {
    rcoord[1] = req.body.y;
  }
  if (Object.prototype.hasOwnProperty.call(req.body, 'A')) {
    rcoord[2] = req.body.A;
  }
  if (Object.prototype.hasOwnProperty.call(req.body, 'N')) {
    rcoord[3] = req.body.N;
  }
  mongoClient.upsertCoords(id, rcoord)
    .then(function (response) {
      rcoords[id] = rcoord;
      return next();
    })
    .catch(function (err) {
      return next(err);
    });

}, function (req, res, next) {

  log.info('update one rcoord successed');
  respond(res, 200, { 'rcoords': rcoords });

});

router.route('/update').post(function (req, res, next) {

  if (!Object.prototype.hasOwnProperty.call(req.body, 'rcoords')) {
    return next(1);
  }

  let rcoords = req.body.rcoords;
  var actions = [];
  for (let id of Object.keys(rcoords)) {
    actions.push(mongoClient.upsertCoords(id, rcoords[id]));
  }
  Promise.all(actions)
    .then(function () {
      return next();
    })
    .catch(function (err) {
      return next(err);
    });

}, function (req, res, next) {

  mongoClient.getCoords()
    .then(function (response) {
      for (let row of response) {
        rcoords[row._id] = row.coords;
      }
      return next();
    })
    .catch(function (err) {
      return next(err);
    });

}, function (req, res, next) {

  log.info('update rcoords successed');
  respond(res, 200, { 'rcoords': rcoords });

});

router.route('/get').get(function (req, res, next) {
  
  respond(res, 200, { 'rcoords': rcoords });

});

router.route('/reload').get(function (req, res, next) {

  mongoClient.getCoords()
    .then(function (response) {
      for (let row of response) {
        rcoords[row._id] = row.coords;
      }
      return next();
    })
    .catch(function (err) {
      return next(err);
    });

}, function (req, res, next) {

  log.info('reload rcoords successed');
  respond(res, 200, { 'rcoords': rcoords });

});