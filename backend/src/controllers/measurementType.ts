// noinspection ExceptionCaughtLocallyJS

import { Request, Response } from "express";
// Model(s) import
import db from "@db/index";
//const DB = db;
const { MeasurementType } = db;
// --- End of model(s) import
import {
  BadRequestException,
  NotFoundException,
  ServerErrorException,
} from "@utils/exceptions";
import { discoveredMeasurements } from "@/service/discoverdMeasurementService";

const checkName = (name: string) => {
  if (!name) {
    throw new BadRequestException(
      "Name is required",
      "measurementType.name.required"
    );
  }

  if (name.length > 255) {
    throw new BadRequestException(
      "Name is too long",
      "measurementType.name.too.long"
    );
  }
  if (name.length < 3) {
    throw new BadRequestException(
      "Name is too short",
      "measurementType.name.too.short"
    );
  }
};

const checkId = (id: string) => {
  if (!id) {
    throw new BadRequestException(
      "Id is required",
      "measurementType.id.required"
    );
  }

  if (id.length !== 36) {
    throw new BadRequestException(
      "Id must be a valid uuid",
      "measurementType.id.not.uuid"
    );
  }
};

const checkIfNameExists = async (name: string) => {
  try {
    const measurementType = await MeasurementType.findOne({ where: { name } });
    if (measurementType) {
      // noinspection ExceptionCaughtLocallyJS
      throw new BadRequestException(
        "MeasurementType already exists",
        "measurementType.already.exists"
      );
    }
  } catch (error) {
    throw error instanceof BadRequestException
      ? error
      : new ServerErrorException("Server error", "server.error");
  }
};

const createMeasurementType = async (req: Request, res: Response) => {
  const { name } = req.body;
  try {
    checkName(name);
  } catch (error) {
    return res.status(400).json(error);
  }
  try {
    await checkIfNameExists(name);
  } catch (error) {
    return error instanceof BadRequestException
      ? res.status(400).json(error)
      : res
          .status(500)
          .json(new ServerErrorException("Server error", "server.error"));
  }

  try {
    const measurementType = await MeasurementType.create({ name });
    if (!measurementType) {
      return res
        .status(500)
        .json(new ServerErrorException("Server error", "server.error"));
    }
    discoveredMeasurements.delete(name);
    return res.status(201).json(measurementType);
  } catch (error) {
    return res
      .status(500)
      .json(new ServerErrorException("Server error", "server.error"));
  }
};

const getMeasurementType = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    // find one if there is an id or findAll if there is no id
    const measurementType = id
      ? await MeasurementType.findByPk(id)
      : await MeasurementType.findAll();
    // if there is no sensor, throw an exception
    if (!measurementType) {
      return res
        .status(404)
        .json(
          new NotFoundException(
            "MeasurementType not found",
            "measurementType.not.found"
          )
        );
    }
    return res.status(200).json(measurementType);
  } catch (error) {
    return res
      .status(500)
      .json(new ServerErrorException("Server error", "server.error"));
  }
};

const updateMeasurementType = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name } = req.body;
  try {
    checkName(name);
    checkId(id);
  } catch (error) {
    return res.status(400).json(error);
  }

  try {
    const measurementType = await MeasurementType.update(
      { name },
      { where: { id } }
    );
    if (!measurementType) {
      return res
        .status(404)
        .json(
          new NotFoundException(
            "MeasurementType not found",
            "measurementType.not.found"
          )
        );
    }
    return res.status(200).json(measurementType);
  } catch (error) {
    return res
      .status(500)
      .json(new ServerErrorException("Server error", "server.error"));
  }
};

const deleteMeasurementType = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    checkId(id);
  } catch (error) {
    return res.status(400).json(error);
  }

  try {
    const measurementType = await MeasurementType.destroy({ where: { id } });
    if (!measurementType) {
      return res
        .status(404)
        .json(
          new NotFoundException(
            "MeasurementType not found",
            "measurementType.not.found"
          )
        );
    }
    return res.status(200).json({ message: "MeasurementType deleted" });
  } catch (error) {
    return res
      .status(500)
      .json(new ServerErrorException("Server error", "server.error"));
  }
};

const getDiscoveredMeasurementTypes = (req: Request, res: Response) => {
  try {
    return res.status(200).json(Array.from(discoveredMeasurements.values()));
  } catch (error) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
export {
  createMeasurementType,
  getMeasurementType,
  updateMeasurementType,
  deleteMeasurementType,
  getDiscoveredMeasurementTypes,
  checkId,
  checkName,
  checkIfNameExists,
};
