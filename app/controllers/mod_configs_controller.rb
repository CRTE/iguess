class ModConfigsController < ApplicationController
  # GET /mod_configs
  # GET /mod_configs.json

  respond_to :html, :js


  def index
    @current_city = (City.find_by_name(cookies['city']) or City.first)
    @mod_configs = ModConfig.all
    @wps_servers = WpsServer.all

    respond_to do |format|
      format.html # index.html.erb
      format.json { render json: @mod_configs }
    end
  end

  # GET /mod_configs/1
  # GET /mod_configs/1.json
  def show
    @mod_config = ModConfig.find(params[:id])
    @datasets = Dataset.all
    @dataset_inputs = ConfigDataset.find_all_by_mod_config_id(params[:id])
    @text_inputs = ConfigTextInput.find_all_by_mod_config_id(@mod_config)

    respond_to do |format|
      format.html # show.html.erb
      format.json { render json: @mod_config }
    end
  end

  # GET /mod_configs/new
  # GET /mod_configs/new.json
  def new
    @mod_config = ModConfig.new
    @wps_servers = WpsServer.all
    @datasets = Dataset.all
    @textinputs = [ ]

    respond_to do |format|
      format.html # new.html.erb
      format.json { render json: @mod_config }
    end
  end

  # GET /mod_configs/1/edit
  def edit
    @mod_config = ModConfig.find(params[:id])
  end

  # Run is only called via ajax request... need to fire up WPSClient and tell it to start
  # running the specified module
  def run

    @mod_config = ModConfig.find(params[:id])
    @city = 

    wpsClientPath ='/home/eykamp/iguess/iguess';

    require "rubypython"
    RubyPython.start
    sys = RubyPython.import 'sys'

    # Make sure the path of WPSClient is on python's module path, but ensure it's only there once
    # Since we can't close the RubyPython instance without crashing Ruby, there is a danger we will
    # add the WPSClient path more than once.
    if not sys.path.include?(wpsClientPath)
      sys.path.append(wpsClientPath)
    end

    wpsClient = RubyPython.import 'WPSClient'

    cli = wpsClient.WPSClient( @mod_config.wps_server.url,
                               @mod_config.identifier,
                               RubyPython::Tuple.tuple( @mod_config.config_text_inputs.map {|x| x.column_name } ),
                               RubyPython::Tuple.tuple( @mod_config.config_text_inputs.map {|x| x.value } ) )

    cli.epsg = @mod_config.city.srs

    binding.pry


    @mod_config = ModConfig.find(params[:id])
    respond_with do |format|
      format.js do
        render :json => @mod_config, :status => :ok
      end
    end
  end

  # POST /mod_configs
  # POST /mod_configs.json
  def create
    @current_city = (City.find_by_name(cookies['city']) or City.first)
    @mod_config = ModConfig.new(params[:mod_config])

    @mod_config.name = @mod_config.name.strip

    if(@mod_config.name.empty?) then
      @mod_config.name = "Unnamed Configuration"
    end

    @mod_config.city = @current_city

    server = WpsServer.find_by_url(params[:wps_server_url])
    @mod_config.wps_server = server
    @mod_config.identifier = params[:identifier]
    success = @mod_config.save

    # Move on to save all the selected datasets
    if(success) then
      if(params[:datasets]) then        # Not every module has input datasets
        params[:datasets].each_key do |key|
          if(not params[:datasets][key].empty? and success) then
            confds = ConfigDataset.new()
            dataset = Dataset.find(params[:datasets][key])
            confds.mod_config = @mod_config
            confds.dataset    = dataset

            success &= confds.save()
          end
        end
      end
    end

    # Save any text inputs and outputs the user provided
    if(success) then
      paramkeys = ['input', 'output']
      paramkeys.each { |paramkey|
        if(params[paramkey]) then
          params[paramkey].each_key do |key|
            if(success) then
              textval = ConfigTextInput.new()
              textval.mod_config = @mod_config
              textval.column_name = key
              textval.value = params[paramkey][key]
              textval.is_input = (paramkey == 'input')

              success &= textval.save()
            end
          end
        end
      }
    end

    respond_to do |format|
      if success
        format.html { redirect_to @mod_config, notice: 'Mod config was successfully created.' }
        format.json { render json: @mod_config, status: :created, location: @mod_config }
      else
        format.html { render action: "new" }
        format.json { render json: @mod_config.errors, status: :unprocessable_entity }
      end
    end
  end

  # PUT /mod_configs/1
  # PUT /mod_configs/1.json
  def update
    @mod_config = ModConfig.find(params[:id])

    respond_to do |format|
      if @mod_config.update_attributes(params[:mod_config])
        format.html { redirect_to @mod_config, notice: 'Mod config was successfully updated.' }
        format.json { head :no_content }
      else
        format.html { render action: "edit" }
        format.json { render json: @mod_config.errors, status: :unprocessable_entity }
      end
    end
  end
  #
  #def update_dataset
  #  @mod_config = ModConfig.find(params[:id])
  #end

  # DELETE /mod_configs/1
  # DELETE /mod_configs/1.json
  def destroy
    @mod_config = ModConfig.find(params[:id])
    @mod_config.destroy

    respond_to do |format|
      format.html { redirect_to mod_configs_url }
      format.json { head :no_content }
    end
  end
end
