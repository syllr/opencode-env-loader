import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { parse } from './parser.js';

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------

/** C6: 缓存上限 */
const MAX_CACHE_SIZE = 500;

/**
 * 缓存结构:
 *   key   → `${cwd}|${filePath}`
 *   value → { mtime: number, raw: string, parsed: Record<string,string>, refVars: string[], refHash: string }
 * 命中条件: mtime 一致 且 基于缓存 refVars 重算的 refHash 与缓存 refHash 一致。
 */
const cache = new Map();

// ---------------------------------------------------------------------------
// 辅助函数
// ---------------------------------------------------------------------------

function refVarsList(content) {
  const vars = new Set();
  for (const m of content.matchAll(/\$(?:\{([A-Z_][A-Z0-9_]*)\}|([A-Z_][A-Z0-9_]*))/g)) {
    vars.add(m[1] || m[2]);
  }
  return [...vars].sort();
}

function hashRefVars(vars) {
  if (vars.length === 0) return '';
  const h = createHash('sha256');
  for (const v of vars) h.update(`${v}=${process.env[v] ?? ''}\0`);
  return h.digest('hex').slice(0, 16);
}

// ---------------------------------------------------------------------------
// Hook 主体
// ---------------------------------------------------------------------------

/**
 * shell.env hook — 扫描 cwd/.opencode/env-loader/ 下的所有文件，
 * 解析后增量注入 output.env，并缓存解析结果。
 *
 * 文件命名无限制（命名只是 skill 生成时为人类可读性而设，
 * 插件对所有文件一视同仁）。后读覆盖先读（按文件名排序后遍历）。
 */
export function shellEnvHook(input, output) {
  const { cwd } = input;
  const envLoaderDir = path.join(cwd, '.opencode', 'env-loader');

  let entries;
  try {
    entries = readdirSync(envLoaderDir, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (e) {
    // 目录不存在或权限不足 → 静默跳过
    if (e.code === 'ENOENT' || e.code === 'EACCES') return;
    throw e;
  }

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const fp = path.join(envLoaderDir, entry.name);
    try {
      const mtime = statSync(fp).mtime.getTime();
      const key = `${cwd}|${fp}`;
      const cached = cache.get(key);

      if (cached && cached.mtime === mtime && cached.refHash === hashRefVars(cached.refVars)) {
        Object.assign(output.env, cached.parsed);
        continue;
      }

      const raw = readFileSync(fp, 'utf-8');
      const parsed = parse(raw);
      const refVars = refVarsList(raw);
      if (cache.size > MAX_CACHE_SIZE) cache.clear();
      cache.set(key, { mtime, raw, parsed, refVars, refHash: hashRefVars(refVars) });
      Object.assign(output.env, parsed);
    } catch (e) {
      if (e.code === 'ENOENT' || e.code === 'EACCES') continue;
      throw e;
    }
  }
}

/** 仅供测试：清空解析缓存。 */
export function _clearCache() {
  cache.clear();
}