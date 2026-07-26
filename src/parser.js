/**
 * 解析 .env 文件内容为键值对对象。
 * @param {string} content - .env 文件内容
 * @returns {Record<string, string>} 解析后的键值对
 */
export function parse(content) {
  const lines = content.split('\n');
  const raw = {};

  // 第一趟：收集所有 KEY=rawValue（不做展开）
  for (const line of lines) {
    if (/^\s*#/.test(line) || /^\s*$/.test(line)) continue;
    const m = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    raw[m[1]] = m[2];
  }

  // 第二趟：递归展开 $VAR / ${VAR}
  // - 直接自引用（KEY=$KEY）→ 从 process.env 取值
  // - 间接循环引用（A=$B, B=$A）→ 返回空串
  // - 文件内优先于 process.env
  const resolved = {};

  function resolve(key, stack = new Set()) {
    if (key in resolved) return resolved[key];
    const val = raw[key];
    if (val === undefined) return process.env[key] ?? '';
    if (stack.has(key)) return '';

    stack.add(key);
    const result = val
      .replace(/\$\{([A-Z_][A-Z0-9_]*)\}/g, (_, n) => {
        if (n === key) return process.env[n] ?? '';
        if (stack.has(n)) return '';
        if (n in raw) return resolve(n, new Set(stack));
        return process.env[n] ?? '';
      })
      .replace(/\$([A-Z_][A-Z0-9_]*)/g, (_, n) => {
        if (n === key) return process.env[n] ?? '';
        if (stack.has(n)) return '';
        if (n in raw) return resolve(n, new Set(stack));
        return process.env[n] ?? '';
      });
    resolved[key] = result;
    return result;
  }

  for (const key of Object.keys(raw)) {
    resolve(key);
  }

  return resolved;
}
