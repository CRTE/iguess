#!/usr/bin/python
'''
Harvester of (Great) Sorrow
Periodically check on availablity and details of various registered services and datasets.
This should be run on a scheduled basis from a service like cron.
'''

############################################################
# Imports

from owslib.wps import WebProcessingService
from owslib.wfs import WebFeatureService
from owslib.wcs import WebCoverageService
from owslib.wms import WebMapService

import psycopg2                         # For database access
from psycopg2.extensions import adapt   # adapt: secure qutoing e.g. adapt('LL\L') => 'LL\\L'; adapt("A'B") => 'A''B'

import time
import datetime
import traceback
import re

from harvester_pwd import dbDatabase, dbName, dbUsername, dbPassword, dbSchema


############################################################
# Constants

wpsVersion = '1.0.0'
wmsVersion = '1.1.1'        # Christian says 1.3.0 is "weird", Rotterdam wms doesn't like 1.3.0!
wfsVersion = '1.1.0'        # Montreuil only works with 1.0.0
wcsVersion = '1.1.1'        # Rotterdam only works when this is set to 1.1.0
wcsVersionAlt = '1.1.0'        # Rotterdam only works when this is set to 1.1.0


# Tables we will use
tables = { }
tables["wpsServers"]    = dbSchema + ".wps_servers"
tables["processes"]     = dbSchema + ".wps_processes"
tables["processParams"] = dbSchema + ".process_params"
tables["datasets"]      = dbSchema + ".datasets"
tables["dataservers"]   = dbSchema + ".dataservers"
tables["cities"]        = dbSchema + ".cities"
tables["modconfigs"]    = dbSchema + ".mod_configs"

############################################################
# Global vars

db_conn = update_cursor = serverCursor = None
city_crs = {}


############################################################


def upsert(cursor, params):
    '''
    Create a database row if one is needed
    '''
    table, column, server_id, proc_id = params

    # This query will return the row's id if it finds a match, otherwise it will return nothing. 
    # We will check this with rowcount, below.
    cursor.execute("UPDATE " + table + " SET alive = TRUE WHERE " + column + " = %s AND identifier = %s RETURNING id", (server_id, proc_id))

    if(cursor.rowcount == 0):
        cursor.execute("INSERT INTO " + table + " (" + column + ", identifier) VALUES (%s, %s)", (server_id, proc_id))



def convert_encoding(data, new_coding='UTF-8'):
    '''
    We get data from many different servers with different encodings.  This function will attempt to convert
    a string in data into a UTF-8 encoded string, which is what the database expects.  This task can
    be somewhat complex, possibly due to server misconfiguration.
    '''
    
    # First try encoding the data directly.  This should always work, but fails with data from some servers in the wild.
    try:
        return data.encode(new_coding)
    except:

        # If that doesn't work, try a series of decoding and re-encodings.  This should never be needed, but sometimes is.
        codings = ["UTF-8", "latin1", "latin2", "latin3", "latin4", "latin5", "latin6", "latin7", "latin8", "latin9", "latin10", "ascii"]
        for coding in codings:
            try:
                return unicode(data, coding).encode(new_coding)
            except:
                continue

    print 'Could not find a unicode coding for string "' + data + '"'

    # Return the string unaltered, and hope that the database doesn't choke
    return data



def run_queries(conn, upsert_list, update_list):
    '''
    Run all the sql statements we've generated thus far.  First the statements in upsert_list are run,
    to ensure that all records are in place.  Then update_list, which is where the real action is; each
    is an update statement that acts on something previously
    '''

    conn.set_session(autocommit=False)
    cursor = db_conn.cursor()

    for params in upsert_list:
        try:
            upsert(cursor, params)
        except Exception as e:
            print "-----"
            print "Error running upsert SQL:"
            print "Params:", str(params)
            print "-----"
            print type(e)
            print e.args
            print str(e)
            print "-----"
            conn.rollback()


    for sql in update_list:
        try:
            sql = convert_encoding(sql)
            cursor.execute(sql)
            conn.commit()

        except Exception as e:
            print "-----"
            print "Error running update SQL:"
            print sql
            print "-----"
            print type(e)
            print e.args
            print str(e)
            print "-----"
            conn.rollback()

    conn.commit()

    conn.set_session(autocommit=True)



