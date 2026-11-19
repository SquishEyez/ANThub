# Contract coverage (Antelope Hub)

This map was built in November 2026 from live mainnet ABIs (`get_abi`) and real table rows. Each
row records how to find one account's entries (scope and index) and which action returns the
value. The scope and index were checked by querying real rows for real accounts.

**Seen** means Hyperion shows a recent successful mainnet call with exactly this data shape.
Actions without that mark are built from the ABI and labelled *Untested* in the app.

## How the app covers a contract

| Tier | What it does |
|---|---|
| Friendly screens (2.0) | Wallet, NFTs, Market, Drops, Packs, WAXDAO, DEX, Creator, Chain tools |
| **Rescue & recover** (2.1) | Scans every row below for one account and offers the return action in one tap. Simple items can be batched into one transaction (max 10 actions). |
| **Contract console** (2.1) | Calls any action on any contract, with forms generated from the ABI (structs, arrays, optionals, variants, extended assets). It also browses any table (scope, bounds, index, key type, paging). High-risk system actions (`updateauth`, `linkauth`, `setcode` and similar) require typing your account name. |

## Rescue scanners

| App | Contract · table | Lookup | Return action | Seen |
|---|---|---|---|---|
| WAX | eosio · refunds | scope = account | `refund(owner)` | ✓ |
| WAX | eosio · delband (stake to others) | scope = account | `undelegatebw` | ✓ |
| WAX | eosio · voters | primary = owner | `claimgbmvote(owner)` (24h) | ✓ |
| WAX | eosio · genesis | scope = account | `claimgenesis(claimer)` | ✓ |
| AtomicHub | atomicmarket · balances | primary = owner | `withdraw(owner, token_to_withdraw)` | ✓ |
| AtomicHub | atomicassets · balances | primary = owner | `withdraw` | ✓ |
| AtomicHub | atomicdropsx · balances | primary = identifier | `withdraw` | ✓ |
| AtomicHub | atomicmarket auctions won / sold / no bids | AtomicMarket API | `auctclaimbuy` / `auctclaimsel` / `cancelauct` | ✓ |
| AtomicHub | atomicmarket buy offers, template buy offers, waiting sales | AtomicMarket API | `cancelbuyo` / `canceltbuyo` / `cancelsale` | ✓ |
| AtomicHub | atomicassets · offers | idx2 = sender, idx3 = recipient | `canceloffer` / `acceptoffer` / `declineoffer` (offers that give nothing back are flagged as scams) | ✓ |
| AtomicHub | atomictoolsx · links | AtomicTools API (table has 15k+ rows, no creator index) | `cancellink(link_id)` | ✓ |
| AtomicHub | atomicpacksx · unboxpacks | idx2 = unboxer; roll ids from `unboxassets` (scope = pack) | `claimunboxed(pack, origin_roll_ids)` / `retryrand` | ✓ / – |
| NeftyBlocks | neftyblocksd · balances | primary = owner | `withdraw` | ✓ |
| NeftyBlocks | blend.nefty · extbalances | primary = owner | `withdrawubal(owner, extended_asset)` | – |
| NeftyBlocks | neftyblocksp · claimassets | idx2 = recipient (contract scope) | `claim(claim_id, roll_indexes = every unclaimed index)` | ✓ |
| NeftyBlocks | market.nefty · balances | primary = owner | `withdraw` | – |
| NeftyBlocks | claim.nefty · claims | primary = account | `claim(account)` | – |
| NFTHive | nfthivedrops · balances | primary = user | `withdraw(account, amount)` | ✓ |
| NFTHive | nfthivedrops · claims (pending RNG) | full scan (small) | `retryrand(claim_id)` | – |
| NFTHive | nfthivepacks · unpackpacks + unpackresult | full scan (small) | `claimunpack` / `retryrand` | ✓ / – |
| NFTHive | nfthivecraft · balances / items / claims | primary / primary / full scan | `withdraw` / `withditems` / `claim` | ✓ / – / – |
| NFTHive | nfthivevault · stakes, rewards | primary | `claim`, `claimstake`, `unstake` | ✓ |
| NFTHive | nft.hive · users, accounts | primary | `withdraw(user, quantity)` | – |
| WAXDAO | tf.waxdao · stakers | scope = account | `getreward`, `unstake` | ✓ |
| WAXDAO | farms.waxdao · stakers | idx3 = user | `claim`, `unstake(asset_ids)` | ✓ |
| WAXDAO | dao.waxdao · stakedtokens | scope = account | `unstaketoken` (after unlock) | – |
| WAXDAO | waxdaolocker · locks | idx2 = creator, idx3 = receiver | `withdraw(lock_ID)` / `cancellock` | ✓ / – |
| WAXDAO | waxdaobacker · balances | primary = wallet | `withdraw(user, [])` | – |
| WAXDAO | waxdaosynths · ordersnew | full scan (small) | `cancelorders(order_ids)` | – |
| WAXDAO | wufclaimtool · claims | scope = airdrop id, primary = claimer | `claim(airdrop_id, account)` | ✓ |
| Alcor | alcordexmain · account → buy/sell orders | primary, then idx3 = account (scope = market id) | `cancelbuy` / `cancelsell` | ✓ |
| Taco | stake.taco · users / staked | primary | `claim`, `unstake` | ✓ |
| Wombat | wombatmaster · staked, stats (WAX and EOS) | scope = account / primary = account | `unstake(owner, asset_ids)`, then after 24h `claim(owner, staked_assets)`; `claimcandy(account)` (daily) | ✓ |
| RPlanet | s.rplanet · accounts | primary = user | `claim(to)` | ✓ |
| SimpleAssets | simpleassets · offers | idx2 = owner, idx3 = offeredto | `canceloffer` / `claim` | – / ✓ |

