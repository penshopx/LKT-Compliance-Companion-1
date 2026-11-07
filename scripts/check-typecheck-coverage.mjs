import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

// Discover packages through pnpm so this stays aligned with pnpm-workspace.yaml.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packages = JSON.parse(
  execFileSync("pnpm", ["-r", "list", "--depth", "-1", "--json"], {
    cwd: root,
    encoding: "utf8",
  }),
);
const readConfig = (path) => {
  const result = ts.readConfigFile(path, ts.sys.readFile);
  if (result.error) {
    throw new Error(ts.flattenDiagnosticMessageText(result.error.messageText, "\n"));
  }
  return result.config;
};
const solution = readConfig(resolve(root, "tsconfig.json"));
const libraries = new Set(
  (solution.references ?? []).map(({ path }) => {
    const absolute = resolve(root, path);
    return absolute.endsWith("tsconfig.json") ? dirname(absolute) : absolute;
  }),
);
const errors = [];
for (const pkg of packages) {
  if (resolve(pkg.path) === root) continue;
  const manifest = JSON.parse(readFileSync(resolve(pkg.path, "package.json"), "utf8"));
  const config = readConfig(resolve(pkg.path, "tsconfig.json"));
  if (config.compilerOptions?.composite) {
    if (!libraries.has(resolve(pkg.path))) {
      errors.push(`${pkg.name}: composite library missing from root tsconfig references`);
    }
  } else if (!manifest.scripts?.typecheck?.trim()) {
    errors.push(`${pkg.name}: leaf package missing a typecheck script`);
  }
}
if (errors.length) {
  throw new Error(`Incomplete workspace typecheck coverage:\n${errors.join("\n")}`);
}
console.log(`Typecheck coverage: ${packages.filter((pkg) => resolve(pkg.path) !== root).length} workspace packages.`);
