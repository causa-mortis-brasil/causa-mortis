#!/usr/bin/env node
import { execSync } from "node:child_process";

const COMMENT_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".astro",
  ".css",
]);

const COMMENT_PATTERNS = [
  /^\s*\/\//,
  /^\s*\/\*/,
  /\*\/\s*$/,
  /^\s*\{\s*\/\*/,
  /^\s*<!--/,
  /-->\s*$/,
];

function run(command) {
  try {
    const stdout = execSync(command, {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { ok: true, output: stdout };
  } catch (error) {
    const output = `${error.stdout ?? ""}${error.stderr ?? ""}`;
    return { ok: false, output };
  }
}

function checkTypeScript() {
  const result = run("npm run check --silent");
  if (result.ok) return null;
  return `Erros de TypeScript encontrados (astro check):\n${result.output.trim()}`;
}

function checkFormatting() {
  const result = run("npm run format:check --silent");
  if (result.ok) return null;
  return `Arquivos não formatados com Prettier (npm run format para corrigir):\n${result.output.trim()}`;
}

function checkComments() {
  const diffResult = run("git diff HEAD --unified=0 --no-color");
  if (!diffResult.ok && !diffResult.output) return null;

  const lines = diffResult.output.split("\n");
  let currentFile = null;
  const violations = [];

  for (const line of lines) {
    if (line.startsWith("+++ b/")) {
      currentFile = line.slice(6);
      continue;
    }
    if (!line.startsWith("+") || line.startsWith("+++")) continue;
    if (!currentFile) continue;

    const extension = currentFile.slice(currentFile.lastIndexOf("."));
    if (!COMMENT_EXTENSIONS.has(extension)) continue;

    const content = line.slice(1);
    if (COMMENT_PATTERNS.some((pattern) => pattern.test(content))) {
      violations.push(`${currentFile}: ${content.trim()}`);
    }
  }

  if (violations.length === 0) return null;
  return `Comentários adicionados ao código (proibidos pelo CLAUDE.md):\n${violations.join("\n")}`;
}

const failures = [checkTypeScript(), checkFormatting(), checkComments()].filter(
  Boolean,
);

if (failures.length > 0) {
  console.log(
    JSON.stringify({
      decision: "block",
      reason: failures.join("\n\n"),
    }),
  );
}
