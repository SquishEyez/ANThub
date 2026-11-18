# Third-party notices

Antelope Hub includes or is built with these open-source components. Each remains under its own licence.

| Component | Licence | Used in |
|---|---|---|
| [React](https://github.com/facebook/react) | MIT | App UI |
| [Capacitor](https://github.com/ionic-team/capacitor) (core, app, status-bar) | MIT | Android shell |
| [Wharfkit Session, Cloud Wallet and Anchor plugins](https://github.com/wharfkit) | BSD-3-Clause | Wallet sign-in and signing |
| [@wharfkit/antelope](https://github.com/wharfkit/antelope) | BSD-3-Clause (No Military License) | Antelope serialization |
| [@proton/wharfkit-plugin-webauth](https://github.com/XPRNetwork/wharfkit-plugin-webauth) 1.1.0 | BSD-3-Clause | WebAuth sign-in on XPR Network |
| Bundled with it: Wharfkit session, protocol-esr, sealed-messages, abicache, common ([wharfkit](https://github.com/wharfkit)); [@greymass/buoy](https://github.com/greymass/buoy-client), @greymass/miniaes | BSD-3-Clause | WebAuth sign-in |
| Bundled with it: @wharfkit/signing-request, elliptic, bn.js, hash.js, hmac-drbg, brorand, eventemitter3, isomorphic-ws | MIT | WebAuth sign-in |
| Bundled with it: pako | MIT and Zlib | WebAuth sign-in |
| Bundled with it: tslib | 0BSD | WebAuth sign-in |
| Bundled with it: inherits, minimalistic-assert | ISC | WebAuth sign-in |
| AndroidX libraries | Apache-2.0 | Android shell |
| [Electron](https://github.com/electron/electron) and Chromium | MIT, BSD and others (`LICENSES.chromium.html` ships inside the Linux app) | Linux app |
| [esbuild](https://github.com/evanw/esbuild), [Prettier](https://github.com/prettier/prettier) | MIT | Build tooling only |
| [electron-builder](https://github.com/electron-userland/electron-builder) | MIT | Build tooling only |

Data comes from public RPC and Hyperion nodes of each network, the AtomicAssets API, the Delphi and XPR oracles, the Metal X API, the Alcor API, and public IPFS gateways for NFT pictures. QR codes are drawn on the device.

## qrcode-generator 1.4.4

Copyright (c) 2009 Kazuhiko Arase. MIT License. Vendored in `android/src/qrcode.jsx` (UMD wrapper removed) to draw QR codes on the device.
