// opencode-env-loader - commands.js
// Command whitelist for development tools

// Java family: JVM languages, build tools, Spring, etc.
const JAVA_COMMANDS = new Set([
  "ant", "boot", "gradle", "gradlew", "jar", "java", "javac",
  "javadoc", "javah", "javap", "javaw", "jcmd", "jconsole",
  "jdb", "jdeprscan", "jdeps", "jhat", "jinfo", "jlink",
  "jmap", "jmc", "jmod", "jpackage", "jps", "jrunscript",
  "jshell", "jstack", "jstat", "jvisualvm", "kotlin",
  "kotlinc", "lein", "mvn", "mvnw", "sbt", "scala", "scalac",
  "spring", "groovy", "groovyc", "clojure", "clj",
])

// Go family
const GO_COMMANDS = new Set([
  "go", "gofmt", "goimports", "golangci-lint", "golint",
  "gopls", "gosec", "goreleaser", "gox", "dlv", "delve",
  "air", "realize", "errcheck", "staticcheck", "ginkgo",
  "goconvey", "testify", "gotests", "cobra", "stringer",
  "mockgen", "sqlc", "migrate", "goose",
])

// Python family
const PYTHON_COMMANDS = new Set([
  "python", "python3", "pip", "pip3", "pipenv", "poetry",
  "pdm", "hatch", "flit", "rye", "uv", "pytest", "tox",
  "nox", "black", "ruff", "flake8", "mypy", "pylint",
  "isort", "autopep8", "django", "flask", "fastapi",
  "gunicorn", "uvicorn", "celery", "scrapy", "jupyter",
  "ipython", "conda", "pyenv", "virtualenv", "sphinx",
  "mkdocs", "bandit", "safety", "twine", "coverage",
  "pre-commit", "cookiecutter", "pyright", "pytype",
  "pyre", "unittest", "behave", "locust",
])

// Node / JS / TS family
const NODE_COMMANDS = new Set([
  "node", "npm", "npx", "yarn", "pnpm", "bun", "deno",
  "tsc", "typescript", "ts-node", "tsx", "vite", "webpack",
  "esbuild", "rollup", "parcel", "tsup", "swc", "turbopack",
  "nx", "jest", "vitest", "mocha", "ava", "tap", "cypress",
  "playwright", "puppeteer", "eslint", "prettier", "biome",
  "oxlint", "dprint", "stylelint", "babel", "nodemon",
  "next", "nuxt", "nest", "express", "fastify",
  "tailwindcss", "sass", "postcss", "turbo", "lerna",
  "changeset", "husky", "commitizen", "commitlint",
  "pm2", "forever", "wrangler", "serverless",
])

export {
  JAVA_COMMANDS,
  GO_COMMANDS,
  PYTHON_COMMANDS,
  NODE_COMMANDS,
}
