# Changelog

## 1.2.0: Metal X trading, WebAuth sign-in, working PowerUp

- **Sign in with WebAuth on XPR Network.** WebAuth now sits next to Anchor on the sign-in screen. On a phone it opens the WebAuth app; on a computer you scan the QR code or use webauth.com. It uses XPR Network's official WharfKit plugin.
- **Choosing a wallet now sticks.** Tapping a wallet on the sign-in screen used to open WharfKit's own wallet list again (a bug from WAX Hub). It now goes straight to the wallet you picked.
- **Metal X trading** (XPR DeFi): buy and sell with limit or market orders on every Metal X market. Prices and fees are shown, and each order goes out in one transaction (deposit with an empty memo, `placeorder`, `process`). Open orders show the right amounts (no more `1.9e-7`).
- **PowerUp works.** WAX Hub's PowerUp form always asked for about 1.5% of the whole network (hundreds of WAX), so it failed every time. Now you pick Light, Normal, Heavy or Custom, see the live price (for example 100 ms CPU for about 0.02 WAX), and pay in EOS or A on EOS.
- **Telos**: Telos never turned PowerUp on, so the same tool now rents CPU from REX for 30 days.
- **XPR profile**: shows a KYC badge when the account has KYC; it no longer says "Not verified", since that flag isn't about KYC. The date shown is when the WebAuth profile was registered, not when the account was created.
- **SimpleDEX**: the "You pay" list only shows tokens a pool trades, which hides look-alike tokens from other contracts.
- **Removed**: the WAX DAO "free PowerUp" button (its contract has been broken since early 2026), and five dead network nodes (WAX, Telos, Libre fallbacks).

## 1.1.2: NFT pictures, checked on the real network

- **Every NFT picture shows**, in the inventory, market, packs, collections and templates. Checked against the live image servers:
  - Small cards now ask AtomicHub's preview service first (about 20 KB instead of a full-size original of up to 1 MB), and stop the slower downloads as soon as one picture arrives.
  - When the preview service has no picture it answers with a 1×1 pixel. That no longer counts as success, so such NFTs (often videos saved as "img") now play their video instead of showing a blank card.

## 1.1.1: Packs and NFT images

- **NFT images show again.** The IPFS gateways the app used have shut down: two no longer exist, one was retired in 2024, and ipfs.io now refuses with "too many requests". Images now come from gateways that still serve WAX NFT media: ipfs.eosdac.io, AtomicHub's image service (resizer.atomichub.io) and ipfs.alienworlds.io. Each gets a short head start before the next joins in, and the first that loads wins, so a hanging gateway no longer leaves a blank card. Images load as they scroll into view, without sending which page you're on (no referrer). Images saved as links to a dead gateway are fetched from a working one, and NFTs that only have a video now show it
- **Packs lists your packs.** It used to list your 80 newest NFTs of any kind and the newest 40 pack definitions on the contract. It now finds the packs you actually own on AtomicHub, NeftyBlocks and NFTHive, through each contract's template index. They're grouped with picture, count and unlock time, with an Open button. Big collections build a small pack index once and keep it on the device
- **Creator studio** previews use the same image loader

## 1.1.0: Wombat, A for resources, more bridges

