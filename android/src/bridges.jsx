// Bridges: every bridge that runs (or ran) on the active Antelope network, with
// its live status from the chain's history and the actions people can take.
// Formats were checked against recent mainnet transactions:
//   Telos EVM   deposit  = eosio.token::transfer TLOS -> eosio.evm, memo "0x<address>"
//               withdraw = eosio.evm::withdraw(to, quantity)  (balance of your linked EVM address)
//   EOS EVM     deposit  = <token>::transfer -> eosio.evmin, memo "0x<address>" (tokens registered in eosio.erc2o)
//   pNetwork    redeem   = <x>.ptokens::redeem2(sender, quantity, memo=<destination>, user_data, chain_id)
//                          chain_id 01EC97DE = Bitcoin, 005FE7F9 = Ethereum
//   WAX bridge  claim    = bridge.wax::claimtoken(evm_tx_hash) / claimnft(evm_chain, evm_tx_hash)
//   Alcor (Telos hub) claim = bridge.alcor::claim(owner, sym_code)
//   Libre BTC   peg-out  = btc.libre::transfer BTC -> x.libre, memo "<bitcoin address>"
//   Libre USDT  peg-out  = usdt.libre::transfer USDT -> t.libre, memo "0x<ethereum address>" (fee taken)
//   Alcor spoke deposit  = <token>::transfer -> bridge.alcor, memo "<telos account>"
//               through  = memo "hop.alcor:<domain>:<recipient>|<own domain>:<refund account>"
//   Alcor hub send-out   = wrap.alcor::transfer -> bridge.alcor, memo "<domain>:<recipient>"

