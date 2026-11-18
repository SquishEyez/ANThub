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

/* Resources paid in A (Vaulta). An account that moved everything to A (stake
   included) has no CPU/NET left, so nothing it signs goes through, not even an
   NFT transfer. core.vaulta::powerup and ::buyrambytes take A, and a PowerUp
   at the start of a transaction pays for that same transaction (checked by dry
   run on mainnet with A-only accounts that had 0 CPU and 0 NET). So when the
   account is short, yo() puts a small PowerUp (and RAM if needed) in front of
   whatever is being signed. Sized from eosio powup.state; costs a fraction of
   a cent. Turn it off on the Vaulta card. */
const WHFUEL = (() => {
  const KEY = "waxhub.fuelA";
  const TARGET_US = 5000; // ~ a day of normal use
  const TARGET_NET = 10000;
  const LOW_US = 1500;
  const LOW_NET = 1000;
  const LOW_RAM = 800; // a PowerUp order row (~130 bytes) plus a new EOS balance row
  const RAM_BYTES = 1024;
  const num = (x) => Number(String(x ?? 0).split(" ")[0]) || 0;
  const on = () => {
    try {
      return localStorage.getItem(KEY) !== "0";
    } catch {
      return true;
    }
  };
  const set = (v) => {
    try {
      localStorage.setItem(KEY, v ? "1" : "0");
    } catch {}
  };
  const usable = () => !!WHCHAIN.vaulta?.converts;
  // powerup.cpp: calc_powerup_fee (in the core token)
  function fee(r, inc) {
    if (!(inc > 0)) return 0;
    const w = Number(r.weight), ex = Number(r.exponent), mn = num(r.min_price), mx = num(r.max_price);
    const price = (u) => mn + (mx - mn) * Math.pow(u / w, ex - 1);
    const integral = (a, b) => mn * (b / w) - mn * (a / w) + ((mx - mn) / ex) * (Math.pow(b / w, ex) - Math.pow(a / w, ex));
    let start = Number(r.utilization);
    const end = start + inc, adj = Number(r.adjusted_utilization);
    let f = 0;
    if (start < adj) {
      f += (price(adj) * Math.min(inc, adj - start)) / w;
      start = adj;
    }
    if (start < end) f += integral(start, end);
    return f;
  }
  const bal = (me, code, sym) =>
    qr({ code, scope: me, table: "accounts", limit: 20 }).then((x) => num((x.rows || []).find((b) => String(b.balance).endsWith(" " + sym))?.balance)).catch(() => 0);
  // What the account is short of, and the actions that fix it.
  async function quote(me, force = false) {
    const V = WHCHAIN.vaulta;
    const [acct, st, reserv, ram, aBal] = await Promise.all([
      FC(me),
      qr({ code: "eosio", scope: "", table: "powup.state", limit: 1 }).then((x) => (x.rows || [])[0]),
      FC("eosio.reserv"),
      qr({ code: "eosio", scope: "eosio", table: "rammarket", limit: 1 }).then((x) => (x.rows || [])[0]),
      bal(me, V.contract, V.sym),
    ]);
    const eBal = num(acct.core_liquid_balance);
    const cpuLeft = Number(acct.cpu_limit?.available || 0), netLeft = Number(acct.net_limit?.available || 0);
    const ramLeft = Number(acct.ram_quota || 0) - Number(acct.ram_usage || 0);
    const short = { cpu: cpuLeft < LOW_US, net: netLeft < LOW_NET, ram: Number(acct.ram_quota) >= 0 && ramLeft < LOW_RAM };
    const need = force || short.cpu || short.net;
    const out = { me, cpuLeft, netLeft, ramLeft, aBal, eBal, short, acts: [], cost: 0, ok: true };
    if (!need && !short.ram) return out;
    let cost = 0;
    const acts = [];
    if (short.ram || (need && ramLeft < LOW_RAM)) {
      const base = num(ram.base.balance), quoteBal = num(ram.quote.balance);
      cost += ((quoteBal * RAM_BYTES) / (base - RAM_BYTES)) * 1.005 * 1.1;
      acts.push({ account: V.contract, name: "buyrambytes", data: { payer: me, receiver: me, bytes: RAM_BYTES } });
    }
    if (need) {
      const cpuPerW = Number(reserv.cpu_limit.max) / Number(reserv.cpu_weight);
      const netPerW = Number(reserv.net_limit.max) / Number(reserv.net_weight);
      const cpuAmt = TARGET_US / cpuPerW, netAmt = TARGET_NET / netPerW;
      const cpu_frac = Math.ceil((cpuAmt * 1e15) / Number(st.cpu.weight));
      const net_frac = Math.ceil((netAmt * 1e15) / Number(st.net.weight));
      const f = Math.max(fee(st.cpu, cpuAmt) + fee(st.net, netAmt), num(st.min_powerup_fee));
      const max = Math.ceil((f * 1.5 + 0.0005) * 1e4) / 1e4;
      cost += max;
      acts.push({ account: V.contract, name: "powerup", data: { payer: me, receiver: me, days: 1, net_frac: String(net_frac), cpu_frac: String(cpu_frac), max_payment: `${max.toFixed(V.prec)} ${V.sym}` } });
    }
    cost = Math.ceil(cost * 1e4) / 1e4;
    // pay in A; top A up from EOS (1:1 through core.vaulta) if it is short
    const gap = Math.ceil((cost - aBal) * 1e4) / 1e4;
    if (gap > 0) {
      if (eBal >= gap) acts.unshift({ account: "eosio.token", name: "transfer", data: { from: me, to: V.contract, quantity: `${gap.toFixed(WHCHAIN.prec)} ${WHCHAIN.sym}`, memo: "" } });
      else out.ok = false;
    }
    return { ...out, acts, cost };
  }
  // Extra actions for yo(): [] when nothing is needed or it can't be paid.
  async function plan(me, actions) {
    if (!usable() || !on()) return [];
    if (actions.some((x) => x.name === "powerup" || x.name === "buyrambytes" || x.name === "buyram")) return [];
    const q = await quote(me);
    if (!q.acts.length) return [];
    if (!q.ok) {
      WH.toast(`Your account is out of CPU/NET and has under ${q.cost} A to rent more. Add a little A or EOS, or let Anchor cover it (Greymass Fuel).`, "error");
      return [];
    }
    WH.toast(`Out of ${[q.short.cpu && "CPU", q.short.net && "NET", q.short.ram && "RAM"].filter(Boolean).join(" / ")}: adding resources paid in A (up to ${q.cost} A) to this transaction.`, "info");
    return q.acts;
  }
  return { on, set, usable, quote, plan, fee };
})();

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
  const [res, setRes] = De.useState(null);
  const [auto, setAuto] = De.useState(WHFUEL.on());
  const [rtick, setRtick] = De.useState(0);
  De.useEffect(() => {
    let live = true;
    if (account && WHFUEL.usable() && viewing === account) WHFUEL.quote(account).then((q) => live && setRes(q)).catch(() => live && setRes(null));
    return () => {
      live = false;
    };
  }, [account, viewing, rtick]);
  async function topUp() {
    setBusy(true);
    try {
      const q = await WHFUEL.quote(account, true);
      if (!q.ok) throw new Error(`You need about ${q.cost} A (or EOS) to rent resources.`);
      const r = await yo(session, q.acts);
      toast(pn(r) ? `Resources added for 24h\n${pn(r)}` : "Resources added for 24h", "success");
      setTimeout(() => setRtick((x) => x + 1), 1500);
    } catch (ex) {
      toast(ex?.message || String(ex), "error");
    } finally {
      setBusy(false);
    }
  }
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
      {mine && res && WHFUEL.usable() && (
        <div className="wh-fuel" style={{ marginTop: 14 }}>
          <div className="row">
            <b style={{ fontSize: 13.5 }}>Network resources</b>
            <span className={`pill ${res.short.cpu || res.short.net || res.short.ram ? "" : "good"}`}>
              {res.short.cpu || res.short.net || res.short.ram ? `Low ${[res.short.cpu && "CPU", res.short.net && "NET", res.short.ram && "RAM"].filter(Boolean).join(" / ")}` : "OK"}
            </span>
          </div>
          <div className="faint" style={{ fontSize: 12, margin: "4px 0 8px" }}>
            CPU {(res.cpuLeft / 1000).toFixed(2)} ms · NET {(res.netLeft / 1024).toFixed(1)} KB · RAM {(res.ramLeft / 1024).toFixed(1)} KB free
          </div>
          <p className="muted" style={{ fontSize: 12.5, margin: "0 0 8px" }}>
            Moved everything to A, staked {WHCHAIN.sym} included? You can still send NFTs and tokens: A pays for CPU, NET and RAM through core.vaulta, in the same transaction.
          </p>
          <label className="row" style={{ justifyContent: "flex-start", gap: 8, fontSize: 13 }}>
            <input type="checkbox" className="check" checked={auto} onChange={(ev) => { WHFUEL.set(ev.target.checked); setAuto(ev.target.checked); }} />
            <span>Pay for resources with A when I run out</span>
          </label>
          <div className="faint" style={{ fontSize: 11.5, margin: "4px 0 8px" }}>Adds a 24-hour PowerUp (about 5 ms CPU, 10 KB NET), and 1 KB of RAM if needed, to the transaction you sign. Usually well under 0.01 A; your wallet shows the exact actions.</div>
          <button type="button" className="btn block" disabled={busy} onClick={topUp}>
            {busy ? <div className="spinner" /> : "Rent CPU/NET for 24h with A now"}
          </button>
        </div>
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