def get_process_abstract(obj):
    '''
    Get the abstract of obj, and make sure we have a proper string if there is none
    '''
    if hasattr(obj, "abstract") and obj.abstract:
        return obj.abstract

    return ""



def get_process_datatype(obj):
    '''
    Get the datatype of obj, and make sure we have a proper string if there is none
    '''
    if hasattr(obj, "dataType") and obj.dataType:
        return clean_datatype(obj.dataType)
    
    return ""   



def get_update_wps_param_sql(proc_id, identifier, title, abstract, datatype, is_input, minOccurs, maxOccurs):
    return (
        "UPDATE " + tables["processParams"] + " "
        "SET title = "      + str(adapt(title))    + ","
            "abstract = "   + str(adapt(abstract)) + ", "
            "datatype = "   + str(adapt(datatype)) + ", "
            "is_input = "   + str(adapt(is_input)) + ", "
            "min_occurs = " + str(adapt(minOccurs)) + ", "
            "max_occurs = " + str(adapt(maxOccurs)) + ", "
            "alive = TRUE, "
            "last_seen = NOW() "
        "WHERE wps_process_id = " + str(adapt(proc_id)) + " "
            "AND identifier = "   + str(adapt(identifier))
    )



def prepare_update_wps_param(procId, obj, is_input):
    abstract = get_process_abstract(obj)
    datatype = get_process_datatype(obj)
    
    # Even though occurrences do no make sense for outputs, they must be inserted in the database.
    minOcc = 1
    maxOcc = 1
    
    if is_input:
        minOcc = obj.minOccurs
        maxOcc = obj.maxOccurs
    
    return get_update_wps_param_sql(procId, obj.identifier, obj.title, abstract, datatype, is_input, minOcc, maxOcc)



def prepare_update_wps_server_info(server_url, wps):
    return (
        "UPDATE " + tables["wpsServers"] + " "
        "SET title = "         + str(adapt(wps.identification.title))    + ", "
            "abstract = "      + str(adapt(wps.identification.abstract)) + ", "
            "provider_name = " + str(adapt(wps.provider.name))           + ", "
            "contact_name = "  + str(adapt(wps.provider.contact.name))   + ", "
            "contact_email = " + str(adapt(wps.provider.contact.email))  + ", "
            "last_seen = NOW(), "
            "alive = TRUE "
        "WHERE url = " + str(adapt(server_url))
    )



def prepare_update_wps_process(server_url, identifier, title, abstract):
    # Note that we do some regex stuff below to fix a problem with adapt that doesn't quote certain
    # combinations of unicode and single quotes.  It's ugly.  I can't help it.  I'm sorry.
    return (
        "UPDATE " + tables["processes"] + " "
        "SET title = "    + re.sub("([^'])'([^'])", "\1''\2", str(adapt(title))) + ", "
            "abstract = " + str(adapt(abstract)) + ", "
            "last_seen = NOW(), "
            "alive = TRUE " +
        "WHERE wps_server_id IN ("
                "SELECT id FROM " + tables["wpsServers"] + " "
                "WHERE url = " + str(adapt(server_url))  + " "
            ")"
            "AND identifier = "  + str(adapt(identifier))
    )



def prepare_select_processes(server_url, identifier):
    return (
        "SELECT id FROM " + tables["processes"] + " "
        "WHERE wps_server_id IN ("
                "SELECT id FROM " + tables["wpsServers"] + " "
                "WHERE url = " + str(adapt(server_url)) + " "
            ")"
            "AND identifier = "  + str(adapt(identifier))    
    )



def clean_datatype(datatype):
    '''
    Strip extraneous prefix from datatype
    '''
    if datatype and datatype.startswith("//www.w3.org/TR/xmlschema-2/#"):
        return datatype.replace("//www.w3.org/TR/xmlschema-2/#", "")

    return datatype



