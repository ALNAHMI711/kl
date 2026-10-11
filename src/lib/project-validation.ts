export type ProjectFile = { path: string; content: string };

export const MAX_FILES = 12;
export const MAX_FILE_LENGTH = 30000;
export const MAX_TOTAL_LENGTH = 100000;
const ALLOWED_PATH = /^(package\.json|index\.html|README\.md|vite\.config\.ts|tsconfig\.json|src\/[a-zA-Z0-9._/-]+\.(tsx?|jsx?|css|json|html|md))$/;

export function validateProjectFiles(value: unknown): ProjectFile[] | null {
  if (!Array.isArray(value) || value.length < 2 || value.length > MAX_FILES) return null;
  const seen = new Set<string>();
  let total = 0;
  const files: ProjectFile[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object' || !('path' in item) || !('content' in item)) return null;
    const path = item.path;
    const content = item.content;
    if (typeof path !== 'string' || typeof content !== 'string') return null;
    if (path.startsWith('/') || path.includes('..') || path.includes('\\') || path.split('/').some((segment) => !segment || segment === '.') || !ALLOWED_PATH.test(path)) return null;
    if (seen.has(path) || content.length > MAX_FILE_LENGTH) return null;
    seen.add(path);
    total += content.length;
    if (total > MAX_TOTAL_LENGTH) return null;
    files.push({ path, content });
  }
  const required = ['package.json', 'index.html', 'src/main.tsx', 'src/App.tsx', 'src/styles.css'];
  if (!required.every((path) => seen.has(path))) return null;

  // Generated projects are untrusted. Block package lifecycle hooks that can run
  // automatically when a user installs dependencies or prepares the project.
  const packageFile = files.find((file) => file.path === 'package.json');
  if (!packageFile) return null;
  let packageJson: unknown;
  try {
    packageJson = JSON.parse(packageFile.content);
  } catch {
    return null;
  }
  if (!packageJson || typeof packageJson !== 'object' || Array.isArray(packageJson)) return null;
  const scripts = 'scripts' in packageJson ? packageJson.scripts : undefined;
  if (scripts !== undefined && (!scripts || typeof scripts !== 'object' || Array.isArray(scripts))) return null;
  const blockedLifecycleScripts = new Set([
    'preinstall',
    'install',
    'postinstall',
    'preprepare',
    'prepare',
    'postprepare',
    'prepublish',
    'prepublishOnly',
    'dependencies',
  ]);
  if (scripts && Object.keys(scripts).some((script) => blockedLifecycleScripts.has(script) || /^(pre|post).+/.test(script))) return null;

  // Only permit conventional Vite/TypeScript tool commands. A generated project is
  // untrusted input; arbitrary npm scripts can execute shell commands when run.
  const allowedScripts: Record<string, Set<string>> = {
    dev: new Set(['vite']),
    build: new Set(['vite build', 'tsc && vite build', 'tsc -b && vite build', 'tsc --noEmit && vite build']),
    preview: new Set(['vite preview']),
    start: new Set(['vite preview']),
    typecheck: new Set(['tsc --noEmit', 'tsc -b']),
    lint: new Set(['eslint .']),
    test: new Set(['vitest run']),
  };
  if (scripts) {
    for (const [name, command] of Object.entries(scripts)) {
      if (typeof command !== 'string' || !allowedScripts[name]?.has(command.trim())) return null;
    }
  }

  // Generated package manifests must not pull executable dependencies from arbitrary
  // URLs, Git repositories, local paths, or npm aliases. Users still need to review
  // normal registry packages before running npm install.
  const manifest = packageJson as Record<string, unknown>;
  for (const sectionName of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
    const section = manifest[sectionName];
    if (section === undefined) continue;
    if (!section || typeof section !== 'object' || Array.isArray(section)) return null;
    for (const [name, version] of Object.entries(section)) {
      if (!/^(@[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+|[a-zA-Z0-9._-]+)$/.test(name)) return null;
      if (typeof version !== 'string' || !version.trim()) return null;
      if (/^(https?:|git\+|git:|ssh:|github:|file:|link:|workspace:|npm:|\.\.?\/|\/)/i.test(version.trim())) return null;
    }
  }

  return files;
}