- **Bridges: send WAX to Ethereum**: native WAX goes out through the official WAX Bridge (`bridge.wax`) and arrives as WAXP, the ERC-20 on Ethereum. Minimum and limits are read from the contract (10 WAX minimum today)
- **Bridges: send A to EOS EVM**: EOS EVM's gas token is now A. Send A (or EOS, converted 1:1 in the same transaction) to any EVM address; the 0.1 A entry fee is read from `eosio.evm`
- **Safer EVM addresses**: mixed-case Ethereum/EVM addresses must match their EIP-55 checksum, so most typos are caught before anything is sent
- **Rescue & recover**: Wombat Dungeon Master on WAX and EOS. Finds NFTs hidden in the dungeon (unstake), unstaked NFTs ready to claim after the 24-hour wait, and the daily candy claim
- **Contract console**: Wombat Dungeon Master recipes (unstake, claim, claim candy)
- **EOS: resources paid in A**: accounts that converted everything to A (staked EOS included) can still send NFTs and tokens. When CPU, NET or RAM is short, a small PowerUp paid in A (and 1 KB of RAM if needed) goes at the front of the transaction. The Vaulta card shows resource health and has an on/off switch and a "Rent CPU/NET for 24h with A now" button. Automatic top-ups never spend A the transaction itself needs and are capped at 0.5 A
- **XPR Network**: clearer advice for WebAuth accounts (back up the key in WebAuth, then import it into Anchor)

## 1.0.0: Antelope Hub

First release of **Antelope Hub**, which replaces WAX Hub. It covers WAX, EOS (Vaulta), Telos, XPR Network, Libre and the Jungle 4 testnet. On Android it installs over WAX Hub as an update (same app id and signing key).

