# 更新日志

## v2.0.4 (2026-09-05)

### 新增

#### project-env-init 自动忽略本地环境文件

`env-loader/` 下全是本机绝对路径，提交进 `git` 只会冲突。`skill` 新增第 7 步（所有语言必做）：先判断是否为 `git` 项目，非 `git` 项目跳过；检查项目根 `.gitignore`，缺失则追加 `.opencode/env-loader/` 一行（已含则跳过，只忽略该子目录，不忽略整个 `.opencode/`）。

## v2.0.3 (2026-09-05)

### 新增

#### project-env-init 支持 pyright 诊断配置

`env-loader` 注入的 `VIRTUAL_ENV` 只对 `bash` 工具链生效，内嵌 `pyright` 不读 `shell` 环境变量，缺配置时会回落系统 `Python` 并误报 `Import could not be resolved`。`project-env-init` 新增“各语言额外处理 / Python”子章节：定位第 1 步找到 `pyproject.toml` 的目录，确认 `.venv` 存在且缺 `pyrightconfig.json` / `[tool.pyright]` 时，默认生成与 `.venv` 同级的 `pyrightconfig.json`（固定模板 `{"venvPath": ".", "venv": ".venv"}`），并提醒重启 `opencode` 生效。

## v2.0.2 (2026-07-26)

### 修复

#### README 文档与解析器实际行为对齐

v2.0.1 之前 README 第 34 行错误地声称"同文件内先定义的变量不会被后续行展开"，但 `parser.js` 实际上**支持**同文件内的 `$VAR` / `${VAR}` 引用（先定义变量可被后续行展开，循环引用返回空串）。v2.0.2 更新文档以反映实际行为。

#### 测试文件不再发布到 npm

v2.0.1 包中包含了 `src/parser.test.js`、`src/plugin.test.js`、`src/shell-env.test.js` 共 3 个测试文件（约 16 KB）。v2.0.2 将 `package.json` 的 `files` 字段从 `["src", "skills"]` 改为精确文件列表（`src/index.js`、`src/parser.js`、`src/shell-env.js`、`src/plugin.js`、`skills`、文档），测试文件自动排除，npm 包体积从 10.1 kB 减到 9.6 kB。

#### 补充迁移文档

v2.0.1 包中缺少 `UPGRADING.md` 和 `CHANGELOG.md`（这两个文件在 v2.0.0 发布时尚未加入工作目录）。v2.0.2 将这两个文档纳入 `package.json` 的 `files` 字段。

## v2.0.1 (2026-07-26)

### 变更

#### 统一扫描目录为 `.opencode/env-loader/`

v2.0.0 同时扫描两类位置：

- `cwd/.opencode/{DEFAULT_SOURCES}` — 硬编码的 `.java-env` / `.node-env` / `.python-env` / `.go-env`
- `cwd/.opencode/env-loader/` — 目录下所有文件

v2.0.1 移除第一类扫描，**只扫描 `cwd/.opencode/env-loader/`**。该目录下所有文件均视为 env 文件（命名无限制，命名只是 skill 生成时为人类可读性而设，插件一视同仁）。按文件名字典序遍历，后读覆盖先读。

#### 移除 `sources` 配置项

v2.0.0 允许通过 `sources` 配置项自定义扫描文件名（如 `["opencode-env-loader", { "sources": [".java-env"] }]`）。v2.0.1 移除该配置项，因为 `env-loader/` 目录下文件名本身就不限制。插件入口签名从 `plugin(input, options)` 变为 `plugin()`。

### 迁移

将 v2.0.0 的文件移动到新位置：

```bash
mkdir -p .opencode/env-loader
mv .opencode/.java-env   .opencode/env-loader/   # 如存在
mv .opencode/.node-env   .opencode/env-loader/
mv .opencode/.python-env .opencode/env-loader/
mv .opencode/.go-env     .opencode/env-loader/
```

如果之前用了自定义 `sources` 配置，请移除 `opencode.json` 中的配置参数：

```jsonc
// 旧
{ "plugin": [["opencode-env-loader", { "sources": [".java-env"] }]] }
// 新
{ "plugin": ["opencode-env-loader"] }
```

## v2.0.0 (2026-07-25)

### 破坏性变更（Breaking Changes）

v2.0.0 是一次完全重写，与 v1.x 不兼容。

#### 移除：`tool.execute.before` 钩子

旧版本通过 `tool.execute.before` 钩子拦截每条命令，检测是否为目标开发工具（java、mvn、go、python、npm 等），然后前置注入 `.opencode/shellrc` 内容。这种方式存在以下问题：

- 每条命令都要走一遍白名单匹配，增加额外开销
- 白名单外的命令无法获取环境变量
- `.opencode/shellrc` 中的 alias/function 等 shell 特性无法在非交互 shell 中工作

**替代方案**：使用新的 `shell.env` 钩子，在 shell 进程启动前直接注入环境变量，不拦截命令、不设白名单。

#### 移除：命令白名单

旧版本维护了一个开发工具白名单，只有匹配的命令才会触发环境加载。v2.0.0 不再需要这个白名单，所有 shell 子进程都能获得项目环境变量。

#### 移除：`.opencode/shellrc` 格式

旧版本使用 `.opencode/shellrc` 文件，内容是任意 shell 脚本。新版本改用每个语言一个独立的 `.*-env` 文件（纯 `KEY=VALUE` 格式）：

- `.java-env` — Java 环境变量
- `.node-env` — Node 环境变量
- `.python-env` — Python 环境变量
- `.go-env` — Go 环境变量

#### 新增：`shell.env` 钩子

新的 `shell.env` 钩子在 OpenCode 启动 shell 子进程前触发，自动从当前工作目录的 `.opencode/` 下扫描 `.*-env` 文件，解析其中的 `KEY=VALUE` 对并注入到环境变量中。

#### 新增：`project-env-init` 内置 Skill

v2.0.0 自带了一个 `project-env-init` Skill，可以自动检测项目语言栈和本地版本管理器，交互式引导用户选择版本，提取环境变量差异并生成对应的 `.*-env` 文件。

#### 新增：安装时可配置 sources

安装插件时可以传入 `sources` 选项自定义扫描的文件名列表，不再硬编码。

### 升级指南

请参阅 [UPGRADING.md](UPGRADING.md) 了解从 v1.x 迁移的详细步骤。
