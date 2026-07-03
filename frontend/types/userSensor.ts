enum Status {
	PENDING = "pending",
	ACCEPTED = "accepted",
	REJECTED = "rejected",
}

interface UserSensorAccess {
	id: string
	status: Status
	User: {
		email: string
	}
	Sensor: {
		name: string
	}
	createdAt: string
}

interface UserSensorAccessUpdateResponse {
	message: string
}

export type { UserSensorAccess, UserSensorAccessUpdateResponse }
export { Status }