- **Wallet** on every network: balances, transfers, staking, RAM, PowerUp, voting (exactly 4 producers on XPR Network)
- **Bridges**: every live and defunct bridge on each network, with working actions
- **Cross-chain (Alcor)**: personal deposit addresses on Ethereum, BNB Chain, Polygon, TON, NEAR and Sui (checked on the device before they're shown), cross-chain swaps, transfer activity
- **Telos studio**: Telos Decide polls and community voting tokens, Telos Works proposals, NFT minting on Telos
- **XPR DeFi**: LOAN lending with a health factor, SimpleDEX swaps and liquidity, Metal X orders, oracle prices, WebAuth profiles and KYC
- **Rescue & recover**: finds stuck deposits, rewards, refunds, stakes, orders and bridged tokens on every network
- **New account**: guided account creation for each network
- **Creator studio** (AtomicAssets, including Telos and Jungle 4 read from the chain), **Contract console**, NFTs, market, drops
- Every major transaction dry-run against the live contracts before release (`tests/dryrun/`)

---

## Development history

Builds 3.0 to 4.4 were test versions on the way to 1.0.0.

### 4.4.0: XPR Network DeFi

Built from the [XPR Network developer skill](https://github.com/XPRNetwork/xpr-network-dev-skill) and dry-run against XPR mainnet.

#### New
- **XPR DeFi** (XPR only): LOAN lending (supply, withdraw, borrow, repay, claim rewards; health factor from on-chain markets and the `oracles` feeds, capped at 1.25), SimpleDEX (swap via `swap:POOL:MIN_OUT:IS_A_IN` net of the protocol fee, `remliquidity`, `withdrawdep`), Metal X open orders (`cancelorder`, `withdrawall`), oracle prices, WebAuth profiles and KYC (`eosio.proton` `usersinfo`).
- **Rescue & recover (XPR)**: LOAN rewards and supply, unfinished SimpleDEX deposits, SimpleDEX liquidity, open Metal X orders.

#### Fixed
- Producer voting: only registered, active producers are listed (an inactive one made the vote fail). On XPR Network exactly 4 producers are required for staking rewards, and the claim uses `voterclaim`.
- XPR Network: transfers to `dex` with a memo are blocked (Metal X keeps them without crediting them).

### 4.3.1: tested against live contracts

Every major transaction was dry-run against the real contracts with `compute_transaction` (Jungle 4 testnet and each mainnet's current state; nothing signed or broadcast). See `tests/dryrun/`.

#### Fixed
- EOS (Vaulta): REX `deposit`/`withdraw` are refused by `eosio` since the rebrand. Lending and REX fund withdrawals now use `core.vaulta` in A (EOS is converted in the same transaction when needed), in Essentials and Rescue.
- EOS account creation: `newaccount2` leaves the account without RAM; the transaction now adds `core.vaulta::buyrambytes` (4096 bytes).
- EOS ⇄ A converter: `swapto` to yourself is refused ("cannot transfer to self"); it now transfers to `core.vaulta`, which converts 1:1.
- Alcor hub send-out enforces the route's minimum.
- Telos Decide voting explains ballots you can't vote on instead of failing.
- RPC reads no longer send `Content-Type: application/json`, which forced a CORS preflight that telos/proton/libre.greymass.com reject.
- Jungle 4: REX and the converter explain that the testnet's `core.vaulta` doesn't convert.

#### Housekeeping
- Unused helpers removed; desktop package homepage points at this repository.

### 4.3.0: Cross-chain with Alcor

#### New
- **Cross-chain** tool: Alcor deposit addresses (verified on the device), cross-chain swaps from `/v1/swap/plan` with an allow-list check before signing, swap deposit addresses (beta) with estimates, and transfer activity with `hop.alcor::recover`.
- **Rescue & recover**: Alcor transfers waiting to be sent back.

#### Changed
- Bridges → Alcor: transfers to Ethereum, BNB Chain and Polygon include Alcor's courier fee (`<domain>:<address>:<fee>`), so they are delivered without a manual release. Review waits until the fee is loaded.
- QR codes are generated on the device with qrcode-generator (MIT) instead of an outside service.

### 4.2.0: Telos

#### New
- **Telos studio** (Telos only): guided Telos Decide polls and ballots (`newballot`, `editdetails`, `editminmax`, `togglebal voteliquid`, `openvoting`; fee from the Decide deposit), community voting tokens (`newtreasury`, `edittrsinfo`, `toggle`, `regvoter`, `mint`), Telos Works proposals (`draftprop`, `launchprop`, `submitreport`, `claimfunds`, `nextms`, `cancelprop`, `deleteprop`) and deposit withdrawals.
- **Creator studio on Telos and Jungle 4**: AtomicAssets collections, schemas and templates are read and decoded straight from the contract tables when no Atomic API is available.
- **Contract console**: Telos contracts, field help and recipes; `eosio.msig` on every network.
- **Rescue & recover**: unused Telos Decide and Telos Works deposits.

### 4.1.0

#### New
- **New account** (More → New account, and from the welcome screen): guided account creation for every network. Free sign-up routes, creating from your own account (EOS: `core.vaulta::newaccount2`; WAX, Telos, Jungle 4: `newaccount` + `buyrambytes` + `delegatebw`), or a request for someone else. Keys are generated on the device and never stored; name rules and availability are checked as you type.
- **Alcor Bridge on WAX, EOS and XPR**: send to Telos, or through Telos to Ethereum, BNB Chain, Polygon or another Antelope chain.
- **Alcor hub on Telos**: send `wrap.alcor` tokens out on any open route.
- **Libre USDT** peg-out to Ethereum.
- **Rescue & recover** lists tokens from old or paused bridges (IBC, Wombat, pNetwork) and links to the right bridge.

#### Fixed
- Only the first bridge on a network could be used: every bridge card now has its own actions, a sign-in button when signed out, and shortcuts to the Console, Rescue and the explorer.

### 4.0.0: Antelope Hub

**WAX Hub is now Antelope Hub**: a fully multi-chain Antelope app. It has a new name, an "A" icon and new splash screens. The Android app id is unchanged, so it updates in place.

#### New
- **Bridges** (More → Bridges): every live and defunct bridge on each network, with live status from on-chain activity and your wrapped balances. Verified actions:
  - Telos EVM deposit and withdraw.
  - EOS EVM token deposits.
  - pNetwork pBTC and pUSDT redemption.
  - WAX Bridge claims for incoming tokens and NFTs.
  - Alcor bridge hub claims on Telos.
  - Libre BTC: deposit address and peg-out.
- **Telos Decide** in Telos essentials: open governance ballots and one-tap voting (it registers you for the ballot's voting token the first time).
- **Rescue & recover** finds unclaimed WAX Bridge transfers, linked Telos EVM balances and Alcor bridge claims.

#### Changed
- The app name and the name shown in wallets are now "Antelope Hub". The Linux package is now `antelope-hub` and replaces `wax-hub` when installed.

## 3.1.0: network essentials

Each network now has an **essentials** screen (More → *Network* essentials) for features unique to that chain. Every action was checked against the live contract ABI and recent mainnet transactions.

- **EOS**: REX yield (put EOS into REX, sell matured REX, withdraw your REX fund); gift, transfer or take back RAM; premium-name auctions (check a name, bid, claim refunds when outbid).
- **Telos**: staking rewards through REX, including moving your staked CPU/NET straight into REX.
- **XPR Network**: stake and unstake XPR, claim daily staking rewards and refunds, and see whether you qualify (you need to vote for 4 producers). Withdraw balances left in the Metal X exchange.
- **Libre**: stake LIBRE for a chosen number of days, see APY and payout, claim finished stakes, and vote on Libre DAO proposals.
- **WAX**: claim voting rewards and genesis WAX.
- **Jungle 4**: practise REX, RAM gifting and name bids with test tokens.
- **Rescue & recover** also finds REX funds and matured REX, unclaimed XPR rewards and refunds, Metal X balances, and finished LIBRE stakes.
- More reliable scans: a check that fails because a node is busy retries once. Extra EOS Nation nodes for EOS and Telos.

## 3.0.0: multi-chain

#### New
- **Works on six Antelope networks**: WAX, EOS (Vaulta), Telos, XPR Network, Libre and the Jungle 4 testnet. Switch from the network chip at the top. Each network uses its own nodes, history, NFT API, core token, price feed and explorer.
- **Features appear only where their contracts exist.** Every network gets the wallet, Rescue & recover, the Contract console, voting and history. NFTs and the Market appear where AtomicAssets and its API run (WAX, EOS, XPR). Drops, blends and swaps follow the contracts deployed on each chain. WAXDAO, packs and NeftyBlocks drops stay WAX-only.
- **Rescue & recover** only runs scanners whose contracts exist on the active network.
- **Free-resource chains** (XPR, Libre) show "CPU and NET are free" instead of staking and PowerUp.
- **Jungle 4 testnet** lets people practise with free test tokens.
- **Vaulta ($A) on EOS**: A and EOS balances, USD value, and a 1:1 **Convert EOS ⇄ A** using the official `core.vaulta::swapto` action (the same action Anchor sends).

#### Changed
- Sign-in offers WAX Cloud Wallet on WAX only. Anchor works on every network.
- Text and amounts follow the active chain's token symbol and decimals.
- Privileged accounts with unlimited CPU/NET show "unlimited" instead of `-1`.

## 2.1.0

#### New
- **Rescue & recover**: scans 34 places across 27 WAX contracts for value still held for an account and returns it in one tap (batched where possible). See [CONTRACTS.md](CONTRACTS.md).
- **Contract console**: call any action on any contract with forms generated from the ABI, or browse any table. Includes ready-made tasks, per-field help and high-risk action guards.
- **Guided Creator studio**: collection → schema → template → mint → sell, with explainers, presets, previews, airdrop minting and a NeftyBlocks drop builder.
- **Linux desktop app** (AppImage and .deb).
- Plain-English error messages with one-tap fixes, explorer links on every transaction, account menu, Android back-button support, first-run intro and offline banner.

#### Fixed
- Drops tab showed mostly old test drops, and collection search didn't work. It now shows live, claimed drops and searches by partial collection name.
- NeftyBlocks pack results were never found, and only the first item was claimed.
- AtomicHub pack claims were sent without roll IDs.
- Older unclaimed packs and Alcor orders weren't listed.
- Tapping the account chip signed you out straight away.
- On tablets and desktop the top bar was cut off.

### Security
- Release APK: WebView remote debugging and mixed content are disabled. New release signing key.
