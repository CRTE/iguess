/**
 *  Copyright (C) 2010 - 2015 CRP Henri Tudor
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
 * Date: 13-08-2014
 *
 * Methods to add and remove periods in the CO2 calculator.
 **/ 
 
var CO2 = CO2 || { };		// Create namespace

/**
 * Method: updateNormalInputName
 * Updates input box name according to a given period and a source.
 */
CO2.updateNormalInputName = function(input, inputName, newPeriod, sourceId)
{	
	input.setAttribute("name", 
		inputName + "["  + 
		newPeriod + "][" + 
		sourceId  + "]"   );
};

/**
 * Method: processNormalInput
 * Sets name and onChange attributes for an Emission factor input box in a new period.
 */
CO2.processNormalInput = function(input, inputName, newPeriod, sourceId)
{
	CO2.updateNormalInputName(input, inputName, newPeriod, sourceId);		
	input.setAttribute("onchange", "stub(" + newPeriod + "); return false;");
};

/**
 * Method: processHeatInput
 * Sets name and onChange attributes for an Heat input box in a new period.
 */
CO2.processHeatInput = function(input, inputName, newPeriod, sourceId)
{
	CO2.updateNormalInputName(input, inputName, newPeriod, sourceId);		
	input.setAttribute("onchange",
		"CO2.updateHeatTotals(" +
			newPeriod + ", " +
			"'co2_heat_mix_total_" + newPeriod + "', " +
		    "'tableHeatMix');" +  
		"CO2.drawCharts();" + 
		"return false;"
		);
};

/**
 * Method: processElecInput
 * Sets name and onChange attributes for an Electricity input box in a new period.
 */
CO2.processElecInput = function(input, inputName, newPeriod, sourceId)
{
	CO2.updateNormalInputName(input, inputName, newPeriod, sourceId);		
	input.setAttribute("onchange",
		"CO2.updateElecTotals(" +
			newPeriod + ", " +
			"'co2_elec_mix_total_" + newPeriod + "', " +
		    "'tableElecMix');" +  
		"CO2.drawCharts();" + 
		"return false;"
		);
};

/**
 * Method: processElecInput
 * Sets name and onChange attributes for a Consumption input box in a new period.
 */
CO2.processConsInput = function(input, inputName, newPeriod, sourceId, tableName)
{
	sectorId = input.name.split("[")[3].split("]")[0];
	sectorName = tableName.split(CO2.consPrefix)[1];
	
	input.setAttribute("name", 
	    inputName + "["  + 
		newPeriod + "][" + 
		sourceId  + "][" + 
		sectorId  + "]"    );
	
	input.setAttribute("onchange",
		"CO2.updateConsTotals(" + 
			newPeriod + ", '" + 
			sectorName + "', " + 
			"'co2_cons_total_" + newPeriod + "_" + sectorId + "', " + 
			"'" + CO2.consPrefix + sectorName + "');" +
		"CO2.drawCharts(); " + 
		"return false;"
		);
};

/**
 * Method: processElecInput
 * Sets id attributes for a total Electricity input box in a new period.
 */
CO2.processElecTotals = function(newRow, newPeriod)
{
	var input = newRow.children()[newRow.children().length - 1].children[0];
	input.setAttribute("id", "co2_elec_mix_total_" + newPeriod);
};

/**
 * Method: processHeatTotals
 * Sets id attributes for a total Heat input box in a new period.
 */
CO2.processHeatTotals = function(newRow, newPeriod)
{
	var input = newRow.children()[newRow.children().length - 1].children[0];
	input.setAttribute("id", "co2_heat_mix_total_" + newPeriod);
};

/**
 * Method: processConsTotals
 * Sets id attributes for a total Consumption input box in a new period.
 */
CO2.processConsTotals = function(newRow, newPeriod)
{
	var input = newRow.children()[newRow.children().length - 1].children[0];
	var split = input.id.split("_");
	input.setAttribute("id", "co2_cons_total_" + newPeriod + "_" + split[4]);
};

/**
 * Method: addPeriodToTable
 * Adds a new period to an input table by cloning its last row.
 * Receives input box processing functions as arguments.
 */
