const tags = {
  tags: [
    { name: "Sensor", description: "Sensor management endpoints" },
    { name: "Session", description: "Recording session endpoints" },
    { name: "MeasurementType", description: "Measurement type endpoints" },
    { name: "Measurement", description: "Measurement data endpoints" },
    { name: "User", description: "User account and authentication endpoints" },
    {
      name: "User Access Control",
      description: "User-sensor and user-measurementType access management",
    },
    {
      name: "Threshold",
      description:
        "Alert threshold management — min/max per sensor and measurement type",
    },
    {
      name: "Zone",
      description:
        "Hierarchical zones (tree) + sensor assignment and cascading zone access",
    },
    {
      name: "Team",
      description: "User teams — grouped, cascading zone access",
    },
  ],
};

export { tags };
