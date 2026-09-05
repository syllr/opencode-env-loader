---
name: project-env-init
description: 检测项目需要的开发语言和版本管理器，在 .opencode/env-loader/ 目录下生成对应的 env 文件。当项目缺少环境变量配置时使用。Use when setting up environment for a new project, env-loader files are missing or outdated, or asking to initialize project environment.
---

# project-env-init

检测当前项目使用的语言栈和本地已安装的版本管理器，引导用户选择版本，提取环境变量差异，在 `.opencode/env-loader/` 下生成 env 文件。

## 文件位置与命名

所有生成的文件统一放在：

```
<项目根>/.opencode/env-loader/
```

文件名按语言取可读名（仅供人类辨识，插件对所有文件一视同仁）：

| 语言   | 文件                               |
| ------ | ---------------------------------- |
| Java   | `.opencode/env-loader/.java-env`   |
| Node   | `.opencode/env-loader/.node-env`   |
| Python | `.opencode/env-loader/.python-env` |
| Go     | `.opencode/env-loader/.go-env`     |

## 流程

### 1. 检测项目类型

用 `Read` 工具在项目根目录查找标记文件，确定项目语言：

| 文件             | 语言   |
| ---------------- | ------ |
| `pom.xml`        | Java   |
| `package.json`   | Node   |
| `pyproject.toml` | Python |
| `go.mod`         | Go     |

如果命中多个，按上表顺序取第一个。一个都没命中则报错退出。

### 2. 检测已安装工具

用 Bash `command -v` 检查对应语言的版本管理器是否可用：

- **Java**: `command -v sdk`
- **Node**: `command -v fnm`，失败则退 `command -v nvm`
- **Python**: `command -v pyenv`。如果成功→走 pyenv 路径（步骤 3 列版本）；如果失败→检查项目根 `.venv/bin/activate` 是否存在。若存在→走 .venv 路径，跳过步骤 3 和步骤 4（仅一个解释器，无需列版本、无需选择）。若都不存在→报错退出。
- **Go**: `command -v goenv`

全失败则报错退出，告知用户需先安装对应管理器。注意：`command -v` 失败可能是初始化脚本未加载（如 `sdk` 需先 source SDKMAN），先按“工具命令参考”表 source 对应初始化脚本后复检，仍失败才判为未安装。

### 3. 列已安装版本

用 Bash 列出本地可用版本（仅本地不探测远端）。各命令输出格式不同，解析指引如下：

```bash
# Java (SDKMAN)
source "$HOME/.sdkman/bin/sdkman-init.sh" && sdk list java installed
# 输出格式示例：多列表格，版本号在第二列，选中行有 >>> 标记
# 解析：用 awk '/^\s*[>]*\s*[\d]/ {print $2}' 或手动取每行第二列为版本号

# Node (fnm)
eval "$(fnm env)" && fnm ls
# 输出格式示例：每行一个版本，当前版本前有 * 标记
# 解析：去掉 * 和空白，取第一列为版本号

# Python (pyenv)
eval "$(pyenv init -)" && pyenv versions
# 输出格式示例：每行一个版本，当前版本前有 * 标记
# 解析：去掉 * 和空白，取第一列为版本号

# Python (.venv)
# 无需列版本。如需获知版本号：source .venv/bin/activate && python --version
# 取输出的第二字段（如 Python 3.12.0 → 版本号 3.12.0）

# Go (goenv)
eval "$(goenv init -)" && goenv versions
# 输出格式示例：每行一个版本，当前版本前有 * 标记
# 解析：去掉 * 和空白，取第一列为版本号
```

将输出展示给用户。

### 4. 用户选版本

用 `question` 工具让用户从第 3 步列出的版本中选择一个。格式示例：

```
检测到 Java 项目，本地可用版本：
  17.0.18-tem
  21.0.6-tem
请选择你想使用的版本：
```

选择后记录版本字符串。

### 5. 抓环境变量差异

用 Bash 执行：先跑 `env` 抓快照，再 source 初始化脚本 + 激活目标版本，再次跑 `env` 抓快照，用 `diff` 提取差异环境变量。