CO2.addPeriodToTable = function(tableName, inputName, totals, newYear, newPeriod, 
	processInput, processTotals)
{
	var newRow = $("[id='" + tableName + "'] tr:last").clone();
	if(newRow.children()[0] == null) return;
	newRow.children()[0].firstChild.textContent = newYear;
		
	// Second change input ids, except for totals
	for(i = 1; i < newRow.children().length - totals; i++)
	{	
		var input = newRow.children()[i].children[0];
		sourceId = input.name.split("[")[2].split("]")[0];
		processInput(input, inputName, newPeriod, sourceId, tableName);
	}
	
	if(totals) processTotals(newRow, newPeriod);
	
	$("[id='" + tableName + "']").append(newRow);
};

/**
 * Method: addPeriod
 * Adds a new period to CO2 scenario.
 * Adds a new row to every table for the new period.
 * Expands data arrays and triggers demands recalculation.
 */
CO2.addPeriod = function()
{
	CO2.numPeriods = CO2.numPeriods + 1;
	
	newPeriod = $('#tableElecMix tr').length - 1;
	baseYear  = $('#co2_scenario_base_year').val();
	timeStep  = $('#co2_scenario_time_step').val();
	newYear   = parseInt(baseYear) + timeStep * newPeriod;
	
	//Electricity Mix
	CO2.addPeriodToTable("tableElecMix", "co2_elec_mixes", 1,
		newYear, newPeriod, CO2.processElecInput, CO2.processElecTotals);
	//Heat Mix
	CO2.addPeriodToTable("tableHeatMix", "co2_heat_mixes", 1,
		newYear, newPeriod, CO2.processHeatInput, CO2.processHeatTotals);
	//Factors
	CO2.addPeriodToTable("table_co2_factor", "co2_factor", 0,
		newYear, newPeriod, CO2.processNormalInput, null);
	CO2.addPeriodToTable("table_ch4_factor", "ch4_factor", 0,
		newYear, newPeriod, CO2.processNormalInput, null);
	CO2.addPeriodToTable("table_n2o_factor", "n2o_factor", 0,
		newYear, newPeriod, CO2.processNormalInput, null);
	
	// Consumptions
	for (var sector in CO2.sector_demands)
		CO2.addPeriodToTable(CO2.consPrefix + CO2.sector_demands[sector].name, "co2_consumptions", 1, 
			newYear, newPeriod, CO2.processConsInput, CO2.processConsTotals);	
	
	// Trigger re-calculation of demands
	$('#tableSectors tr').each(function(i, row)
	{
		if (i > 0) row.children[2].firstElementChild.onchange();
	});
	
		
	for(i = 0; i < CO2.sector_n2o.length; i++)
	{
		CO2.sector_n2o[i].data.push(0.0);
		CO2.sector_ch4[i].data.push(0.0);
		CO2.sector_co2[i].data.push(0.0);	
	}
	CO2.co2_elec.push(0.0);
	CO2.ch4_elec.push(0.0);
	CO2.n2o_elec.push(0.0);
	CO2.co2_heat.push(0.0);
	CO2.ch4_heat.push(0.0);
	CO2.n2o_heat.push(0.0);
	CO2.periodNames.push(newYear.toString());
	CO2.drawCharts();
};

/**
 * Method: removePeriod
 * Removes a period from a CO2 scenario.
 * Removes the last row of every table.
 * Contracts data arrays.
 */
CO2.removePeriod = function()
{
	CO2.numPeriods = CO2.numPeriods - 1;
	
	// Remove last row of Mix and Factor tables
	$('#tableElecMix tr:last').remove();
	$('#tableHeatMix tr:last').remove();
	$('#table_co2_factor tr:last').remove();
	$('#table_ch4_factor tr:last').remove();
	$('#table_n20_factor tr:last').remove();
	
	// Remove last row of Consumptions
	for (var sector in CO2.sector_demands)
		$("[id='" + CO2.consPrefix + CO2.sector_demands[sector].name + "'] tr:last").remove();
	
	for(i = 0; i < CO2.sector_n2o.length; i++)
	{
		CO2.sector_n2o[i].data.pop();
		CO2.sector_ch4[i].data.pop();
		CO2.sector_co2[i].data.pop();	
	}
	CO2.periodNames.pop();
	CO2.drawCharts();
};
