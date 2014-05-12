/**
 *  Copyright (C) 2010 - 2014 CRP Henri Tudor
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 * 
 * 
 * @author Luis de Sousa [luis.desousa@tudor.lu]
 * Date: 29-11-2011
 *
 * The code that initializes and provides interaction for the map
 * in the home page.
 **/ 

//= require webgis/BaseLayers

var WebGIS = WebGIS || { };

WebGIS.leftMap = null;
WebGIS.rightMap = null;

WebGIS.treeNodes = new Array();
WebGIS.layerList = new Array();

WebGIS.proxy = "/home/geoproxy?url=";
OpenLayers.ProxyHost = "/home/geoproxy?url=";


/**
 * All layers will always use the base layer projection for the request.
 * Since we are using Google and OSM anything other than EPSG:900913 will be ignored.
 */
//WebGIS.mapProjection = "EPSG:900913";
WebGIS.mapProjection = "EPSG:3857";
//WebGIS.requestProjection = "EPSG:900913";
WebGIS.requestProjection = "EPSG:3857";
WebGIS.displayProjection = "EPSG:4326";

Proj4js.defs["EPSG:3857"]  = "+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +wktext  +no_defs";
Proj4js.defs["EPSG:28992"]  = "+proj=sterea +lat_0=52.15616055555555 +lon_0=5.38763888888889 +k=0.9999079 +x_0=155000 +y_0=463000 +ellps=bessel +towgs84=565.237,50.0087,465.658,-0.406857,0.350733,-1.87035,4.0812 +units=m +no_defs";

WebGIS.initMap = function () 
{
	var mapProjection = new OpenLayers.Projection(WebGIS.mapProjection);
    
    // Nothing will be displayed outside these bounds (Poland - Ireland)
    var boundsMap  = new OpenLayers.Bounds(-1015000, 5845000, 1100000, 8000000);  
    
    WebGIS.leftMap = new OpenLayers.Map("leftMap",{
      projection: 			mapProjection,
      displayProjection: 	new OpenLayers.Projection(WebGIS.displayProjection),
      units: 				"m",
      maxExtent: 			boundsMap,
      controls: []
    });
   
    WebGIS.registerIdentify(WebGIS.leftMap, this);

    WebGIS.leftMap.addLayers(WebGIS.getLeftBaseLayers()); 
    //Tell GoogleMaps we don't want the 45º view
    WebGIS.gsatLeft.mapObject.setTilt(0);
    
    WebGIS.leftMap.events.register("mousemove",   null, WebGIS.mapMouseMove);
    
    WebGIS.leftMap.addControl(new OpenLayers.Control.ScaleLine());
};

WebGIS.mapMouseMove = function(e) 
{
	var lonLat = WebGIS.leftMap.getLonLatFromPixel(e.xy);	
	WebGIS.updateCoords(lonLat);
};

WebGIS.zoomToCity = function () 
{  
	onLocationChanged(document.getElementById("city-dropdown").value);
};

// Adds a new layer to the map "on the fly"
WebGIS.addNewLayer = function (title, serviceURL, layerName, type, tag, id)
{
	WebGIS.layerList[id] = new Array();
	WebGIS.layerList[id]["title"] = title;
	WebGIS.layerList[id]["serviceURL"] = serviceURL;
	WebGIS.layerList[id]["layerName"] = layerName;
	WebGIS.layerList[id]["type"] = type;
	
    // Call OpenLayers.Layer.WMS.initialize()
	if(WebGIS.treeNodes[tag] == null)
	{
		WebGIS.treeNodes[tag] = new Ext.tree.TreeNode
		({
			    text: tag,
			    leaf: false,
			    expanded: true
		});
		WebGIS.treeRoot.appendChild(WebGIS.treeNodes[tag]);
	}
    
    /*var newNode = new GeoExt.tree.LayerNode(
    {
        text: title,
        layer: layer,
        leaf: true,
        checked: visible,
        //icon: null,
        iconCls: "treeIcon",
        children: [],
        nodeType: "gx_layer",
        id: "dsid-" + id
    });*/
    var newNode = new Ext.tree.TreeNode(
    {
        text: title,
        leaf: true,
        checked: false,
        iconCls: "treeIcon",
        children: [],
        id: "dsid-" + id,
        toto: "TOTO"
    });
    newNode.on("checkchange", WebGIS.addLayerToMapEvent);
    WebGIS.treeNodes[tag].appendChild(newNode);
    
	if(sessionStorage.getItem(layerName) != null)
		WebGIS.addLayerToMap(id);	
};

