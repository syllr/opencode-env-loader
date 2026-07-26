import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'node:path';
import { shellEnvHook, _clearCache } from './shell-env.js';

// ---------------------------------------------------------------------------
// Mock filesystem — state shared across tests via vi.hoisted
// ---------------------------------------------------------------------------

const mockFs = vi.hoisted(() => {
  const files = new Map();

  return {
    files,

    readdirSync: vi.fn((dir, options) => {
      const entries = [];
      for (const p of files.keys()) {
        if (path.dirname(p) === dir) {
          entries.push(path.basename(p));
        }
      }
      entries.sort();
      if (options && options.withFileTypes) {
        return entries.map((name) => ({ name, isFile: () => true, isDirectory: () => false }));
      }
      return entries;
    }),

    readFileSync: vi.fn((p, _encoding) => {
      const entry = files.get(p);
      if (!entry) {
        const err = new Error(`ENOENT: ${p}`);
        err.code = 'ENOENT';
        throw err;
      }
      return entry.content;
    }),

    statSync: vi.fn((p) => {
      const entry = files.get(p);
      if (!entry) {
        const err = new Error(`ENOENT: ${p}`);
        err.code = 'ENOENT';
        throw err;
      }
      return { mtime: entry.mtime, isFile: () => true };
    }),
  };
});

