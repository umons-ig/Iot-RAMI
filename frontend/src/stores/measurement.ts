import { ref } from "vue"
import { defineStore } from "pinia"
import type { MeasurementGroupBySensor, Option, SensorWithProperty } from "#/measurement" // => from head but never used: SensorWithAvailability
//import type { MeasurementGroupBySensor, SensorWithProperty } from "#/measurement" => from feature 8
import { useMeasurement } from "@/composables/useMeasurement.composable"

export const useMeasurementStore = defineStore("measurement", () => {
	const { getAllMeasurementsTypes, initMeasurements, getAllSensorsNames, feedMeasurementsComposable, feedMeasurementsSampleNumberComposable } = useMeasurement()

	const measurementTypes = ref<string[]>([])
	const sensorNames = ref<string[]>([])
	const sensors = ref<SensorWithProperty[]>([]) // sensor name and availability
	const measurements = ref<MeasurementGroupBySensor[]>([])
	const isInitialized = ref(false)
	const pointsOption = ref<number[]>(useMeasurement().numberPointList(14)) // => Jusqu'à option, c'est from head
	const samplesOption = ref<string[]>([
		"No sample",
		"Secondly",
		"Midminutely",
		"Minutely",
		"Quarterhourly",
		"Halfhourly",
		"Hourly",
		"Daily",
		"Weekly",
		"Fornightly",
		"Monthly",
		"Quarterly",
		"Halfyearly",
		"Yearly",
		"Decade",
		"Century",
		"Millennium",
	])

	const options: Option[] = [
		{
			name: "points",
			options: pointsOption.value,
			message: "Number of points",
		},
		{
			name: "samples",
			options: samplesOption.value,
			message: "Sample",
		},
	]

	const getMeasurementTypes = () => {
		return measurementTypes.value
	}

	const getMeasurements = () => {
		return measurements.value
	}

	const getSensorsName = () => {
		return sensorNames.value
	}

	const getSensors = () => {
		return sensors.value
	}

	const getOptionsByName = (optionName: string) => {
		return options.find(item => item.name === optionName) ?? { options: [], name: "", message: "" }
	}

	const setSensorAvailability = (sensor: string, isAvailable: boolean) => {
		sensors.value.find(item => item.name === sensor)!.propertyVerified = isAvailable
	}

	const getMeasurementsBySensor = (sensor: string) => {
		return measurements.value.find(item => item.sensor === sensor)?.measurementType
	}

	const getMeasurementsByTypeAndSensor = (type: string, sensor: string) => {
		return measurements.value.find(item => item.sensor === sensor)?.measurementType.find(item => item.type === type)?.measurements
	}

	function getMessageByName(optionName: string): string {
		const option = options.find(option => option.name === optionName)
		return option ? option.message : ""
	}

	const refresh = async () => {
		if (!isInitialized.value) {
			measurementTypes.value = await getAllMeasurementsTypes()

			const sensorsData = await getAllSensorsNames()
			sensorNames.value = sensorsData
			sensors.value = sensorsData.map(item => ({
				name: item,
				propertyVerified: false,
			}))
			measurements.value = initMeasurements(measurementTypes.value, sensorNames.value)
			isInitialized.value = true
		}
		await feedMeasurements()
	}

	const feedMeasurementsSampleNumber = async (measurementType: string, sensor: string, sample: string, number: number) => {
		measurements.value = await feedMeasurementsSampleNumberComposable(measurements.value, measurementType, sensor, sample, number)
	}

	const feedMeasurements = async () => {
		measurements.value = await feedMeasurementsComposable(measurements.value, sensors.value)
	}

	const reset = () => {
		measurementTypes.value = []
		sensorNames.value = []
		sensors.value = []
		measurements.value = []
		isInitialized.value = false
	}
	return {
		getMeasurementTypes,
		refresh,
		getMeasurements,
		getSensors,
		feedMeasurementsSampleNumber,
		feedMeasurements,
		getMeasurementsBySensor,
		getMeasurementsByTypeAndSensor,
		getSensorsName,
		getOptionsByName,
		getMessageByName,
		setSensorAvailability,
		reset,
	}
})
