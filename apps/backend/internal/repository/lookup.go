package repository

import (
	"context"

	"github.com/CreoCot/enose-core/backend/internal/models"
	"gorm.io/gorm"
)

type LookupRepository interface {
	// Devices
	GetDeviceByCode(ctx context.Context, code string) (*models.Device, error)
	GetAllDevices(ctx context.Context) ([]models.Device, error)
	GetOrCreateDevice(ctx context.Context, serial, deviceTypeCode, name string) (*models.Device, error)

	// Measurement Objects (то, что исследуем)
	GetOrCreateObject(ctx context.Context, name string) (*models.MeasurementObject, error)
	SearchObjects(ctx context.Context, query string) ([]models.MeasurementObject, error)

	// Coatings (покрытия датчиков)
	GetAllCoatings(ctx context.Context) ([]models.Coating, error)
}

type lookupRepository struct {
	db *gorm.DB
}

func NewLookupRepository(db *gorm.DB) LookupRepository {
	return &lookupRepository{db: db}
}

// GetDeviceByCode находит девайс по коду/серийнику (нужно для привязки к XML)
func (r *lookupRepository) GetDeviceByCode(ctx context.Context, code string) (*models.Device, error) {
	var dev models.Device
	err := r.db.WithContext(ctx).Where("code = ?", code).First(&dev).Error
	if err != nil {
		return nil, err
	}
	return &dev, nil
}

func (r *lookupRepository) GetAllDevices(ctx context.Context) ([]models.Device, error) {
	var devices []models.Device
	err := r.db.WithContext(ctx).Preload("DeviceType").Find(&devices).Error
	return devices, err
}

func (r *lookupRepository) GetOrCreateDevice(ctx context.Context, serial, deviceTypeCode, name string) (*models.Device, error) {
	var dev models.Device
	err := r.db.WithContext(ctx).Where("serial_number = ?", serial).First(&dev).Error
	if err == nil {
		return &dev, nil
	}
	if err != gorm.ErrRecordNotFound {
		return nil, err
	}

	// Создаём тип устройства
	var devType models.DeviceType
	err = r.db.WithContext(ctx).Where("code = ?", deviceTypeCode).First(&devType).Error
	if err == gorm.ErrRecordNotFound {
		devType = models.DeviceType{Code: deviceTypeCode, Name: deviceTypeCode}
		if err := r.db.WithContext(ctx).Create(&devType).Error; err != nil {
			return nil, err
		}
	} else if err != nil {
		return nil, err
	}

	dev = models.Device{
		SerialNumber: serial,
		DeviceTypeID: devType.ID,
		Name:         name,
	}
	if err := r.db.WithContext(ctx).Create(&dev).Error; err != nil {
		return nil, err
	}

	return &dev, nil
}

// GetOrCreateObject возвращает объект исследования, а если такого еще нет в базе — создает его
func (r *lookupRepository) GetOrCreateObject(ctx context.Context, name string) (*models.MeasurementObject, error) {
	var obj models.MeasurementObject
	// GORM метод FirstOrCreate идеально подходит для справочников, заполняемых на лету
	err := r.db.WithContext(ctx).Where(models.MeasurementObject{Name: name}).FirstOrCreate(&obj).Error
	if err != nil {
		return nil, err
	}
	return &obj, nil
}

// SearchObjects использует триграммный индекс для быстрого автокомплита на фронтенде (ILIKE %query%)
func (r *lookupRepository) SearchObjects(ctx context.Context, query string) ([]models.MeasurementObject, error) {
	var objects []models.MeasurementObject
	err := r.db.WithContext(ctx).
		Where("name ILIKE ?", "%"+query+"%").
		Limit(10).
		Find(&objects).Error
	return objects, err
}

func (r *lookupRepository) GetAllCoatings(ctx context.Context) ([]models.Coating, error) {
	var coatings []models.Coating
	err := r.db.WithContext(ctx).Find(&coatings).Error
	return coatings, err
}
