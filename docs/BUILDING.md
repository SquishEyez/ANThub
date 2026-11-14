# Building Antelope Hub

The Android app was originally released as a compiled 2.0 APK
(`android/base/wax-hub-2.0.apk`). Version 4.2 is built by taking the web layer
out of that APK and applying the changes in `android/src/`:

- `patches.mjs`: source-level edits to the 2.0 bundle. Each anchor must match exactly once, or the build fails.
- `chain.js` (the network registry) and `chains.jsx` (network picker and per-chain feature rules); `chainify.mjs` rewrites the WAX-specific values in the app code so they follow the active chain.
- `ext.jsx`, `rescue.jsx`, `console.jsx`, `drops.jsx`, `creator.jsx`: the new UI and features. They're injected into the bundle.
- `ext.css`: the style layer.

The build then minifies the result, sets the version to 4.2 (versionCode 8), applies the Antelope Hub branding (`brand.py`: icons and splash screens; `arsc.py`: launcher label),
disables WebView debugging and mixed content, and repacks the APK while
keeping every entry's original compression.

The Linux app (`desktop/`) runs the same web bundle in Electron.

## Requirements

- Node.js 20 or newer, Python 3, `unzip`
- To sign the APK: Android build-tools (`zipalign`, `apksigner`) and your keystore

## Build everything

```bash
./build.sh
```

Outputs:
- `android/dist/antelope-hub-1.0-unsigned.apk` (sign it, see below)
- `android/dist/web/`: the web bundle, which you can serve with any static server to test in a browser
- `desktop/release/antelope-hub-1.0.0-x86_64.AppImage` and `desktop/release/antelope-hub-1.0.0-amd64.deb`

## Sign the APK

```bash
cd android
./sign.sh /path/to/waxhub-release.jks
```

Keep the keystore and its password out of the repository; `.gitignore` already excludes `*.jks`.
Every future release must be signed with the **same key**, or users have to
uninstall before updating.

## Run the Linux app from source

```bash
cd desktop
npm install
npm start
```
