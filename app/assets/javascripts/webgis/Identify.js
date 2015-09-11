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
 * Date: 12-11-2012
 *
 * Includes the functions to perform the identify action
 **/

var WebGIS = WebGIS || { };

WebGIS.ctrlIdentify = null;
WebGIS.infoPopUp = null;
WebGIS.regExpImages = "https?://(.)*(.jpg|.png)";

WebGIS.registerIdentify = function(map, ref) {

	WebGIS.ctrlIdentify = new OpenLayers.Control.WMSGetFeatureInfo({
		drillDown:true,
		infoFormat:"application/vnd.ogc.gml"
	});

	WebGIS.ctrlIdentify.events.register("getfeatureinfo", ref, WebGIS.showInfo);
	WebGIS.leftMap.addControl(WebGIS.ctrlIdentify);
};

WebGIS.toggleLayer = function(e) 
{  
	WebGIS.ctrlIdentify.layers = [];
	
	var layers  = WebGIS.leftMap.layers;                              
    
    for (var i = 0; i < layers.length; i++) 
    {
    	if (layers[i].getVisibility())
    		WebGIS.ctrlIdentify.layers.push(layers[i]);
    }
};

WebGIS.searchLayerName = function(type)
{
	for (i = 0; i < WebGIS.leftMap.layers.length; i++)
		if((WebGIS.leftMap.layers[i].params) &&
		   (WebGIS.leftMap.layers[i].params.LAYERS == type))
			return WebGIS.leftMap.layers[i].name;
			
	return type;
};

WebGIS.showInfo = function(evt) 
{
	var itemSet = [];
	var message = "";
	
    Ext.each(evt.features, function(feature) 
    {
		grid = new Ext.grid.PropertyGrid();
		for (var key in feature.attributes)
		{	
			value = feature.attributes[key];
			if ((value != null) && (value.match(WebGIS.regExpImages)))	
			    grid.customRenderers[key] = Function("v", "return \"<img src=\\\"" + value + "\\\" />\";");	
		}
    	delete grid.getStore().sortInfo; // Remove default sorting
    	grid.getColumnModel().getColumnById('name').sortable = true;
    	grid.setSource(feature.attributes); // Now load data
    	grid.title = WebGIS.searchLayerName(feature.type);
    	itemSet.push(grid);
    });
    
    if(itemSet.length <= 0)
    	message = "<br><br><br><br><br><br><br><br>" + 
    		"<p align=center><i>No data found in this area.</i></p>";

    if(WebGIS.infoPopUp != null) WebGIS.infoPopUp.close();

    WebGIS.infoPopUp = new GeoExt.Popup({
        title: "Feature Info",
        width: 270,
        height: 320,
        layout: "accordion",
        map: WebGIS.leftPanel,
		location: evt.xy,
        items: itemSet,
        html: message
    });
    
    WebGIS.infoPopUp.show();
};
