/**
 * e2e.test.js — 端到端测试：模拟真实 OpenCode plugin 调用链路。
 *
 * 使用真实临时文件系统（而非 mock），验证 plugin factory → shell.env hook →
 * parser 的全链路行为。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, statSync, readdirSync, unlinkSync, mkdirSync, utimesSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { _clearCache } from '../src/shell-env.js';

// ---------------------------------------------------------------------------
// 夹具
// ---------------------------------------------------------------------------

let tmpDir;
let childDir;
let loaderDir;

beforeAll(() => {
  tmpDir = mkdtempSync(path.join(tmpdir(), 'env-loader-e2e-'));
  childDir = path.join(tmpDir, 'child');
  loaderDir = path.join(tmpDir, '.opencode', 'env-loader');
  mkdirSync(childDir);
  mkdirSync(loaderDir, { recursive: true });
});

afterAll(() => {
  _clearCache();
  rmSync(tmpDir, { recursive: true, force: true });
});

beforeEach(() => {
  _clearCache();
  // 清理 loaderDir 中残留文件，保证测试隔离
  if (existsSync(loaderDir)) {
    for (const entry of readdirSync(loaderDir)) {
      const fp = path.join(loaderDir, entry);
      const st = statSync(fp);
      if (st.isFile()) unlinkSync(fp);
    }
  }
});

// ---------------------------------------------------------------------------
// 辅助函数
// ---------------------------------------------------------------------------

/**
 * 在 .opencode/env-loader/ 目录中写入 env 文件。
 * @param {string} name - 文件名（如 '.java-env' 或 'custom.conf'）
 * @param {string} content - 文件内容
 * @param {string} [baseDir] - 目标根目录，默认 tmpDir
 * @returns {string} 文件完整路径
 */
function writeLoaderFile(name, content, baseDir = tmpDir) {
  const targetDir = path.join(baseDir, '.opencode', 'env-loader');
  if (!existsSync(targetDir)) mkdirSync(targetDir, { recursive: true });
  const fp = path.join(targetDir, name);
  writeFileSync(fp, content);
  return fp;
}

async function getHooks() {
  const { default: plugin } = await import('../src/plugin.js');
  return plugin();
}

// ---------------------------------------------------------------------------
// 测试用例
// ---------------------------------------------------------------------------

