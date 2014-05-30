class CreateCo2SectorScenario < ActiveRecord::Migration
  def change
    create_table :co2_sector_scenarios do |t|
      t.integer "co2_sector_id"
      t.integer "co2_scenario_id"
      t.float "demand"
      t.float "efficiency"
      t.float "base_total"

      t.timestamps
    end

    add_index :co2_sector_scenarios, :id
    add_index :co2_sector_scenarios, [:co2_sector_id,:co2_scenario_id], unique: true
  end
end
