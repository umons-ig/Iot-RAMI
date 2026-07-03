enum SessionFields {
	ID = "id",
	ID_SENSOR = "idSensor",
	CREATED_AT = "createdAt",
	ENDED_AT = "endedAt",
}

interface Session {
	[SessionFields.ID]: string
	[SessionFields.ID_SENSOR]: string
	[SessionFields.CREATED_AT]: string
	[SessionFields.ENDED_AT]?: string // Optional as the session might be ongoing
}

export type { Session }
