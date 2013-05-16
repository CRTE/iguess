/**
 * @author Luis de Sousa [luis.desousa@tudor.lu]]
 * date: 17-01-2012
 * 
 * This code was downloaded from the OpenLayers Mail-list archive:
 * http://osgeo-org.1803224.n2.nabble.com/How-to-change-the-display-coordinates-td3576165.html
 * Originally created by Codehaus for the MapBuilder project.
 */
var WebGIS = WebGIS || { };

//WebGIS.degreeSymbol = "&#176;";
WebGIS.degreeSymbol = "º";

WebGIS.updateCoords = function(lonLat)
{
	lonLat4326 = lonLat.transform(
			WebGIS.leftMap.getProjectionObject(),
            new OpenLayers.Projection(WebGIS.displayProjection));
	
	WebGIS.coordsLongLabel.setText(WebGIS.convertDMS(lonLat4326.lon, "LON")); 
	WebGIS.coordsLatLabel.setText(WebGIS.convertDMS(lonLat4326.lat, "LAT"));	
}

/**
 * Decimal to DMS conversion
 */
WebGIS.convertDMS = function(coordinate, type) {
  var coords = new Array();

  abscoordinate = Math.abs(coordinate)
  coordinatedegrees = Math.floor(abscoordinate);

  coordinateminutes = (abscoordinate - coordinatedegrees)/(1/60);
  tempcoordinateminutes = coordinateminutes;
  coordinateminutes = Math.floor(coordinateminutes);
  coordinateseconds = (tempcoordinateminutes - coordinateminutes)/(1/60);
  coordinateseconds =  Math.round(coordinateseconds*10);
  coordinateseconds /= 10;

  if( coordinatedegrees < 10 )
    coordinatedegrees = "0" + coordinatedegrees;

  if( coordinateminutes < 10 )
    coordinateminutes = "0" + coordinateminutes;

  if( coordinateseconds < 10 )
    coordinateseconds = "0" + coordinateseconds;

  /**
   * This section had to be changed from the original to look a bit more friendly
   */

  return coordinatedegrees + WebGIS.degreeSymbol + " " +
          coordinateminutes + "' " +
          (parseFloat(coordinateseconds).toFixed(parseFloat(2))) + "\" " +
          this.getHemi(coordinate, type);
}

/**
 * Return the hemisphere abbreviation for this coordinate.
 */
WebGIS.getHemi = function(coordinate, type) {
  var coordinatehemi = "";
  if (type == 'LAT') {
    if (coordinate >= 0) {
      coordinatehemi = "N";
    }
    else {
      coordinatehemi = "S";
    }
  }
  else if (type == 'LON') {
    if (coordinate >= 0) {
      coordinatehemi = "E";
    } else {
      coordinatehemi = "W";
    }
  }

  return coordinatehemi;
}