def check_wps(serverCursor):
    '''
    Check all WPS services, and update the database accordingly
    '''
    # Get the server list, but ignore servers marked as deleted
    serverCursor.execute("SELECT DISTINCT url FROM " + tables["wpsServers"])

    upsert_list = []
    sqlList = []

    # Mark all our records as dead; we'll mark them as alive as we process them.  Note that the database won't
    # actually be udpated until we commit all our transactions at the end, so we'll never see this value
    # for a server/process/input that is in fact alive.  
    sqlList.append("UPDATE " + tables["wpsServers"] + " SET alive = false")
    sqlList.append("UPDATE " + tables["processes"]  + " SET alive = false")

    # We'll delete the parameter list completely; There is no benefit of keeping older, but now disused module 
    # parameters around... it just confuses things.
    # If the parameters reappaear in the process in the future, they will be added back, and any values 
    # associated with them will be retained.
    sqlList.append("DELETE FROM " + tables["processParams"])
    

    for row in serverCursor:
        server_url = row[0]

        # Run a GetCapabilities query on the WPS server -- could fail if URL is bogus
        try:
            wps = WebProcessingService(server_url, version = wpsVersion)
        except:  
            print "Could not load WPS data from url " + server_url
            # If URL is bogus, will raise a URLError... but whatever... no errors are reoverable at this point
            continue

        # Update the server title and abstract
        sqlList.append(prepare_update_wps_server_info(server_url, wps))

        # Iterate over the processes available on this server
        for proc in wps.processes: 
            abstract = get_process_abstract(proc)

            sqlList.append(prepare_update_wps_process(server_url, proc.identifier, proc.title, abstract))

            # Need to do this here so that the SELECT below will find a record if the upsert inserts... a little messy
            run_queries(db_conn, upsert_list, sqlList)
            upsert_list = []
            sqlList = []

            # Get all processes associated with server that match the specified identifier -- could be more than one
            update_cursor.execute(prepare_select_processes(server_url, proc.identifier))

            for procrow in update_cursor: 
                procId = procrow[0]

                try:
                    procDescr = wps.describeprocess(proc.identifier)        # Call to OWSLib
                except:
                    print "Could not describe process ", proc.identifier, " on server ", server_url


                for input in procDescr.dataInputs:
                    upsert_list.append((tables["processParams"], "wps_process_id", procId, input.identifier))
                    sqlList.append(prepare_update_wps_param(procId, input, True))

                for output in procDescr.processOutputs:
                    upsert_list.append((tables["processParams"], "wps_process_id", procId, output.identifier))
                    sqlList.append(prepare_update_wps_param(procId, output, False))

    # Run and commit WPS transactions
    run_queries(db_conn, upsert_list, sqlList)
    upsert_list = []



def simplify_crs(crs):
    '''
    Convert urn:ogc:def:crs:EPSG::28992 to EPSG:28992
    '''
    # First, replace the :: with a single :
    crs = crs.replace('::', ':')
    words  = crs.split(':')

    return words[len(words) - 2]  + ":" + words[len(words) - 1]



def is_equal_crs(first, second):
    '''
    Compare whether two crs's are the same.  We'll consider the following two strings equal:
    urn:ogc:def:crs:EPSG::28992 <==>  EPSG:28992
    '''
    return simplify_crs(first).lower() == simplify_crs(second).lower()



def get_dataset_title(wms, wfs, wcs):
    '''
    Get the title for this data service; if multiple services are defined, prioritize WMS
    '''
    return convert_encoding(wms and wms.identification.title or
                            wfs and wfs.identification.title or
                            wcs and wcs.identification.title or
                            "Unnamed server")



def get_dataset_abstract(wms, wfs, wcs):
    '''
    Get the abstract for this data service; if multiple services are defined, prioritize WMS
    '''
    return convert_encoding(wms and wms.identification.abstract or
                            wfs and wfs.identification.abstract or
                            wcs and wcs.identification.abstract or
                            "")



def prepare_set_datasets_not_alive(server_url):
    return (
        "UPDATE " + tables["datasets"] + " SET alive = false "
        "WHERE EXISTS ( "
            "SELECT * FROM " + tables["dataservers"] + " "
            "WHERE dataservers.id = datasets.dataserver_id "
                "AND dataservers.url = '" + server_url + "'"
        ")"
    )



