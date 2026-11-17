import { blue, edge, green, neutral, node, orange, pink, purple, type CanvasTemplate } from "./helpers";

const users = node("aws-users", "Tenant Users", "circle", 0, 1, pink);
const cloudFront = node("aws-cloudfront", "CloudFront", "pill", 1, 1, blue, "aws.cloudfront");
const webApp = node("aws-web-app", "Static Web App", "cylinder", 1, 0, green, "aws.s3");
const apiGateway = node("aws-api-gateway", "API Gateway", "pill", 2, 1, blue, "aws.api-gateway");
const cognito = node("aws-cognito", "Cognito", "hexagon", 2, 0, purple, "aws.cognito");
const cloudWatch = node("aws-cloudwatch", "CloudWatch", "hexagon", 2, 2, neutral, "aws.cloudwatch");
const tenantsFn = node("aws-tenants-fn", "Tenants Function", "rectangle", 3, 0, blue, "aws.lambda");
const billingFn = node("aws-billing-fn", "Billing Function", "rectangle", 3, 1, blue, "aws.lambda");
const projectsFn = node("aws-projects-fn", "Projects Function", "rectangle", 3, 2, blue, "aws.lambda");
const tenantsTable = node("aws-tenants-table", "Tenants Table", "cylinder", 4, 0, green, "aws.dynamodb");
const usageQueue = node("aws-usage-queue", "Usage Queue", "hexagon", 4, 1, orange, "aws.sqs");
const projectsTable = node("aws-projects-table", "Projects Table", "cylinder", 4, 2, green, "aws.dynamodb");
const usageWorker = node("aws-usage-worker", "Usage Worker", "rectangle", 5, 1, blue, "aws.lambda");
const usageTable = node("aws-usage-table", "Usage Table", "cylinder", 6, 1, green, "aws.dynamodb");

export const awsServerlessSaas: CanvasTemplate = {
  id: "aws-serverless-saas-api",
  name: "AWS serverless SaaS API",
  description: "A multi-tenant API on API Gateway and Lambda, with Cognito sign-in, DynamoDB tables and SQS usage metering.",
  labels: { cloudProvider: "aws", architectureStyle: "serverless", industry: "saas", projectType: "backend-platform" },
  nodes: [
    users,
    cloudFront,
    webApp,
    apiGateway,
    cognito,
    cloudWatch,
    tenantsFn,
    billingFn,
    projectsFn,
    tenantsTable,
    usageQueue,
    projectsTable,
    usageWorker,
    usageTable,
  ],
  edges: [
    edge(users, cloudFront, "HTTPS"),
    edge(cloudFront, webApp, "static assets"),
    edge(cloudFront, apiGateway, "/api"),
    edge(apiGateway, cognito, "verify JWT"),
    edge(apiGateway, cloudWatch, "access logs"),
    edge(apiGateway, tenantsFn, "/tenants"),
    edge(apiGateway, billingFn, "/billing"),
    edge(apiGateway, projectsFn, "/projects"),
    edge(tenantsFn, tenantsTable, "tenant config"),
    edge(billingFn, usageQueue, "usage event"),
    edge(projectsFn, projectsTable, "read/write"),
    edge(usageQueue, usageWorker, "trigger"),
    edge(usageWorker, usageTable, "aggregate"),
  ],
};
