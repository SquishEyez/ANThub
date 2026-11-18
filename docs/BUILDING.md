# Building Antelope Hub

Antelope Hub is built from the original **WAX Hub 2.0** Android APK (`android/base/wax-hub-2.0.apk`). The build takes that APK's web app, applies the changes in `android/src/`, and repacks it. The Linux app (`desktop/`) runs the same web bundle in Electron.

## Requirements

- Node.js 20 or newer
- Python 3 with **Pillow** (`pip install pillow`), used to redraw the icons and splash screens
- `unzip`
- To sign the APK: Android build-tools (`zipalign`, `apksigner`) and the release keystore

## Build everything

```bash
./build.sh
```

Outputs:
- `android/dist/antelope-hub-1.1.1-unsigned.apk` (sign it, see below)
- `android/dist/web/`: the web bundle, which you can serve with any static server (`python3 -m http.server -d android/dist/web`) to test in a browser
- `desktop/release/antelope-hub-1.1.1-x86_64.AppImage` and `desktop/release/antelope-hub-1.1.1-amd64.deb`

Android only: `cd android && npm install && npm run build` (or `npm run build:web` for just the web bundle).

## How the build works (`android/build.mjs`)

1. Extract the web bundle from the base APK, and prettify it so patches are stable.
2. Apply `src/patches.mjs`, a list of exact-text edits to the original bundle. Each anchor must match exactly once, or the build stops.
3. Rewrite WAX-only values (symbols, precision, explorers) so they follow the active network (`chainify.mjs`).
4. Inject `src/chain.js` (the network registry), then compile and inject the feature layer: every `src/*.jsx`, plus `src/alcorcheck.js`.
5. Minify, and add `src/ext.css`.
6. Rebrand. `brand.py` redraws icons and splash screens, `arsc.py` sets the launcher label, and `axml.py` sets the version from `android/package.json` (`version` 1.1.1, `androidVersionCode` 14).
7. Repack the APK, keeping every entry's original compression (`repack.py`). WebView debugging and plain-HTTP traffic stay disabled.

### Source files (`android/src/`)

| File | What it is |
|---|---|
| `patches.mjs` | Edits to the original bundle (navigation, tool list, branding, voting rules, safety guards) |
| `chain.js` | Network registry: RPC nodes, APIs, contracts and features per network |
| `chains.jsx` | Network picker and per-network feature rules |
| `ext.jsx`, `ext.css` | Core UX: helpers, sheets, onboarding, quick actions, styles |
| `rescue.jsx` | Rescue & recover scanners |
| `console.jsx` | Contract console |
| `drops.jsx`, `creator.jsx` | Drops and Creator studio (AtomicAssets, with an on-chain reader where there's no indexer) |
| `native.jsx` | Network essentials (REX, RAM, names, XPR staking, Libre) |
| `bridges.jsx` | Bridges, plus Telos Decide voting |
| `account.jsx` | Guided account creation |
| `telos.jsx` | Telos studio |
| `alcor.jsx`, `alcorcheck.js` | Cross-chain (Alcor), plus the on-device deposit-address check |
| `xpr.jsx` | XPR DeFi |
| `qrcode.jsx` | QR codes drawn on the device (vendored qrcode-generator, MIT) |

## Sign the APK

```bash
cd android
./sign.sh /path/to/release-keystore.jks          # key alias: waxhub
```

Keep the keystore and its password out of the repository; `.gitignore` already excludes `*.jks`. Every release must be signed with the **same key** (fingerprint in `SECURITY.md`), or Android won't install it as an update.

## Verify a release against this source

The web app inside a release APK can be rebuilt and compared:

```bash
git checkout <release commit>
./build.sh                       # or: cd android && npm install && npm run build:web
mkdir /tmp/rel && unzip -q antelope-hub-<version>.apk 'assets/*' -d /tmp/rel
diff -r /tmp/rel/assets/public android/dist/web && echo identical
```

## Test transactions without sending them

`tests/dryrun/` runs any transaction against a network's current state with `compute_transaction`, without signing or broadcasting it. See its README.

## Run the Linux app from source

```bash
cd android && npm install && npm run build:web && cd ..
rm -rf desktop/web && cp -r android/dist/web desktop/web
cd desktop && npm install && npm start
```
