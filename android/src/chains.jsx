// Chain picker and per-chain feature rules.

const WHGATE = (() => {
  const H = WHCHAIN.has;
  const tabs = {
    wallet: true,
    nfts: WHCHAIN.hasNfts,
    market: WHCHAIN.hasNfts && H("atomicmarket"),
    drops: H("neftyblocksd") || H("atomicdropsx") || H("nfthivedrops") || H("blend.nefty"),
    more: true,
  };
  const tools = {
    rescue: true,
    console: true,
    native: true,
    bridges: WHCHAIN.key !== "jungle4",
    telosstudio: WHCHAIN.key === "telos",
    alcorx: ["wax", "eos", "telos", "xpr"].includes(WHCHAIN.key),
    xprdefi: WHCHAIN.key === "xpr",
    dao: H("dao.waxdao") || H("farms.waxdao") || H("tf.waxdao"),
    dex: H("swap.alcor") || H("alcordexmain") || H("swap.taco") || H("swap.box") || H("swap.nefty"),
    packs: H("atomicpacksx") || H("neftyblocksp") || H("nfthivepacks"),
    creator: WHCHAIN.hasNfts || H("atomicassets"),
    tools: true,
  };
  const subTools = {
    vote: true,
    power: !!WHCHAIN.powerup,
    account: !!WHCHAIN.staking,
    history: WHCHAIN.hyperion.length > 0,
    portfolio: !!WHCHAIN.delphi && H("swap.alcor"),
    qr: true,
    watch: true,
    links: WHCHAIN.hasNfts && H("atomictoolsx"),
  };
  const dropSources = { nefty: H("neftyblocksd"), atomic: H("atomicdropsx"), hive: H("nfthivedrops"), blends: H("blend.nefty") };
  const swapProviders = { alcor: H("swap.alcor"), nefty: H("swap.nefty"), taco: H("swap.taco"), box: H("swap.box") };
  const firstOf = (map, fallback) => Object.keys(map).find((k) => map[k]) || fallback;
  return {
    tab: (k) => tabs[k] !== false,
    tool: (k) => tools[k] !== false,
    sub: (k) => subTools[k] !== false,
    dropSource: (k) => !!dropSources[k],
    firstDropSource: () => firstOf(dropSources, "nefty"),
    swap: (k) => !!swapProviders[k],
    firstSwap: () => firstOf(swapProviders, "alcor"),
    spot: H("alcordexmain"),
    tabs,
  };
})();

function WH_ChainChip({ onOpen }) {
  return (
    <button type="button" className="wh-chain-chip" onClick={onOpen} aria-label={`Network: ${WHCHAIN.name}. Change network`}>
      <span className="wh-chain-dot" style={{ background: WHCHAIN.color }} />
      <span>{WHCHAIN.chip}</span>
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>
  );
}

function WH_ChainSheet({ open, onClose, signedIn }) {
  return (
    <WH_Sheet open={open} title="Choose a network" onClose={onClose}>
      <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
        Antelope Hub works on these Antelope blockchains. Your keys and accounts are separate on each one. Sign in again after switching (Anchor works on all of them).
      </p>
      {WHCHAIN_ORDER.map((k) => {
        const c = WHCHAINS[k];
        const on = k === WHCHAIN.key;
        const feats = [
          c.atomic.length ? "NFTs" : null,
          c.contracts === "*" || (c.contracts || []).some((x) => /drops|blend/.test(x)) ? "Drops" : null,
          c.contracts === "*" || (c.contracts || []).includes("swap.alcor") ? "Swaps" : null,
          c.freeResources ? "Free resources" : c.powerup ? "PowerUp" : null,
          c.cloudWallet ? "Cloud Wallet" : null,
        ].filter(Boolean);
        return (
          <button key={k} type="button" className={`wh-chain-row ${on ? "on" : ""}`} onClick={() => (on ? onClose() : WHCHAIN.switchTo(k))}>
            <span className="wh-chain-logo" style={{ background: c.color }}>
              {c.chip.slice(0, 1)}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <b>
                {c.name} {c.testnet && <span className="wh-testnet">TESTNET</span>}
              </b>
              <span className="wh-chain-tag">{c.tagline}</span>
              <span className="wh-chain-feats">{["Wallet", "Console", "Rescue", ...feats].join(" · ")}</span>
            </span>
            {on ? <span className="pill good">Current</span> : <span className="faint">›</span>}
          </button>
        );
      })}
      {signedIn && <div className="faint" style={{ fontSize: 12, marginTop: 10 }}>After switching you may need to sign in again on the new network.</div>}
    </WH_Sheet>
  );
}

/* Vaulta ($A) on the EOS network: A and EOS convert 1:1 through core.vaulta.
   Transferring EOS (eosio.token) or A (core.vaulta) to core.vaulta converts it
   and pays the sender back in the other token. Checked by dry run on mainnet;
   swapto to your own account is refused ("cannot transfer to self"). */
