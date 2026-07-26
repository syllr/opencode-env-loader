# 升级指南

本指南覆盖两个迁移路径：

- [v1 → v2 升级指南](#v1--v2-升级指南)（从 v1.x 升级）
- [v2.0.0 → v2.0.1 迁移指南](#v200--v201-迁移指南)（小版本内行为变更）

---

## v1 → v2 升级指南

### 概述

v2.0.0 是一次完全重写。如果你从 v1.x 升级，需要手动迁移环境配置。整个迁移过程大约需要 5 分钟。

### 迁移步骤

#### 步骤 1：删除旧的 `.opencode/shellrc` 文件

v2.0.0 不再支持 `.opencode/shellrc` 格式。请删除项目根路径下的这个文件：

```bash
rm .opencode/shellrc
```

如果文件在 `.opencode/` 目录中：

```bash
rm -rf .opencode/shellrc
```

#### 步骤 2：更新 `opencode.json` 配置

在 `opencode.json` 中添加插件：

```json
{
  "plugin": ["opencode-env-loader"]
}
```

#### 步骤 3：生成 `.opencode/env-loader/` 下的 env 文件

v2 起所有 env 文件统一放在 `.opencode/env-loader/` 子目录下（命名只是为人类可读性，插件对所有文件一视同仁）。

有两种方式生成：

##### 方式 A：使用 `project-env-init` Skill（推荐）

在 OpenCode 中运行：

```
/skill project-env-init
```

Skill 会自动完成：

1. 检测项目类型（Java / Node / Python / Go）
2. 检测本地已安装的版本管理器（SDKMAN / fnm / nvm / pyenv / goenv）
3. 列出本地可用版本供你选择
4. 提取环境变量差异
5. 生成对应的 `.opencode/env-loader/.java-env`（或对应语言）文件

##### 方式 B：手动创建 env 文件

手动在 `.opencode/env-loader/` 下创建文件，每行一个 `KEY=VALUE` 对，支持 `$VAR` 和 `${VAR}` 引用。

Java 示例（`.opencode/env-loader/.java-env`）：

```bash
JAVA_HOME=$HOME/.sdkman/candidates/java/17.0.18-tem
PATH=$JAVA_HOME/bin:$PATH
```

Python 示例（`.opencode/env-loader/.python-env`）：

```bash
PATH=$HOME/.pyenv/versions/3.12.0/bin:$PATH
```

Node 示例（`.opencode/env-loader/.node-env`）：

```bash
PATH=$HOME/.fnm/current/bin:$PATH
```

Go 示例（`.opencode/env-loader/.go-env`）：

```bash
GOROOT=$HOME/.goenv/versions/1.22.0
PATH=$HOME/.goenv/versions/1.22.0/bin:$PATH
```

任意命名的自定义文件（`.opencode/env-loader/database.conf`）：

```bash
DB_HOST=localhost
DB_PORT=5432
```

#### 步骤 4：重启 OpenCode

关闭并重新启动 OpenCode，使新的插件配置和 `shell.env` 钩子生效。

### 验证

重启后，在项目目录中执行 `echo $JAVA_HOME`（或对应的环境变量），确认环境变量已正确加载。

### 回滚

如果升级后遇到问题，可以回退到 v1.x：

1. 删除 `.opencode/env-loader/` 目录
2. 恢复之前删除的 `.opencode/shellrc` 文件
3. 将 `opencode.json` 中的插件配置回退到旧版本
4. 重新安装 v1.x 版本的插件

---

## v2.0.0 → v2.0.1 迁移指南

### 概述

v2.0.1 统一了扫描目录：**只扫描 `cwd/.opencode/env-loader/`**，不再扫描 `cwd/.opencode/.{java,node,python,go}-env`。同时移除了 `sources` 配置项。如果你是从 v2.0.0 升级，需要做两步迁移。

### 迁移步骤

#### 步骤 1：移动已有的 env 文件到 `env-loader/` 子目录

v2.0.0 兼容两种位置：

- `cwd/.opencode/.java-env` 等
- `cwd/.opencode/env-loader/*.env`

v2.0.1 只看后者。如果你的项目已经在 v2.0.0 把文件放在了 `cwd/.opencode/` 根目录下，需要移动它们：

```bash
mkdir -p .opencode/env-loader
mv .opencode/.java-env   .opencode/env-loader/   # 如存在
mv .opencode/.node-env   .opencode/env-loader/   # 如存在
mv .opencode/.python-env .opencode/env-loader/   # 如存在
mv .opencode/.go-env     .opencode/env-loader/   # 如存在
```

迁移完成后，`.opencode/` 下应该只剩下 `env-loader/` 子目录。

#### 步骤 2：从 `opencode.json` 中移除 `sources` 配置

v2.0.1 不再支持 `sources` 配置项。`opencode.json` 中的配置必须从：

```jsonc
// 旧 (v2.0.0)
{
  "plugin": [["opencode-env-loader", { "sources": [".java-env", ".node-env"] }]],
}
```

简化为：

```jsonc
// 新 (v2.0.1+)
{
  "plugin": ["opencode-env-loader"],
}
```

如果保留了旧配置，插件不会报错，但 `sources` 参数会被静默忽略——所有 env-loader/ 下的文件都会被加载。

#### 步骤 3：重启 OpenCode

关闭并重新启动 OpenCode。重启后 `echo $JAVA_HOME`（或对应变量）应返回正确值。

### 回滚

如果升级后遇到问题，可以回退到 v2.0.0：

1. 恢复文件位置：`mv .opencode/env-loader/*.env .opencode/`（注意：v2.0.0 同时识别两个位置）
2. 恢复 `opencode.json` 配置中的 `sources` 选项
3. `npm install -g opencode-env-loader@2.0.0`
