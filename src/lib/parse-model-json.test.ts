import { describe, expect, it } from 'vitest';
import { parseModelJson } from './parse-model-json';

describe('parseModelJson', () => {
  it('parses a plain JSON object', () => {
    expect(parseModelJson('{"name":"demo"}')).toEqual({ name: 'demo' });
  });

  it('accepts a complete fenced JSON response from a model', () => {
    expect(parseModelJson('```json\n{"name":"demo","files":[]}\n```')).toEqual({
      name: 'demo',
      files: [],
    });
  });

  it('rejects prose surrounding JSON instead of guessing', () => {
    expect(parseModelJson('Here is the JSON: {"name":"demo"}')).toBeNull();
  });

  it('rejects invalid JSON and non-JSON code fences', () => {
    expect(parseModelJson('```javascript\nalert(1)\n```')).toBeNull();
    expect(parseModelJson('{"name":')).toBeNull();
  });
});
