# Manual Update (No npx)

When npm access is unavailable, install directly from source.

```bash
git pull --rebase
node bin/install.js --all --local --target /path/to/project --verify
```

OpenCode-only update:

```bash
node bin/install.js --opencode --local --target /path/to/project --verify
```

Uninstall:

```bash
node bin/install.js --all --local --target /path/to/project --uninstall --verify
```
