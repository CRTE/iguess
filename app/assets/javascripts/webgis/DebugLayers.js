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
 * Date: 24-01-2013
 *
 * Methods that add debug layers to the WebGIS.
 * Used to test the WebGIS in case the Data Manager isn't working properly.
 */ 

var WebGIS = WebGIS || { };

WebGIS.addDebugLayersML = function() {

	var oroML =  new OpenLayers.Layer.WMS(
    	"Orography",
    	"http://montreuil.dynmap.com/carte_pour_iguess/carteWS.php",
        {layers: "Ligne_orographique_grp", 
         format: "image/png",
         srsName: WebGIS.requestProjection,
	 	 transparent: "true",
     	 projection: new OpenLayers.Projection(WebGIS.requestProjection)},
        {isBaseLayer: false,  
     	 visibility: false}
    );
	
	var buildsRemML =  new OpenLayers.Layer.WMS(
    	"Buildings - relevant",
    	"http://montreuil.dynmap.com/carte_pour_iguess/carteWS.php",
        {layers: "Bati_remarquable", 
         format: "image/png",
         srsName: WebGIS.requestProjection,
	 	 transparent: "true",
     	 projection: new OpenLayers.Projection(WebGIS.requestProjection)},
        {isBaseLayer: false,  
     	 visibility: false}
    );
	
	var buildsInduML =  new OpenLayers.Layer.WMS(
    	"Buildings - industrial",
    	"http://montreuil.dynmap.com/carte_pour_iguess/carteWS.php",
        {layers: "Bati_industriel", 
         format: "image/png",
         srsName: WebGIS.requestProjection,
	 	 transparent: "true",
     	 projection: new OpenLayers.Projection(WebGIS.requestProjection)},
        {isBaseLayer: false,  
     	 visibility: false}
    );

	var buildsIndiffML =  new OpenLayers.Layer.WMS(
    	"Buildings - indifferenced",
    	"http://montreuil.dynmap.com/carte_pour_iguess/carteWS.php",
        {layers: "BATI_INDIFFERENCIE", 
         format: "image/png",
         srsName: WebGIS.requestProjection,
	 	 transparent: "true",
     	 projection: new OpenLayers.Projection(WebGIS.requestProjection)},
        {isBaseLayer: false,  
     	 visibility: false}
    );

    WebGIS.leftMap.addLayer(oroML);
    WebGIS.leftMap.addLayer(buildsRemML);
    WebGIS.leftMap.addLayer(buildsInduML);
    WebGIS.leftMap.addLayer(buildsIndiffML);

};

WebGIS.addDebugLayersLB = function() {
	
	var busLB =  new OpenLayers.Layer.WMS(
    	"Bus lines",
    	"http://logis.ludwigsburg.de/mapguide2011/mapagent/mapagent.fcgi",
        {layers: "Ludwigsburg/3_Layer/buslinien", 
         format: "image/png",
         srsName: WebGIS.requestProjection,
	 	 transparent: "true",
     	 projection: new OpenLayers.Projection(WebGIS.requestProjection)},
        {isBaseLayer: false,  
     	 visibility: false}
    );
    
    var buildsLB =  new OpenLayers.Layer.WMS(
    	"Buildings",
    	"http://logis.ludwigsburg.de/mapguide2011/mapagent/mapagent.fcgi",
        {layers: "Ludwigsburg/3_Layer/gebaeude_lb_3857", 
         format: "image/png",
         srsName: WebGIS.requestProjection,
	 	 transparent: "true",
     	 projection: new OpenLayers.Projection(WebGIS.requestProjection)},
        {isBaseLayer: false,  
     	 visibility: false}
    );
    
    var streetsLB =  new OpenLayers.Layer.WMS(
    	"Streets",
    	"http://logis.ludwigsburg.de/mapguide2011/mapagent/mapagent.fcgi",
        {layers: "Ludwigsburg/3_Layer/Straßennamen", 
         format: "image/png",
         srsName: WebGIS.requestProjection,
	 	 transparent: "true",
     	 projection: new OpenLayers.Projection(WebGIS.requestProjection)},
        {isBaseLayer: false,  
     	 visibility: false}
    );
   
     WebGIS.leftMap.addLayer(busLB);
     WebGIS.leftMap.addLayer(buildsLB);
     WebGIS.leftMap.addLayer(streetsLB);
};

WebGIS.addDebugLayersRO = function() {
	
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
	
	var dsmIGUESS =  new OpenLayers.Layer.WMS(
		"DSM iGUESS",
		"http://services.iguess.tudor.lu/cgi-bin/mapserv?map=/var/www/MapFiles/RO_localOWS_test.map",
	    {layers: "ro_dsm", 
	     format: "image/png",
	     srsName: WebGIS.requestProjection,
	 	 transparent: "true",
	 	 projection: new OpenLayers.Projection(WebGIS.requestProjection),
         sld_body: WebGIS.getStyle("ro_dsm", WebGIS.SLD_GEOTH)},
	    {isBaseLayer: false,  
	 	 visibility: false}
	);

	WebGIS.leftMap.addLayer(buildsIGUESS);
	WebGIS.leftMap.addLayer(dsmIGUESS);
	
};

WebGIS.addDebugLayersGent = function() 
{	
	var test =  new OpenLayers.Layer.WMS(
		"Test layer",
		"http://extragisqa.gent.be/geoserver/ows",
	    {layers: "GH_BuildingInformation2", 
	     format: "image/png",
	     srsName: WebGIS.requestProjection,
	 	 transparent: "true",
	 	 projection: new OpenLayers.Projection(WebGIS.requestProjection),
         sld_body: WebGIS.getStyle("GH_BuildingInformation2", WebGIS.SLD_GEOTH)},
	    {isBaseLayer: false,  
	 	 visibility: false}
	);

	WebGIS.leftMap.addLayer(test);
};