vi.mock('node:fs', () => {
  const fns = {
    readdirSync: mockFs.readdirSync,
    readFileSync: mockFs.readFileSync,
    statSync: mockFs.statSync,
  };
  return { ...fns, default: fns };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function addFile(filePath, content, mtime = new Date(0)) {
  mockFs.files.set(filePath, { content, mtime });
}

function clearAllFiles() {
  mockFs.files.clear();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('shellEnvHook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAllFiles();
    _clearCache();
  });

  // ── 基本调用不抛错 ──────────────────────────────────────────────

  it('基本调用不抛错', () => {
    expect(() => shellEnvHook({ cwd: '/project' }, { env: {} })).not.toThrow();
  });

  // ── 场景 1: env-loader/ 下单文件加载 ────────────────────────────

  it('cwd/.opencode/env-loader/.java-env → output.env.JAVA_HOME 正确注入', () => {
    addFile('/project/.opencode/env-loader/.java-env', 'JAVA_HOME=/usr/lib/jvm/java-17', new Date(1000));

    const output = { env: {} };
    shellEnvHook({ cwd: '/project' }, output);

    expect(output.env.JAVA_HOME).toBe('/usr/lib/jvm/java-17');
  });

  // ── 场景 2: 子目录 cwd 不 walk-up ──────────────────────────────

  it('子目录 cwd → 不扫描父级 env-loader/', () => {
    addFile('/project/.opencode/env-loader/.java-env', 'JAVA_HOME=/usr/lib/jvm/java-17', new Date(1000));

    const output = { env: {} };
    shellEnvHook({ cwd: '/project/src' }, output);

    expect(output.env.JAVA_HOME).toBeUndefined();
  });

  // ── 场景 3: env-loader/ 不存在 → 静默跳过 ──────────────────────

  it('env-loader/ 目录不存在 → output.env 不变', () => {
    const output = { env: {} };
    shellEnvHook({ cwd: '/tmp/empty' }, output);

    expect(output.env).toEqual({});
  });

  // ── 场景 4: 多文件覆盖 (按文件名排序,后者覆盖前者) ──────────────

  it('多文件 → 按文件名排序遍历,后者覆盖前者同名 key', () => {
    addFile('/project/.opencode/env-loader/.aaa-env', 'JAVA_HOME=/old', new Date(1000));
    addFile('/project/.opencode/env-loader/.zzz-env', 'JAVA_HOME=/new', new Date(2000));

    const output = { env: {} };
    shellEnvHook({ cwd: '/project' }, output);

    expect(output.env.JAVA_HOME).toBe('/new');
  });

  // ── 场景 5: 不区分文件名,任意命名都加载 ────────────────────────

  it('任意命名 (database.conf) 也被加载', () => {
    addFile('/project/.opencode/env-loader/database.conf', 'DB_HOST=localhost\nDB_PORT=5432', new Date(1000));

    const output = { env: {} };
    shellEnvHook({ cwd: '/project' }, output);

    expect(output.env.DB_HOST).toBe('localhost');
    expect(output.env.DB_PORT).toBe('5432');
  });

  // ── 场景 6: 缓存命中 ──────────────────────────────────────────────

  it('缓存: 同 cwd+mtime → 命中,不重新读文件', () => {
    addFile('/project/.opencode/env-loader/.java-env', 'JAVA_HOME=/usr/lib/jvm/java-17', new Date(1000));

    const input = { cwd: '/project' };
    const out1 = { env: {} };
    shellEnvHook(input, out1);
    const callCount = mockFs.readFileSync.mock.calls.length;

    const output = { env: {} };
    shellEnvHook(input, output);

    expect(mockFs.readFileSync).toHaveBeenCalledTimes(callCount);
    expect(output.env.JAVA_HOME).toBe('/usr/lib/jvm/java-17');
  });

  // ── 场景 7: 缓存失效 (mtime 变化) ──────────────────────────────

  it('缓存: mtime 变化 → 失效,重新读取文件', () => {
    addFile('/project/.opencode/env-loader/.java-env', 'JAVA_HOME=/old', new Date(1000));

    shellEnvHook({ cwd: '/project' }, { env: {} });

    const entry = mockFs.files.get('/project/.opencode/env-loader/.java-env');
    entry.mtime = new Date(2000);
    entry.content = 'JAVA_HOME=/new';

    const output = { env: {} };
    shellEnvHook({ cwd: '/project' }, output);

    expect(output.env.JAVA_HOME).toBe('/new');
    expect(mockFs.readFileSync).toHaveBeenCalledTimes(2);
  });

  // ── 场景 8: 子目录被跳过 ────────────────────────────────────────

  it('env-loader/ 下的子目录被跳过,文件正常加载', () => {
    const origReaddirSync = mockFs.readdirSync;
    mockFs.readdirSync = vi.fn((dir, options) => {
      if (options && options.withFileTypes && dir === '/project/.opencode/env-loader') {
        return [
          { name: 'prod.env', isFile: () => true, isDirectory: () => false },
          { name: 'subdir', isFile: () => false, isDirectory: () => true },
        ];
      }
      return origReaddirSync(dir, options);
    });

    addFile('/project/.opencode/env-loader/prod.env', 'NODE_ENV=production', new Date(1000));

    const output = { env: {} };
    shellEnvHook({ cwd: '/project' }, output);

    expect(output.env.NODE_ENV).toBe('production');
  });

  // ── 场景 9: $VAR 展开 ────────────────────────────────────────────

  it('$VAR 引用从 process.env 展开', () => {
    process.env.MY_BASE = '/opt/sdk';
    try {
      addFile('/project/.opencode/env-loader/.java-env', 'JAVA_HOME=$MY_BASE/java', new Date(1000));

      const output = { env: {} };
      shellEnvHook({ cwd: '/project' }, output);

      expect(output.env.JAVA_HOME).toBe('/opt/sdk/java');
    } finally {
      delete process.env.MY_BASE;
    }
  });

  // ── 场景 10: 注释与空行忽略 ─────────────────────────────────────

  it('注释行 (#) 和空行被忽略', () => {
    addFile(
      '/project/.opencode/env-loader/.java-env',
      '# 这是注释\n\nJAVA_HOME=/usr/lib/jvm/java-17\n# 另一个注释\n',
      new Date(1000),
    );

    const output = { env: {} };
    shellEnvHook({ cwd: '/project' }, output);

    expect(output.env.JAVA_HOME).toBe('/usr/lib/jvm/java-17');
  });

  // ── 场景 11: 并发安全 ────────────────────────────────────────────

  it('并发: 20 个任务同时调用 → 无 race condition', () => {
    addFile('/project/.opencode/env-loader/.java-env', 'JAVA_HOME=/usr/lib/jvm/java-17', new Date(1000));

    const tasks = Array.from({ length: 20 }, () => {
      const output = { env: {} };
      shellEnvHook({ cwd: '/project' }, output);
      return output;
    });

    for (const r of tasks) {
      expect(r.env.JAVA_HOME).toBe('/usr/lib/jvm/java-17');
    }
  });

  // ── 场景 12: 多个 .*-env 文件全部加载 (典型多语言项目) ──────────

  it('env-loader/ 下多个 .*-env 文件全部加载', () => {
    addFile('/project/.opencode/env-loader/.java-env', 'JAVA_HOME=/opt/java17', new Date(1000));
    addFile('/project/.opencode/env-loader/.node-env', 'NODE_HOME=/opt/node22', new Date(2000));
    addFile('/project/.opencode/env-loader/.python-env', 'PYTHON_HOME=/opt/py312', new Date(3000));

    const output = { env: {} };
    shellEnvHook({ cwd: '/project' }, output);

    expect(output.env.JAVA_HOME).toBe('/opt/java17');
    expect(output.env.NODE_HOME).toBe('/opt/node22');
    expect(output.env.PYTHON_HOME).toBe('/opt/py312');
  });
});