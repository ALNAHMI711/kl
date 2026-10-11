import { describe, expect, it } from 'vitest';
import { extractFencedHtml } from './html-output';

describe('extractFencedHtml', () => {
  it('extracts a fenced HTML document', () => {
    expect(extractFencedHtml('Here is the page:\n```html\n<!doctype html><h1>Hello</h1>\n```'))
      .toBe('<!doctype html><h1>Hello</h1>\n');
  });

  it('matches the HTML fence without case sensitivity', () => {
    expect(extractFencedHtml('```HTML\n<p>Hi</p>```')).toBe('<p>Hi</p>');
  });

  it('returns the first HTML fence when multiple fences exist', () => {
    expect(extractFencedHtml('```html\n<p>first</p>```\n```html\n<p>second</p>```'))
      .toBe('<p>first</p>');
  });

  it('does not treat non-HTML fences or unfenced markup as HTML output', () => {
    expect(extractFencedHtml('```tsx\nexport default 1```')).toBeNull();
    expect(extractFencedHtml('<h1>unfenced</h1>')).toBeNull();
  });

  it('rejects non-string inputs and missing closing fences', () => {
    expect(extractFencedHtml(null)).toBeNull();
    expect(extractFencedHtml({ text: '```html\n<p>x</p>```' })).toBeNull();
    expect(extractFencedHtml('```html\n<p>unfinished</p>')).toBeNull();
  });
});
