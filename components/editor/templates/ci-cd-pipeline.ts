import { blue, edge, green, node, orange, purple, red, teal, type CanvasTemplate } from "./helpers";

const push = node("ci-push", "Git Push", "circle", 0, 0);
const build = node("ci-build", "Build", "rectangle", 1, 0, blue);
const tests = node("ci-tests", "Run Tests", "rectangle", 2, 0, purple);
const gate = node("ci-gate", "Tests pass?", "diamond", 3, 0, orange);
const notify = node("ci-notify", "Notify Team", "hexagon", 3, 1, red);
const registry = node("ci-registry", "Image Registry", "cylinder", 4, 0, teal);
const staging = node("ci-staging", "Deploy Staging", "pill", 4, 1, green);
const prod = node("ci-prod", "Deploy Production", "pill", 5, 1, green);

export const ciCdPipeline: CanvasTemplate = {
  id: "ci-cd-pipeline",
  name: "CI/CD pipeline",
  description: "From a git push through build, tests and a quality gate to staged deployments.",
  labels: { cloudProvider: "agnostic", projectType: "cicd-pipeline" },
  nodes: [push, build, tests, gate, notify, registry, staging, prod],
  edges: [
    edge(push, build),
    edge(build, tests),
    edge(tests, gate),
    edge(gate, registry, "pass"),
    edge(gate, notify, "fail"),
    edge(registry, staging),
    edge(staging, prod, "approve"),
  ],
};