WebGIS.addLayerToMapEvent = function(node, checked)
{
	var id = node.id.substring(5,node.id.length);
	
	if(checked) WebGIS.addLayerToMap(id);
	else WebGIS.removeLayerFromMap(id);
};

WebGIS.addLayerToMap = function(id)
{
	var params = { 
		layers: WebGIS.layerList[id]["layerName"],      
		format: "image/png",
		srsName: WebGIS.requestProjection,
		srs: WebGIS.requestProjection,
		transparent: "true"
    };
    
    var sldBody = WebGIS.getStyle(
    	WebGIS.layerList[id]["layerName"], 
    	WebGIS.layerList[id]["type"]
    	);
    if(sldBody != null) params["sld_body"] = sldBody;
    
    var options = { 
    	isBaseLayer: false,     
		visibility: true,
		singleTile:  true,
		transitionEffect: 'resize'
    };
	
	var layer = new OpenLayers.Layer.WMS(
		WebGIS.layerList[id]["title"], 
		WebGIS.layerList[id]["serviceURL"], 
		params, 
		options
	);
	
	WebGIS.leftMap.addLayer(layer);
	layer.events.register("visibilitychanged", this, WebGIS.toggleLayer);
	
	WebGIS.addWidgetsToLayerNode(WebGIS.layerTree.root.firstChild.firstChild);
};

WebGIS.removeLayerFromMap = function(id)
{
	var array = WebGIS.leftMap.getLayersByName(WebGIS.layerList[id]["title"]);
	if (array.length > 0) 
	{
		WebGIS.leftMap.removeLayer(array[0]);
		WebGIS.layerTree.root.firstChild.eachChild(WebGIS.addWidgetsToLayerNode);
	}
};

WebGIS.moveLayer = function(layerName, delta)
{
	if (layerName == null) return;
	
	var layers = WebGIS.leftMap.getLayersByName(layerName);
	if (layers.length <= 0) return;
	WebGIS.leftMap.raiseLayer(layers[0], delta);
	
	WebGIS.layerTree.root.firstChild.eachChild(WebGIS.addWidgetsToLayerNode);
};

WebGIS.moveLayerUp = function(butt, event)
{ 
	WebGIS.moveLayer(butt.container.dom.firstChild.data, 1);
};

WebGIS.moveLayerDown = function(butt, event)
{ 
	WebGIS.moveLayer(butt.container.dom.firstChild.data, -1);
};

WebGIS.addWidgetsToLayerNode = function(treeNode)
{
	var buttonUp = new Ext.Button({
		xtype: 'button',
		tooltip : 'Move up',
		iconCls : 'tinyUp',
		autoWidth : true,
		cls: 'tinyUp',
		handler: WebGIS.moveLayerUp,
	});
	
	var buttonDown = new Ext.Button({
		xtype: 'button',
		tooltip : 'Move down',
		iconCls : 'tinyDown',
		autoWidth : true,
		cls: 'tinyDown',
		handler: WebGIS.moveLayerDown
	});
	
	var slider = new GeoExt.LayerOpacitySlider({
        layer: treeNode.layer,
        aggressive: true, 
        cls: "layerSlide",
        isFormField: true,
        inverse: false,
        fieldLabel: "opacity",
        plugins: new GeoExt.LayerOpacitySliderTip({template: '<div>Transparency: {opacity}%</div>'})
    });
	
	treeNode.setCls("layerNode");
	buttonUp.render(treeNode.getUI().getTextEl());
	buttonDown.render(treeNode.getUI().getTextEl());
	slider.render(treeNode.getUI().getTextEl());
};

// Remove all layers from the current map
WebGIS.clearLayers = function(alsoClearBaseLayers)
{
  alsoClearBaseLayers = alsoClearBaseLayers || false;
  var layers = WebGIS.leftMap.layers;
  var layersToRemove = [];

  for(var i = 0, len = layers.length; i < len; i++) 
  {   
    if(layers[i] != null) 
    {
    	if(!alsoClearBaseLayers && layers[i].isBaseLayer);
    	else WebGIS.leftMap.removeLayer(layers[i]);
    } 
  } 
  	
  WebGIS.treeNodes = [];
  WebGIS.treeRoot.removeAll();
};
		

		 


