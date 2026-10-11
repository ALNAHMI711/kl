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
  return files;
}
