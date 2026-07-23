import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, relative, resolve } from 'node:path';
import ts from 'typescript';

const root = resolve(import.meta.dirname, '..');
const appSourceRoot = resolve(root, 'src');
const workerSourceRoot = resolve(root, 'worker/src');
const sourceRoots = [appSourceRoot, workerSourceRoot];
const orchestratorLimits = new Map([
  ['src/App.tsx', 330],
  ['src/components/AppScreenRouter.tsx', 200],
  ['src/services/rankingService.ts', 420],
  ['worker/src/index.ts', 300],
  ['worker/src/leaderboards.ts', 470],
]);

const listSourceFiles = (directory) => readdirSync(directory, { withFileTypes: true })
  .flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      return listSourceFiles(path);
    }
    if (!entry.isFile() || !['.ts', '.tsx'].includes(extname(entry.name))) {
      return [];
    }
    if (entry.name.endsWith('.test.ts') || entry.name.endsWith('.d.ts')) {
      return [];
    }
    return [path];
  });

const files = sourceRoots.flatMap(listSourceFiles);
const fileSet = new Set(files);

const resolveImport = (importer, specifier) => {
  if (!specifier.startsWith('.')) {
    return null;
  }
  const base = resolve(dirname(importer), specifier.replace(/\.js$/, ''));
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    resolve(base, 'index.ts'),
    resolve(base, 'index.tsx'),
  ];
  return candidates.find((candidate) => fileSet.has(candidate)) ?? null;
};

const collectSpecifiers = (file) => {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const specifiers = [];
  const visit = (node) => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
      && node.moduleSpecifier
      && ts.isStringLiteral(node.moduleSpecifier)) {
      specifiers.push(node.moduleSpecifier.text);
    }
    if (ts.isCallExpression(node)
      && node.expression.kind === ts.SyntaxKind.ImportKeyword
      && node.arguments.length === 1
      && ts.isStringLiteral(node.arguments[0])) {
      specifiers.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return specifiers;
};

const graph = new Map(files.map((file) => [
  file,
  collectSpecifiers(file)
    .map((specifier) => resolveImport(file, specifier))
    .filter(Boolean),
]));

const state = new Map();
const stack = [];
const cycles = [];
const visit = (file) => {
  const currentState = state.get(file) ?? 0;
  if (currentState === 2) {
    return;
  }
  if (currentState === 1) {
    const cycleStart = stack.indexOf(file);
    cycles.push([...stack.slice(cycleStart), file]);
    return;
  }
  state.set(file, 1);
  stack.push(file);
  graph.get(file)?.forEach(visit);
  stack.pop();
  state.set(file, 2);
};
files.forEach(visit);

const errors = [];
for (const [path, maximumLines] of orchestratorLimits) {
  const absolutePath = resolve(root, path);
  const lineCount = readFileSync(absolutePath, 'utf8').split(/\r?\n/).length;
  if (lineCount > maximumLines) {
    errors.push(`${path} has ${lineCount} lines; orchestration modules are limited to ${maximumLines}.`);
  }
}

for (const cycle of cycles) {
  errors.push(`Circular dependency: ${cycle.map((file) => relative(root, file)).join(' -> ')}`);
}

for (const [file, dependencies] of graph) {
  dependencies.forEach((dependency) => {
    if ((file.startsWith(appSourceRoot) && dependency.startsWith(workerSourceRoot))
      || (file.startsWith(workerSourceRoot) && dependency.startsWith(appSourceRoot))) {
      errors.push(`Application/Worker boundary violation: ${relative(root, file)} -> ${relative(root, dependency)}`);
    }
  });
}

for (const file of files.filter((path) => path.includes('/src/domain/'))) {
  const forbidden = graph.get(file)?.filter((dependency) => (
    dependency.includes('/src/components/')
    || dependency.includes('/src/hooks/')
    || dependency.includes('/src/services/')
  )) ?? [];
  forbidden.forEach((dependency) => {
    errors.push(`Domain dependency points outward: ${relative(root, file)} -> ${relative(root, dependency)}`);
  });
}

if (errors.length > 0) {
  throw new Error(`Maintainability checks failed:\n- ${errors.join('\n- ')}`);
}

const totalBytes = files.reduce((sum, file) => sum + statSync(file).size, 0);
console.log(
  `Maintainability checks passed: ${files.length} source modules, no cycles or boundary violations, `
  + `${totalBytes.toLocaleString('en-US')} bytes inspected.`,
);
