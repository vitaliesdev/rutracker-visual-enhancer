#!/usr/bin/env node
// Bumps the version in extension/manifest.json and package.json.
// Usage: npm run bump -- <patch|minor|major|X.Y.Z>   (defaults to patch)
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = join(root, "extension", "manifest.json");
const packagePath = join(root, "package.json");

const arg = (process.argv[2] || "patch").trim();
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const current = String(manifest.version || "0.0.0");

function nextVersion(version, kind) {
  if (/^\d+\.\d+\.\d+$/.test(kind)) return kind;
  const [major, minor, patch] = version.split(".").map(Number);
  if (kind === "major") return `${major + 1}.0.0`;
  if (kind === "minor") return `${major}.${minor + 1}.0`;
  if (kind === "patch") return `${major}.${minor}.${patch + 1}`;
  throw new Error(`Unknown bump "${kind}". Use patch, minor, major, or X.Y.Z.`);
}

const next = nextVersion(current, arg);
manifest.version = next;
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

try {
  const pkg = JSON.parse(readFileSync(packagePath, "utf8"));
  pkg.version = next;
  writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + "\n");
} catch {
  // package.json version is informational only.
}

console.log(`Version ${current} -> ${next}`);
console.log("Next: npm run build");
