import type { Measurement, MeasurementGet, MeasurementGroupBySensor, MeasurementGroupByType, MeasurementTypeGet, SensorGet, SensorWithProperty } from "#/measurement"
import { useAxios } from "@/composables/useAxios.composable"
import { useMeasurementStore } from "@/stores/measurement"

const useMeasurement = () => {
	const { axios } = useAxios()
	const castIntoMeasurement = (measurement: MeasurementGet[]): Measurement[] => {
		return measurement.map(item => ({
			type: item.measurementType.name,
			value: Math.floor(item.value),
			sensor: item.sensor.name,
			timestamp: item.timestamp,
		}))
	}

	const initMeasurements = (measurementTypes: string[], sensorNames: string[]) => {
		return sensorNames.map(sensor => ({
			sensor,
			measurementType: measurementTypes.map(type => ({
				type,
				measurements: [],
			})),
		}))
	}

	const feedMeasurementsComposable = async (measurements: MeasurementGroupBySensor[], sensors: SensorWithProperty[]) => {
		for (const sensor of sensors) {
			if (sensor.propertyVerified) {
				const { data } = (await axios.get<MeasurementGet[]>(`/measurements?sensor=${sensor.name}&number=10`)) as { data: MeasurementGet[] }
				const measurementsCast = castIntoMeasurement(data)
				measurements.forEach(item => {
					if (item.sensor === sensor.name) {
						item.measurementType.forEach(type => {
							type.measurements = measurementsCast.filter(measurement => measurement.type === type.type)
						})
					}
				})
			}
		}
		return measurements
	}

	const feedMeasurementsSampleNumberComposable = async (measurements: MeasurementGroupBySensor[], measurementType: string, sensor: string, sample: string, number: number) => {
		const { data } = (await axios.get<MeasurementGet[]>(`/measurements?sensor=${sensor}&type=${measurementType}&sample=${sample}&number=100000`)) as {
			data: MeasurementGet[]
		}
		const measurementsCast = castIntoMeasurement(data)
		measurements.forEach(item => {
			if (item.sensor === sensor) {
				item.measurementType.forEach(type => {
					if (type.type === measurementType) {
						type.measurements = measurementsCast.slice(0, number)
					}
				})
			}
		})
		return measurements
	}

	const getTimestampArrayByTypeAndSensor = (type: string, sensor: string) => {
		const measurements = useMeasurementStore().getMeasurementsByTypeAndSensor(type, sensor)

		return measurements ? measurements.map(item => item.timestamp) : []
	}

	const getValueArrayByTypeAndSensor = (type: string, sensor: string) => {
		const measurements = useMeasurementStore().getMeasurementsByTypeAndSensor(type, sensor)

		return measurements ? measurements.map(item => item.value) : []
	}

	const refreshMeasurementsComposable = (measurementTypes: string[], measurements: MeasurementGroupByType[]) => {
		measurementTypes.forEach(type => {
			if (!measurements.find(item => item.type === type)) {
				measurements.push({
					type,
					measurements: [],
				})
			}
		})
		return measurements
	}

	const getAllMeasurementsTypes = async () => {
		const { data } = (await axios.get<MeasurementTypeGet[]>("/measurementTypes")) as { data: MeasurementTypeGet[] }
		return data.map(item => item.name)
	}

	const getAllSensorsNames = async () => {
		const { data } = (await axios.get<SensorGet[]>(`/sensors`)) as { data: SensorGet[] }
		return data ? data.map(item => item.name) : [""]
	}

	const numberPointList = (max: number) => {
		const list = []
		for (let i = 0; i < max; i++) {
			list.push(2 ** i)
		}
		return list
	}
	return {
		castIntoMeasurement,
		getAllMeasurementsTypes,
		initMeasurements,
		refreshMeasurementsComposable,
		getAllSensorsNames,
		feedMeasurementsComposable,
		feedMeasurementsSampleNumberComposable,
		getTimestampArrayByTypeAndSensor,
		getValueArrayByTypeAndSensor,
		numberPointList,
	}
}

export { useMeasurement }
