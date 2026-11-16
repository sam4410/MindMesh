// Managed cloud services a canvas node can represent (CanvasNodeData.service holds the ID).
// Covers every role in the design-context service table (spec 42); combined cells such as
// "ECS / EKS" are separate entries so a node names exactly one service.
export type CloudProvider = "aws" | "azure" | "gcp";

export interface CloudService {
  id: string;
  provider: CloudProvider;
  name: string;
  role: string;
}

// Role order matches the table the design agent sees.
export const CLOUD_SERVICE_ROLES = [
  "API gateway",
  "Container compute",
  "Functions",
  "Relational DB",
  "NoSQL DB",
  "Cache",
  "Queue",
  "Event stream",
  "Object storage",
  "CDN",
  "Identity",
  "Secrets",
  "Monitoring",
  "Data warehouse",
] as const;

const s = (provider: CloudProvider, slug: string, name: string, role: (typeof CLOUD_SERVICE_ROLES)[number]) =>
  ({ id: `${provider}.${slug}`, provider, name, role }) satisfies CloudService;

export const CLOUD_SERVICES = [
  // AWS
  s("aws", "api-gateway", "API Gateway", "API gateway"),
  s("aws", "ecs", "ECS", "Container compute"),
  s("aws", "eks", "EKS", "Container compute"),
  s("aws", "lambda", "Lambda", "Functions"),
  s("aws", "rds", "RDS", "Relational DB"),
  s("aws", "aurora", "Aurora", "Relational DB"),
  s("aws", "dynamodb", "DynamoDB", "NoSQL DB"),
  s("aws", "elasticache", "ElastiCache", "Cache"),
  s("aws", "sqs", "SQS", "Queue"),
  s("aws", "kinesis", "Kinesis", "Event stream"),
  s("aws", "msk", "MSK", "Event stream"),
  s("aws", "s3", "S3", "Object storage"),
  s("aws", "cloudfront", "CloudFront", "CDN"),
  s("aws", "cognito", "Cognito", "Identity"),
  s("aws", "secrets-manager", "Secrets Manager", "Secrets"),
  s("aws", "cloudwatch", "CloudWatch", "Monitoring"),
  s("aws", "redshift", "Redshift", "Data warehouse"),
  // Azure
  s("azure", "api-management", "API Management", "API gateway"),
  s("azure", "container-apps", "Container Apps", "Container compute"),
  s("azure", "aks", "AKS", "Container compute"),
  s("azure", "functions", "Azure Functions", "Functions"),
  s("azure", "sql", "Azure SQL", "Relational DB"),
  s("azure", "postgresql", "PostgreSQL Flexible Server", "Relational DB"),
  s("azure", "cosmos-db", "Cosmos DB", "NoSQL DB"),
  s("azure", "redis", "Azure Cache for Redis", "Cache"),
  s("azure", "service-bus", "Service Bus", "Queue"),
  s("azure", "event-hubs", "Event Hubs", "Event stream"),
  s("azure", "blob-storage", "Blob Storage", "Object storage"),
  s("azure", "front-door", "Front Door", "CDN"),
  s("azure", "entra-id", "Entra ID", "Identity"),
  s("azure", "key-vault", "Key Vault", "Secrets"),
  s("azure", "monitor", "Azure Monitor", "Monitoring"),
  s("azure", "synapse", "Synapse", "Data warehouse"),
  s("azure", "fabric", "Fabric", "Data warehouse"),
  // Google Cloud (Pub/Sub serves both queue and event stream roles)
  s("gcp", "api-gateway", "API Gateway", "API gateway"),
  s("gcp", "cloud-run", "Cloud Run", "Container compute"),
  s("gcp", "gke", "GKE", "Container compute"),
  s("gcp", "cloud-functions", "Cloud Functions", "Functions"),
  s("gcp", "cloud-sql", "Cloud SQL", "Relational DB"),
  s("gcp", "firestore", "Firestore", "NoSQL DB"),
  s("gcp", "memorystore", "Memorystore", "Cache"),
  s("gcp", "pubsub", "Pub/Sub", "Queue"),
  s("gcp", "cloud-storage", "Cloud Storage", "Object storage"),
  s("gcp", "cloud-cdn", "Cloud CDN", "CDN"),
  s("gcp", "identity-platform", "Identity Platform", "Identity"),
  s("gcp", "secret-manager", "Secret Manager", "Secrets"),
  s("gcp", "cloud-monitoring", "Cloud Monitoring", "Monitoring"),
  s("gcp", "bigquery", "BigQuery", "Data warehouse"),
] as const satisfies readonly CloudService[];

export type CloudServiceId = (typeof CLOUD_SERVICES)[number]["id"];

// A tuple for z.enum in the design plan schema.
export const CLOUD_SERVICE_IDS = CLOUD_SERVICES.map((service) => service.id) as [CloudServiceId, ...CloudServiceId[]];

export const CLOUD_PROVIDER_BADGES: Record<CloudProvider, { label: string; color: string }> = {
  // Provider brand colors for the small node badge; not theme tokens.
  aws: { label: "AWS", color: "#FF9900" },
  azure: { label: "Azure", color: "#0078D4" },
  gcp: { label: "GCP", color: "#4285F4" },
};

// The provider plus the service, without doubling a name that already has it: "AWS Lambda",
// "Azure SQL" (not "Azure Azure SQL").
export function serviceFullName(service: CloudService) {
  const prefix = `${CLOUD_PROVIDER_BADGES[service.provider].label} `;
  return service.name.startsWith(prefix) ? service.name : `${prefix}${service.name}`;
}

export function getCloudService(id: string | undefined | null): CloudService | undefined {
  return id ? CLOUD_SERVICES.find((service) => service.id === id) : undefined;
}

export function cloudServicesFor(provider: CloudProvider): CloudService[] {
  return CLOUD_SERVICES.filter((service) => service.provider === provider);
}