def prepare_set_dataservers_not_alive(server_url):
    return (
        "UPDATE " + tables["dataservers"] + " "
        "SET alive = false "
        "WHERE url = '" + server_url + "'"    
    )



def prepare_update_dataservers(server_url, title, abstract, wms, wfs, wcs):
    return (
        "UPDATE " + tables["dataservers"] + " "
        "SET title = "    + str(adapt(title)) + ", "
            "abstract = " + str(adapt(abstract)) + ", "
            "alive = TRUE, "
            "last_seen = NOW(), "
            "wms = "   + str(adapt(True if wms else False)) + ", "
            "wfs = "   + str(adapt(True if wfs else False)) + ", "
            "wcs = "   + str(adapt(True if wcs else False)) + " "
        "WHERE url = " + str(adapt(server_url))
    )    



def get_ows_objects(server_url):
    '''
    Try to create OWSLib objects for the specified server; if contact cannot be established, OWSLib
    will throw an exception, which we'll use as a signal that that service does not exist.  For the
    moment, we don't really care why it failed, just that it did.
    '''
    try:        
        wms = WebMapService(server_url, version = wmsVersion)
    except:
        wms = None

    try:
        wfs = WebFeatureService(server_url, version = wfsVersion)
    except:
        wfs = None

    try:
        wcs = WebCoverageService(server_url, version = wcsVersion)
        # If contents are empty this may mean the server does not support 
        # the select WCS version, try with the alternate.
        if wcs.contents == None or len(wcs.contents) <= 0:
           wcs = WebCoverageService(server_url, version = wcsVersionAlt) 
    except: 
        wcs = None   

    return wms, wfs, wcs 



def get_service_title(obj, identifier):
    return convert_encoding(obj.contents[identifier].title if obj.contents[identifier].title else identifier)



def get_service_abstract(obj, identifier):
    return convert_encoding(obj.contents[identifier].abstract if obj.contents[identifier].abstract else "")    



def get_image_resolution(describe_coverage_object):
    gridOffsets = describe_coverage_object.xpath("//*[local-name() = 'GridOffsets']")

    if len(gridOffsets) == 0:
        return None, None
    
    offsets = gridOffsets[0].text.split()
    
    if len(offsets) == 2:
        return abs(float(offsets[0])), abs(float(offsets[1]))
    
    if len(offsets) == 4:
        return abs(float(offsets[0])), abs(float(offsets[3]))



def get_target_crs(describe_coverage_object):
    try:
        for element in describe_coverage_object[0].iter("{http://www.opengis.net/wcs/1.1}GridBaseCRS"):
           return element.text
        for element in describe_coverage_object[0].iter("{http://www.opengis.net/wcs/1.1.1}GridBaseCRS"):
           return element.text
    except:
       return None

    return None 



def get_bounding_box(describe_coverage_object, target_crs):
    '''
    Returns the WGS84 BBox
    '''
    try:
        for element in describe_coverage_object[0].iter("{http://www.opengis.net/ows/1.1}WGS84BoundingBox"):
            lower_corner = element.find("{http://www.opengis.net/ows/1.1}LowerCorner").text 
            upper_corner = element.find("{http://www.opengis.net/ows/1.1}UpperCorner").text
            return str.split(lower_corner + " " + upper_corner)
    except:
        return (None, None, None, None)

    return (None, None, None, None)


def get_supported_formats(describe_coverage_object):
    '''
    Returns list with supported formats.
    Fails for MapServer (that apparently does not comply with the standard)
    '''
    ret = list()
    try:
        for element in describe_coverage_object[0].iter("{http://www.opengis.net/wcs/1.1.1}SupportedFormat"):
            ret.append(element.text)
        return ret
    except:
        return None
    return None


