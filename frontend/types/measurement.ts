interface MeasurementGet {
	id: string
	idSensor: string
	idMeasurementType: string
	value: number
	timestamp: string
	measurementType: {
		name: string
	}
	sensor: {
		name: string
	}
}

interface Measurement {
	type: string
	value: number
	sensor: string
	timestamp: string
}

interface MeasurementTypeGet {
	id: string
	name: string
}

interface MeasurementGroupByType {
	type: string
	measurements: Measurement[]
}

interface MeasurementGroupBySensor {
	sensor: string
	measurementType: MeasurementGroupByType[]
}

interface SensorGet {
	id: string
	name: string
}

interface SensorWithProperty {
	name: string
	propertyVerified: boolean
}

interface Option {
	name: string
	options: string[] | number[]
	message: string
}

export type { Measurement, MeasurementGet, MeasurementGroupByType, MeasurementTypeGet, SensorGet, MeasurementGroupBySensor, SensorWithProperty, Option } // from head: SensorWithAvailability sauf withProperty
//export type { Measurement, MeasurementGet, MeasurementGroupByType, MeasurementTypeGet, SensorGet, MeasurementGroupBySensor, SensorWithProperty } // from 8: SensorWithProperty
