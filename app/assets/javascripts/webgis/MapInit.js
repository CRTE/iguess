/**
 * @author Luis de Sousa [luis.desousa@tudor.lu]
 * Date: 29-11-2011
 *
 * The code that initializes and provides interaction for the map
 * in the home page.
 **/ 

//= require webgis/BaseLayers

var WebGIS = WebGIS || { };

WebGIS.map;
/**
 * All layers will always use the base layer projection for the request.
 * Since we are using Google and OSM anything other than EPSG:900913 will be ignored.
 */
//WebGIS.mapProjection = "EPSG:900913";
WebGIS.mapProjection = "EPSG:3857";
//WebGIS.requestProjection = "EPSG:900913";
WebGIS.requestProjection = "EPSG:3857";
WebGIS.displayProjection = "EPSG:4326";

/**
 * In the future the proj4 string will have to be stored in the database.
 * For now only the Ludwigsburg projection is known so it is left hard coded here.
 */
Proj4js.defs["EPSG:31467"] = "+proj=tmerc +lat_0=0 +lon_0=9 +k=1 +x_0=3500000 +y_0=0 +ellps=bessel +datum=potsdam +units=m +no_defs";
Proj4js.defs["EPSG:28992"] = "+proj=sterea +lat_0=52.15616055555555 +lon_0=5.38763888888889 +k=0.9999079 +x_0=155000 +y_0=463000 +ellps=bessel +units=m +no_defs";
Proj4js.defs["EPSG:3857"]  = "+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +wktext  +no_defs";

WebGIS.initMap = function () {

	var mapProjection = new OpenLayers.Projection(WebGIS.mapProjection);
	
    var boundsInit = new OpenLayers.Bounds(995196.25, 6240993.46, 1057535.16, 6274861.39);
    
    // Nothing will be displayed outside these bounds (Poland - Ireland)
    var boundsMap  = new OpenLayers.Bounds(-1015000, 5845000, 1100000, 8000000);  
    
    WebGIS.map = new OpenLayers.Map("BroadMap",{
      projection: 			mapProjection,
      displayProjection: 	new OpenLayers.Projection(WebGIS.displayProjection),
      units: 				"m",
      maxExtent: 			boundsMap,
      controls: 			[ new OpenLayers.Control.NavToolbar({zoomWheelEnabled: true}) ]
    });

    var mp = new OpenLayers.Control.MousePosition({
      formatOutput: function(lonLat) {
        var markup = WebGIS.convertDMS(lonLat.lon, "LON") + "  ";
        markup += WebGIS.convertDMS(lonLat.lat, "LAT");
        return markup;
      }
    });
    WebGIS.map.addControl(mp);
    
    WebGIS.registerIdentify(WebGIS.map, this);

    WebGIS.map.addLayers(WebGIS.getBaseLayers());

    WebGIS.map.setCenter(boundsInit.getCenterLonLat(), 13);
    
    var buildsIGUESS =  new OpenLayers.Layer.WMS(
    	"Builds iGUESS",
    	"http://services.iguess.tudor.lu/cgi-bin/mapserv?map=/var/www/MapFiles/RO_localOWS_test.map",
        {layers: "RO_building_footprints", 
         format: "image/png",
         srsName: WebGIS.requestProjection,
	 	 transparent: "true",
     	 projection: new OpenLayers.Projection(WebGIS.requestProjection)},
        {isBaseLayer: false,  
     	 visibility: false}
    );
    
    WebGIS.map.addLayer(buildsIGUESS);
    
  }

WebGIS.zoomToCity = function () {
	  onLocationChanged(document.getElementById("city-dropdown").value);
	}

// Adds a new layer to the map "on the fly"
WebGIS.addNewLayer = function (title, serviceURL, layerName)
{
    var layer =  new OpenLayers.Layer.WMS(
            title,
            serviceURL,
            {layers: layerName,
              format: "image/png",
              srsName: WebGIS.requestProjection,
              srs: WebGIS.requestProjection,
              transparent: "true"},
            {isBaseLayer: false,
              visibility: true,
              singleTile: true}
    );

    WebGIS.map.addLayer(layer);
}

//Remove all layers from the current map
WebGIS.clearLayers = function(alsoClearBaseLayers)
{
 /* alsoClearBaseLayers = alsoClearBaseLayers || false;
  var layers = WebGIS.map.layers;
  var layerCount = layers.length;

  for(var i = 0; i < layerCount; i++) {
    if(layers[i].isBaseLayer == alsoClearBaseLayers) {
      WebGIS.map.removeLayer(layers[i]);
    }
  }*/
}


