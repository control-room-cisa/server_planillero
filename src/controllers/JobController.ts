// src/controllers/JobController.ts
import { RequestHandler } from "express";
import { JobService } from "../services/JobService";
import { ApiResponse } from "../dtos/ApiResponse";
import type { Job } from "@prisma/client";

export const listJobs: RequestHandler<
  {},                       // params
  ApiResponse<Job[]>,       // res body
  {},                       // req body
  {}                        // query
> = async (_req, res, next) => {
  try {
    const jobs = await JobService.listJobs();
    return res.json({
      success: true,
      message: "Listado de jobs",
      data: jobs,
    });
  } catch (err) {
    next(err);
  }
};
