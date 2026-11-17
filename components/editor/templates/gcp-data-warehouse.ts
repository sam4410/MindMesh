import { blue, edge, green, neutral, node, orange, pink, teal, type CanvasTemplate } from "./helpers";

// Dataflow and Looker aren't in the cloud-service catalog, so those nodes carry no service badge.
const ordersDb = node("gcp-orders-db", "Orders DB", "cylinder", 0, 0, green, "gcp.cloud-sql");
const clickstream = node("gcp-clickstream", "App Events", "circle", 0, 1, pink);
const crm = node("gcp-crm", "CRM (SaaS)", "hexagon", 0, 2, teal);
const pubsub = node("gcp-pubsub", "Ingestion", "hexagon", 1, 1, orange, "gcp.pubsub");
const rawZone = node("gcp-raw-zone", "Raw Zone", "cylinder", 2, 0, green, "gcp.cloud-storage");
const dataflow = node("gcp-dataflow", "Dataflow Transforms", "rectangle", 2, 1, blue);
const monitoring = node("gcp-monitoring", "Cloud Monitoring", "hexagon", 2, 2, neutral, "gcp.cloud-monitoring");
const bigquery = node("gcp-bigquery", "Warehouse", "cylinder", 3, 1, green, "gcp.bigquery");
const looker = node("gcp-looker", "Looker BI", "rectangle", 4, 1);
const analysts = node("gcp-analysts", "Analysts", "circle", 5, 1, pink);

export const gcpDataWarehouse: CanvasTemplate = {
  id: "gcp-data-warehouse",
  name: "GCP data warehouse",
  description: "Sources stream through Pub/Sub into a Cloud Storage raw zone, Dataflow transforms load BigQuery, and Looker reports on it.",
  labels: { cloudProvider: "gcp", industry: "general", projectType: "data-warehouse" },
  nodes: [ordersDb, clickstream, crm, pubsub, rawZone, dataflow, monitoring, bigquery, looker, analysts],
  edges: [
    edge(ordersDb, pubsub, "change events"),
    edge(clickstream, pubsub, "events"),
    edge(crm, pubsub, "webhooks"),
    edge(pubsub, rawZone, "archive raw"),
    edge(pubsub, dataflow, "stream"),
    edge(rawZone, dataflow, "batch read"),
    edge(dataflow, monitoring, "job metrics"),
    edge(dataflow, bigquery, "load curated"),
    edge(bigquery, looker, "SQL queries"),
    edge(looker, analysts, "dashboards"),
  ],
};
