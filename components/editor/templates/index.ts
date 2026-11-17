import { awsServerlessSaas } from "./aws-serverless-saas";
import { azureEcommerce } from "./azure-ecommerce";
import { ciCdPipeline } from "./ci-cd-pipeline";
import { eventDriven } from "./event-driven";
import { gcpDataWarehouse } from "./gcp-data-warehouse";
import type { CanvasTemplate } from "./helpers";
import { microservices } from "./microservices";
import { mlPlatform } from "./ml-platform";
import { patientRecords } from "./patient-records";
import { paymentsPlatform } from "./payments-platform";

export type { CanvasTemplate } from "./helpers";

// Gallery order: the general patterns first, then the segment-specific ones.
export const CANVAS_TEMPLATES: CanvasTemplate[] = [
  microservices,
  ciCdPipeline,
  eventDriven,
  azureEcommerce,
  awsServerlessSaas,
  gcpDataWarehouse,
  paymentsPlatform,
  patientRecords,
  mlPlatform,
];