const WHBR = (() => {
  const K = WHCHAIN.key;
  const L = {
    wax: [
      { id: "waxbridge", name: "WAX Bridge (official)", what: "WAX ⇄ Ethereum, BNB Chain and Solana, for tokens and NFTs", contracts: ["bridge.wax"], panel: "waxbridge" },
      { id: "ibc", name: "Antelope IBC", what: "WAX ⇄ EOS / Telos / UX via proofs (wrap-lock and wrapped tokens)", contracts: ["ibc.wl.eos", "ibc.wt.eos", "ibc.wl.tlos", "ibc.wt.tlos", "ibc.wl.ux", "ibc.wt.ux"], tokens: ["ibc.wt.eos", "ibc.wt.tlos", "ibc.wt.ux"], panel: "ibc" },
      { id: "alcor", name: "Alcor Bridge", what: "Send tokens to Telos, Ethereum, BNB Chain, Polygon and other Antelope chains", contracts: ["bridge.alcor"], tokens: ["wrap.alcor"], panel: "alcorspoke" },
      { id: "wombat", name: "Wombat Bridge", what: "Wombat's IBC-style WAX ⇄ EOS bridge", contracts: ["wombatbridge"], tokens: ["wombatbridge"], panel: "ibc" },
    ],
    eos: [
      { id: "eosevm", name: "EOS EVM", what: "EOS native ⇄ EOS EVM, for supported tokens", contracts: ["eosio.evm", "eosio.erc2o"], panel: "eosevm" },
      { id: "ptokens", name: "pNetwork pTokens", what: "Wrapped BTC, ETH, LINK and LTC (pBTC, pETH…)", contracts: ["btc.ptokens", "eth.ptokens", "link.ptokens", "ltc.ptokens"], tokens: ["btc.ptokens", "eth.ptokens", "link.ptokens", "ltc.ptokens"], panel: "ptokens" },
      { id: "ibc", name: "Antelope IBC", what: "EOS ⇄ WAX / Telos / UX (wrapped WAX, TLOS, UTX on EOS)", contracts: ["ibc.wt.wax", "ibc.wl.wax", "ibc.wt.tlos", "ibc.wt.ux"], tokens: ["ibc.wt.wax", "ibc.wt.tlos", "ibc.wt.ux"], panel: "ibc" },
      { id: "alcor", name: "Alcor Bridge", what: "Send tokens to Telos, Ethereum, BNB Chain, Polygon and other Antelope chains", contracts: ["bridge.alcor"], tokens: ["wrap.alcor"], panel: "alcorspoke" },
      { id: "wombat", name: "Wombat Bridge", what: "Wrapped tokens from Wombat's WAX ⇄ EOS bridge", contracts: ["wombatbridge"], tokens: ["wombatbridge"], panel: "ibc" },
    ],
    telos: [
      { id: "tevm", name: "Telos EVM", what: "Telos native ⇄ Telos EVM (same TLOS, two layers)", contracts: ["eosio.evm"], panel: "tevm" },
      { id: "alcor", name: "Alcor Bridge (hub)", what: "Telos hub for Alcor's routes: Ethereum, BNB Chain, Polygon, WAX, EOS and XPR", contracts: ["bridge.alcor"], tokens: ["wrap.alcor"], panel: "alcorhub" },
      { id: "ptokens", name: "pNetwork pTokens", what: "Wrapped BTC, ETH, LINK, USDC and USDT", contracts: ["btc.ptokens", "eth.ptokens", "link.ptokens", "usdc.ptokens", "usdt.ptokens"], tokens: ["btc.ptokens", "eth.ptokens", "link.ptokens", "usdc.ptokens", "usdt.ptokens"], panel: "ptokens" },
      { id: "ibc", name: "Antelope IBC", what: "Telos ⇄ EOS / WAX / UX. Mostly inactive since 2023–2025", contracts: ["ibc.wt.eos", "ibc.wl.eos", "ibc.wt.wax", "ibc.wt.ux"], tokens: ["ibc.wt.eos", "ibc.wt.wax", "ibc.wt.ux"], panel: "ibc" },
    ],
    xpr: [
      { id: "xprwrap", name: "XPR wrapped assets", what: "BTC, ETH, USDC, XRP and more as X-tokens (XBTC, XETH, XXRP…)", contracts: ["proton.wrap", "xtokens"], tokens: ["xtokens"], panel: "xprwrap" },
      { id: "alcor", name: "Alcor Bridge", what: "Send tokens to Telos, Ethereum, BNB Chain, Polygon and other Antelope chains", contracts: ["bridge.alcor"], tokens: ["wrap.alcor"], panel: "alcorspoke" },
    ],
    libre: [
      { id: "librebtc", name: "Libre Bitcoin bridge", what: "Bitcoin ⇄ BTC on Libre (peg-in / peg-out)", contracts: ["x.libre", "v.libre", "btc.libre"], tokens: ["btc.libre"], panel: "librebtc" },
      { id: "libreusdt", name: "Libre USDT bridge", what: "Ethereum USDT ⇄ USDT on Libre (validator-run)", contracts: ["usdt.libre", "t.libre"], tokens: ["usdt.libre"], panel: "libreusdt" },
      { id: "ptokens", name: "pNetwork pTokens", what: "Older wrapped pBTC and pUSDT on Libre", contracts: ["btc.ptokens", "usdt.ptokens"], tokens: ["btc.ptokens", "usdt.ptokens"], panel: "ptokens" },
    ],
    jungle4: [],
  };
  const list = L[K] || [];
  async function lastActivity(contract) {
    const h = WHCHAIN.hyperion[0];
    if (!h) return null;
    try {
      const r = await Wf(`${h}/v2/history/get_actions?account=${contract}&filter=${contract}:*&limit=1&sort=desc`, { method: "GET" }, 15e3);
      const j = await r.json();
      const t = j?.actions?.[0]?.timestamp;
      return t ? Date.parse(t + "Z") : 0;
    } catch {
      return null;
    }
  }
  function status(ts) {
    if (ts === null || ts === void 0) return { label: "Unknown", cls: "" };
    if (!ts) return { label: "No recent activity", cls: "bad" };
    const days = (Date.now() - ts) / 864e5;
    if (days < 7) return { label: "Active", cls: "good" };
    if (days < 120) return { label: `Quiet: last used ${Math.round(days)}d ago`, cls: "accent" };
    return { label: `Inactive since ${new Date(ts).toLocaleDateString()}`, cls: "bad" };
  }
  const isEvm = (a) => /^0x[0-9a-fA-F]{40}$/.test(String(a || "").trim());
  const isBtc = (a) => /^(bc1[0-9a-z]{25,90}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/.test(String(a || "").trim());
  // Alcor bridge: network ids ("domains") used in memos
  const ALCOR = {
    "1": { name: "Ethereum", evm: true },
    "56": { name: "BNB Chain", evm: true },
    "137": { name: "Polygon", evm: true },
    "1181148696416462999": { name: "WAX", ant: "wax" },
    "12439917377594391589": { name: "EOS (Vaulta)", ant: "eos" },
    "4057084141687023600": { name: "XPR Network", ant: "xpr" },
  };
  const symCode = (n) => {
    let b = BigInt(n),
      out = "";
    while (b > 0n) {
      out += String.fromCharCode(Number(b & 255n));
      b >>= 8n;
    }
    return out;
  };
  // the routes live on Telos, so read them from Telos whichever network is active
  async function alcorRoutes() {
    const body = { code: "bridge.alcor", scope: "bridge.alcor", table: "routes", json: true, limit: 200 };
    if (K === "telos") return (await qr(body)).rows || [];
    for (const u of WHCHAINS.telos.rpc) {
      try {
        const r = await Wf(`${u}/v1/chain/get_table_rows`, { method: "POST", body: JSON.stringify(body) }, 12e3);
        if (r.ok) return (await r.json()).rows || [];
      } catch {}
    }
    return [];
  }
  const recipientOk = (dom, v) => {
    const d = ALCOR[String(dom)];
    if (!d) return false;
    return d.evm ? isEvm(v) : WH.checkAccountName(v).ok;
  };
  // courier fee (Telos units) so an EVM payout is delivered without the recipient releasing it
  const EVMID = { "1": "mainnet", "56": "bsc", "137": "polygon" };
  async function courierFee(domain, sym) {
    const id = EVMID[String(domain)];
    if (!id) return null;
    try {
      return WHAX.courierFee(await WHAX.fees(), id, sym);
    } catch {
      return null;
    }
  }
  return { list, lastActivity, status, isEvm, isBtc, ALCOR, symCode, alcorRoutes, recipientOk, courierFee };
})();

function WH_Bridges({ session: t, onNeedLogin: e, toast: r, onBack: n }) {
  const me = Di(t);
  const [focus] = De.useState(() => WH.takeSub("", null));
  De.useEffect(() => {
    if (!focus) return;
    const id = setTimeout(() => document.getElementById(`br-${focus}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 250);
    return () => clearTimeout(id);
  }, []);
  const jump = (id) => document.getElementById(`br-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  const [acts, setActs] = De.useState({});
  const [bals, setBals] = De.useState([]);
  const [tick, setTick] = De.useState(0);
  const [confirm, setConfirm] = De.useState(null);
  const [busy, setBusy] = De.useState(false);
  De.useEffect(() => {
    let live = true;
    WHBR.list.forEach(async (b) => {
      const times = await Promise.all((b.contracts || []).map(WHBR.lastActivity));
      const known = times.filter((x) => x !== null);
      const ts = known.length ? Math.max(...known) : null;
      live && setActs((s) => ({ ...s, [b.id]: ts }));
    });
    return () => {
      live = false;
    };
  }, []);
  De.useEffect(() => {
    me ? H9(me).then(setBals).catch(() => setBals([])) : setBals([]);
  }, [me, tick]);
  const ask = (title, actions, details = [], warning) => {
    if (!t) return e();
    setConfirm({ title, actions, details: [{ label: "Account", value: me }, ...details], warning });
  };
  async function run() {
    setBusy(true);
    try {
      const res = await yo(t, confirm.actions);
      r(pn(res) ? `Transaction sent\n${pn(res)}` : "Transaction sent", "success");
      setConfirm(null);
      setTimeout(() => setTick((x) => x + 1), 1800);
    } catch (err) {
      r(err?.message || String(err), "error");
    } finally {
      setBusy(false);
    }
  }
  const p = { me, signedIn: !!t, ask, bals, tick, login: e };
  return (
    <>
      <div className="back-row">
        <button className="btn sm" onClick={n}>
          ← More
        </button>
        <h1 style={{ margin: 0, flex: 1 }}>Bridges</h1>
      </div>
      <p className="sub">Every bridge that runs, or ran, on {WHCHAIN.name}, with its live status from the chain. Old bridges are listed so you can find and recover wrapped tokens you may still hold.</p>
      <CR_Help title="Bridge safety">
        <p>A bridge moves value between chains by locking it on one side and issuing a wrapped version on the other. Wrapped tokens are only worth what the bridge can still redeem.</p>
        <p>Double-check every address you type: a wrong or wrong-network address usually means the funds are gone. Try a small amount first. Inactive bridges may never complete a transfer.</p>
      </CR_Help>
      {WHBR.list.length > 1 && (
        <div className="wh-chips" style={{ margin: "4px 0 12px" }}>
          <span className="faint" style={{ fontSize: 12 }}>Jump to:</span>
          {WHBR.list.map((b) => (
            <button type="button" key={b.id} className="wh-chip" onClick={() => jump(b.id)}>
              {b.name.replace(/ \(.*\)$/, "")}
            </button>
          ))}
        </div>
      )}
      {!t && WHBR.list.length > 0 && (
        <div className="card" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, fontSize: 13 }}>Sign in to see your bridged balances and use every bridge below.</div>
          <button className="btn primary sm" onClick={e}>
            Sign in
          </button>
        </div>
      )}
      {WHBR.list.length === 0 && <WH_Empty title="No bridges on this network" text="Jungle 4 is a testnet. Switch to a mainnet to see its bridges." />}
      {WHBR.list.map((b) => {
        const st = WHBR.status(acts[b.id]);
        const mine = bals.filter((x) => (b.tokens || []).includes(x.contract) && Number(x.amount) > 0);
        return (
          <div className="card" key={b.id} id={`br-${b.id}`} style={{ scrollMarginTop: 12 }}>
            <div className="row" style={{ alignItems: "flex-start" }}>
              <div style={{ minWidth: 0 }}>
                <h3 style={{ margin: 0 }}>{b.name}</h3>
                <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>{b.what}</div>
              </div>
              <span className={`pill ${st.cls}`}>{acts[b.id] === undefined ? "Checking…" : st.label}</span>
            </div>
            <div className="faint mono" style={{ fontSize: 10.5, margin: "6px 0" }}>{(b.contracts || []).join(" · ")}</div>
            {mine.length > 0 && (
              <div style={{ margin: "6px 0 10px" }}>
                <div className="label">Your bridged tokens</div>
                {mine.map((x) => (
                  <div className="kv" key={x.contract + x.currency}>
                    <span>
                      {NV.fmt(x.amount, 8)} {x.currency}
                    </span>
                    <span className="faint">{x.contract}</span>
                  </div>
                ))}
              </div>
            )}
            {b.panel === "tevm" && <BR_TelosEvm {...p} />}
            {b.panel === "eosevm" && <BR_EosEvm {...p} />}
            {b.panel === "ptokens" && <BR_PTokens {...p} contracts={b.tokens} />}
            {b.panel === "waxbridge" && <BR_WaxBridge {...p} />}
            {b.panel === "alcorhub" && <BR_AlcorHub {...p} />}
            {b.panel === "librebtc" && <BR_LibreBtc {...p} />}
            {b.panel === "libreusdt" && <BR_LibreUsdt {...p} />}
            {b.panel === "alcorspoke" && <BR_AlcorSpoke {...p} />}
            {b.panel === "ibc" && (
              <p className="faint" style={{ fontSize: 12, margin: 0 }}>
                {b.id === "wombat"
                  ? "Wombat's bridge has closed. Its wrapped tokens can still be sent from your wallet and traded where a market exists, but they can no longer be redeemed through Wombat."
                  : "IBC transfers are completed by submitting block proofs, which the Antelope IBC web app does for you. Wrapped tokens above can still be sent and traded here. To move them back, use the IBC app while its provers are running."}
              </p>
            )}
            {b.panel === "ibc" && p.signedIn && mine.length === 0 && <p className="faint" style={{ fontSize: 12, margin: "6px 0 0" }}>You don't hold any tokens from this bridge on {WHCHAIN.name}.</p>}
            {b.panel === "xprwrap" && (
              <p className="faint" style={{ fontSize: 12, margin: 0 }}>
                Deposits and withdrawals of X-tokens go through the XPR wallet (WebAuth) or Metal X, which work out the network fee for you. X-tokens above can be sent and traded here.
              </p>
            )}
            {b.id === "alcor" && WHGATE.tool("alcorx") && (
              <div className="wh-chips" style={{ marginTop: 10 }}>
                <button type="button" className="wh-chip accent" onClick={() => WH.nav({ tab: "more", tool: "alcorx", sub: "receive" })}>
                  Receive from Ethereum, BNB, Polygon…
                </button>
                <button type="button" className="wh-chip accent" onClick={() => WH.nav({ tab: "more", tool: "alcorx", sub: "swap" })}>
                  Swap to another token & chain
                </button>
              </div>
            )}
            <BR_Footer b={b} />
          </div>
        );
      })}
      <WH_Confirm open={!!confirm} title={confirm?.title || ""} details={confirm?.details || []} warning={confirm?.warning} busy={busy} onClose={() => !busy && setConfirm(null)} onConfirm={run} />
    </>
  );
}

/* ----------------------------------------------------------- Telos EVM */
function BR_TelosEvm({ me, signedIn, ask, bals, tick }) {
  const [to, setTo] = De.useState("");
  const [amt, setAmt] = De.useState("");
  const [linked, setLinked] = De.useState(null);
  const [wd, setWd] = De.useState("");
  De.useEffect(() => {
    if (!me) return;
    qr({ code: "eosio.evm", scope: "eosio.evm", table: "account", index_position: 3, key_type: "name", lower_bound: me, upper_bound: me, limit: 1 })
      .then((x) => setLinked(((x.rows || [])[0] && x.rows[0].account === me && x.rows[0]) || false))
      .catch(() => setLinked(false));
  }, [me, tick]);
  const tlos = Number((bals || []).find((b) => b.currency === "TLOS" && b.contract === "eosio.token")?.amount || 0);
  const evmBal = linked ? Number(BigInt("0x" + (linked.balance || "0")) / 10n ** 14n) / 1e4 : 0;
  const a = Number(String(amt).replace(",", "."));
  const w = Number(String(wd).replace(",", "."));
  return (
    <>
      <div className="label">Send TLOS to an EVM address</div>
      <input className={`input ${to && !WHBR.isEvm(to) ? "wh-invalid" : ""}`} placeholder="0x… (your MetaMask / EVM wallet address)" value={to} onChange={(ev) => setTo(ev.target.value.trim())} autoCapitalize="none" spellCheck={false} />
      {to && !WHBR.isEvm(to) && <div className="wh-field-msg err">An EVM address is 0x followed by 40 hex characters.</div>}
      <div style={{ height: 8 }} />
      <WH_AmountInput label="Amount" value={amt} max={signedIn ? String(tlos) : ""} symbol="TLOS" onChange={setAmt} />
      <button className="btn primary block" disabled={!WHBR.isEvm(to) || !(a > 0) || (signedIn && a > tlos)} onClick={() => ask("Send TLOS to Telos EVM", [{ account: "eosio.token", name: "transfer", data: { from: me, to: "eosio.evm", quantity: `${a.toFixed(4)} TLOS`, memo: to.toLowerCase() } }], [{ label: "EVM address", value: to }, { label: "Amount", value: `${a.toFixed(4)} TLOS` }], "TLOS arrives at that EVM address within seconds. Double-check the address: EVM transfers can't be reversed.")}>
        Review deposit
      </button>
      {signedIn && linked && (
        <div style={{ marginTop: 14 }}>
          <div className="label">Your linked EVM address</div>
          <div className="kv">
            <span className="mono" style={{ fontSize: 12 }}>0x{linked.address}</span>
            <span>{NV.fmt(evmBal)} TLOS</span>
          </div>
          {evmBal > 0 && (
            <>
              <WH_AmountInput label="Withdraw to your Telos account" value={wd} max={String(evmBal)} symbol="TLOS" onChange={setWd} />
              <button className="btn block" disabled={!(w > 0) || w > evmBal + 1e-9} onClick={() => ask("Withdraw from Telos EVM", [{ account: "eosio.evm", name: "withdraw", data: { to: me, quantity: `${w.toFixed(4)} TLOS` } }], [{ label: "Amount", value: `${w.toFixed(4)} TLOS` }])}>
                Review withdrawal
              </button>
            </>
          )}
        </div>
      )}
      {signedIn && linked === false && <div className="faint" style={{ fontSize: 12, marginTop: 10 }}>{me} has no linked EVM address. Deposits to any 0x address still work.</div>}
    </>
  );
}

/* ------------------------------------------------------------- EOS EVM */
function BR_EosEvm({ me, signedIn, ask, bals, login }) {
  const [reg, setReg] = De.useState([]);
  const [tok, setTok] = De.useState("");
  const [to, setTo] = De.useState("");
  const [amt, setAmt] = De.useState("");
  De.useEffect(() => {
    qr({ code: "eosio.erc2o", scope: "eosio.erc2o", table: "tokens", limit: 100 }).then((x) => setReg(x.rows || [])).catch(() => setReg([]));
  }, []);
  const mine = (bals || []).filter((b) => reg.some((r) => r.token_contract === b.contract && String(r.ingress_fee).split(" ")[1] === b.currency) && Number(b.amount) > 0);
  const sel = mine.find((b) => `${b.contract}:${b.currency}` === tok) || mine[0];
  const r = sel && reg.find((x) => x.token_contract === sel.contract && String(x.ingress_fee).split(" ")[1] === sel.currency);
  const a = Number(String(amt).replace(",", "."));
  const fee = r ? Number(String(r.ingress_fee).split(" ")[0]) : 0;
  return (
    <>
      <p className="muted" style={{ fontSize: 12.5, margin: "0 0 8px" }}>
        Supported tokens: {reg.map((x) => String(x.ingress_fee).split(" ")[1]).join(", ") || "…"}. Each has a small entry fee, taken from the amount.
      </p>
      {signedIn && mine.length === 0 && <div className="faint" style={{ fontSize: 12.5 }}>You don't hold any supported token right now.</div>}
      {!signedIn && <BR_SignIn login={login} what="send your tokens to EOS EVM" />}
      {sel && (
        <>
          <CR_F label="Token">
            <select className="select" value={`${sel.contract}:${sel.currency}`} onChange={(ev) => setTok(ev.target.value)}>
              {mine.map((b) => (
                <option key={b.contract + b.currency} value={`${b.contract}:${b.currency}`}>
                  {b.currency} ({NV.fmt(b.amount, 8)})
                </option>
              ))}
            </select>
          </CR_F>
          <input className={`input ${to && !WHBR.isEvm(to) ? "wh-invalid" : ""}`} placeholder="0x… EVM address" value={to} onChange={(ev) => setTo(ev.target.value.trim())} autoCapitalize="none" spellCheck={false} />
          <div style={{ height: 8 }} />
          <WH_AmountInput label={`Amount (fee ${r?.ingress_fee})`} value={amt} max={String(sel.amount)} symbol={sel.currency} onChange={setAmt} />
          <button className="btn primary block" disabled={!WHBR.isEvm(to) || !(a > fee) || a > Number(sel.amount)} onClick={() => ask(`Send ${sel.currency} to EOS EVM`, [{ account: sel.contract, name: "transfer", data: { from: me, to: "eosio.evmin", quantity: `${a.toFixed(sel.decimals)} ${sel.currency}`, memo: to } }], [{ label: "EVM address", value: to }, { label: "Amount", value: `${a.toFixed(sel.decimals)} ${sel.currency}` }, { label: "Entry fee", value: r.ingress_fee }], "The tokens arrive at that EVM address minus the fee. Double-check the address.")}>
            Review deposit
          </button>
        </>
      )}
    </>
  );
}

/* --------------------------------------------------------- pNetwork */
function BR_PTokens({ me, signedIn, ask, bals, contracts, login }) {
  const CHAIN = { PBTC: { id: "01EC97DE", net: "Bitcoin", ok: WHBR.isBtc }, PUSDT: { id: "005FE7F9", net: "Ethereum", ok: WHBR.isEvm } };
  const mine = (bals || []).filter((b) => contracts.includes(b.contract) && Number(b.amount) > 0);
  const [dest, setDest] = De.useState({});
  const [amt, setAmt] = De.useState({});
  if (!signedIn) return <BR_SignIn login={login} what="see your pTokens and redeem them" />;
  if (!mine.length) return <p className="faint" style={{ fontSize: 12, margin: 0 }}>You don't hold any pTokens on {WHCHAIN.name}.</p>;
  return (
    <>
      <div className="warn">pNetwork has wound down many of its routes. Before redeeming, check on pNetwork's own channels that redemptions to that network are still being processed. Otherwise the tokens are burned and may not arrive.</div>
      {mine.map((b) => {
        const c = CHAIN[b.currency];
        const k = b.contract;
        const a = Number(String(amt[k] || "").replace(",", "."));
        const d = (dest[k] || "").trim();
        return (
          <div key={k} style={{ marginBottom: 12 }}>
            <b>
              {NV.fmt(b.amount, 9)} {b.currency}
            </b>
            {!c ? (
              <div className="faint" style={{ fontSize: 12 }}>Redeeming {b.currency} isn't wired in the app (its redeem format couldn't be verified on-chain). Use the Contract console → {k} → redeem2 if you know the details.</div>
            ) : (
              <>
                <input className={`input ${d && !c.ok(d) ? "wh-invalid" : ""}`} style={{ marginTop: 6 }} placeholder={`Your ${c.net} address`} value={dest[k] || ""} onChange={(ev) => setDest({ ...dest, [k]: ev.target.value })} autoCapitalize="none" spellCheck={false} />
                <div style={{ height: 8 }} />
                <WH_AmountInput label="Amount to redeem" value={amt[k] || ""} max={b.amount} symbol={b.currency} onChange={(v) => setAmt({ ...amt, [k]: v })} />
                <button className="btn block" disabled={!c.ok(d) || !(a > 0) || a > Number(b.amount)} onClick={() => ask(`Redeem ${b.currency} to ${c.net}`, [{ account: k, name: "redeem2", data: { sender: me, quantity: `${a.toFixed(b.decimals)} ${b.currency}`, memo: d, user_data: "", chain_id: c.id } }], [{ label: "To", value: `${d} (${c.net})` }, { label: "Amount", value: `${a.toFixed(b.decimals)} ${b.currency}` }], `The ${b.currency} is burned here and pNetwork sends the original asset to that ${c.net} address. This can't be undone.`)}>
                  Review redemption
                </button>
              </>
            )}
          </div>
        );
      })}
    </>
  );
}

/* --------------------------------------------------------- WAX bridge */
function BR_WaxBridge({ me, signedIn, ask, tick, login }) {
  const [pending, setPending] = De.useState([]);
  const [hash, setHash] = De.useState("");
  De.useEffect(() => {
    if (!me) return;
    Promise.all([
      qr({ code: "bridge.wax", scope: "bridge.wax", table: "evmtokentx.a", limit: 500 }).then((x) => (x.rows || []).filter((r) => r.wax_to_account === me).map((r) => ({ ...r, kind: "token" }))),
      qr({ code: "bridge.wax", scope: "bridge.wax", table: "evmnfttx.a", limit: 500 }).then((x) => (x.rows || []).filter((r) => r.wax_to_account === me).map((r) => ({ ...r, kind: "nft" }))),
    ])
      .then(([a, b]) => setPending([...a, ...b]))
      .catch(() => setPending([]));
  }, [me, tick]);
  const okHash = /^(0x)?[0-9a-fA-F]{64}$/.test(hash.trim());
  return (
    <>
      <p className="muted" style={{ fontSize: 12.5, margin: "0 0 8px" }}>
        Transfers into WAX from Ethereum, BNB Chain or Solana sometimes need a final claim on WAX. Anything waiting for {signedIn ? me : "you"} appears below. To send out of WAX, use the official WAX bridge site.
      </p>
      {pending.map((p) => (
        <div className="kv" key={p.id} style={{ alignItems: "center" }}>
          <span>
            {p.kind === "token" ? WH.trimAsset(p.wax_receive_token.quantity) : `${(p.evm_token_ids || []).length} NFT(s)`} from {p.evm_chain}
          </span>
          <button className="btn sm primary" onClick={() => ask("Claim bridged " + (p.kind === "token" ? "tokens" : "NFTs"), [p.kind === "token" ? { account: "bridge.wax", name: "claimtoken", data: { evm_tx_hash: p.evm_tx_hash } } : { account: "bridge.wax", name: "claimnft", data: { evm_chain: p.evm_chain, evm_tx_hash: p.evm_tx_hash } }])}>
            Claim
          </button>
        </div>
      ))}
      {signedIn && pending.length === 0 && <div className="faint" style={{ fontSize: 12.5, marginBottom: 8 }}>Nothing waiting to be claimed for {me}.</div>}
      {!signedIn && <BR_SignIn login={login} what="see transfers waiting for you" />}
      <div className="label" style={{ marginTop: 8 }}>Claim by source transaction hash</div>
      <div className="search" style={{ marginBottom: 0 }}>
        <input className={`input ${hash && !okHash ? "wh-invalid" : ""}`} placeholder="0x… transaction hash on the other chain" value={hash} onChange={(ev) => setHash(ev.target.value.trim())} autoCapitalize="none" spellCheck={false} />
        <button className="btn" disabled={!okHash} onClick={() => ask("Claim bridged tokens", [{ account: "bridge.wax", name: "claimtoken", data: { evm_tx_hash: hash.trim().replace(/^0x/, "") } }], [{ label: "Source tx", value: hash.trim() }])}>
          Claim
        </button>
      </div>
    </>
  );
}

/* ------------------------------------------------- Alcor hub (Telos) */
function BR_AlcorHub({ me, signedIn, ask, tick, bals, login }) {
  const [claims, setClaims] = De.useState([]);
  De.useEffect(() => {
    me ? qr({ code: "bridge.alcor", scope: me, table: "claims", limit: 50 }).then((x) => setClaims((x.rows || []).filter((c) => NV.num(c.balance) > 0))).catch(() => setClaims([])) : setClaims([]);
  }, [me, tick]);
  if (!signedIn)
    return (
      <>
        <BR_SignIn login={login} what="claim parked balances and send tokens out" />
        <BR_AlcorOut me={me} signedIn={false} ask={ask} bals={bals} />
      </>
    );
  return (
    <>
      <div className="label">Claimable</div>
      {claims.length ? (
        claims.map((c) => (
          <div className="kv" key={c.balance} style={{ alignItems: "center" }}>
            <span>{WH.trimAsset(c.balance)} claimable</span>
            <button className="btn sm primary" onClick={() => ask("Claim from Alcor bridge", [{ account: "bridge.alcor", name: "claim", data: { owner: me, sym_code: String(c.balance).split(" ")[1] } }], [{ label: "Amount", value: c.balance }])}>
              Claim
            </button>
          </div>
        ))
      ) : (
        <div className="faint" style={{ fontSize: 12.5, marginBottom: 10 }}>Nothing claimable from the Alcor bridge for {me}.</div>
      )}
      <BR_AlcorOut me={me} signedIn ask={ask} bals={bals} />
    </>
  );
}

/* Telos hub: send a wrap.alcor token out to another network */
function BR_AlcorOut({ me, signedIn, ask, bals }) {
  const [routes, setRoutes] = De.useState(null);
  const [tok, setTok] = De.useState("");
  const [dom, setDom] = De.useState("");
  const [to, setTo] = De.useState("");
  const [amt, setAmt] = De.useState("");
  De.useEffect(() => {
    WHBR.alcorRoutes().then(setRoutes).catch(() => setRoutes([]));
  }, []);
  const open = (routes || []).filter((r) => Number(r.withdrawals_open) && WHBR.ALCOR[String(r.domain)]).map((r) => ({ ...r, sym: WHBR.symCode(r.asset_id), domain: String(r.domain) }));
  const syms = [...new Set(open.map((r) => r.sym))];
  const mine = (bals || []).filter((b) => b.contract === "wrap.alcor" && syms.includes(b.currency) && Number(b.amount) > 0);
  const sel = mine.find((b) => b.currency === tok) || mine[0];
  const dests = sel ? open.filter((r) => r.sym === sel.currency) : [];
  const route = dests.find((r) => r.domain === dom) || dests[0];
  const d = route && WHBR.ALCOR[route.domain];
  const a = Number(String(amt).replace(",", "."));
  const max = route && sel ? Number(route.max_withdrawal) / 10 ** sel.decimals : 0;
  // the route's min_deposit also bounds withdrawals (the contract refuses less)
  const min = route && sel ? Number(route.min_deposit || 0) / 10 ** sel.decimals : 0;
  const [cfee, setCfee] = De.useState(null);
  De.useEffect(() => {
    if (!(route && sel && d?.evm)) return setCfee(null);
    setCfee(undefined);
    WHBR.courierFee(route.domain, sel.currency).then(setCfee);
  }, [route?.domain, sel?.currency]);
  const outMemo = route ? `${route.domain}:${to}${d?.evm && cfee ? `:${cfee}` : ""}` : "";
  return (
    <div style={{ marginTop: 12 }}>
      <div className="label">Send out through the bridge</div>
      <p className="muted" style={{ fontSize: 12.5, margin: "0 0 8px" }}>
        Open routes: {syms.length ? syms.map((x) => `${x} → ${open.filter((r) => r.sym === x).map((r) => WHBR.ALCOR[r.domain].name).join(", ")}`).join(" · ") : routes ? "none right now" : "loading…"}
      </p>
      {signedIn && routes && mine.length === 0 && <div className="faint" style={{ fontSize: 12.5 }}>You don't hold a bridgeable wrap.alcor token on Telos.</div>}
      {sel && route && (
        <>
          <CR_F label="Token">
            <select className="select" value={sel.currency} onChange={(ev) => setTok(ev.target.value)}>
              {mine.map((b) => (
                <option key={b.currency} value={b.currency}>
                  {b.currency} ({NV.fmt(b.amount, 8)})
                </option>
              ))}
            </select>
          </CR_F>
          <CR_F label="Send to">
            <select className="select" value={route.domain} onChange={(ev) => setDom(ev.target.value)}>
              {dests.map((r) => (
                <option key={r.domain} value={r.domain}>
                  {WHBR.ALCOR[r.domain].name}
                </option>
              ))}
            </select>
          </CR_F>
          <input className={`input ${to && !WHBR.recipientOk(route.domain, to) ? "wh-invalid" : ""}`} placeholder={d.evm ? `0x… ${d.name} address` : `${d.name} account name`} value={to} onChange={(ev) => setTo(ev.target.value.trim())} autoCapitalize="none" spellCheck={false} />
          <div style={{ height: 8 }} />
          <WH_AmountInput label={`Amount${min ? ` (min ${NV.fmt(min, sel.decimals)}` : ""}${max ? `${min ? ", " : " ("}max ${NV.fmt(max, sel.decimals)} per transfer` : ""}${min || max ? ")" : ""}`} value={amt} max={String(sel.amount)} symbol={sel.currency} onChange={setAmt} />
          {a > 0 && a < min && <div className="wh-field-msg err">The bridge only accepts {NV.fmt(min, sel.decimals)} {sel.currency} or more on this route.</div>}
          <button
            className="btn primary block"
            disabled={!WHBR.recipientOk(route.domain, to) || !(a > 0) || a < min || a > Number(sel.amount) || (max > 0 && a > max) || cfee === undefined}
            onClick={() =>
              ask(
                `Send ${sel.currency} to ${d.name}`,
                [{ account: "wrap.alcor", name: "transfer", data: { from: me, to: "bridge.alcor", quantity: `${a.toFixed(sel.decimals)} ${sel.currency}`, memo: outMemo } }],
                [{ label: "To", value: `${to} on ${d.name}` }, { label: "Amount", value: `${a.toFixed(sel.decimals)} ${sel.currency}` }, ...(d.evm ? [{ label: "Courier fee", value: cfee ? `${(Number(cfee) / 10 ** sel.decimals).toFixed(sel.decimals)} ${sel.currency} (delivered for you)` : "none: the recipient releases it on " + d.name }] : []), { label: "Memo", value: outMemo }],
                d.evm && !cfee ? `Couldn't get Alcor's courier fee, so the recipient must release it on ${d.name} with their own wallet and gas.` : `The bridge releases ${sel.currency} on ${d.name}, usually within minutes. Double-check the ${d.evm ? "address" : "account"}: a wrong one can't be reversed.`,
              )
            }
          >
            Review transfer
          </button>
        </>
      )}
    </div>
  );
}

/* Alcor on WAX / EOS / XPR: deposit to Telos or route straight through */
function BR_AlcorSpoke({ me, signedIn, ask, bals, login }) {
  const [cfg, setCfg] = De.useState(null);
  const [list, setList] = De.useState(null);
  const [routes, setRoutes] = De.useState([]);
  const [tok, setTok] = De.useState("");
  const [dom, setDom] = De.useState("telos");
  const [to, setTo] = De.useState("");
  const [amt, setAmt] = De.useState("");
  De.useEffect(() => {
    qr({ code: "bridge.alcor", scope: "bridge.alcor", table: "config", limit: 1 }).then((x) => setCfg((x.rows || [])[0] || false)).catch(() => setCfg(false));
    const scopes = [...new Set(["eosio.token", "wrap.alcor", ...(WHCHAIN.vaulta ? ["core.vaulta"] : []), ...(WHCHAIN.key === "xpr" ? ["mon3y"] : [])])];
    Promise.all(scopes.map((c) => qr({ code: "bridge.alcor", scope: c, table: "listing", limit: 50 }).then((x) => (x.rows || []).map((r) => ({ ...r, contract: c }))).catch(() => [])))
      .then((x) => setList(x.flat().filter((r) => Number(r.enabled))))
      .catch(() => setList([]));
    WHBR.alcorRoutes().then(setRoutes).catch(() => setRoutes([]));
  }, []);
  De.useEffect(() => {
    if (me && !to && dom === "telos") setTo(me);
  }, [me]);
  const own = cfg && String(cfg.domain);
  const paused = cfg && Number(cfg.paused);
  const listed = (list || []).map((r) => ({ ...r, code: String(r.sym).split(",")[1], dec: Number(String(r.sym).split(",")[0]) }));
  const mine = (bals || []).filter((b) => listed.some((l) => l.contract === b.contract && l.code === b.currency) && Number(b.amount) > 0);
  const sel = mine.find((b) => `${b.contract}:${b.currency}` === tok) || mine[0];
  const lst = sel && listed.find((l) => l.contract === sel.contract && l.code === sel.currency);
  const minDep = lst ? Number(lst.min_deposit) / 10 ** lst.dec : 0;
  const onward = sel ? routes.filter((r) => Number(r.withdrawals_open) && WHBR.symCode(r.asset_id) === sel.currency && String(r.domain) !== own && WHBR.ALCOR[String(r.domain)]).map((r) => String(r.domain)) : [];
  const dest = dom !== "telos" && onward.includes(dom) ? dom : "telos";
  const d = dest === "telos" ? { name: "Telos", ant: "telos" } : WHBR.ALCOR[dest];
  const okTo = dest === "telos" ? WH.checkAccountName(to).ok : WHBR.recipientOk(dest, to);
  const a = Number(String(amt).replace(",", "."));
  const [cfee, setCfee] = De.useState(null);
  De.useEffect(() => {
    if (!(sel && d?.evm)) return setCfee(null);
    setCfee(undefined);
    WHBR.courierFee(dest, sel.currency).then(setCfee);
  }, [dest, sel?.currency]);
  const memo = dest === "telos" ? to : `hop.alcor:${dest}:${to}${d?.evm && cfee ? `:${cfee}` : ""}|${own}:${me}`;
  return (
    <>
      <p className="muted" style={{ fontSize: 12.5, margin: "0 0 8px" }}>
        Bridgeable here: {listed.length ? listed.map((l) => `${l.code} (min ${NV.fmt(Number(l.min_deposit) / 10 ** l.dec, l.dec)})`).join(", ") : list ? "none listed" : "loading…"}. Tokens go to Telos first; the app can route them straight on to Ethereum, BNB Chain, Polygon or another Antelope chain.
      </p>
      {paused ? <div className="warn">The Alcor bridge is paused on {WHCHAIN.name} right now. Try again later.</div> : null}
      {!signedIn && <BR_SignIn login={login} what="send your tokens across" />}
      {signedIn && list && mine.length === 0 && <div className="faint" style={{ fontSize: 12.5 }}>You don't hold a token the bridge accepts right now.</div>}
      {sel && lst && cfg && !paused && (
        <>
          <CR_F label="Token">
            <select className="select" value={`${sel.contract}:${sel.currency}`} onChange={(ev) => setTok(ev.target.value)}>
              {mine.map((b) => (
                <option key={b.contract + b.currency} value={`${b.contract}:${b.currency}`}>
                  {b.currency} ({NV.fmt(b.amount, 8)})
                </option>
              ))}
            </select>
          </CR_F>
          <CR_F label="Send to">
            <select
              className="select"
              value={dest}
              onChange={(ev) => {
                setDom(ev.target.value);
                setTo(ev.target.value === "telos" ? me : "");
              }}
            >
              <option value="telos">Telos (your Telos account)</option>
              {onward.map((x) => (
                <option key={x} value={x}>
                  {WHBR.ALCOR[x].name} (through Telos)
                </option>
              ))}
            </select>
          </CR_F>
          <input className={`input ${to && !okTo ? "wh-invalid" : ""}`} placeholder={d.evm ? `0x… ${d.name} address` : `${d.name} account name`} value={to} onChange={(ev) => setTo(ev.target.value.trim())} autoCapitalize="none" spellCheck={false} />
          {dest === "telos" && <div className="faint" style={{ fontSize: 11.5, marginTop: 4 }}>Your Telos account usually has the same name as this one, but check: it must already exist on Telos.</div>}
          <div style={{ height: 8 }} />
          <WH_AmountInput label={`Amount (minimum ${NV.fmt(minDep, lst.dec)} ${sel.currency})`} value={amt} max={String(sel.amount)} symbol={sel.currency} onChange={setAmt} />
          <button
            className="btn primary block"
            disabled={!okTo || !(a >= minDep) || !(a > 0) || a > Number(sel.amount) || cfee === undefined}
            onClick={() =>
              ask(
                `Send ${sel.currency} to ${d.name}`,
                [{ account: sel.contract, name: "transfer", data: { from: me, to: "bridge.alcor", quantity: `${a.toFixed(sel.decimals)} ${sel.currency}`, memo } }],
                [{ label: "To", value: `${to} on ${d.name}` }, { label: "Amount", value: `${a.toFixed(sel.decimals)} ${sel.currency}` }, ...(d.evm ? [{ label: "Courier fee", value: cfee ? `${(Number(cfee) / 10 ** sel.decimals).toFixed(sel.decimals)} ${sel.currency} (delivered for you)` : "none: the recipient releases it on " + d.name }] : []), { label: "Memo", value: memo }],
                dest === "telos"
                  ? "The bridge releases the tokens on Telos after its guardians confirm, usually within minutes."
                  : `The tokens travel through Telos to ${d.name}, minus bridge fees. If the onward leg fails, they're returned to ${me} here. Double-check the ${d.evm ? "address" : "account"}.`,
              )
            }
          >
            Review transfer
          </button>
        </>
      )}
    </>
  );
}

/* --------------------------------------------------- Libre Bitcoin */
function BR_LibreBtc({ me, signedIn, ask, bals, tick, login }) {
  const [addr, setAddr] = De.useState(null);
  const [to, setTo] = De.useState("");
  const [amt, setAmt] = De.useState("");
  De.useEffect(() => {
    if (!me) return;
    Promise.all(["x.libre", "v.libre"].map((c) => qr({ code: c, scope: c, table: "accounts", lower_bound: me, upper_bound: me, limit: 1 }).then((x) => (x.rows || []).find((r) => r.account === me)).catch(() => null))).then(([a, b]) => setAddr(a || b || false));
  }, [me, tick]);
  const btc = (bals || []).find((b) => b.contract === "btc.libre" && b.currency === "BTC");
  const a = Number(String(amt).replace(",", "."));
  return (
    <>
      {signedIn && (
        <div style={{ marginBottom: 12 }}>
          <div className="label">Your Bitcoin deposit address (peg-in)</div>
          {addr ? (
            <div className="row" style={{ justifyContent: "flex-start", gap: 6 }}>
              <span className="mono" style={{ fontSize: 12, wordBreak: "break-all" }}>{addr.btc_address}</span>
              <WH_CopyBtn text={addr.btc_address} label="Copy BTC address" />
            </div>
          ) : (
            <div className="faint" style={{ fontSize: 12.5 }}>No deposit address assigned to {me} yet. Libre assigns one when you request it in the Libre wallet.</div>
          )}
          <div className="faint" style={{ fontSize: 11.5, marginTop: 4 }}>Send real BTC to this address and the bridge mints BTC on Libre to your account after confirmations.</div>
        </div>
      )}
      {!signedIn && <BR_SignIn login={login} what="see your Bitcoin deposit address" />}
      <div className="label">Withdraw to Bitcoin (peg-out)</div>
      <input className={`input ${to && !WHBR.isBtc(to) ? "wh-invalid" : ""}`} placeholder="bc1… Bitcoin address" value={to} onChange={(ev) => setTo(ev.target.value.trim())} autoCapitalize="none" spellCheck={false} />
      <div style={{ height: 8 }} />
      <WH_AmountInput label="Amount" value={amt} max={btc ? btc.amount : ""} symbol="BTC" onChange={setAmt} />
      <button className="btn primary block" disabled={!WHBR.isBtc(to) || !(a > 0) || (btc && a > Number(btc.amount))} onClick={() => ask("Withdraw BTC to Bitcoin", [{ account: "btc.libre", name: "transfer", data: { from: me, to: "x.libre", quantity: `${a.toFixed(8)} BTC`, memo: to } }], [{ label: "To", value: to }, { label: "Amount", value: `${a.toFixed(8)} BTC` }], "The bridge sends real BTC to that address, minus its network fee. Double-check the address.")}>
        Review withdrawal
      </button>
    </>
  );
}

/* --------------------------------------------------- Libre USDT */
function BR_LibreUsdt({ me, signedIn, ask, bals, login }) {
  const [to, setTo] = De.useState("");
  const [amt, setAmt] = De.useState("");
  const usdt = (bals || []).find((b) => b.contract === "usdt.libre" && b.currency === "USDT");
  const a = Number(String(amt).replace(",", "."));
  return (
    <>
      <p className="muted" style={{ fontSize: 12.5, margin: "0 0 8px" }}>
        Withdraw USDT from Libre to an Ethereum address (ERC-20). Deposits are made in the Bitcoin Libre wallet, which gives you a personal deposit address.
      </p>
      {!signedIn && <BR_SignIn login={login} what="withdraw your USDT" />}
      {signedIn && !usdt && <div className="faint" style={{ fontSize: 12.5, marginBottom: 8 }}>{me} holds no USDT on Libre.</div>}
      <div className="label">Withdraw to Ethereum (peg-out)</div>
      <input className={`input ${to && !WHBR.isEvm(to) ? "wh-invalid" : ""}`} placeholder="0x… Ethereum address" value={to} onChange={(ev) => setTo(ev.target.value.trim())} autoCapitalize="none" spellCheck={false} />
      <div style={{ height: 8 }} />
      <WH_AmountInput label="Amount" value={amt} max={usdt ? usdt.amount : ""} symbol="USDT" onChange={setAmt} />
      <button
        className="btn primary block"
        disabled={!WHBR.isEvm(to) || !(a > 30) || (usdt ? a > Number(usdt.amount) : signedIn)}
        onClick={() =>
          ask(
            "Withdraw USDT to Ethereum",
            [{ account: "usdt.libre", name: "transfer", data: { from: me, to: "t.libre", quantity: `${a.toFixed(8)} USDT`, memo: to } }],
            [{ label: "To", value: `${to} (Ethereum)` }, { label: "Amount", value: `${a.toFixed(8)} USDT` }],
            "The bridge takes an Ethereum network fee from the amount (recently between 5 and 30 USDT) and refunds any fraction below 6 decimals. Double-check the address.",
          )
        }
      >
        Review withdrawal
      </button>
      <div className="faint" style={{ fontSize: 11.5, marginTop: 4 }}>Send more than 30 USDT so the fee is always covered.</div>
    </>
  );
}

/* --------------------------------------------------- shared */
function BR_SignIn({ login, what }) {
  return (
    <div className="row" style={{ gap: 8, margin: "4px 0 10px", justifyContent: "flex-start" }}>
      <button className="btn sm primary" onClick={login}>
        Sign in
      </button>
      <span className="faint" style={{ fontSize: 12.5 }}>to {what}.</span>
    </div>
  );
}

function BR_Footer({ b }) {
  const c = (b.contracts || [])[0];
  return (
    <div className="wh-chips" style={{ marginTop: 12, borderTop: "1px solid var(--line, rgba(127,127,127,.18))", paddingTop: 10 }}>
      <button type="button" className="wh-chip" onClick={() => WH.nav({ tab: "more", tool: "console", sub: c })}>
        Open {c} in Console
      </button>
      {WHGATE.tool("rescue") && (
        <button type="button" className="wh-chip" onClick={() => WH.nav({ tab: "more", tool: "rescue" })}>
          Scan in Rescue
        </button>
      )}
      {WHCHAIN.explorer && (
        <a className="wh-chip" href={WH.accountUrl(c)} target="_blank" rel="noopener noreferrer">
          Explorer
        </a>
      )}
    </div>
  );
}

/* ------------------------------------------------ Telos Decide (essentials) */
function NV_TelosDecide({ me, signedIn, ask, tick }) {
  const [ballots, setBallots] = De.useState(null);
  const [reg, setReg] = De.useState([]);
  De.useEffect(() => {
    qr({ code: "telos.decide", scope: "telos.decide", table: "ballots", limit: 300, reverse: !0 })
      .then((x) => setBallots((x.rows || []).filter((b) => b.status === "voting" && Date.parse(b.end_time + "Z") > Date.now())))
      .catch(() => setBallots([]));
    me ? qr({ code: "telos.decide", scope: me, table: "voters", limit: 20 }).then((x) => setReg(x.rows || [])).catch(() => setReg([])) : setReg([]);
  }, [me, tick]);
  const code = (sym) => String(sym).split(",")[1];
  const row = (sym) => reg.find((v) => String(v.liquid || "").endsWith(" " + code(sym)));
  const registered = (sym) => !!row(sym);
  // what would count on this ballot: its settings say whether liquid and/or staked tokens vote.
  // VOTE is recomputed from staked TLOS by the refresh in the same transaction, so it isn't checked here.
  function weightProblem(b) {
    if (!me || code(b.treasury_symbol) === "VOTE") return null;
    const v = row(b.treasury_symbol);
    const set = Object.fromEntries((b.settings || []).map((x) => [x.key, !!x.value]));
    const liquid = NV.num(v?.liquid), staked = NV.num(v?.staked);
    const counts = (set.voteliquid ? liquid : 0) + (set.votestake !== false ? staked : 0);
    if (counts > 0) return null;
    if (liquid + staked === 0) return `You hold no ${code(b.treasury_symbol)}, which this ballot counts.`;
    return set.votestake !== false && !set.voteliquid ? `This ballot only counts staked ${code(b.treasury_symbol)}. Stake some first (Contract console → telos.decide → stake).` : `Your ${code(b.treasury_symbol)} doesn't count on this ballot.`;
  }
  function vote(b, opt) {
    const acts = [];
    if (!registered(b.treasury_symbol)) acts.push({ account: "telos.decide", name: "regvoter", data: { voter: me, treasury_symbol: b.treasury_symbol, referrer: null } });
    acts.push({ account: "telos.decide", name: "refresh", data: { voter: me } });
    acts.push({ account: "telos.decide", name: "castvote", data: { voter: me, ballot_name: b.ballot_name, options: [opt] } });
    ask(`Vote “${opt}”`, acts, [{ label: "Ballot", value: b.title || b.ballot_name }, { label: "Choice", value: opt }], acts.length > 2 ? "This also registers you as a voter for this ballot's treasury (one-time)." : void 0);
  }
  return (
    <NV_Card title="Telos Decide: governance votes" tag="Vote">
      <p className="muted" style={{ fontSize: 13, margin: "0 0 10px" }}>
        Telos runs its governance on-chain with Telos Decide: proposals, Telos Works funding and community ballots. Each ballot is weighted by its own voting token (for example VOTE, which comes from staked TLOS). Voting the first time registers you for that token.
      </p>
      {ballots === null && De.createElement(ra, { h: 40 })}
      {ballots && ballots.length === 0 && <div className="faint" style={{ fontSize: 13 }}>No ballots are open right now.</div>}
      {(ballots || []).slice(0, 12).map((b) => (
        <div key={b.ballot_name} className="cr-help" style={{ background: "var(--card-2)", borderColor: "var(--line)" }}>
          <b>{b.title || b.ballot_name}</b>
          <div className="faint" style={{ fontSize: 12, margin: "4px 0 8px" }}>
            {b.category} · {b.total_voters} voter(s) · closes {new Date(Date.parse(b.end_time + "Z")).toLocaleString()}
          </div>
          {b.description && !/^n\/?a$/i.test(String(b.description).trim()) && <div className="muted" style={{ fontSize: 12.5, marginBottom: 8 }}>{String(b.description).slice(0, 220)}</div>}
          {weightProblem(b) && <div className="faint" style={{ fontSize: 12, marginBottom: 6 }}>{weightProblem(b)}</div>}
          <div className="wh-chips" style={{ marginTop: 0 }}>
            {(b.options || []).map((o) => (
              <button key={o.key} className="wh-chip big" disabled={!signedIn || !!weightProblem(b)} onClick={() => vote(b, o.key)}>
                {o.key} <span className="faint">{WH.trimAsset(o.value)}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </NV_Card>
  );
}
