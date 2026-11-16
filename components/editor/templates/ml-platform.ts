import { blue, edge, green, neutral, node, pink, teal, type CanvasTemplate } from "./helpers";

// The feature store, training jobs and model registry have no catalog entry, so they carry no badge.
const sources = node("ml-sources", "Data Sources", "hexagon", 0, 1, teal);
const dataLake = node("ml-data-lake", "Data Lake", "cylinder", 1, 1, green, "aws.s3");
const featurePipeline = node("ml-feature-pipeline", "Feature Pipeline", "rectangle", 2, 1, blue, "aws.ecs");
const featureStore = node("ml-feature-store", "Feature Store", "cylinder", 3, 1, green);
const training = node("ml-training", "Training Jobs", "rectangle", 4, 0, blue);
const registry = node("ml-registry", "Model Registry", "cylinder", 5, 0, green);
const serving = node("ml-serving", "Model Serving", "rectangle", 5, 1, blue, "aws.ecs");
const monitoring = node("ml-monitoring", "Model Monitoring", "hexagon", 5, 2, neutral, "aws.cloudwatch");
const apps = node("ml-apps", "Client Apps", "circle", 6, 1, pink);

export const mlPlatform: CanvasTemplate = {
  id: "ml-platform",
  name: "ML platform",
  description: "From an S3 data lake through a feature store and training to a model registry, serving endpoint and monitoring.",
  labels: { cloudProvider: "aws", architectureStyle: "microservices", industry: "general", projectType: "ml-platform" },
  nodes: [sources, dataLake, featurePipeline, featureStore, training, registry, serving, monitoring, apps],
  edges: [
    edge(sources, dataLake, "ingest raw"),
    edge(dataLake, featurePipeline, "batch read"),
    edge(featurePipeline, featureStore, "write features"),
    edge(featureStore, training, "training sets"),
    edge(training, registry, "register model"),
    edge(registry, serving, "deploy approved"),
    edge(featureStore, serving, "online features"),
    edge(apps, serving, "predict"),
    edge(serving, monitoring, "latency & drift"),
  ],
};
