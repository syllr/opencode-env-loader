import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'node:path';
import { shellEnvHook } from './shell-env.js';

// ---------------------------------------------------------------------------
// Mock filesystem — state shared across tests via vi.hoisted
// ---------------------------------------------------------------------------

const mockFs = vi.hoisted(() => {
  // filePath -> { content: string, mtime: Date }
  const files = new Map();

  return {
    files,

    readdirSync: vi.fn((dir) => {
      const entries = [];
      for (const p of files.keys()) {
        if (path.dirname(p) === dir) {
          entries.push(path.basename(p));
        }
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

    existsSync: vi.fn((p) => files.has(p)),
  };
});

vi.mock('node:fs', () => {
  const fns = {
    readdirSync: mockFs.readdirSync,
    readFileSync: mockFs.readFileSync,
    statSync: mockFs.statSync,
    existsSync: mockFs.existsSync,
  };
  return { ...fns, default: fns };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Register a virtual file in the mock filesystem. */
function addFile(filePath, content, mtime = new Date(0)) {
  mockFs.files.set(filePath, { content, mtime });
}

function clearAllFiles() {
  mockFs.files.clear();
}

// ---------------------------------------------------------------------------
// Tests — TDD RED: all behavioural tests fail with "not implemented"
// ---------------------------------------------------------------------------

describe('shellEnvHook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAllFiles();
  });

  // ── 确认 stub 存在 ────────────────────────────────────────────────

  it('stub: 未实现时抛出 not implemented', () => {
    expect(() => shellEnvHook({ cwd: '/project' }, { env: {} })).toThrow('not implemented');
  });

  // ── 场景 1: cwd 下有 .java-env ────────────────────────────────────

  it('cwd/.java-env → output.env.JAVA_HOME 正确注入', () => {
    addFile('/project/.java-env', 'JAVA_HOME=/usr/lib/jvm/java-17', new Date(1000));

    const output = { env: {} };
    // RED: 以下调用抛出 "not implemented"，测试失败
    shellEnvHook({ cwd: '/project' }, output);

    // 实现后: expect(output.env.JAVA_HOME).toBe('/usr/lib/jvm/java-17');
  });

  // ── 场景 2: walk-up ───────────────────────────────────────────────

  it('walk-up 从子目录到 worktree 根找到 -env 文件', () => {
    addFile('/project/.java-env', 'JAVA_HOME=/usr/lib/jvm/java-17', new Date(1000));

    const output = { env: {} };
    shellEnvHook({ cwd: '/project/src' }, output);

    // 实现后: expect(output.env.JAVA_HOME).toBe('/usr/lib/jvm/java-17');
  });

  // ── 场景 3: 找不到任何 -env 文件 ──────────────────────────────────

  it('无 -env 文件 → output.env 不变', () => {
    const output = { env: {} };
    shellEnvHook({ cwd: '/tmp/empty' }, output);

    // 实现后: expect(output.env).toEqual({});
  });

  // ── 场景 4: 两个 -env 文件覆盖 ────────────────────────────────────

  it('两个 -env 文件 → 后读的覆盖先读的同名 key', () => {
    addFile('/project/.base-env', 'JAVA_HOME=/old/java', new Date(1000));
    addFile('/project/.java-env', 'JAVA_HOME=/new/java', new Date(2000));

    const output = { env: {} };
    shellEnvHook({ cwd: '/project' }, output);

    // 实现后: expect(output.env.JAVA_HOME).toBe('/new/java');
  });

  // ── 场景 5: 缓存命中 ──────────────────────────────────────────────

  it('缓存: 同 cwd+mtime → 命中，不重新读文件', () => {
    addFile('/project/.java-env', 'JAVA_HOME=/usr/lib/jvm/java-17', new Date(1000));

    const input = { cwd: '/project' };
    // 第 1 次调用
    shellEnvHook(input, { env: {} });
    // const callCount = mockFs.readFileSync.mock.calls.length;
    // 第 2 次调用 → 应走缓存
    const output = { env: {} };
    shellEnvHook(input, output);

    // 实现后: expect(mockFs.readFileSync).toHaveBeenCalledTimes(callCount);
    // expect(output.env.JAVA_HOME).toBe('/usr/lib/jvm/java-17');
  });

  // ── 场景 6: 缓存失效 ──────────────────────────────────────────────

  it('缓存: mtime 变化 → 失效，重新读取文件', () => {
    addFile('/project/.java-env', 'JAVA_HOME=/old', new Date(1000));

    // 第 1 次调用
    shellEnvHook({ cwd: '/project' }, { env: {} });

    // 模拟文件变更
    const entry = mockFs.files.get('/project/.java-env');
    entry.mtime = new Date(2000);
    entry.content = 'JAVA_HOME=/new';

    // 第 2 次调用 → 应重新读取
    const output = { env: {} };
    shellEnvHook({ cwd: '/project' }, output);

    // 实现后:
    // expect(output.env.JAVA_HOME).toBe('/new');
    // expect(mockFs.readFileSync).toHaveBeenCalledTimes(2);
  });

  // ── 场景 7: 并发安全 ──────────────────────────────────────────────

  it('并发: 20 个任务同时调用 → 无 race condition', async () => {
    addFile('/project/.java-env', 'JAVA_HOME=/usr/lib/jvm/java-17', new Date(1000));

    const tasks = Array.from({ length: 20 }, () => {
      const output = { env: {} };
      // RED: 以下调用抛出 "not implemented"
      shellEnvHook({ cwd: '/project' }, output);
      return output;
    });

    // 实现后如果 hook 是 async:
    // const results = await Promise.all(tasks);
    // for (const r of results) {
    //   expect(r.env.JAVA_HOME).toBe('/usr/lib/jvm/java-17');
    // }
  });
});
