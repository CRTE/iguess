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
 * date: 14-06-2012
 *
 * This file is a patch for the usage of Google Maps with OpenLayers 2.11
 * Downloaded from:
 * http://trac.osgeo.org/openlayers/wiki/Release/2.11/GoogleMaps37
 */

OpenLayers.Layer.Google.v3.repositionMapElements = function() {
	// This is the first time any Google layer in this mapObject has been
	// made visible.  The mapObject needs to know the container size.
	google.maps.event.trigger(this.mapObject, "resize");
	
	var div = this.mapObject.getDiv().firstChild;
	if (!div || div.childNodes.length < 3) {
	  this.repositionTimer = window.setTimeout(
	          OpenLayers.Function.bind(this.repositionMapElements, this),
	          250
	  );
	  return false;
	}
	
	var cache = OpenLayers.Layer.Google.cache[this.map.id];
	var container = this.map.viewPortDiv;
	
	// move the ToS and branding stuff up to the container div
	// depends on value of zIndex, which is not robust
	for (var i=div.children.length-1; i>=0; --i) {
	  if (div.children[i].style.zIndex == 1000001) {
	    var termsOfUse = div.children[i];
	    container.appendChild(termsOfUse);
	    termsOfUse.style.zIndex = "1100";
	    termsOfUse.style.bottom = "";
	    termsOfUse.className = "olLayerGoogleCopyright olLayerGoogleV3";
	    termsOfUse.style.display = "";
	    cache.termsOfUse = termsOfUse;
	  }
	  if (div.children[i].style.zIndex == 1000000) {
	    var poweredBy = div.children[i];
	    container.appendChild(poweredBy);
	    poweredBy.style.zIndex = "1100";
	    poweredBy.style.bottom = "";
	    poweredBy.className = "olLayerGooglePoweredBy olLayerGoogleV3 gmnoprint";
	    poweredBy.style.display = "";
	        cache.poweredBy = poweredBy;
	      }
	      if (div.children[i].style.zIndex == 10000002) {
	        container.appendChild(div.children[i]);
	      }
	    }
	
	    this.setGMapVisibility(this.visibility);
  };