```bash
# 快照 1：当前环境
env | sort > /tmp/env_before.txt

# 初始化 + 激活
source "$HOME/.sdkman/bin/sdkman-init.sh" && sdk use java 17.0.18-tem

# 快照 2：激活后
env | sort > /tmp/env_after.txt

# 提取新增或变更的变量
diff /tmp/env_before.txt /tmp/env_after.txt | grep '^>' | sed 's/^> //'
```

将输出中的差异变量整理为 `KEY=VALUE` 格式。

如果 `diff` 无输出（即版本切换前后环境变量无变化），不要写空文件。此时根据语言类型写入最小必要变量，路径从第 3/4 步选中的版本推导：

- Java：`JAVA_HOME=$HOME/.sdkman/candidates/java/<所选版本>` + `PATH=$JAVA_HOME/bin:$PATH`
- Python：`VIRTUAL_ENV=<项目根>/.venv` + `PATH=$VIRTUAL_ENV/bin:$PATH`
- Node：`PATH=$HOME/.fnm/node-versions/<所选版本>/installation/bin:$PATH`（`nvm` 用户则为 `PATH=$HOME/.nvm/versions/node/<所选版本>/bin:$PATH`）
- Go：先执行 `goenv prefix <所选版本>` 取字面绝对路径，再写入 `GOROOT=<绝对路径>` + `PATH=$GOROOT/bin:$PATH`（勿把 `$(...)` 原样写入文件，插件不支持命令替换）

### 6. 写 env-loader/ 文件

**目录检查**：确保 `.opencode/env-loader/` 目录存在，不存在则创建 `mkdir -p .opencode/env-loader`。

**可重入性检查**：用 `Read` 检查目标文件是否已存在（如 `.opencode/env-loader/.java-env`）。如果存在，用 `question` 询问用户是否覆盖：

```
.opencode/env-loader/.java-env 已存在，是否覆盖？（yes/no）
```

- yes → 覆盖写入
- no → 跳过，保持原文件不变

将第 5 步提取的环境变量整理为 `KEY=VALUE` 格式，用 `Write` 工具写入：

| 语言   | 文件路径                           |
| ------ | ---------------------------------- |
| Java   | `.opencode/env-loader/.java-env`   |
| Node   | `.opencode/env-loader/.node-env`   |
| Python | `.opencode/env-loader/.python-env` |
| Go     | `.opencode/env-loader/.go-env`     |

Java (SDKMAN) 示例（`.opencode/env-loader/.java-env`）：

```bash
JAVA_HOME=/Users/user/.sdkman/candidates/java/17.0.18-tem
PATH=$JAVA_HOME/bin:$PATH
```

Python (pyenv) 示例（`.opencode/env-loader/.python-env`）：

```bash
PATH=/Users/user/.pyenv/versions/3.12.0/bin:$PATH
```

Node (fnm) 示例（`.opencode/env-loader/.node-env`）：

```bash
PATH=$HOME/.fnm/current/bin:$PATH
```

Go (goenv) 示例（`.opencode/env-loader/.go-env`）：

```bash
GOROOT=/Users/user/.goenv/versions/1.22.0
PATH=$GOROOT/bin:$PATH
```

### 7. 忽略本地环境文件（所有语言必做）

背景：`env-loader/` 下全是本机绝对路径（如 `/Users/xxx/...`、`$HOME/...`），换台机器即失效，提交进 `git` 只会造成冲突与泄漏，必须忽略。

步骤：

1. 先判断是否为 `git` 项目：用 `Read` 检查项目根是否存在 `.git` 目录（或用 `Bash` 执行 `git rev-parse --is-inside-work-tree`）。非 `git` 项目直接跳过本步骤。
2. 用 `Read` 检查项目根 `.gitignore` 是否存在，不存在则新建（内容直接写 `.opencode/env-loader/` 一行）。
3. 用 `Grep` 检查是否已含 `env-loader` 忽略规则（匹配 `.opencode/env-loader` 即可）。已含则跳过，不重复追加。
4. 缺失则向 `.gitignore` 末尾追加一行（保留末尾换行）：

   ```
   .opencode/env-loader/
   ```

   只忽略该子目录，不忽略整个 `.opencode/`（后者可能含需提交的共享配置）。

## 各语言额外处理

主流程（步骤 1–7）结束后，按第 1 步命中的语言执行对应子章节。无对应子章节的语言直接结束。目前仅有 `Python`：

