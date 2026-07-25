import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { shellEnvHook } from './shell-env.js';

/** 默认扫描的 -env 文件名列表 */
const DEFAULT_SOURCES = ['.java-env', '.node-env', '.python-env', '.go-env'];

/**
 * OpenCode plugin — 自动加载项目环境变量，注入到 shell 子进程。
 * @param {object} [input] - OpenCode plugin 输入 ({ directory, worktree })
 * @param {object} [options] - 配置选项 ({ sources })
 * @returns {Promise<object>} Hooks 对象
 */
export default async function plugin(input = {}, options = {}) {
  // 解析 skills 目录路径（本插件所在 src/ 的同级 skills/ 目录）
  const pluginDir = path.dirname(fileURLToPath(import.meta.url));
  const skillsPath = path.join(path.dirname(pluginDir), 'skills');

  // sources 默认值
  const sources = options.sources ?? DEFAULT_SOURCES;

  return {
    /** config hook — 将 skills 路径注入 OpenCode 配置 */
    config(cfg) {
      const paths = cfg.skills.paths ?? [];
      // 语义去重：已存在 env-loader 相关路径时不再重复添加
      const alreadyHasEnvLoader = paths.some((p) => p.includes('env-loader'));
      if (!alreadyHasEnvLoader) {
        cfg.skills.paths = Array.from(new Set([...paths, skillsPath]));
      }
    },

    /** shell.env hook — 扫描项目 -env 文件，注入环境变量 */
    'shell.env': async (input, output) => {
      shellEnvHook(input, output, { ...options, worktree: input.worktree });
      // 始终注入标记变量，便于下游脚本检测 env-loader 已运行
      output.env.ENV_LOADER_CWD = input.cwd;
    },
  };
}
