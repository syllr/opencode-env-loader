# opencode-env-loader

OpenCode plugin to auto-load project environment before shell execution.

## Features

- Automatically detects Java/Go/Python/Node development commands
- Injects project-level `.opencode/shellrc` before command execution
- Supports SDKMAN, pyenv, nvm, goenv, and more

## Installation

1. Add to your `opencode.json`:
```json
{
  "plugin": ["opencode-env-loader"]
}
```

2. Create `.opencode/shellrc` in your project root.

3. Restart OpenCode.

## Configuration

Create a `.opencode/shellrc` file in your project with your environment setup.

See `examples/` directory for reference configurations for Java, Go, Python, and Node.

### Java Example (.opencode/shellrc)

```bash
source "$HOME/.sdkman/bin/sdkman-init.sh"
sdk use java 17.0.18-tem
```

### Python Example (.opencode/shellrc)

```bash
source .venv/bin/activate
```

### Go Example (.opencode/shellrc)

```bash
export GOENV_ROOT="$HOME/.goenv"
export PATH="$GOENV_ROOT/bin:$PATH"
eval "$(goenv init -)"
goenv local 1.21
```

### Node Example (.opencode/shellrc)

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 20
```

## How It Works

The plugin hooks into `tool.execute.before` and:
1. Detects if the command is a development tool (java, mvn, go, python, npm, etc.)
2. If yes, prepends the content of `.opencode/shellrc` to the command
3. Adds an AI prompt to ignore the setup commands

## License

MIT
