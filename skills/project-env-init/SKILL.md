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
- **Python**: `command -v pyenv`。如果成功→走 pyenv 路径（步骤 3 列版本）；如果失败→检查 `.venv/bin/activate` 是否存在。若存在→走 .venv 路径，跳过步骤 3（无需列版本）。若都不存在→报错退出。
- **Go**: `command -v goenv`

全失败则报错退出，告知用户需先安装对应管理器。

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
- Node：`PATH=$HOME/.fnm/node-versions/<所选版本>/installation/bin:$PATH`
- Go：`GOROOT=$(goenv prefix <所选版本>)` + `PATH=$GOROOT/bin:$PATH`

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

## 工具命令参考

| 工具          | 初始化脚本                                  | 列版本                    | 激活                        |
| ------------- | ------------------------------------------- | ------------------------- | --------------------------- |
| Java(SDKMAN)  | `source "$HOME/.sdkman/bin/sdkman-init.sh"` | `sdk list java installed` | `sdk use java <version>`    |
| Node(nvm)     | `source "$HOME/.nvm/nvm.sh"`                | `nvm ls`                  | `nvm use <version>`         |
| Node(fnm)     | `eval "$(fnm env)"`                         | `fnm ls`                  | `fnm use <version>`         |
| Python(pyenv) | `eval "$(pyenv init -)"`                    | `pyenv versions`          | `pyenv local <version>`     |
| Python(.venv) | 无                                          | 仅一个版本                | `source .venv/bin/activate` |
| Go(goenv)     | `eval "$(goenv init -)"`                    | `goenv versions`          | `goenv local <version>`     |

## 限制

- 禁止执行 `npm install`、`pip install`、`go install` 等包安装命令
- 禁止探测 remote/远端版本
- 只在 `.opencode/env-loader/` 下写文件，不修改 `package.json` 或其他项目文件
