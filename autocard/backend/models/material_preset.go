package models

// MaterialPreset holds regional construction cost reference prices.
// Region: "HN" = Hà Nội, "HCM" = TP.HCM, "DN" = Đà Nẵng
type MaterialPreset struct {
	ID               string  `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	Region           string  `gorm:"not null;index"                                  json:"region"`
	ConstructionType string  `gorm:"not null"                                        json:"construction_type"`
	Category         string  `gorm:"not null"                                        json:"category"`
	Name             string  `gorm:"not null"                                        json:"name"`
	Unit             string  `gorm:"not null"                                        json:"unit"`
	UnitPrice        float64 `gorm:"not null"                                        json:"unit_price"`
	PriceFactor      float64 `gorm:"not null;default:1.0"                            json:"price_factor"`
	Note             string  `json:"note,omitempty"`
}
