# Quickstart

```bash
cd packages/sdk
npm install
npm test
npm run build
node dist/src/cli.js doctor --config ../../examples/fabric.config.json
node dist/src/cli.js assemble --query "onboard support" --project acme-shop --channel "#acme-shop" --chunks ../../examples/chunks.json --config ../../examples/fabric.config.json
```
