type APISensorErrors =
  | "sensor.not.found"
  | "sensor.name.required"
  | "sensor.name.too.long"
  | "sensor.name.too.short"
  | "sensor.name.not.string"
  | "topic.name.required"
  | "topic.name.too.long"
  | "topic.name.too.short"
  | "topic.name.not.string"
  | "sensor.already.exists"
  | "topic.already.exists"
  | "sensor.id.required"
  | "sensor.id.not.string"
  | "sensor.id.not.uuid"
  | "sensor.name.invalid"
  | "sensor.already.exists";

type APISensorDataErrors =
  | "sensor.data.time.not.positif.number"
  | "sensor.data.time.not.16.digits.long"
  | "sensor.data.value.invalid"
  | "sensor.data.time.too.old"
  | "sensor.data.one.time.parameter.missing"
  | "sensor.data.time.last.parameter.should.be.greater.than.first.one";

type APISessionErrors =
  | "session.is.already.in.progress"
  | "session.is.already.closed"
  | "session.not.found";

type APIUserSensorErrors =
  | "userSensor.user.id.required"
  | "userSensor.sensor.id.required"
  | "userSensor.user.id.not.uuid"
  | "userSensor.sensor.id.not.uuid"
  | "userSensor.user.already.has.asked"
  | "userSensor.user.already.added"
  | "userSensor.user.banned"
  | "userSensor.user.added"
  | "userSensor.user.pending.required"
  | "userSensor.mail.not.sent"
  | "userSensor.sensor.already.exists";

type APIMeasurementTypeErrors =
  | "measurementType.not.found"
  | "measurementType.name.required"
  | "measurementType.name.too.long"
  | "measurementType.name.too.short"
  | "measurementType.name.not.string"
  | "measurementType.id.required"
  | "measurementType.id.not.string"
  | "measurementType.id.not.uuid"
  | "measurementType.already.exists"
  | "measurementType.name.not.unique"
  | "measurementType.name.not.found"
  | "measurementType.name.not.valid";

type APIMeasurementErrors =
  | "measurement.not.found"
  | "measurement.id.required"
  | "measurement.id.not.string"
  | "measurement.id.not.uuid"
  | "measurement.already.exists"
  | "measurement.date.required"
  | "measurement.date.not.string"
  | "measurement.date.not.date"
  | "measurement.date.not.valid"
  | "measurement.value.required"
  | "measurement.value.not.string"
  | "measurement.value.not.number"
  | "measurement.value.not.valid"
  | "measurement.sensor.required"
  | "measurement.sensor.not.string"
  | "measurement.sensor.not.uuid"
  | "measurement.sensor.not.found"
  | "measurement.measurementType.required"
  | "measurement.measurementType.not.string"
  | "measurement.measurementType.not.uuid"
  | "measurement.measurementType.not.found"
  | "measurement.number.not.valid"
  | "measurement.number.not.string"
  | "measurement.number.not.number"
  | "measurement.average.not.valid"
  | "measurement.average.not.string"
  | "measurement.sample.time.not.valid"
  | "measurement.sample.time.required"
  | "measurement.sample.not.valid"
  | "measurement.sample.invalid.time.part"
  | "measurement.measurements.required"
  | "measurement.measurements.not.array"
  | "measurement.measurements.max"
  | "measurement.errors"
  | "measurement.sensor.not.allowed"
  | "measurement.sensor.forbidden";

type APIUserErrors =
  | "user.body.invalid"
  | "user.body.empty"
  | "user.not.found"
  | "user.id.empty"
  | "user.name.empty"
  | "user.id.not.uuid"
  | "user.id.not.found"
  | "user.id.already.exists"
  | "user.name.already.exists"
  | "user.id.not.number"
  | "user.name.not.string"
  | "user.not.created"
  | "user.not.updated"
  | "user.not.deleted"
  | "user.name.not.found"
  | "user.first.name.too.long"
  | "user.first.name.too.short"
  | "user.last.name.too.long"
  | "user.last.name.too.short"
  | "user.date.of.birth.not.valid"
  | "user.sex.invalid"
  | "user.password.too.short"
  | "user.password.too.long"
  | "user.password.not.string"
  | "user.password.not.valid"
  | "user.email.not.string"
  | "user.email.not.valid"
  | "user.email.already.used"
  | "user.role.not.string"
  | "user.role.not.valid"
  | "user.role.empty"
  | "user.role.not.found"
  | "user.role.not.allowed"
  | "user.role.not.updated"
  | "user.role.not.deleted"
  | "user.role.not.created"
  | "user.role.already.exists"
  | "user.role.id.empty"
  | "user.role.id.not.number"
  | "user.role.id.not.found"
  | "user.role.id.not.deleted"
  | "user.role.id.not.updated"
  | "user.role.id.not.created"
  | "user.role.id.already.exists"
  | "user.role.name.empty"
  | "user.role.name.not.string"
  | "user.role.name.not.found"
  | "user.role.name.not.deleted"
  | "user.role.name.not.updated"
  | "user.role.name.not.created"
  | "user.role.name.already.exists"
  | "user.role.name.too.short"
  | "user.role.name.too.long"
  | "user.credentials.invalid"
  | "user.unauthorized"
  | "user.role.not.enough.permissions"
  | "user.name.already.used";

type AuthErrors =
  | "auth.token.not.provided"
  | "auth.token.invalid"
  | "auth.token.expired"
  | "auth.token.not.found"
  | "auth.token.not.valid"
  | "auth.token.not.present"
  | "auth.token.unauthorized";

type APIThresholdErrors =
  | "threshold.not.found"
  | "threshold.missing.fields"
  | "threshold.already.exists";

type APIZoneErrors =
  | "zone.name.required"
  | "zone.parent.invalid"
  | "zone.parent.cycle"
  | "zone.not.found"
  | "zone.not.empty"
  | "zone.sensor.required"
  | "zone.access.target.required";

type APITeamErrors =
  | "team.name.required"
  | "team.not.found"
  | "team.member.required"
  | "team.member.not.found";

type APIServerErrors = "server.error" | "resource.not.found";

type APIErrors =
  | APISensorErrors
  | APISensorDataErrors
  | APISessionErrors
  | APIServerErrors
  | APIMeasurementTypeErrors
  | APIMeasurementErrors
  | APIUserErrors
  | AuthErrors
  | APIUserSensorErrors
  | APIThresholdErrors
  | APIZoneErrors
  | APITeamErrors;

export { APIErrors };
