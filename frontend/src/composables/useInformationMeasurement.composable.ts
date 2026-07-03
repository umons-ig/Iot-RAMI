const useInformationMeasurement = () => {
	const averageValue = (values: number[]) => {
		const sum = values.reduce((accumulator, currentValue) => accumulator + currentValue, 0)
		const average = sum / values.length
		const roundedAverage = average.toFixed(2)
		return parseFloat(roundedAverage)
	}
	return { averageValue }
}

export { useInformationMeasurement }
