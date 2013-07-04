class DatasetsController < ApplicationController
  before_filter :authenticate_user!, :except => [:get_for_city]

  respond_to :html, :json, :js   # See http://railscasts.com/episodes/224-controllers-in-rails-3, c. min 7:00

  # GET /datasets
  # GET /datasets.json
  def index

    # current_user should always be set here
    @current_city = current_user.role_id == 1 ? City.find_by_id(current_user.city_id) : (City.find_by_name(cookies['city']) or City.first)
    @dataset_tags = getDatasetTags()
    @datasets     = Dataset.find_all_by_city_id(@current_city.id, :select => "*, case when title = '' or title is null then identifier else title end as sortcol", :order => :sortcol )
    @wps_servers  = WpsServer.all

    respond_to do |format|
      format.html # index.html.erb
      format.json { render json: @datasets }
    end
  end

  # GET /datasets/1
  # GET /datasets/1.json
  def show
    @dataset = Dataset.find(params[:id])

    respond_to do |format|
      format.html # show.html.erb
      format.json { render json: @dataset }
    end
  end


  # Get all datasets for the specified city, only used by ajax queries
  def get_for_city
    @current_city = City.find_by_name(params[:cityName])

    showOnlyPublished = false
    if current_user == nil then 
      showOnlyPublished = true    # User not logged in
    elsif current_user.role_id == 2 then
      showOnlyPublished = false   # User has permissions to see all
    elsif current_user.city_id == @current_city.id then
      showOnlyPublished = false   # User is in own city
    else
      showOnlyPublished = true    # User is in foreign city
    end


    if showOnlyPublished then  
      @datasets = Dataset.find_all_by_city_id_and_published_and_alive(@current_city.id, :true, :true, :order => 'title desc')
    else
      @datasets = Dataset.find_all_by_city_id_and_alive(@current_city.id, :true, :order => 'title desc')
    end

    # I really want this, but it returns HTML... respond_with(@datasets)
    respond_to do |format|
      format.json { render json: @datasets.to_json(:include => {:dataset_tags => { :only => :tag } } ) } 
    end
  end


  # GET /datasets/new
  # GET /datasets/new.json
  def new
    @dataset = Dataset.new

    respond_to do |format|
      format.html # new.html.erb
      format.json { render json: @dataset }
    end
  end

  # GET /datasets/1/edit
  def edit
    @dataset = Dataset.find(params[:id])
  end


  # Called when user registers a dataset by clicking on the "Registerd" button;
  #    always called via ajax with json response type
  def create
    @dataset = Dataset.new(params[:dataset])
    @current_city = City.find_by_name(params[:cityName])

    # Check if the dataset's server url is in our dataservers database... if not, add it
    dataserver = Dataserver.find_by_url(@dataset.server_url.strip)

    if not dataserver then
      # Need to create a new server
      dataserver = Dataserver.new
      dataserver.url = @dataset.server_url.strip
      dataserver.save

      # TODO -- launch server probe
    end

    @dataset.dataserver = dataserver
    @dataset.city = @current_city
    @dataset.last_seen = DateTime.now

    @dataset.save

    if(params[:tags]) then
      tags = params[:tags].split(/,/)
      tags.each { |t| makeTag(@dataset, t) }
    end

# This is wrong -- only want to respond to json
    respond_to do |format|
      format.html { render :json => { :tags => DatasetTag.find_all_by_dataset_id(@dataset.id).map {|d| d.tag },
                                      :dataset => @dataset
                                    }
                  }
      format.json { render :json => { :tags => DatasetTag.find_all_by_dataset_id(@dataset.id).map {|d| d.tag },
                                      :dataset => @dataset
                                    }
                  }
    end
  end


  # PUT /datasets/1
  # PUT /datasets/1.json
  def update
    # If we are changing the dataset type, we need to unlink it from any configurations it is part of
    tagVal = params[:dataset_tag]    # Tag we are either adding or deleting

    if params[:id] == "add_data_tag" then
      dataset = Dataset.find_by_identifier_and_server_url(params[:dataset][:identifier], params[:dataset][:server_url])
      makeTag(dataset, tagVal)

    elsif params[:id] == "del_data_tag" then
      dataset = Dataset.find_by_identifier_and_server_url(params[:dataset][:identifier], params[:dataset][:server_url])
      if dataset and dataset.dataset_tags.find_by_tag(tagVal) then
        tags = DatasetTag.find_all_by_dataset_id_and_tag(dataset, tagVal)
        tags.map {|t| t.delete }    # Handles the case where tag is in db more than once as result of bug elsewhere
      end

    # User checked or unchecked publish checkbox (NOT the register dataset checkbox!!)
    elsif params[:id] == "publish" then
      dataset = Dataset.find_by_id(params[:dataset][:id])
      dataset.published = params[:checked]
      dataset.save
    end

# This is wrong -- only want to respond to json
    respond_to do |format|
      format.html { render :json => dataset ? DatasetTag.find_all_by_dataset_id(dataset.id, :order=>:tag).map {|d| d.tag } : [] }
      format.json { render :json => dataset ? DatasetTag.find_all_by_dataset_id(dataset.id, :order=>:tag).map {|d| d.tag } : [] }
    end
  end


  # DELETE /datasets/1
  # DELETE /datasets/1.json
  # Only called with json
  def destroy
    if params[:id] == "destroy_by_params" then
      @dataset = Dataset.find_by_identifier_and_server_url(params[:dataset][:identifier], params[:dataset][:server_url])
    else
      @dataset = Dataset.find(params[:id])
    end

    @dataset.destroy

    respond_to do |format|
      format.json { render :text => @dataset.id, :status => :ok }
      format.js { render :text => @dataset.id, :status => :ok }
    end
  end


  def mass_import
    @datasets        = Dataset.all
    @dataset_tags    = getDatasetTags()

    # current_user should always be set here
    @current_city = current_user.role_id == 1 ? City.find_by_id(current_user.city_id) : (City.find_by_name(cookies['city']) or City.first)

    if @current_city.nil?     # Should never happen, but just in case...
      @current_city = City.first
    end

    @cities = City.all
  end


  # Will only be run with ajax
  def run_harvester
    cmd = 'usr/bin/python /home/iguess/iguess_test/iguess/harvester.py'

    system(cmd)

    respond_with do |format|
      format.js { render :json => "Running", :status => :ok }
    end
  end

end
