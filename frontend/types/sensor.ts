enum SensorFields {
	ID = "id",
	NAME = "name",
	TOPIC = "topic",
	CREATED_AT = "createdAt",
	UPDATED_AT = "updatedAt",
}

interface Sensor {
	[SensorFields.ID]: string
	[SensorFields.NAME]: string
	[SensorFields.TOPIC]: string
	[SensorFields.CREATED_AT]: string
	[SensorFields.UPDATED_AT]: string
	zoneId?: string | null
}

// routes Path

// Pair of requests/responses (You need to do this for each controller path acessible from the frontend)

// Answer format

export type { Sensor }
