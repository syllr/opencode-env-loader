import { describe, it, expect } from 'vitest';

describe('plugin', () => {
  it('default export should be an async function', async () => {
    const { default: plugin } = await import('./plugin.js');

    expect(typeof plugin).toBe('function');

    const result = plugin();
    expect(result).toBeInstanceOf(Promise);
    await expect(result).resolves.toBeDefined();
  });

  it('should return config hook and shell.env hook from plugin()', async () => {
    const { default: plugin } = await import('./plugin.js');
    const hooks = await plugin();

    expect(hooks).toHaveProperty('config');
    expect(typeof hooks.config).toBe('function');
    expect(hooks).toHaveProperty('shell.env');
    expect(typeof hooks['shell.env']).toBe('function');
  });

  it('config hook should inject env-loader skills path into cfg.skills.paths', async () => {
    const { default: plugin } = await import('./plugin.js');
    const hooks = await plugin();
    const cfg = { skills: { paths: ['/existing'] } };

    hooks.config(cfg);

    expect(cfg.skills.paths).toHaveLength(2);
    expect(cfg.skills.paths[0]).toBe('/existing');
    expect(cfg.skills.paths[1]).toMatch(/env-loader/);
  });

  it('config hook should deduplicate existing env-loader path in cfg.skills.paths', async () => {
    const { default: plugin } = await import('./plugin.js');
    const hooks = await plugin();
    const existingPath = '/some/path/env-loader/skills';
    const cfg = { skills: { paths: [existingPath] } };

    hooks.config(cfg);

    const envLoaderPaths = cfg.skills.paths.filter((p) => p.includes('env-loader'));
    expect(envLoaderPaths).toHaveLength(1);
    expect(envLoaderPaths[0]).toBe(existingPath);
  });

  it('shell.env hook should accept input.cwd and populate output.env with ENV_LOADER_CWD', async () => {
    const { default: plugin } = await import('./plugin.js');
    const hooks = await plugin();
    const input = { cwd: '/proj' };
    const output = { env: {} };

    await hooks['shell.env'](input, output);

    expect(output.env).toBeDefined();
    expect(output.env.ENV_LOADER_CWD).toBe('/proj');
  });

  it('shell.env hook 不接收配置参数 (v2 起 sources 已删除)', async () => {
    const { default: plugin } = await import('./plugin.js');
    const hooks = await plugin();
    const output = { env: {} };

    await hooks['shell.env']({ cwd: '/proj' }, output);

    expect(output.env).toBeDefined();
    expect(output.env.ENV_LOADER_CWD).toBe('/proj');
  });
});