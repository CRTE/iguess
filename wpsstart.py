import sys, ast, getopt, types, WPSClient, time, syslog 

errLog = open("wps.log","a")

argv = sys.argv[1:]
errLog.write("Processing command:\n" + " ".join(argv) + "\n")

# Code modeled on http://stackoverflow.com/questions/7605631/passing-a-list-to-python-from-command-line
arg_dict = { } 

# Params (and the types) we expect  IMPORTANT: make sure each starts with a different letter!!!
switches = { 'url':str, 'procname':str, 'names':list, 'vals':list, 'outnames':list, 'titles':list }

singles = '' . join([x[0] + ':' for x in switches])
long_form = [x + '=' for x in switches]

d = {}
for x in switches:
    d[x[0] + ':'] = '--' + x


try:            
    opts, args = getopt.getopt(argv, singles, long_form)
except getopt.GetoptError, e:          
    errLog.write("Bad arg: " + e.msg)
    sys.exit(2)       

for opt, arg in opts:
    if opt[1] + ':' in d:       # opt -> :names
        o = d[opt[1] + ':'][2:]         # o -> names
    elif opt in d.values(): 
        o = opt[2:]
    else: o = ''

    if o and arg:
        if switches[o] == tuple or switches[o] == list or switches[o] == dict:
            arg_dict[o] = ast.literal_eval(arg)
        else:
            arg_dict[o] = arg

    if not o:
        errLog.write("Invalid options!\n")
        sys.exit(2)
    #Error: bad arg for names... [dem] is not a <type 'list'>!

    if not isinstance(arg_dict[o], switches[o]):
        errLog.write(str(opt) + " " + str(arg) + "\nError: bad arg for " + o + "... " + str(arg_dict[o]) + " is not a " + str(switches[o]) + "!\n")
        sys.exit(2)                 


# Now that we have our args sorted out, let's try to launch the WPSClient


iniCli = WPSClient.WPSClient()

# Sanitize vals
vals = [ v.replace('&', '&amp;') for v in arg_dict['vals'] ]

# Basic test with literal inputs
#iniCli.init(
#    "http://services.iguess.tudor.lu/cgi-bin/pywps.cgi?", 
#    "test_rand_map", 
#    ["delay"], 
#    ["1"],
#    ["rand", "region", "num"])

# Test with a remote GML resource
#iniCli.init(
#    "http://services.iguess.tudor.lu/cgi-bin/pywps.cgi?", 
#    "buffer", 
#    ["size","data"], 
#    ["5","http://services.iguess.tudor.lu/pywps/sampleData/testLines4326.gml"],
#    ["buffer"])

# Test with a WFS resource
iniCli.init(
    # Process Server address
    arg_dict['url'] + '?', 
    # Process name
    arg_dict['procname'], 
    # Input names
    arg_dict['names'],
    # Input values - '&' character must be passed as '&amp;'
    vals,
    # Output names
    arg_dict['outnames'],
    # Titles for those datasets
    arg_dict['titles'] )


url = iniCli.sendRequest()

errLog.write("Launching process: " + url + "\n")
sys.stdout.write("OK:" + url)     # This is the line that our rails code will be looking for!

# iniCli = None

# if(url == None):
#     print "Sorry something went wrong."

# else:
#     statCli = WPSClient.WPSClient()
    
#     statCli.initFromURL(url)

#     while not statCli.checkStatus():
#         print "Waiting..."
#         time.sleep(10)
    
#     # Needed because PyWPS deletes CRS information from the outputs
#     # Maybe it should be a parameter to the constructor?
#     statCli.epsg = "28992"
    
#     statCli.generateMapFile()
    
    
    
