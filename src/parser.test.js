import { describe, it, expect } from 'vitest';
import { parse } from './parser.js';

describe('parse', () => {
  it('should parse simple KEY=VALUE pair', () => {
    const result = parse('FOO=bar');
    expect(result).toEqual({ FOO: 'bar' });
  });

  it('should skip lines starting with #', () => {
    const result = parse('# this is a comment');
    expect(Object.keys(result)).toHaveLength(0);
  });

  it('should skip empty lines', () => {
    const result = parse('');
    expect(Object.keys(result)).toHaveLength(0);
  });

  it('should skip whitespace-only lines', () => {
    const result = parse('   \t  ');
    expect(Object.keys(result)).toHaveLength(0);
  });

  it('should expand $VAR using process.env', () => {
    const result = parse('HOME=$HOME');
    expect(result.HOME).toBe(process.env.HOME);
  });

  it('should expand ${VAR} using process.env', () => {
    const result = parse('HOME=${HOME}');
    expect(result.HOME).toBe(process.env.HOME);
  });

  it('should replace undefined variable with empty string', () => {
    const result = parse('KEY=$UNDEFINED_VAR_XYZ');
    expect(result.KEY).toBe('');
  });

  it('should replace undefined braced variable with empty string', () => {
    const result = parse('KEY=${UNDEFINED_VAR_XYZ}');
    expect(result.KEY).toBe('');
  });

  it('should prefix existing PATH value with new path', () => {
    const oldPath = process.env.PATH;
    const result = parse('PATH=/new:$PATH');
    expect(result.PATH).toBe('/new:' + oldPath);
  });

  it('should keep injection string as-is without evaluation', () => {
    const result = parse('KEY=; rm -rf /');
    expect(result.KEY).toBe('; rm -rf /');
  });

  it('should not treat # inside value as comment', () => {
    const result = parse('KEY=val#ue');
    expect(result.KEY).toBe('val#ue');
  });

  it('should parse multiple lines into multiple keys', () => {
    const result = parse('A=1\nB=2\nC=3');
    expect(result).toEqual({ A: '1', B: '2', C: '3' });
  });

  it('should handle mixed content with comments, blanks, and pairs', () => {
    const input = [
      '# Database config',
      '',
      'DB_HOST=localhost',
      'DB_PORT=5432',
      '',
      '# App config',
      'APP_ENV=production',
    ].join('\n');
    const result = parse(input);
    expect(result).toEqual({
      DB_HOST: 'localhost',
      DB_PORT: '5432',
      APP_ENV: 'production',
    });
  });
});
