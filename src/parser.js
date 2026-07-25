/**
 * 解析 .env 文件内容为键值对对象。
 * @param {string} content - .env 文件内容
 * @returns {Record<string, string>} 解析后的键值对
 */
export function parse(content) {
  const result = {};
  for (const line of content.split('\n')) {
    if (/^\s*#/.test(line) || /^\s*$/.test(line)) continue;
    const m = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let val = m[2];
    val = val.replace(/\$\{([A-Z_][A-Z0-9_]*)\}/g, (_, n) => process.env[n] ?? '');
    val = val.replace(/\$([A-Z_][A-Z0-9_]*)/g, (_, n) => process.env[n] ?? '');
    result[m[1]] = val;
  }
  return result;
}
