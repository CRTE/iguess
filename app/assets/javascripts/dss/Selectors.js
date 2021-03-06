/**
 * Copyright (C) 2010 - 2014 CRP Henri Tudor
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
 * Date: 13-05-2013
 *
 * Methods to control the sliders window.
 */ 

//= require webgis/MapInit
//= require dss/Feature
//= require dss/FeatureArray
//= require dss/Map
//= require dss/Sliders

var DSS = DSS || { };

DSS.costField = "multi_c_e";
DSS.invField = "mult_r_i";
DSS.areaField = "area_cum";
DSS.genField = "mult_r_e";

DSS.comboLayer = null;
DSS.comboInvest = null;

DSS.winSelect = null;

DSS.nextSelect = null;

DSS.init = function()
{
	DSS.map = WebGIS.leftMap;
	DSS.showSelectWindow();
	DSS.winSelect.show();
	if(DSS.winPanel == null) DSS.initWinPanel();
};


DSS.getOverlays = function()
{
	overlays = new Array(); 
	
	for(i=0; i < DSS.map.layers.length; i++)
		if (!DSS.map.layers[i].isBaseLayer && DSS.map.layers[i].visibility)
			overlays.push(DSS.map.layers[i].name);
	
	return overlays;
};

DSS.populateAtributes = function()
{
	var attributes = new Array();
	for (var key in DSS.layerWFS.features[0].attributes) attributes.push(key);
	
	DSS.comboCost.enable();
	DSS.comboInvest.enable();
	DSS.comboGen.enable();
	DSS.comboArea.enable();
	
	DSS.comboCost.store = attributes;	
	DSS.comboInvest.store = attributes;
	DSS.comboGen.store = attributes;
	DSS.comboArea.store = attributes;	
};

DSS.comboLayerSelected = function()
{
	layers = DSS.map.getLayersByName(DSS.comboLayer.getValue());
	if(layers.length <= 0) return;
	
	if(layers[0].CLASS_NAME == "OpenLayers.Layer.Vector")
	{
		DSS.layerWFS = layers[0];
		DSS.populateAtributes();
	}
	else
	{
		DSS.createProtocol(layers[0].params["LAYERS"], layers[0].url);
		if (DSS.layerWFS == null) DSS.layerWFS = DSS.createWFS(layers[0].params["LAYERS"], null);	
		else DSS.layerWFS.protocol = DSS.protocol;
		
	}
};

DSS.createProtocol = function(name, address)
{
	DSS.protocol = new OpenLayers.Protocol.WFS({
		version: "1.1.0",
		url: address + "&srsName=" + WebGIS.mapProjection,
		featureNS: "http://mapserver.gis.umn.edu/mapserver",
		featureType: name,
		srsName: WebGIS.cityCRS
	});
	
	var response = DSS.protocol.read({
	    maxFeatures: 2000,
	    callback: DSS.featuresLoaded
	});
};

DSS.createWFS = function(name, style)
{
	if (style == null) style = DSS.createStyle(); 
	
	var wfs = new OpenLayers.Layer.Vector(name, {
		strategies: [new OpenLayers.Strategy.Fixed()],
		styleMap: style,
		projection: new OpenLayers.Projection(WebGIS.cityCRS),
		protocol: DSS.protocol},
        {isBaseLayer: false,  
     	 visibility: true}
	);

	return wfs;
};

DSS.featuresLoaded = function(resp) 
{
	/* Check if a WFS service is available for the layer */
	if((resp.features == null) || (resp.features.length <= 0))
	{
		alert("Sorry, this layer is not available in vector format.\n\n" +
				"Please select a different layer.");
		return;
	}
	
	DSS.layerWFS.protocol = DSS.protocol;
	DSS.layerWFS.addFeatures(resp.features);
	DSS.layerWFS.setVisibility(true);
	
	DSS.populateAtributes();
};

DSS.comboFieldsSelected = function()
{
	if((DSS.comboInvest.getValue() != null) && (DSS.comboInvest.getValue() != "") &&
	   (DSS.comboGen.getValue()    != null) && (DSS.comboGen.getValue()    != "") &&
       (DSS.comboArea.getValue()   != null) && (DSS.comboArea.getValue()   != "") &&
       (DSS.comboCost.getValue()   != null) && (DSS.comboCost.getValue()   != ""))
		DSS.nextSelect.enable();
};

