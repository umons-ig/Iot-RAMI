import { Request, Response } from "express";

const getHome = async (_req: Request, res: Response) => {
  return res.status(200).json({ message: "Hello World" });
};

export { getHome };