### Python：pyright 诊断配置

背景：`env-loader` 注入的 `VIRTUAL_ENV` 只对 `bash` 工具链生效，`opencode serve` 内嵌的 `pyright` 不读 `shell` 环境变量，只通过配置文件定位解释器。若缺配置，`pyright` 会回落到系统 `Python`（如 `/Library/Frameworks/...`），报 `Import "pydantic_settings" could not be resolved` 之类错误。

1. **定位 Python 项目目录**：第 1 步找到 `pyproject.toml` 的目录即为 Python 项目目录（通常就是项目根）。下文记为 `<pyproj>`。注意：若 Python 项目在子目录（如 `backend/`）而项目根无 `pyproject.toml`，第 1 步无法命中 Python，本子章节不执行。
2. **检查 `.venv`**：用 `Read` 确认 `<pyproj>/.venv/bin/activate`（或 `<pyproj>/.venv` 目录）是否存在。不存在则跳过本子章节（`pyenv` 全局解释器场景无需配置）。
3. **检查已有配置**：用 `Read` 检查 `<pyproj>/pyrightconfig.json` 是否存在；用 `Grep` 检查 `<pyproj>/pyproject.toml` 是否已含 `[tool.pyright]`。任一存在即视为已配置，直接跳过，不覆盖、不追加。
4. **缺失则生成，二选一**：默认生成 `<pyproj>/pyrightconfig.json`（不污染已有 `pyproject.toml`，无需解析 `TOML`，最安全）。仅当用户明确要求时，才改为向 `pyproject.toml` 追加 `[tool.pyright]` 节。二者生效等价，不可同时写（写一个即可）。

   `pyrightconfig.json` 固定模板（`venvPath` 是相对配置文件自身解析的，贴着 `venv` 放则 `"."` 恒正确，与项目层级无关）：

   ```json
   {
     "venvPath": ".",
     "venv": ".venv"
   }
   ```

   `pyproject.toml` 等价写法（用户明确要求时才用）：

   ```toml
   [tool.pyright]
   venvPath = "."
   venv = ".venv"
   ```

   **可重入性**：第 3 步已确认配置缺失，生成时直接写入，无需再问是否覆盖（`pyproject.toml` 追加场景亦然，该节不存在才追加）。

5. **提醒重启**：配置只在 `opencode serve` 启动时读一次，运行时新建不生效。生成后必须告知用户重启 `opencode` 才生效，并建议用任意 `Python` 文件编辑触发一次诊断验证（报错消失即成功）。

## 工具命令参考

| 工具          | 初始化脚本                                  | 列版本                    | 激活                                                            |
| ------------- | ------------------------------------------- | ------------------------- | --------------------------------------------------------------- |
| Java(SDKMAN)  | `source "$HOME/.sdkman/bin/sdkman-init.sh"` | `sdk list java installed` | `sdk use java <version>`                                        |
| Node(nvm)     | `source "$HOME/.nvm/nvm.sh"`                | `nvm ls`                  | `nvm use <version>`                                             |
| Node(fnm)     | `eval "$(fnm env)"`                         | `fnm ls`                  | `fnm use <version>`                                             |
| Python(pyenv) | `eval "$(pyenv init -)"`                    | `pyenv versions`          | `pyenv shell <version>`（仅当前 shell，不写 `.python-version`） |
| Python(.venv) | 无                                          | 仅一个版本                | `source .venv/bin/activate`                                     |
| Go(goenv)     | `eval "$(goenv init -)"`                    | `goenv versions`          | `goenv shell <version>`（仅当前 shell，不写 `.go-version`）     |

## 限制

- 禁止执行 `npm install`、`pip install`、`go install` 等包安装命令
- 禁止探测 remote/远端版本
- 只在 `.opencode/env-loader/` 下写文件，不修改 `package.json` 或其他项目文件。唯一例外：“各语言额外处理 / Python”允许在 Python 项目目录（`<pyproj>/`，与 `.venv` 同级）新建 `pyrightconfig.json`，或经用户明确要求后追加 `pyproject.toml` 的 `[tool.pyright]` 节；第 7 步允许新建或追加项目根 `.gitignore`（仅追加 `.opencode/env-loader/` 一行）
