import { describe, expect, it } from 'vitest';
import { MAX_FILE_LENGTH, MAX_FILES, MAX_TOTAL_LENGTH, validateProjectFiles } from './project-validation';

const validFiles = [
  { path: 'package.json', content: '{"scripts":{"dev":"vite"}}' },
  { path: 'index.html', content: '<div id="root"></div>' },
  { path: 'src/main.tsx', content: 'import React from "react";' },
];

describe('validateProjectFiles', () => {
  it('accepts a minimal project with required root files', () => {
    expect(validateProjectFiles(validFiles)).toEqual(validFiles);
  });

  it('rejects missing required root files', () => {
    expect(validateProjectFiles([{ path: 'package.json', content: '{}' }, { path: 'src/App.tsx', content: 'export {}' }])).toBeNull();
  });

  it('rejects path traversal and absolute paths', () => {
    expect(validateProjectFiles([...validFiles, { path: 'src/../secret.ts', content: 'x' }])).toBeNull();
    expect(validateProjectFiles([...validFiles, { path: '/tmp/evil.ts', content: 'x' }])).toBeNull();
  });

  it('rejects backslash paths and unsupported file locations', () => {
    expect(validateProjectFiles([...validFiles, { path: 'src\\\\evil.ts', content: 'x' }])).toBeNull();
    expect(validateProjectFiles([...validFiles, { path: 'public/evil.js', content: 'x' }])).toBeNull();
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
    expect(validateProjectFiles([
      { path: 'package.json', content: 'x'.repeat(MAX_FILE_LENGTH + 1) },
      validFiles[1],
    ])).toBeNull();
  });

  it('rejects projects over the aggregate size limit', () => {
    expect(validateProjectFiles([
      { path: 'package.json', content: 'x'.repeat(MAX_TOTAL_LENGTH / 2) },
      { path: 'index.html', content: 'y'.repeat(MAX_TOTAL_LENGTH / 2 + 1) },
    ])).toBeNull();
  });

  it('rejects malformed values', () => {
    expect(validateProjectFiles(null)).toBeNull();
    expect(validateProjectFiles([null, ...validFiles])).toBeNull();
    expect(validateProjectFiles([{ path: 'package.json', content: 123 }, validFiles[1]])).toBeNull();
  });
});