## Not scanned automatically (use the Contract console)

- **swap.alcor**: concentrated-liquidity positions are scoped per pool (hundreds of pools). Use alcor.exchange or `subliquid` / `collect`.
- **swap.taco** liquidity: `remliquidity`.
- **nfthivecraft · lockups**: over 6,000 rows with no owner index. Use `unlock(asset_id, crafter)`.
- **nft.hive · sales**: over 6,000 rows with no seller index. Use `cancelsale(sale_id)`.
- **blend.nefty · inventory**: there is no user withdraw action for deposited inventory in the current ABI.
- **lock.minty**, **claim.nefty**: tables are currently empty or show no recent activity.
- **eosio · namebids**: no bidder index. Use `bidrefund(bidder, newname)`.

## Bugs fixed in the original (2.0) screens while mapping

- Packs → NeftyBlocks read `claimassets` with `scope = account`, so it never found anything. It now uses the contract scope and idx2 = recipient.
- Packs → NeftyBlocks claimed only `roll_indexes: [0]`, which skipped every item after the first. It now claims every unclaimed index.
- Packs → AtomicHub sent `claimunboxed` with empty `origin_roll_ids`. It now reads them from `unboxassets`.
- Packs → AtomicHub and NFTHive only looked at the newest 50 rows of the whole table. AtomicHub now uses the unboxer index, and NFTHive reads the whole (small) table.
- DEX → Alcor open orders only looked at the newest 50 orders in a market, so older orders were invisible. It now uses idx3 = account.

## Re-checking

The survey scripts query `get_abi`, `get_table_rows` and Hyperion `get_actions`. To re-check
after a contract upgrade, compare the struct fields above with the live ABI. The Contract
console's table view shows each table's row fields.

## Other networks

Each scanner runs only if its contract exists on the active network. Presence was checked with `get_abi` in November 2026:

| Network | Chain ID (start) | Core token | Contracts the app uses beyond the system contracts |
|---|---|---|---|
| WAX | `1064487b…` | WAX (8) | everything in the tables above, plus bridge.wax, bridge.alcor |
| EOS (Vaulta) | `aca376f2…` | EOS (4), A (4) | atomicassets, atomicmarket, atomictoolsx, atomicdropsx, swap.alcor, delphioracle, core.vaulta, eosio.evmin, \*.ptokens, bridge.alcor |
| Telos | `4667b205…` | TLOS (4) | atomicassets, atomicmarket, blend.nefty, swap.alcor, delphioracle, telos.decide, works.decide, eosio.evm, bridge.alcor, \*.ptokens |
| XPR Network | `384da888…` | XPR (4) | atomicassets, atomicmarket, atomicdropsx, blend.nefty, swap.alcor, lending.loan, simpledex, dex (Metal X), oracles, eosio.proton, bridge.alcor |
| Libre | `38b1d781…` | LIBRE (4) | stake.libre, dao.libre, btc.libre / x.libre, usdt.libre / t.libre, \*.ptokens |
| Jungle 4 (testnet) | `73e4385a…` | EOS (4) | atomicassets, atomicmarket, atomictoolsx, core.vaulta |

The system scanners (unstake refunds, stake to others) run where staking exists. Voting rewards and genesis WAX are WAX-only.

### EOS since the Vaulta rebrand (checked by dry run)

