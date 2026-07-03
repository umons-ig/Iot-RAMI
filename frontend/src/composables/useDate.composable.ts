const useDate = () => {
	const beautifulDate = (date: string) => {
		return new Date(date).toLocaleString().slice(0, -3)
	}

	const formatDate = (date: string) => {
		const dateObj = new Date(date)
		return dateObj.toLocaleString("fr-FR", { month: "numeric", day: "numeric", hour: "numeric", minute: "numeric" })
	}

	return { formatDate, beautifulDate }
}

export { useDate }
