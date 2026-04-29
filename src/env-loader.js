import { existsSync, readFileSync } from "fs"
import { join } from "path"
import { JAVA_COMMANDS, GO_COMMANDS, PYTHON_COMMANDS, NODE_COMMANDS } from "./commands.js"

const ALL_DEV_COMMANDS = new Set([
  ...JAVA_COMMANDS, ...GO_COMMANDS,
  ...PYTHON_COMMANDS, ...NODE_COMMANDS,
])

const SKIP_PREFIX = new Set(["sudo", "nohup", "time", "npx", "command"])
const SEPARATOR = /\s*(?:&&|\|\||;|\|)\s*/

function extractCommand(segment) {
  let s = segment.trim()
  if (!s) return null
  s = s.replace(/^\w+=\S+\s*/, "").trim()
  if (!s) return null
  let firstWord = s.split(/\s+/)[0]
  while (firstWord && SKIP_PREFIX.has(firstWord)) {
    s = s.slice(firstWord.length).trim()
    if (!s) return null
    firstWord = s.split(/\s+/)[0]
  }
  let cmd = s.split(/\s+/)[0]
  cmd = cmd.replace(/^\.\//, "")
  cmd = cmd.split("/").pop()
  return cmd || null
}

function needsShellRc(command) {
  if (!command || typeof command !== "string") return false
  const segments = command.split(SEPARATOR)
  if (segments.length === 0) return false
  for (const seg of segments) {
    const cmd = extractCommand(seg)
    if (cmd && ALL_DEV_COMMANDS.has(cmd)) return true
  }
  return false
}

const AI_PROMPT = `# AUTO-INJECTED: Ignore these environment setup commands, just focus on the original user command.
`.trim()

export const EnvLoaderPlugin = async ({ directory }) => {
  return {
    "tool.execute.before": async (input, output) => {
      if (input.tool !== "bash") return
      if (!output.args?.command) return

      const rcPath = join(directory, ".opencode/shellrc")
      if (!existsSync(rcPath)) return

      const cmd = output.args.command
      if (!needsShellRc(cmd)) return

      try {
        const rcContent = readFileSync(rcPath, "utf-8")
        output.args.command = `${rcContent.trim()}\n\n${AI_PROMPT}\n\n${cmd}`
      } catch { /* 读取失败静默跳过 */ }
    },
  }
}

export { needsShellRc, extractCommand }
