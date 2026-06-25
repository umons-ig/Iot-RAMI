import { Request, Response } from "express";
// Model(s) import
import db from "@db/index";
const DB: any = db;
const { Threshold } = DB;
// --- End of model(s) import
import { BadRequestException, NotFoundException } from "@utils/exceptions";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Validation des bornes d'un seuil (cf. PLAN_AMELIORATIONS §2.6) : avant, on
// pouvait créer un seuil avec min > max (jamais déclenché) ou des valeurs non
// numériques. Lève BadRequestException sinon.
const validateThresholdValues = (
  minValue: unknown,
  maxValue: unknown
): void => {
  if (
    minValue !== undefined &&
    minValue !== null &&
    typeof minValue !== "number"
  ) {
    throw new BadRequestException(
      "minValue must be a number",
      "threshold.invalid.value"
    );
  }
  if (
    maxValue !== undefined &&
    maxValue !== null &&
    typeof maxValue !== "number"
  ) {
    throw new BadRequestException(
      "maxValue must be a number",
      "threshold.invalid.value"
    );
  }
  if (
    typeof minValue === "number" &&
    typeof maxValue === "number" &&
    minValue >= maxValue
  ) {
    throw new BadRequestException(
      "minValue must be strictly less than maxValue",
      "threshold.invalid.range"
    );
  }
};

const createThreshold = async (req: Request, res: Response) => {
  try {
    const { idSensor, idMeasurementType, minValue, maxValue } = req.body;
    if (!idSensor || !idMeasurementType) {
      throw new BadRequestException(
        "idSensor and idMeasurementType are required",
        "threshold.missing.fields"
      );
    }
    if (!UUID_RE.test(idSensor) || !UUID_RE.test(idMeasurementType)) {
      throw new BadRequestException(
        "idSensor and idMeasurementType must be valid UUIDs",
        "threshold.invalid.id"
      );
    }
    validateThresholdValues(minValue, maxValue);
    const newThreshold = await Threshold.create({
      idSensor,
      idMeasurementType,
      minValue,
      maxValue,
    });
    res.status(201).json(newThreshold);
  } catch (error) {
    if (error instanceof BadRequestException) {
      res.status(400).json({ error: error.message, code: error.codeError });
    } else {
      console.error("Error creating threshold:", error);
      res.status(500).json({
        error: "Internal server error.",
        code: "threshold.internal.error",
      });
    }
  }
};
const getThresholdBySensor = async (req: Request, res: Response) => {
  try {
    const { idSensor } = req.params;
    const thresholds = await Threshold.findAll({ where: { idSensor } });
    if (!thresholds || thresholds.length === 0) {
      throw new NotFoundException(
        "No thresholds found for the given sensor.",
        "threshold.not.found"
      );
    }
    res.status(200).json(thresholds);
  } catch (error) {
    if (error instanceof NotFoundException) {
      res.status(404).json({ error: error.message, code: error.codeError });
    } else {
      console.error("Error fetching thresholds:", error);
      res.status(500).json({
        error: "Internal server error.",
        code: "threshold.internal.error",
      });
    }
  }
};
const updateThreshold = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { minValue, maxValue } = req.body;
    const threshold = await Threshold.findByPk(id);
    if (!threshold) {
      throw new NotFoundException(
        "Threshold not found.",
        "threshold.not.found"
      );
    }
    // Valide les bornes APRÈS fusion avec les valeurs existantes (§2.6).
    const mergedMin = minValue !== undefined ? minValue : threshold.minValue;
    const mergedMax = maxValue !== undefined ? maxValue : threshold.maxValue;
    validateThresholdValues(mergedMin, mergedMax);
    threshold.minValue = mergedMin;
    threshold.maxValue = mergedMax;
    await threshold.save();
    res.status(200).json(threshold);
  } catch (error) {
    if (error instanceof BadRequestException) {
      res.status(400).json({ error: error.message, code: error.codeError });
    } else if (error instanceof NotFoundException) {
      res.status(404).json({ error: error.message, code: error.codeError });
    } else {
      console.error("Error updating threshold:", error);
      res.status(500).json({
        error: "Internal server error.",
        code: "threshold.internal.error",
      });
    }
  }
};
const deleteThreshold = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const threshold = await Threshold.findByPk(id);
    if (!threshold) {
      throw new NotFoundException(
        "Threshold not found.",
        "threshold.not.found"
      );
    }
    await threshold.destroy();
    res.status(200).json({ message: "Threshold deleted successfully." });
  } catch (error) {
    if (error instanceof NotFoundException) {
      res.status(404).json({ error: error.message, code: error.codeError });
    } else {
      console.error("Error deleting threshold:", error);
      res.status(500).json({
        error: "Internal server error.",
        code: "threshold.internal.error",
      });
    }
  }
};

export {
  createThreshold,
  getThresholdBySensor,
  updateThreshold,
  deleteThreshold,
};
