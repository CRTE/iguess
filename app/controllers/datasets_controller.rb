
class DatasetsController < ApplicationController
  before_filter :authenticate_user!, :except => [:get_for_city]

  respond_to :html, :json, :js   # See http://railscasts.com/episodes/224-controllers-in-rails-3, c. min 7:00

  # GET /datasets
  # GET /datasets.json
  def index

    # current_user should always be set here
    @current_city = User.getCurrentCity(current_user, cookies)
    @datasets     = Dataset.find_all_by_city_id(@current_city.id, 
                        :select => "*, case when title = '' or title is null then identifier else title end as sortcol", 
                        :order => :sortcol )
    @wps_servers  = WpsServer.all

    respond_to do |format|
      format.html # index.html.erb
      format.json { render json: @datasets }
    end
  end


  # Get all datasets for the specified city, only used by ajax queries
  def get_for_city
    @current_city = City.find_by_id(params[:cityId])

    showOnlyPublished = false
    if current_user == nil  
      showOnlyPublished = true    # User not logged in
    elsif current_user.role_id == 2 
      showOnlyPublished = false   # User has permissions to see all
    elsif current_user.city_id == @current_city.id 
      showOnlyPublished = false   # User is in own city
    else
      showOnlyPublished = true    # User is in foreign city
    end


    if showOnlyPublished   
      @datasets = Dataset.find_all_by_city_id_and_published_and_alive(@current_city.id, :true, :true, :order => 'title desc')
    else
      @datasets = Dataset.find_all_by_city_id_and_alive(@current_city.id, :true, :order => 'title desc')
    end

    # I really want this, but it returns HTML... respond_with(@datasets)
    respond_to do |format|
      format.json { render json: @datasets.to_json(:include => {:dataset_tags => { :only => :tag } } ) } 
    end
  end



  # Called when user registers a dataset by clicking on the "Register" button;
  #    always called via ajax with json response type
  def create
    if not user_signed_in?    # Should always be true... but if not, we'll bail
      return
    end

    @dataset = Dataset.new(params[:dataset])

    # Check if the dataset's server url is in our dataservers database... if not, add it
    url = @dataset.server_url.strip
    @dataserver = Dataserver.find_by_url(url)

    if not @dataserver 
      # Need to create a new server
      @dataserver = Dataserver.new(url, params[:server_title], params[:server_abstract])
      @dataserver.save
    end

    @dataset.dataserver = @dataserver


    # Because of limitations in the WCS protocol, we don't always get a reliable projected bounding box from WCS servers.
    # Therefore, we will take the lat-long bbox that is provided reliably, and project it here with the Proj4 library.
    # We only need to do this with WCS data, and we'll overwrite whatever values are passed in the bbox params.
    if @dataset.service == 'WCS' 
      points = params[:llbbox].split(/,/)
      if points.length != 4
        # Do something!
      else
        @dataset.bbox_left   = points[0] 
        @dataset.bbox_bottom = points[1]
        @dataset.bbox_right  = points[2] 
        @dataset.bbox_top    = points[3]
        @dataset.bbox_srs    = "EPSG:4326"
      end

    elsif @dataset.service == 'WFS'
      @current_city = City.find_by_id(params[:dataset][:city_id])
      @dataset.bbox_srs = @current_city.srs
    end


    @dataset.save

    if(params[:tags]) 
      tags = params[:tags].split(/,/)
      tags.each { |t| makeTag(@dataset, t) }
    end

    # Send the new dataset back to the client as a JSON object, along with any tags
    respond_to do |format|
      format.json { render :json => { :tags => DatasetTag.find_all_by_dataset_id(@dataset.id)
                                                         .map {|d| d.tag },
                                      :dataset => @dataset
                                    }
                  }
    end
  end


   # Create a hook to return a datarequest for a particular dataset... primarily for testing purposes
   # http://0.0.0.0:3000/datasets/ShowDataRequest/1829
   # This should probably be deleted at some point, or at least require a key of some sort
  def ShowDataRequest
    dataset = Dataset.find_by_id(params[:id])
    if not dataset then
      respond_with do |format|
        format.html { render :text => "Could not find dataset with id = " + params[:id].to_s, 
                             :status => :ok }
      end
      return
    end

    req = dataset.getRequest(dataset.city.srs, nil)

    respond_with do |format|
      format.html { render :text => req, :status => :ok }
    end
  end


  # PUT /datasets/1
  # PUT /datasets/1.json
  def update
    error = false

    if user_signed_in? 
      if params[:dataset][:id]
        @dataset = Dataset.find_by_id(params[:dataset][:id])
      else
        @current_city = User.getCurrentCity(current_user, cookies)
        @dataset = Dataset.find_by_identifier_and_server_url_and_city_id(params[:dataset][:identifier], 
                                                                         params[:dataset][:server_url], 
                                                                         @current_city.id)
      end


      if(@dataset.nil?)   # Couldn't find dataset... now what?
        error = true
        return
      end

      if params[:id] == "add_data_tag" or params[:id] == "del_data_tag"
        tagVal = params[:dataset_tag]    # Tag we are either adding or deleting

        if params[:id] == "add_data_tag" 
          makeTag(@dataset, tagVal)

        elsif params[:id] == "del_data_tag" 
          if @dataset and @dataset.dataset_tags.find_by_tag(tagVal) 
            tags = DatasetTag.find_all_by_dataset_id_and_tag(@dataset, tagVal)
            tags.map {|t| t.delete }    # Handles the case where tag is in db more than once as result of bug elsewhere
          else
            error = true
          end
        end

        if not error
          alltags = getAllTags(@dataset)
          respond_to do |format|
            # Filter out any dead tags
            format.json { render :json => @dataset ? DatasetTag.find_all_by_dataset_id(@dataset.id, :order=>:tag)
                                                               .select {|d| alltags.include? d.tag }
                                                               .map {|d| d.tag } : [] }
          end
        end

      # User checked or unchecked publish checkbox (NOT the register dataset checkbox!!)
      elsif params[:id] == "publish"   
        if User.canAccessObject(current_user, @dataset)
          @dataset.published = params[:checked]
          @dataset.save
        else
          error = true
        end
      end

    else  # Don't have permission... do what?
      error = true
    end
  end


  # DELETE /datasets/1
  # DELETE /datasets/1.json
  # Only called with json
  def destroy
    if params[:id] == "destroy_by_params" then
      @dataset = Dataset.find_by_identifier_and_server_url(params[:dataset][:identifier], 
                                                           params[:dataset][:server_url])
    else
      @dataset = Dataset.find(params[:id])
    end

    status = :ok

    if @dataset and User.canAccessObject(current_user, @dataset)
      @dataset.destroy
    else
      status = 403
    end

    respond_to do |format|
      format.json { render :text => @dataset.id, :status => status }
      format.js   { render :text => @dataset.id, :status => status }
    end
  end


  GoogleProjection = 'EPSG:3857'

  def mass_import
    # current_user should always be set here
    @current_city = User.getCurrentCity(current_user, cookies)

    # Only used for generating a list of registered datasets
    @datasets = Dataset.find_all_by_city_id_and_finalized(@current_city.id, true)

    if @current_city.nil?     # Should never happen, but just in case...
      @current_city = City.first
    end

    @cities = City.all
  end
end
