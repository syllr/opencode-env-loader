/**
 * shell.env hook — 在 shell 执行前注入项目级环境变量。
 *
 * @param {{ cwd: string, sessionID?: string, callID?: string }} input
 * @param {{ env: Record<string,string> }} output
 * @param {object} [options]
 */
export function shellEnvHook(input, output, options) {
  throw new Error('not implemented');
}
