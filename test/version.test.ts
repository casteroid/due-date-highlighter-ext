import { expect, it } from "vitest";
import pkg from "../package.json";
import manifest from "../src/manifest.json";

it("package.json and the manifest carry the same version", () => {
  expect(pkg.version).toBe(manifest.version);
});