def check_data_servers(serverCursor):

    cursor = db_conn.cursor()

    # Get the server list
    serverCursor.execute("SELECT DISTINCT url FROM " + tables["dataservers"])

    for row in serverCursor:
        upsert_list = []
        sqlList = []
        
        server_url = row[0]

        # Marking all datasets and dataservers as defunct; will mark non-defunct as we go
        sqlList.append(prepare_set_datasets_not_alive(server_url))
        sqlList.append(prepare_set_dataservers_not_alive(server_url))

        wms, wfs, wcs = get_ows_objects(server_url)

        if not (wms or wfs or wcs):    # No data services available?  Time to move on!
            run_queries(db_conn, upsert_list, sqlList)
            continue

        title    = get_dataset_title   (wms, wfs, wcs)
        abstract = get_dataset_abstract(wms, wfs, wcs)
        
        
        # wms: ['__class__', '__delattr__', '__dict__', '__doc__', '__format__', '__getattribute__', '__getitem__', '__hash__', '__init__', '__module__', '__new__', '__reduce__', '__reduce_ex__', '__repr__', '__setattr__', '__sizeof__', '__str__', '__subclasshook__', '__weakref__', '_buildMetadata', '_capabilities', '_getcapproperty', 'contents', 'exceptions', 'getOperationByName', 'getServiceXML', 'getcapabilities', 'getfeatureinfo', 'getmap', 'identification', 'items', 'operations', 'password', 'provider', 'url', 'username', 'version']
        # wfs: ['__class__', '__delattr__', '__dict__', '__doc__', '__format__', '__getattribute__', '__getitem__', '__hash__', '__init__', '__module__', '__new__', '__reduce__', '__reduce_ex__', '__repr__', '__setattr__', '__sizeof__', '__str__', '__subclasshook__', '__weakref__', '_buildMetadata', '_capabilities', 'contents', 'exceptions', 'getOperationByName', 'getcapabilities', 'getfeature', 'identification', 'items', 'log', 'operations', 'provider', 'url', 'version']
        # wfs.contents: ['__class__', '__cmp__', '__contains__', '__delattr__', '__delitem__', '__doc__', '__eq__', '__format__', '__ge__', '__getattribute__', '__getitem__', '__gt__', '__hash__', '__init__', '__iter__', '__le__', '__len__', '__lt__', '__ne__', '__new__', '__reduce__', '__reduce_ex__', '__repr__', '__setattr__', '__setitem__', '__sizeof__', '__str__', '__subclasshook__', 'clear', 'copy', 'fromkeys', 'get', 'has_key', 'items', 'iteritems', 'iterkeys', 'itervalues', 'keys', 'pop', 'popitem', 'setdefault', 'update', 'values', 'viewitems', 'viewkeys', 'viewvalues']
        # wcs: ['__class__', '__delattr__', '__dict__', '__doc__', '__format__', '__getattribute__', '__getitem__', '__hash__', '__init__', '__module__', '__new__', '__reduce__', '__reduce_ex__', '__repr__', '__setattr__', '__sizeof__', '__str__', '__subclasshook__', '__weakref__', '_capabilities', '_describeCoverage', 'contents', 'cookies', 'getCoverage', 'getDescribeCoverage', 'getOperationByName', 'identification', 'items', 'log', 'operations', 'provider', 'setLogLevel', 'url', 'version']
        # wcs.contents: ['__class__', '__delattr__', '__dict__', '__doc__', '__format__', '__getattribute__', '__hash__', '__init__', '__module__', '__new__', '__reduce__', '__reduce_ex__', '__repr__', '__setattr__', '__sizeof__', '__str__', '__subclasshook__', '__weakref__', '_checkChildAndParent', '_elem', '_getGrid', '_getTimeLimits', '_getTimePositions', '_parent', '_service', 'abstract', 'boundingBox', 'boundingBoxWGS84', 'boundingboxes', 'crsOptions', 'description', 'grid', 'id', 'keywords', 'styles', 'supportedCRS', 'supportedFormats', 'timelimits', 'timepositions', 'title']

        try:
            sqlList.append(prepare_update_dataservers(server_url, title, abstract, wms, wfs, wcs))

            sql = ( "SELECT d.id, d.identifier, d.city_id "
                    "FROM " + tables["datasets"] + " AS d " 
                    "LEFT JOIN " + tables["dataservers"] + " AS ds ON d.dataserver_id = ds.id "
                    "WHERE ds.url = %s" )

            cursor.execute(sql, (server_url,))        # Trailing comma required

            for row in cursor:
                dsid, identifier, cityId = row
                title = abstract = service = None
                bbox_left = bbox_bottom = bbox_right = bbox_top = None
                target_crs = None
                has_city_crs = False

                # from lxml import etree
                # if wms:
                #     print dir(wms)
                #     etree.dump(wms._capabilities)

                if wfs and identifier in wfs.contents:
                    title    = get_service_title   (wfs, identifier)
                    abstract = get_service_abstract(wfs, identifier)
                    service = "WFS"

                    if wfs.contents[identifier].boundingBoxWGS84:
                        # For WFS 1.0, at least, the boundingBoxWGS84 is actually a local CRS bounding box
                        # For WFS 1.1.0 it is correctly a WGS84 bounding box
                        bb = wfs.contents[identifier].boundingBoxWGS84    # Looks like (91979.2, 436330.0, 92615.5, 437657.0)
                        bbox_left, bbox_bottom, bbox_right, bbox_top = bb
                    else:  # No bounding box!
                        # Make sure this dataset is not used as the aoi for any configurations
                        sql = "UPDATE " + tables["modconfigs"] + " SET aoi = -1 WHERE aoi = %s"
                        update_cursor.execute(sql, (dsid,))
                        bbox_left = bbox_bottom = bbox_right = bbox_top = None

                    # Check if dataset is available in the city's local srs
                    for c in wfs.contents[identifier].crsOptions:
                        if is_equal_crs(c.id, city_crs[cityId]):
                            has_city_crs = True
                            break

                    
                if wcs and identifier in wcs.contents:
                    title    = get_service_title   (wcs, identifier)
                    abstract = get_service_abstract(wcs, identifier)
                    service = "WCS"
                    
                    for c in wcs.contents[identifier].supportedCRS:     # crsOptions is available here, but always empty; only exists for OOP
                        if is_equal_crs(c.id, city_crs[cityId]):
                            has_city_crs = True
                            break

                    try:
                        dc = wcs.getDescribeCoverage(identifier)
                    except:
                        print "Can't do DescribeCoverage for WCS dataset " + server_url + " >>> " + identifier
                        continue

                    # Check for error
                    errors = dc.xpath("//*[local-name() = 'ExceptionReport']")
                    if len(errors) > 0:
                        errorText = "No error message"
                        errorMsgs = dc.xpath("//*[local-name() = 'ExceptionText']")

                        if len(errorMsgs) > 0:
                            errorText = errorMsgs[0].text

                        print "Error with " + identifier + " on " + server_url + ": " + errorText
                        continue


                    resX, resY = get_image_resolution(dc)
                    if resX is None:
                        print "Can't find GridOffsets for WCS dataset " + server_url + " >>> " + identifier
                        continue

                    target_crs = get_target_crs(dc)
                    if target_crs is None:
                        print "Can't find GridBaseCRS for WCS dataset " + server_url + " >>> " + identifier
                        continue
                    
                    if wcs.contents[identifier].boundingBoxWGS84:
                        bbox_left, bbox_bottom, bbox_right, bbox_top = wcs.contents[identifier].boundingBoxWGS84
                    else:
                        bbox_left, bbox_bottom, bbox_right, bbox_top = get_bounding_box(dc, target_crs)

                    if bbox_left is None:
                        print "Could not find a bbox for WCS dataset " + server_url + " >>> " + identifier
                        continue
                    
                    formats = get_supported_formats(dc)
                    if (formats == None) or (len(formats) == 0):
                        formats = wcs.contents[identifier].supportedFormats

                    # All else being equal, we'd prefer to work with img datasets; second choice is tiff,
                    # otherwise, we'll just take what is offered first
                    if len(formats) == 0:
                        print "Cannot find valid image format for WCS dataset " + server_url + " >>> " + identifier
                        continue

                    if(len(formats[0]) == 0):
                        print "Cannot get a supported format for WCS dataset " + server_url + " >>> " + identifier
                        continue

                    if 'image/img' in formats:
                        img_format = 'image/img'
                    elif 'image/tiff' in formats:
                        img_format = 'image/tiff'
                    else:
                        img_format = formats


                else:               # No WCS
                    resX = resY = img_format = None


                if wms and identifier in wms.contents:
                    title    = get_service_title   (wms, identifier)
                    abstract = get_service_abstract(wms, identifier)
                    if service is None:     # Don't clobber a WFS or WCS service
                        service = "WMS"

                if service:           # Update the database with the layer info
                    sqlList.append( "UPDATE " + tables["datasets"] + " "
                                    "SET title = "        + str(adapt(title))    + ", "
                                        "abstract = "     + str(adapt(abstract)) + ", "
                                        "alive = TRUE, "
                                        "last_seen = NOW(), "
                                        "local_srs = "    + str(adapt(has_city_crs)) + ", "
                                        "format = "       + ("NULL" if img_format  is None else str(adapt(img_format)))  + ", "
                                        "bbox_left = "    + ("NULL" if bbox_left   is None else str(adapt(bbox_left)))   + ", "
                                        "bbox_right = "   + ("NULL" if bbox_right  is None else str(adapt(bbox_right)))  + ", "
                                        "bbox_top = "     + ("NULL" if bbox_top    is None else str(adapt(bbox_top)))    + ", "
                                        "bbox_bottom = "  + ("NULL" if bbox_bottom is None else str(adapt(bbox_bottom))) + ", "
                                        "bbox_srs = "     + ("NULL" if target_crs  is None else str(adapt(simplify_crs(target_crs))))  + ", "
                                        "resolution_x = " + ("NULL" if resX        is None else str(adapt(resX)))        + ", "
                                        "resolution_y = " + ("NULL" if resY        is None else str(adapt(resY)))        + ", "
                                        "service = "      + str(adapt(service)) +
                                    "WHERE id = " + str(adapt(dsid)) 
                                  )
                else:
                     print "Not found: " + identifier + " (on server " +  server_url + ")"

        except Exception as e:
            print "Error scanning server " + server_url
            print type(e)
            print e.args
            print e
            print "-----"
            print traceback.format_exc()

        else:
            # Run queries and commit dataset transactions
            run_queries(db_conn, upsert_list, sqlList)


