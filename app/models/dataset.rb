class Dataset < ActiveRecord::Base
  has_many :mod_configs, :through => :config_datasets
  has_many :config_datasets, :dependent => :destroy
  has_many :dataset_tags, :dependent => :destroy, :order => :tag
  belongs_to :city
  belongs_to :dataserver
end


# Creates a list of valid tags -- i.e. those that are referenced by inputs to known processes that are flagged as alive, plus "Mapping"
def getDatasetTags
  tags = []

  tags = ProcessParam.find_all_by_datatype_and_alive('ComplexData', :true).map{ |p| p.identifier }
  tags.push('Mapping')    # Mapping is always a valid tag

  return tags.sort_by! { |x| x.downcase }.uniq
end


def makeTag(dataset, tagVal)
  # Prevent duplicate tags
  if dataset and not dataset.dataset_tags.find_by_tag(tagVal) then
    tag = DatasetTag.new
    tag.dataset_id = dataset.id
    tag.tag = tagVal
    tag.save
  end
end 


# Make str into an name that is safe to use as a css identifier
# We have the equivalent in javascript as well
def cssEscape(str)
  return str.gsub(/[^a-z,A-Z,_,-,0-9]/, 'X')
end


def getJoinChar(serverUrl)
  return serverUrl.index("?") == nil ? "?" : "&"
end


def insertGetCapabilitiesLinkBlock(serverUrl, wms, wfs, wcs)
  output = "";

  if wms then
    output += (output.length() ? ' ' : '') + '<a href="' + serverUrl + getJoinChar(serverUrl) + 'SERVICE=WMS&VERSION=1.3.0&REQUEST=GetCapabilities" target="_blank">WMS</a>'
  end

  if wfs then
    output += (output.length() ? ' ' : '') + '<a href="' + serverUrl + getJoinChar(serverUrl) + 'SERVICE=WFS&VERSION=1.0.0&REQUEST=GetCapabilities" target="_blank">WFS</a>'
  end

  if wcs then
    output += (output.length() ? ' ' : '') + '<a href="' + serverUrl + getJoinChar(serverUrl) + 'SERVICE=WCS&VERSION=1.1.0&REQUEST=GetCapabilities" target="_blank">WCS</a>'
  end

  raw(output)
end
