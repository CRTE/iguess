class CO2Sector < ActiveRecord::Base
 has_many :co2_scenarios, through: :co2_sector_scenario
end