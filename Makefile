# Context Fabric (public) — developer task runner.
#
# Thin, dependency-free wrappers over the workspace npm scripts and the boundary
# doctor. `make ci` mirrors what the GitHub Actions workflow runs.
#
# This is an npm workspace: install/build/test run at the repo root and fan out
# to packages/* via the root package.json scripts.

.DEFAULT_GOAL := help
.PHONY: help install build test lint doctor ci clean

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*## ' $(MAKEFILE_LIST) \
		| sort \
		| awk 'BEGIN {FS = ":.*## "} {printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'

install: ## Install dependencies (clean, lockfile-faithful)
	npm ci

build: ## Compile all workspace packages to dist/
	npm run build

test: ## Build and run the test suites
	npm test

lint: ## Run ESLint and the Prettier format check
	npm run lint
	npm run format:check

doctor: ## Run the public-boundary & hygiene checks
	bash scripts/doctor.sh

ci: doctor install lint build test ## Full local CI gate: doctor + install + lint + build + test

clean: ## Remove build artifacts
	npm run clean --workspaces --if-present
