# Working on Liveline

Liveline is a native macOS app with a Swift Cocoa/WebKit host and a bundled HTML/CSS/JavaScript interface. There are no package dependencies.

## Project layout

- `Sources/main.swift`: macOS host, Notion requests, Keychain storage, and native bridge.
- `Resources/app.js`, `style.css`, `index.html`: interface and game.
- `Resources/logic.js`: shared date, task, and scoring logic.
- `tests/logic.test.js`: Node.js checks.

## Validation

Run `node tests/logic.test.js` for logic changes. On macOS with Xcode Command Line Tools, run `./build.sh` to compile and sign the app. `./build.sh --install` installs and launches it locally.

Linux cloud sessions can edit the source and run the Node.js checks, but cannot build or launch the Cocoa/WebKit app. Report native validation as pending when a Mac is unavailable.

## Personal data

Keep `Resources/snapshot.json` and `build/` gitignored. Do not commit Notion tokens, Keychain contents, or cached personal agenda data. A fresh clone starts without personal tasks. Preserve the app's read-only Notion behavior unless explicitly asked to change it.