def main():
    global db_conn, update_cursor, serverCursor, city_crs

    # Get the database connection info
    print "Starting Harvester of Sorrow ", datetime.datetime.fromtimestamp(time.time()).strftime('%Y-%m-%d %H:%M:%S')
    
    # To the database
    db_conn = psycopg2.connect(host = dbDatabase, database = dbName, user = dbUsername, password = dbPassword)

    db_conn.set_client_encoding("UTF-8")

    # Turn autocommit on to avoid locking our select statements
    # set_session([isolation_level,] [readonly,] [deferrable,] [autocommit])
    db_conn.set_session(autocommit=True)

    serverCursor  = db_conn.cursor()      # For listing servers
    update_cursor = db_conn.cursor()      # For updating the database

    # Build a list of native CRS's for the cities
    # Creates:
    # {2: 'urn:ogc:def:crs:EPSG::31370', 3: 'urn:ogc:def:crs:EPSG::31467', 4: 'urn:ogc:def:crs:EPSG::2154', 5: 'urn:ogc:def:crs:EPSG::28992'}
    serverCursor.execute("SELECT id, srs FROM " + tables["cities"])

    for row in serverCursor:
        city_crs[row[0]] = row[1]

    try:
        check_wps(serverCursor)
        check_data_servers(serverCursor)

    except Exception as e:
        print "-----"
        print "Unexpected error!"
        print type(e)
        print e.args
        print e
        print "-----"

        db_conn.rollback()

    # Close all cursors/connections
    try:
        serverCursor.close()
    except:
        print "Error closing serverCursor"

    try:
        update_cursor.close()
    except:
        print "Error closing update_cursor"

    try:
        db_conn.close()
    except:
        print "Error closing db_conn!"

    print "Done!"


if __name__ == '__main__':
    main()
   
