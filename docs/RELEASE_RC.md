# Release candidate process

Run `npm run release:check`, confirm GitHub CI, bump `package.json` and exported `VERSION` to the intended RC version, then tag a release candidate such as `v0.2.0-rc.1`. Publish npm only after docs, boundary doctor, and audit are green.
