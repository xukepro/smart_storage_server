var gju = require('geojson-utils');

/*---------------- 室内相对坐标转换为地理坐标 -----------------/

floorInfo = 
{
    "buid": "building_8cc9eca0-fd74-432f-a8d4-690620c39735_1557389824542",
    "floor_name": "-1",
    "is_published": "true",
    "username_creator": "null",
    "description": "-1",
    "floor_number": "-1",
    "fuid": "building_8cc9eca0-fd74-432f-a8d4-690620c39735_1557389824542_-1",
    "zoom": "21",
    "top_right_lat": "39.964916511126624",
    "top_right_lng": "116.35848090359056",
    "bottom_left_lat": "39.96441208043755",
    "bottom_left_lng": "116.3579544117573"
}

planInfo =
{
    "length_x": "44",
    "length_y": "55"
}

/-------------------------------------------------*/
module.exports.convert = convert;
function convert(pos, floorInfo, planInfo) {

  var geoLen_x = gju.pointDistance(
    { type: 'Point', coordinates: [floorInfo.bottom_left_lng, floorInfo.bottom_left_lat] },
    { type: 'Point', coordinates: [floorInfo.top_right_lng, floorInfo.bottom_left_lat] }
  );
  var geoLen_y = gju.pointDistance(
    { type: 'Point', coordinates: [floorInfo.bottom_left_lng, floorInfo.bottom_left_lat] },
    { type: 'Point', coordinates: [floorInfo.bottom_left_lng, floorInfo.top_right_lat] }
  );

  var true_len_x = planInfo.length_x;
  var true_len_y = planInfo.length_y;

  var geoDis_x = pos[0] / true_len_x * geoLen_x;
  var geoDis_y = pos[1] / true_len_y * geoLen_y;

  var bearing = Math.atan2(geoDis_x, geoDis_y) * 180.0 / Math.PI;
  var kDist = Math.sqrt(Math.pow(geoDis_x, 2) + Math.pow(geoDis_y, 2)) / 1000.0;

  var desti = gju.destinationPoint(
    { type: 'Point', coordinates: [floorInfo.bottom_left_lng, floorInfo.bottom_left_lat] }, bearing, kDist);

  var coordinate = {
    lat: desti.coordinates[1],
    lng: desti.coordinates[0]
  };

  return coordinate;
}