import { describe, it, expect, afterEach } from 'vitest';
import { parse } from './parser.js';

// 保存原始环境变量以便恢复
const ORIGINAL_PATH = process.env.PATH;
const ORIGINAL_HOME = process.env.HOME;

describe('parse', () => {
  afterEach(() => {
    process.env.PATH = ORIGINAL_PATH;
    process.env.HOME = ORIGINAL_HOME;
  });

  // ========== 现有测试（13 个） ==========

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

  // ========== 新增测试（10 个） ==========

  it('should resolve same-file $VAR reference', () => {
    const result = parse('A=hello\nB=$A');
    expect(result).toEqual({ A: 'hello', B: 'hello' });
  });

  it('should resolve same-file ${VAR} reference', () => {
    const result = parse('A=hello\nB=${A}');
    expect(result).toEqual({ A: 'hello', B: 'hello' });
  });

  it('should resolve cross-line concatenation', () => {
    const result = parse('BASE=/usr\nPATH=$BASE/bin');
    expect(result).toEqual({ BASE: '/usr', PATH: '/usr/bin' });
  });

  it('should prefer file-internal value over process.env', () => {
    process.env.PATH = '/system';
    const result = parse('PATH=/local\nCUSTOM=$PATH');
    expect(result.CUSTOM).toBe('/local');
  });

  it('should handle empty value in file', () => {
    const result = parse('A=\nB=$A');
    expect(result).toEqual({ A: '', B: '' });
  });

  it('should return empty string for undefined variable', () => {
    const result = parse('A=$NOT_EXIST');
    expect(result.A).toBe('');
  });

  it('should handle circular reference without crashing', () => {
    const result = parse('A=$B\nB=$A');
    expect(result.A).toBe('');
    expect(result.B).toBe('');
  });

  it('should resolve nested chain (A->B->C)', () => {
    const result = parse('A=$B\nB=$C\nC=final');
    expect(result).toEqual({ A: 'final', B: 'final', C: 'final' });
  });

  it('should preserve literal $ when not matching VAR pattern', () => {
    const result = parse('A=price$10');
    expect(result.A).toBe('price$10');
  });

  it('should mix file-internal and system references', () => {
    process.env.HOME = '/home';
    const result = parse('BASE=$HOME\nFINAL=$BASE/app');
    expect(result.BASE).toBe('/home');
    expect(result.FINAL).toBe('/home/app');
  });
});