describe('端到端：Plugin 完整调用链路', () => {
  // ── 1. 基本端到端 ──────────────────────────────────────────────

  it('创建 .opencode/env-loader/.java-env → plugin → shell.env hook → JAVA_HOME 正确注入', async () => {
    writeLoaderFile('.java-env', 'JAVA_HOME=/usr/lib/jvm/java-17\nJAVA_OPTS=-Xmx2g');

    const hooks = await getHooks();
    const input = { cwd: tmpDir };
    const output = { env: {} };

    await hooks['shell.env'](input, output);

    expect(output.env.JAVA_HOME).toBe('/usr/lib/jvm/java-17');
    expect(output.env.JAVA_OPTS).toBe('-Xmx2g');
    expect(output.env.ENV_LOADER_CWD).toBe(tmpDir);
  });

  // ── 2. 子目录 cwd 不 walk-up ──────────────────────────────────

  it('子目录 cwd → 不扫描父级 env-loader/', async () => {
    writeLoaderFile('.java-env', 'JAVA_HOME=/usr/lib/jvm/java-17');

    const hooks = await getHooks();
    const input = { cwd: childDir };
    const output = { env: {} };

    await hooks['shell.env'](input, output);

    expect(output.env.JAVA_HOME).toBeUndefined();
  });

  // ── 3. PATH 中 $HOME 展开 ──────────────────────────────────────

  it('env 文件中 $HOME 引用应展开为 process.env.HOME', async () => {
    writeLoaderFile('.node-env', 'NODE_PATH=$HOME/.nvm/versions/node\nHOME_BACKUP=$HOME');

    const hooks = await getHooks();
    const output = { env: {} };

    await hooks['shell.env']({ cwd: tmpDir }, output);

    expect(output.env.NODE_PATH).toBe(`${process.env.HOME}/.nvm/versions/node`);
    expect(output.env.HOME_BACKUP).toBe(process.env.HOME);
  });

  // ── 4. 多文件合并（按文件名排序,后者覆盖前者同名 key） ─────────

  it('多个 env-loader 文件: 后读覆盖先读同名 key', async () => {
    writeLoaderFile('.aaa-env', 'JAVA_HOME=/old\nSHARED_KEY=from-aaa');
    writeLoaderFile('.zzz-env', 'JAVA_HOME=/new\nPYTHONPATH=/opt/python');

    const hooks = await getHooks();
    const output = { env: {} };

    await hooks['shell.env']({ cwd: tmpDir }, output);

    expect(output.env.JAVA_HOME).toBe('/new');
    expect(output.env.SHARED_KEY).toBe('from-aaa');
    expect(output.env.PYTHONPATH).toBe('/opt/python');
  });

  // ── 5. 缓存：同 cwd + 同 mtime → 命中 ─────────────────────────

  it('缓存: 同 cwd + 同 mtime → 命中，不重新读磁盘', async () => {
    const envPath = writeLoaderFile('.java-env', 'JAVA_HOME=/usr/lib/jvm/java-17');

    const hooks = await getHooks();
    const input = { cwd: tmpDir };

    const out1 = { env: {} };
    await hooks['shell.env'](input, out1);
    expect(out1.env.JAVA_HOME).toBe('/usr/lib/jvm/java-17');

    const stat1 = statSync(envPath).mtime.getTime();

    const out2 = { env: {} };
    await hooks['shell.env'](input, out2);
    expect(out2.env.JAVA_HOME).toBe('/usr/lib/jvm/java-17');

    const stat2 = statSync(envPath).mtime.getTime();
    expect(stat2).toBe(stat1);
  });

  // ── 6. 缓存：mtime 变化 → 失效 ─────────────────────────────────

  it('缓存: mtime 变化 → 失效，重新读取磁盘', async () => {
    const envPath = writeLoaderFile('.java-env', 'JAVA_HOME=/old');

    const hooks = await getHooks();
    const input = { cwd: tmpDir };

    const out1 = { env: {} };
    await hooks['shell.env'](input, out1);
    expect(out1.env.JAVA_HOME).toBe('/old');

    writeFileSync(envPath, 'JAVA_HOME=/new');
    const newMtime = Date.now() + 1000;
    utimesSync(envPath, newMtime / 1000, newMtime / 1000);

    const out2 = { env: {} };
    await hooks['shell.env'](input, out2);
    expect(out2.env.JAVA_HOME).toBe('/new');
  });

  // ── 7. 缓存：不同 cwd → 不同 key ─────────────────

  it('缓存: 不同 cwd → 各自独立缓存条目', async () => {
    const envPath = writeLoaderFile('.java-env', 'JAVA_HOME=/shared');

    const hooks = await getHooks();

    const out1 = { env: {} };
    await hooks['shell.env']({ cwd: tmpDir }, out1);
    expect(out1.env.JAVA_HOME).toBe('/shared');

    const oldMtime = statSync(envPath).mtime;
    writeFileSync(envPath, 'JAVA_HOME=/updated');
    utimesSync(envPath, oldMtime, oldMtime);

    const out2 = { env: {} };
    await hooks['shell.env']({ cwd: tmpDir }, out2);
    expect(out2.env.JAVA_HOME).toBe('/shared');

    const out3 = { env: {} };
    await hooks['shell.env']({ cwd: childDir }, out3);
    expect(out3.env.JAVA_HOME).toBeUndefined();
  });

  // ── 8. 缓存：envRefHash 防 process.env 变化 ────────────────────

  it('缓存: $VAR 引用的 process.env 值变化 → 缓存失效', async () => {
    writeLoaderFile('.java-env', 'MY_PATH=$MY_VAR_A:$MY_VAR_B');

    const hooks = await getHooks();
    const input = { cwd: tmpDir };

    process.env.MY_VAR_A = 'alpha';
    process.env.MY_VAR_B = 'beta';

    const out1 = { env: {} };
    await hooks['shell.env'](input, out1);
    expect(out1.env.MY_PATH).toBe('alpha:beta');

    process.env.MY_VAR_A = 'alpha-v2';

    const out2 = { env: {} };
    await hooks['shell.env'](input, out2);
    expect(out2.env.MY_PATH).toBe('alpha-v2:beta');

    delete process.env.MY_VAR_A;
    delete process.env.MY_VAR_B;
  });

  // ── 9. 解析注释和空行 ──────────────────────────────────────────

  it('parser: 注释行和空行被跳过', async () => {
    writeLoaderFile('.java-env', '# Java 配置\n\nJAVA_HOME=/usr/lib/jvm/java-17\n\n# 注释行\nJAVA_OPTS=-Xmx2g');

    const hooks = await getHooks();
    const output = { env: {} };

    await hooks['shell.env']({ cwd: tmpDir }, output);

    expect(output.env.JAVA_HOME).toBe('/usr/lib/jvm/java-17');
    expect(output.env.JAVA_OPTS).toBe('-Xmx2g');
    expect(Object.keys(output.env)).toHaveLength(3);
  });

  // ── 10. 无 env-loader/ 内容 → output 仅含 ENV_LOADER_CWD ─────

  it('env-loader/ 为空 → output 仅含 ENV_LOADER_CWD', async () => {
    const hooks = await getHooks();
    const output = { env: {} };

    await hooks['shell.env']({ cwd: tmpDir }, output);

    expect(Object.keys(output.env)).toEqual(['ENV_LOADER_CWD']);
    expect(output.env.ENV_LOADER_CWD).toBe(tmpDir);
  });

  // ── 11. config hook 端到端 ─────────────────────────────────────

  it('config hook 注入 env-loader skills 路径', async () => {
    const hooks = await getHooks();
    const cfg = { skills: { paths: [] } };

    hooks.config(cfg);

    expect(cfg.skills.paths).toHaveLength(1);
    expect(cfg.skills.paths[0]).toMatch(/env-loader/);
    expect(cfg.skills.paths[0]).toMatch(/skills$/);
  });

  // ── 12. config hook 去重 ───────────────────────────────────────

  it('config hook: 已存在 env-loader 路径时不去重添加', async () => {
    const hooks = await getHooks();
    const existingPath = '/existing/env-loader/skills';
    const cfg = { skills: { paths: [existingPath] } };

    hooks.config(cfg);

    expect(cfg.skills.paths).toHaveLength(1);
    expect(cfg.skills.paths[0]).toBe(existingPath);
  });

  // ── 13. env-loader/ 自定义文件名（不带 -env 后缀）──

  it('env-loader/ 自定义命名 (database.conf / secrets.env) 全量加载', async () => {
    writeLoaderFile('database.conf', 'CUSTOM_KEY=custom-value\nDB_HOST=prod-db');
    writeLoaderFile('secrets.env', 'API_TOKEN=abc123');

    const hooks = await getHooks();
    const output = { env: {} };

    await hooks['shell.env']({ cwd: tmpDir }, output);

    expect(output.env.CUSTOM_KEY).toBe('custom-value');
    expect(output.env.DB_HOST).toBe('prod-db');
    expect(output.env.API_TOKEN).toBe('abc123');
  });

  // ── 14. env-loader/ 目录不存在 → 静默跳过 ─────────────────────

  it('env-loader/ 目录不存在 → 静默跳过，不报错', async () => {
    const childOpencodeDir = path.join(childDir, '.opencode');
    mkdirSync(childOpencodeDir, { recursive: true });

    const hooks = await getHooks();
    const output = { env: {} };

    await expect(
      hooks['shell.env']({ cwd: childDir }, output),
    ).resolves.not.toThrow();

    expect(Object.keys(output.env)).toEqual(['ENV_LOADER_CWD']);
    rmSync(childOpencodeDir, { recursive: true, force: true });
  });

  // ── 15. ${VAR} 花括号语法展开 ──────────────────────────────────

  it('${VAR} 花括号语法展开通过全链路', async () => {
    process.env.TEST_VAR = 'test-value';
    writeLoaderFile('.java-env', 'MY_KEY=${TEST_VAR}-suffix');

    const hooks = await getHooks();
    const output = { env: {} };

    await hooks['shell.env']({ cwd: tmpDir }, output);

    expect(output.env.MY_KEY).toBe('test-value-suffix');

    delete process.env.TEST_VAR;
  });

  // ── 16. 典型多语言项目 ─────────────────────────────────────────

  it('典型多语言项目: .java-env + .node-env + .python-env 同时存在', async () => {
    writeLoaderFile('.java-env', 'JAVA_HOME=/opt/java17\nJAVA_OPTS=-Xmx2g');
    writeLoaderFile('.node-env', 'NODE_HOME=/opt/node22');
    writeLoaderFile('.python-env', 'PYTHON_HOME=/opt/py312');

    const hooks = await getHooks();
    const output = { env: {} };

    await hooks['shell.env']({ cwd: tmpDir }, output);

    expect(output.env.JAVA_HOME).toBe('/opt/java17');
    expect(output.env.JAVA_OPTS).toBe('-Xmx2g');
    expect(output.env.NODE_HOME).toBe('/opt/node22');
    expect(output.env.PYTHON_HOME).toBe('/opt/py312');
  });
});