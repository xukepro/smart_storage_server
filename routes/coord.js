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

router.route('/change').post(function (req, res, next) {

  let getRcoords = req.body.rcoords;
  for (let k of Object.keys(getRcoords.getRcoords)){
    let json = {_id: k, coords: getRcoords.getRcoords[k]};
    console.log(json);
    mongoClient.Coords(json).save()
      .then(function () {
        return next();
      })
      .catch(function (err) {
        return next(err);
      });
  }

}, function (req, res, next) {

  mongoClient.getCoords()
    .then(function () {
      for (let row of res) {
        rcoords[row._id] = row.coords;
      }
      return next();
    })
    .catch(function (err) {
      return next(err);
    });

}, function (req, res, next) {
  
  log.info('change rcoords successed');
  respond(res, 200, { 'rcoords': rcoords });

});

router.route('/get').get(function (req, res, next) {

  respond(res, 200, { 'rcoords': rcoords });

});

router.route('/reload').get(function (req, res, next) {

  mongoClient.getCoords()
    .then(function () {
      for (let row of res) {
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