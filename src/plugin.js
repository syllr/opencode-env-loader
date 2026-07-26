import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { shellEnvHook } from './shell-env.js';

/**
 * OpenCode plugin — 自动加载项目环境变量，注入到 shell 子进程。
 * @returns {Promise<object>} Hooks 对象
 */
export default async function plugin() {
  // 解析 skills 目录路径（本插件所在 src/ 的同级 skills/ 目录）
  const pluginDir = path.dirname(fileURLToPath(import.meta.url));
  const skillsPath = path.join(path.dirname(pluginDir), 'skills');

  return {
    /** config hook — 将 skills 路径注入 OpenCode 配置 */
    config(cfg) {
      cfg.skills = cfg.skills ?? {};
      const paths = cfg.skills?.paths ?? [];
      const alreadyHasEnvLoader = paths.some((p) => p.includes('env-loader'));
      if (!alreadyHasEnvLoader) {
        cfg.skills.paths = Array.from(new Set([...paths, skillsPath]));
      }
    },

    /** shell.env hook — 扫描项目 env-loader/ 目录，注入环境变量 */
    'shell.env': async (input, output) => {
      shellEnvHook(input, output);
      output.env.ENV_LOADER_CWD = input.cwd;
    },
  };
}