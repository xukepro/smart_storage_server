module.exports = (res, code, params, msg, contentType) => {
  let operationStatus = {};
  let ContentType = "application/json";
  if (msg) {
    operationStatus.message = msg;
  }

  for (let key in params) {
    operationStatus[key] = params[key];
  }

  res.contentType = ContentType;
  operationStatus.code = code;
  res.send(operationStatus);
};