| Task | What works | What the system contract refuses |
|---|---|---|
| Put tokens into REX | `core.vaulta::deposit` + `core.vaulta::buyrex`, in **A** (EOS is converted first by a transfer to `core.vaulta`) | `eosio::deposit` ("must now be called from the core.vaulta contract") |
| Withdraw the REX fund | `core.vaulta::withdraw(owner, … A)` | `eosio::withdraw` |
| Convert EOS ⇄ A | transfer EOS (`eosio.token`) or A (`core.vaulta`) to `core.vaulta`; it pays back 1:1 | `core.vaulta::swapto` to yourself ("cannot transfer to self") |
| Create an account | `core.vaulta::newaccount2` + `core.vaulta::buyrambytes(…, 4096)` | `newaccount2` alone (the account has no RAM) |
| RAM, staking, PowerUp, voting, name bids, refunds | `eosio::…` as before | – |

On Jungle 4, `core.vaulta` doesn't convert EOS to A, so REX there needs test A tokens.

**Resources paid in A.** `core.vaulta::powerup(payer, receiver, days, net_frac, cpu_frac, max_payment A)` and `core.vaulta::buyrambytes` take A. A PowerUp at the start of a transaction pays for that same transaction, so an account with 0 CPU and 0 NET and only A can still sign. Checked by dry run on mainnet: an `atomicassets::transfer` from three such accounts passed with `core.vaulta::powerup` in front, and failed without it (`net usage is too high: 104 > 0`). `max_payment` must be covered by the A balance, so it is sized from `eosio` `powup.state` (calc_powerup_fee) at 1.5× the quote. A PowerUp can also need about 130 bytes of RAM for its order row, plus a row for the EOS it converts, so 1 KB of RAM is bought in A when less than 800 bytes are free. AtomicAssets transfers need no RAM from the sender (the asset's `ram_payer` pays). The app adds these only when CPU or NET is short, never spends A the transaction itself needs (EOS is converted first instead), and never adds more than 0.5 A without asking.

## Bridges

Live status is read from each contract's latest on-chain action (Hyperion). These actions were checked against recent mainnet transactions:

| Bridge | Network | User actions in the app |
|---|---|---|
| Telos EVM (`eosio.evm`) | Telos | `eosio.token::transfer` TLOS to `eosio.evm` with memo `0x<address>`; `eosio.evm::withdraw(to, quantity)` |
| EOS EVM (`eosio.evm`) | EOS | gas token A: `core.vaulta::transfer` A to `eosio.evm` with memo `0x<address>`; must exceed `config.ingress_bridge_fee` (0.1 A). EOS itself is refused ("received unexpected token") |
| EOS EVM (`eosio.evmin` → `eosio.erc2o`) | EOS | `<token>::transfer` to `eosio.evmin` with memo `0x<address>`, for tokens in `eosio.erc2o.tokens` |
| pNetwork (`*.ptokens`) | EOS, Telos, Libre | `redeem2(sender, quantity, memo, user_data, chain_id)`: PBTC → `01EC97DE` (Bitcoin), PUSDT → `005FE7F9` (Ethereum) |
| WAX Bridge (`bridge.wax`) | WAX | `claimtoken(evm_tx_hash)`, `claimnft(evm_chain, evm_tx_hash)`; pending rows in `evmtokentx.a` / `evmnfttx.a` |
| WAX Bridge out (`bridge.wax`) | WAX | `eosio.token::transfer` WAX to `bridge.wax` with memo `ethereum-0x2A79324c19Ef2B89Ea98b23BC669B7E7c9f8A517-0x<recipient>` (WAXP ERC-20); minimum in `minxfer.a`, limits in `translimit.a`. The old WAXE route (`0x7a2B…`, 1000:1, listed in `waxtokens.b`) is closed: "outbound bridging of this token is closed". Other chains: "not supported yet" |
| Alcor bridge hub (`bridge.alcor`) | Telos | `claim(owner, sym_code)` from `claims` (scope = owner); send out = `wrap.alcor::transfer` to `bridge.alcor` with memo `<domain>:<recipient>`, routes from `routes` |
| Alcor bridge spokes (`bridge.alcor`) | WAX, EOS, XPR | `<token>::transfer` to `bridge.alcor` with memo `<telos account>`, or `hop.alcor:<domain>:<recipient>\|<own domain>:<refund account>`; tokens from `listing` (scope = token contract) |
| Libre USDT (`usdt.libre`, `t.libre`) | Libre | `usdt.libre::transfer` to `t.libre` with memo `0x<ethereum address>` (fee deducted) |
| Libre Bitcoin (`x.libre`, `v.libre`, `btc.libre`) | Libre | deposit address from `accounts`; peg-out = `btc.libre::transfer` to `x.libre` with memo `<bitcoin address>` |
| Antelope IBC (`ibc.wl.*`, `ibc.wt.*`), Wombat, XPR wrap | various | status and balances only: completing a transfer needs off-chain proofs or fee quotes |
| Telos Decide (`telos.decide`) | Telos | `regvoter(voter, treasury_symbol, null)` (first time), `refresh(voter)`, `castvote(voter, ballot_name, options)` |

## New accounts

| Network | Action |
|---|---|
| EOS | `core.vaulta::newaccount2(creator, name, key)` + `core.vaulta::buyrambytes(payer, receiver, 4096)` |
| WAX, Telos, Jungle 4 | `eosio::newaccount` + `eosio::buyrambytes` + `eosio::delegatebw` |
| XPR Network, Libre | created by their onboarding wallets (WebAuth, Bitcoin Libre) |

## Telos governance

| Contract | What the app does | Actions |
|---|---|---|
| `telos.decide` | Fee deposit | `eosio.token::transfer` TLOS to `telos.decide` (any memo except `skip`); `withdraw(voter, quantity)` |
| `telos.decide` | Create a ballot | `newballot(ballot_name, category, publisher, treasury_symbol, voting_method, initial_options)`, `editdetails`, `editminmax`, `togglebal(ballot, voteliquid)`, `openvoting(ballot, end_time)` |
| `telos.decide` | Manage a ballot | `closevoting(ballot, true)`, `cancelballot`, `deleteballot` |
| `telos.decide` | Community token | `newtreasury(manager, max_supply, access)`, `edittrsinfo`, `toggle(symbol, setting)`, `regvoter(voter, symbol, referrer)`, `mint(to, quantity, memo)` |
| `works.decide` | Funding proposals | `draftprop`, `launchprop` (fee = max(min_fee, fee_percent × request) from the Works deposit), `submitreport`, `claimfunds`, `nextms`, `cancelprop`, `deleteprop`, `withdraw(account_name, quantity)` |
| `atomicassets` | NFTs without an indexer | reads `collections`, `schemas`, `templates` and decodes the serialized attribute data |

## Alcor bridge API

Base `https://telos.alcor.exchange/api/bridge/v1` (public, no key).

| Feature | Calls | Checks in the app |
|---|---|---|
| Deposit address | `POST /deposit-addresses {chain, to[, memo]}`, `GET /deposit-addresses/<address>`, `GET /fees` | EVM address recomputed: CREATE2 from factory `0x6bc5…c362`, salt `keccak256(abi.encode(uint64 telosTo, string leg))` |
| Swap address (beta) | `POST /deposit-addresses {chain, to, token[, refund]}`, `GET …/estimate` | address recomputed from the returned `telosTo` and `leg`; the leg must buy the chosen token for the chosen recipient |
| Cross-chain swap | `GET /swap/plan?from=&to=&amount=&recipient=&sender=[&courierFee=]` | only `transfer` to `swap.alcor` / `bridge.alcor` / `book.alcor` from the signer, and `wrap.alcor::open`; the final memo must name the recipient; re-planned at approval |
| Activity | `GET /hops?party=` | `hop.alcor::recover` offered on Telos for hops with `recover` |
| Courier fee | `GET /fees` → `withdrawal` | appended to EVM destinations: `hop.alcor:<domain>:<address>:<fee>\|<own domain>:<account>` and `<domain>:<address>:<fee>` |

## XPR Network DeFi

| Contract | Actions used | Reads |
|---|---|---|
| `lending.loan` (LOAN) | `entermarkets` + `<token>::transfer` memo `mint`; `redeem(redeemer, {L-token, shares.loan})`; `borrow(borrower, {quantity, contract}, false)`; repay = transfer memo `repay`; `claimrewards(claimer, markets)` | `markets`, `marketshares`, `shares`, `borrows`, `rewards`; cash via `get_currency_balance`; prices from `oracles` |
| `simpledex` | swap = transfer memo `swap:POOL:MIN_OUT:IS_A_IN`; `remliquidity(account, poolId, lpTokens, minA, minB)`; `withdrawdep(account, depositId)` | `pools`, `protofee`, `lp` and `deposits` (scope = account) |
| `dex` (Metal X) | order = one transaction: `<pay token>::transfer` to `dex` with an **empty** memo, `placeorder`, `process(q_size, false)`. Sell: `quantity` in the base token's raw units. Buy: `quantity` is the quote token spent (checked against live mainnet buys). `price` is always in the quote token's raw units. Market orders: `fill_type` 1 at price `9223372036854775806` (buy) or `1` (sell). Plus `cancelorder(account, order_id)` and `withdrawall(account)` | `dex.api.mainnet.metalx.com/dex/v1/`: `markets/all` (status 1 = trading), `trades/daily` (last price), `orders/open`; on-chain `balances`. The API's certificate chains to SSL.com TLS RSA Root CA 2022, which Android 13 and older don't trust. Fallback: the `markets` table (`ask_token.quantity` is the last price; `bid_fee` is the fee). Open orders come from the account's last 100 `placeorder` transactions (Hyperion), whose `dex::logorder` gives the order id, then `orderbook` / `orderq` / `sltp` are read by primary key (the order book has no account index) |
| `eosio` (XPR) | `voteproducer` with exactly 4 producers, `voterclaim` | `get_producers` (active only) |
| `eosio.proton` | none | `usersinfo` (`verified` is an optional checkmark, separate from KYC; `kyc` is a list of claims; `date` is when the WebAuth profile was registered), `kycproviders` |
| `oracles` | none | `feeds`, `data` |

## Packs and NFT media

- **Finding packs**: `atomicpacksx`, `neftyblocksp` and `nfthivepacks` have no owner index, but each `packs` table has a secondary index on the template id (index 2, `i64`: `pack_template_id`, or `template_id` on NFTHive). The app takes the templates an account owns (AtomicAssets API `/accounts/{account}`, or the `atomicassets` `assets` table scope = account) and looks them up there. For 250 templates or fewer, it jumps through index 2. For more, it builds a template → pack id index of the whole table once (in parallel, by primary key) and keeps it on the device. Unbox: `atomicassets::transfer` of the pack to the contract with memo `unbox` (`unpack` on NFTHive). Checked by dry run: it calls `orng.wax::requestrand`.
- **IPFS gateways** (late 2026): `ipfs.atomichub.io` and `atomichub-ipfs.com` have no DNS, `cloudflare-ipfs.com` doesn't resolve, `ipfs.neftyblocks.io` is parked, and `ipfs.io` and `dweb.link` answer 429. Working: `ipfs.eosdac.io`, `resizer.atomichub.io/images/v1/preview?ipfs=<cid>&size=370` and `ipfs.alienworlds.io` (same findings as [Zigm4/crucible](https://github.com/Zigm4/crucible)). The app races them with a 1.2 s head start each. Small cards (240 px or narrower) try the preview service first. It answers a 1×1 image when it has nothing, which the app treats as a failure. `ipfs.eosdac.io` can hang on CIDs with a path, and `ipfs.atomicassets.io` no longer connects.

## Resources and sign-in

- **PowerUp (Chain tools)**: `eosio::powerup(payer, receiver, 1, net_frac, cpu_frac, max_payment)`. The fractions are sized from `powup.state` and `eosio.reserv`, which turn CPU time and NET size into a share of the network, and the fee follows `calc_powerup_fee`, with `max_payment` at 1.5× the quote. On EOS the same action exists in `core.vaulta` and is paid in A. WAX Hub's original form always asked for a `15e12` fraction, about 1.5% of the network: 491 WAX or 118 EOS against a 1-coin cap, so it never worked. The new form is checked by dry run.
- **Telos**: `powerup` isn't initialized ("powerup hasn't been initialized"). CPU is rented from REX instead: `eosio::deposit` + `eosio::rentcpu(from, receiver, loan_payment, loan_fund)` for 30 days.
- **waxdao::powerup**: removed. It fails with "eosio::powerup not found", and was last used successfully in March 2026.
- **WebAuth sign-in (XPR Network)**: XPR's official `@proton/wharfkit-plugin-webauth` 1.1.0, pinned in `android/package.json` and bundled at build time. It uses `proton:` signing requests through the `cb.anchor.link` relay (same as Anchor), or a webauth.com window. The sign-in sheet passes the wallet's id to `SessionKit.login()`. The original passed the plugin object, which SessionKit ignored, so it always asked again which wallet to use.
- **Nodes checked in November 2026**: `apiwax.3dkrender.com` and `api.uxnetwork.io` (502), `wax.pink.gg` (connection reset), `telos.api.eosnation.io` (404) and the chain API of `libre.eosusa.io` (500) were removed. Libre's Hyperion on `libre.eosusa.io` still works.