DSS.next = function()
{
	DSS.costField = DSS.comboCost.getValue();
	DSS.invField  = DSS.comboInvest.getValue();
	DSS.areaField = DSS.comboArea.getValue();
	DSS.genField  = DSS.comboGen.getValue();
	DSS.winSelect.hide();
	if(DSS.winPanel == null) DSS.initWinPanel();
	DSS.winPanel.show();
	
	if(DSS.layerWFS.map == null)
	{
		// With some services the addLayer method is throwing an exception, 
		// for unknown reasons, but it is correctly adding the new layer to the map. 
		// The try block avoids execution to halt.
		try
		{
			DSS.map.addLayer(DSS.layerWFS);
		}
		catch(e) 
		{
			//debugger;
			DSS.map.addLayer(DSS.layerWFS);
		}
		
		// Remove layer from layer tree
		WebGIS.layerTree.root.firstChild.firstChild.remove();
	}
	
	//----- Populate Feature Array -----//
	DSS.featureArray = new DSS.FeatureArray();
	for(var i = 0; i < DSS.layerWFS.features.length; i++)
	{
		var feat = new DSS.Feature(
			DSS.layerWFS.features[i].attributes[DSS.costField],	
			DSS.layerWFS.features[i].attributes[DSS.invField],
			DSS.layerWFS.features[i].attributes[DSS.genField],
			DSS.layerWFS.features[i].attributes[DSS.areaField]
		);
		DSS.featureArray.add(feat);
	}
	


	DSS.initSliders();
};

DSS.showSelectWindow = function() 
{
	DSS.comboLayer  = new Ext.form.ComboBox(
	{
		fieldLabel: 'Layer', 
		labelAlign: 'top',
		width: DSS.controlWidth,
		store: DSS.getOverlays(), 
	    listeners:{
	         scope: DSS,
	         'select': DSS.comboLayerSelected
	    }
	});
	
	DSS.comboCost = new Ext.form.ComboBox(
	{	
		fieldLabel: 'Cost', 	
		store: [''], 
		disabled: true, 
		labelAlign: 'top',
		width: DSS.controlWidth,
	    listeners:{
	         scope: DSS,
	         'select': DSS.comboFieldsSelected
	         //'select': function() {alert('SELECT!!!!');}
	    }
	});
	
	DSS.comboInvest = new Ext.form.ComboBox(
	{	
		fieldLabel: 'Cumulative Investment', 	
		labelAlign: 'top',
		width: DSS.controlWidth,
		store: [''], 
		disabled: true, 
	    listeners:{
	         scope: DSS,
	         'select': DSS.comboFieldsSelected
	    }
	});
	
	DSS.comboGen = new Ext.form.ComboBox(
	{
		fieldLabel: 'Cumulative Energy Generation/Savings', 	
		labelAlign: 'top',
		width: DSS.controlWidth,
		store: [''], 
		disabled: true, 
	    listeners:{
	         scope: DSS,
	         'select': DSS.comboFieldsSelected
	    }
	});
	
	DSS.comboArea = new Ext.form.ComboBox(
	{
		fieldLabel: 'Cumulative Area', 
		labelAlign: 'top',
		width: DSS.controlWidth,
		store: [''], 
		disabled: true, 
	    listeners:{
	         scope: DSS,
	         'select': DSS.comboFieldsSelected
	    }
	});
	
	var info = new Ext.form.TextArea({disabled: true, originalValue: 'This is some info.'});
	
	//creating a form 
	this.form= new Ext.FormPanel({ 
		border:false, // <-- removing the border of the form
		defaults:{xtype:'textfield'},	//component by default of the form
		bodyStyle:'background-color:#e8e8e8; padding:12px',
		labelAlign: 'top',
		items:[ 
		    DSS.comboLayer, 
		    DSS.comboCost, 
		    DSS.comboInvest, 
		    DSS.comboGen, 
		    DSS.comboArea, 
		    //info,
		] 
	}); 
	
	var intro = new Ext.Panel({
		bodyStyle:'background-color:#e8e8e8;',
		contentEl: 'divSelectId',
		border: false
	});
	
	DSS.nextSelect = new Ext.Button({
		text:'Next', 
        disabled: true,
        listeners:{
	    	scope: DSS,
	    	'click': DSS.next
	    }
    });

	//creating the window that will contain the form
	DSS.winSelect = new Ext.Window({ 
		title: 'Potential Application', 
		width:300, 
		//height:400,
		closable: false, 
		bodyStyle:'background-color:#e8e8e8;padding: 6px', 
		items:[intro, this.form], //assigning the form
		buttonAlign: 'right', //buttons aligned to the right
		buttons:
		[{
			text:'Cancel', 
		    listeners:{
		    	scope: DSS,
		    	'click': DSS.quit
		    }
		},
		DSS.nextSelect] //buttons of the form
	}); 

	DSS.winSelect.show();
};