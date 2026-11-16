import { blue, boundary, edge, green, node, pink, purple, type CanvasTemplate } from "./helpers";

const web = node("phr-web", "Web Portal", "circle", 0, 0, pink);
const mobile = node("phr-mobile", "Mobile App", "circle", 0, 2, pink);
const identity = node("phr-identity", "Identity Provider", "hexagon", 1, 0, purple);
const api = node("phr-api", "Records API", "pill", 1, 1, blue);
const records = node("phr-records", "Records Module", "rectangle", 2, 1, blue);
const consent = node("phr-consent", "Consent Module", "rectangle", 2, 2, blue);
const phiDb = node("phr-phi-db", "PHI Database", "cylinder", 3, 1, green);
const audit = node("phr-audit", "Audit Log", "cylinder", 3, 2, green);
const backups = node("phr-backups", "Encrypted Backups", "cylinder", 4, 1, green);
// The PHI database is isolated in its own zone; only the records module reaches it.
const phiZone = boundary("phr-phi-zone", "PHI zone", [phiDb]);

export const patientRecords: CanvasTemplate = {
  id: "patient-records-system",
  name: "Patient records system",
  description: "A modular monolith with records and consent modules, an isolated PHI database, audit logging and backups.",
  labels: {
    cloudProvider: "agnostic",
    architectureStyle: "modular-monolith",
    industry: "healthcare",
    projectType: "backend-platform",
  },
  // The boundary comes first so the gallery preview draws it underneath.
  nodes: [phiZone, web, mobile, identity, api, records, consent, phiDb, audit, backups],
  edges: [
    edge(web, api, "HTTPS"),
    edge(mobile, api, "HTTPS"),
    edge(api, identity, "OIDC tokens"),
    edge(api, records, "records API"),
    edge(records, consent, "check consent"),
    edge(records, phiDb, "encrypted PHI"),
    edge(records, audit, "access log"),
    edge(consent, audit, "consent changes"),
    edge(phiDb, backups, "nightly snapshot"),
  ],
};
