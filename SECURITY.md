# Security policy

## What Antelope Hub can and can't do

- Antelope Hub **never handles private keys or seed phrases**. Signing happens in Anchor or My Cloud Wallet.
- Keys made in **New account** are generated on your device, shown once, and never stored or sent.
- Every transaction is shown to you before your wallet asks you to approve it.
- The Android app only requests the `INTERNET` and `ACCESS_NETWORK_STATE` permissions. Release builds disable WebView remote debugging and plain-HTTP traffic.
- Sign-in uses WharfKit with the Anchor, My Cloud Wallet (WAX) and WebAuth (XPR Network) wallet plugins. The WebAuth plugin is XPR Network's official `@proton/wharfkit-plugin-webauth`, pinned to an exact version in `android/package.json` (with `package-lock.json`). It never sees private keys: the WebAuth app or webauth.com signs.
- NFT pictures come from public IPFS gateways (ipfs.eosdac.io, resizer.atomichub.io, ipfs.alienworlds.io, with ipfs.atomicassets.io and ipfs.io as fallbacks). Like any website, a gateway sees your IP address and which picture it serves. The app loads pictures only when they scroll into view and sends no referrer. Gateway list: `WHIPFS` in `android/src/media.jsx`.
- The Linux app shows the interface in a sandboxed window with no Node.js access. It serves its own files only on `127.0.0.1`, opens other websites in your normal browser, and only allows pop-up windows for wallet sign-in.

## Verifying a download

Each release includes `SHA256SUMS.txt`. The Android APK is signed with the maintainer's release key. Its certificate's SHA-256 fingerprint is:

```
55:D0:33:93:FA:9F:B4:07:D0:3F:CC:0C:0B:04:A3:C7:06:4B:D7:D7:DD:4E:7C:6A:A4:F1:BE:D7:D4:44:78:F8
```

Check it with `apksigner verify --print-certs antelope-hub-<version>.apk` (Android build-tools). The certificate still carries the original name "WAX Hub", because keeping the same key is what lets Antelope Hub update WAX Hub in place. Android refuses to update an installed copy with an APK signed by a different key.

The app's web code can also be rebuilt from this repository (`./build.sh`) and compared with the files inside a release APK. The 1.0 release was checked this way and matches byte for byte.

## Reporting a vulnerability

Please **don't open a public issue** for security problems. Use GitHub's
[private vulnerability reporting](../../security/advisories/new) for this repository instead.
Include steps to reproduce, and the affected version and platform. You'll get a reply as soon as possible.

Never send anyone your private keys, seed phrase or wallet password, including the maintainers.