function WH_Vaulta({ balances, session, account, viewing, toast, onDone }) {
  const V = WHCHAIN.vaulta;
  const [open, setOpen] = De.useState(false);
  const [dir, setDir] = De.useState("toA");
  const [amt, setAmt] = De.useState("");
  const [busy, setBusy] = De.useState(false);
  const [usd, setUsd] = De.useState(0);
  De.useEffect(() => {
    let live = true;
    if (V && V.delphi) k2(V.delphi).then((m) => live && setUsd(m ? m / 10 ** V.delphiPrec : 0)).catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  if (!V) return null;
  const find = (sym, contract) => (balances || []).find((b) => b.currency === sym && b.contract === contract);
  const a = Number(find(V.sym, V.contract)?.amount || 0);
  const e = Number(find(WHCHAIN.sym, "eosio.token")?.amount || 0);
  const mine = !!session && viewing === account;
  const from = dir === "toA" ? WHCHAIN.sym : V.sym;
  const to = dir === "toA" ? V.sym : WHCHAIN.sym;
  const max = dir === "toA" ? e : a;
  const n = Number(String(amt).replace(",", "."));
  const err = amt && !(n > 0) ? "Enter an amount" : n > max ? "That's more than you have" : "";
  async function go() {
    setBusy(true);
    try {
      const q = `${n.toFixed(V.prec)} ${from}`;
      // a plain transfer to core.vaulta converts 1:1 and pays the sender back
      // (swapto with from = to is refused: "cannot transfer to self")
      const res = await yo(session, [{ account: dir === "toA" ? "eosio.token" : V.contract, name: "transfer", data: { from: account, to: V.contract, quantity: q, memo: "" } }]);
      toast(pn(res) ? `Transaction sent\n${pn(res)}` : "Transaction sent", "success");
      setOpen(false);
      setAmt("");
      setTimeout(onDone, 1500);
    } catch (ex) {
      toast(ex?.message || String(ex), "error");
    } finally {
      setBusy(false);
    }
  }
  const fmt = (x) => x.toLocaleString(void 0, { maximumFractionDigits: 4 });
  return (
    <div className="card wh-vaulta">
      <div className="row">
        <h3 style={{ margin: 0 }}>Vaulta ($A)</h3>
        <span className="pill">1 {WHCHAIN.sym} = 1 A</span>
      </div>
      <p className="muted" style={{ fontSize: 13, margin: "6px 0 10px" }}>
        The network is now called Vaulta, and its new token is A. EOS and A swap 1:1 through the official core.vaulta contract, and either can pay for RAM and PowerUp.
      </p>
      <div className="stat-grid" style={{ gridTemplateColumns: "1fr 1fr", margin: 0 }}>
        <div className="stat">
          <div className="v">{fmt(a)} A</div>
          <div className="k">{usd && a ? `≈ $${(a * usd).toFixed(2)}` : "A balance"}</div>
        </div>
        <div className="stat">
          <div className="v">
            {fmt(e)} {WHCHAIN.sym}
          </div>
          <div className="k">{WHCHAIN.sym} balance</div>
        </div>
      </div>
      {mine && (
        <button type="button" className="btn primary block" style={{ marginTop: 12 }} onClick={() => setOpen(true)}>
          Convert {WHCHAIN.sym} ⇄ A
        </button>
      )}
      <WH_Sheet open={open} title={`Convert ${from} to ${to}`} onClose={() => !busy && setOpen(false)}>
        <div className="tabs">
          <button className={`tab ${dir === "toA" ? "on" : ""}`} onClick={() => { setDir("toA"); setAmt(""); }}>
            {WHCHAIN.sym} → A
          </button>
          <button className={`tab ${dir === "toEOS" ? "on" : ""}`} onClick={() => { setDir("toEOS"); setAmt(""); }}>
            A → {WHCHAIN.sym}
          </button>
        </div>
        <WH_AmountInput label={`Amount of ${from}`} value={amt} max={String(max)} symbol={from} onChange={setAmt} />
        <div className="kv"><span className="muted">You receive</span><span>{n > 0 ? `${n.toFixed(V.prec)} ${to}` : "—"}</span></div>
        <div className="kv"><span className="muted">Rate</span><span>1:1, no fee</span></div>
        <div className="kv"><span className="muted">How</span><span>transfer to core.vaulta (1:1)</span></div>
        {busy && (
          <div className="wh-waiting">
            <div className="spinner" />
            <span>Waiting for your wallet…</span>
          </div>
        )}
        <button type="button" className="btn primary block" style={{ marginTop: 14 }} disabled={busy || !(n > 0) || !!err} onClick={go}>
          {busy ? <div className="spinner" /> : "Approve in wallet"}
        </button>
      </WH_Sheet>
    </div>
  );
}
