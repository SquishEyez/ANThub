// Alcor cross-chain: deposit addresses, cross-chain swaps and transfer tracking,
// built on Alcor's public bridge API (https://telos.alcor.exchange/api/bridge/docs).
//   Receive:  POST /v1/deposit-addresses {chain, to[, memo]}; the EVM address is
//             recomputed on the device (WHAC) and shown only when it matches.
//   Swap:     GET /v1/swap/plan; the actions are signed only after checking they
//             go to Alcor's contracts (swap.alcor, bridge.alcor, book.alcor) from
//             the signed-in account and name the chosen recipient.
//   Get paid: POST /v1/deposit-addresses {chain, to, token[, refund]} (beta).
//   Activity: GET /v1/hops?party=…, recover stuck hops (hop.alcor::recover).

const WHAX = (() => {
  const API = "https://telos.alcor.exchange/api/bridge/v1";
  const MINE = { wax: "wax", eos: "vaulta", telos: "telos", xpr: "xpr" }[WHCHAIN.key] || null;
  const NAMES = { mainnet: "Ethereum", bsc: "BNB Smart Chain", polygon: "Polygon", telos: "Telos", wax: "WAX", xpr: "XPR Network", vaulta: "Vaulta (EOS)", ton: "TON", near: "NEAR", sui: "Sui" };
  const ANT = ["telos", "wax", "xpr", "vaulta"];
  const EVM = ["mainnet", "bsc", "polygon"];
  const COURIER = [...EVM, "ton", "near", "sui"];
  async function get(path) {
    const r = await Wf(API + path, { method: "GET" }, 25e3);
    const j = await r.json().catch(() => null);
    if (!r.ok) throw new Error(j?.error || j?.message || `Alcor API error ${r.status}`);
    return j;
  }
  async function post(path, body) {
    const r = await Wf(API + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }, 25e3);
    const j = await r.json().catch(() => null);
    if (!r.ok) throw new Error(r.status === 429 ? "Alcor limits new addresses to 20 an hour. Try again later." : j?.error || j?.message || `Alcor API error ${r.status}`);
    return j;
  }
  let cache = {};
  const once = (k, fn, ttl = 6e4) => {
    const c = cache[k];
    if (c && Date.now() - c.t < ttl) return c.p;
    const p = fn().catch((e) => {
      delete cache[k];
      throw e;
    });
    cache[k] = { t: Date.now(), p };
    return p;
  };
  const fees = () => once("fees", () => get("/fees"));
  const routes = () => once("routes", () => get("/routes"), 3e5);
  function raw(n, dec) {
    try {
      const v = BigInt(String(n || "0"));
      const s = v.toString().padStart(dec + 1, "0");
      const out = dec ? `${s.slice(0, -dec)}.${s.slice(-dec)}`.replace(/\.?0+$/, "") : s;
      return Number(out).toLocaleString(void 0, { maximumFractionDigits: Math.min(dec, 8) });
    } catch {
      return String(n);
    }
  }
  const big = (a, b) => (BigInt(a || 0) > BigInt(b || 0) ? a : b);
  function recipientOk(chain, v) {
    v = String(v || "").trim();
    if (ANT.includes(chain)) return WH.checkAccountName(v).ok;
    if (EVM.includes(chain)) return /^0x[0-9a-fA-F]{40}$/.test(v);
    if (chain === "ton") return /^(UQ|EQ)[A-Za-z0-9_-]{46}$|^0:[0-9a-fA-F]{64}$|^0x[0-9a-fA-F]{64}$/.test(v);
    if (chain === "near") return /^([a-z0-9_-]+\.)*[a-z0-9_-]+\.near$|^[0-9a-f]{64}$/.test(v) && v.length <= 64;
    if (chain === "sui") return /^0x[0-9a-fA-F]{64}$/.test(v);
    return false;
  }
  const placeholder = (chain) => (ANT.includes(chain) ? `${NAMES[chain]} account name` : EVM.includes(chain) ? `0x… ${NAMES[chain]} address` : chain === "ton" ? "UQ… TON address" : chain === "near" ? "name.near" : "0x… Sui address (64 hex)");
  function courierFee(f, chain, sym) {
    if (!f) return null;
    const list = EVM.includes(chain) ? f.chains?.find((c) => c.id === chain)?.tokens : f[chain]?.tokens;
    return list?.find((t) => t.symbol === sym)?.withdrawal || null;
  }
  // the least worth sending to a deposit address on a network now
  function sendAtLeast(f, net, tok) {
    const list = EVM.includes(net) ? f?.chains?.find((c) => c.id === net)?.tokens : f?.[net]?.tokens;
    const fe = list?.find((t) => String(t.token).toLowerCase() === String(tok.token || "").toLowerCase() || t.symbol === tok.symbol);
    return fe?.forwardsFrom ? big(tok.min, fe.forwardsFrom) : tok.min;
  }
  // a plan is signed only if every action stays inside Alcor's contracts
  function checkPlan(plan, me, recipient, dest) {
    if (!plan?.possible) return plan?.reason || "This swap isn't possible right now.";
    const s = plan.sign;
    if (!s || s.kind !== "actions" || s.chain !== MINE) return "Alcor answered with a transaction for another network.";
    const okTo = ["swap.alcor", "bridge.alcor", "book.alcor"];
    for (const a of s.actions || []) {
      if (a.name === "transfer") {
        if (a.data?.from !== me) return "A transfer in the plan isn't from your account.";
        if (!okTo.includes(a.data?.to)) return `The plan sends to ${a.data?.to}, which isn't an Alcor contract. Not signing it.`;
      } else if (a.name === "open" && a.account === "wrap.alcor") {
        if (!Object.values(a.data || {}).includes(me)) return "The plan opens a balance for another account.";
      } else return `Unexpected action ${a.account}::${a.name} in the plan.`;
    }
    const last = (s.actions || []).filter((a) => a.name === "transfer").pop();
    if (!last) return "The plan has nothing to sign.";
    if ((ANT.includes(dest) || EVM.includes(dest)) && !String(last.data.memo || "").toLowerCase().includes(String(recipient).toLowerCase())) return "The plan doesn't name your recipient. Not signing it.";
    return null;
  }
  return { MINE, NAMES, ANT, EVM, COURIER, get, post, fees, routes, raw, recipientOk, placeholder, courierFee, sendAtLeast, checkPlan };
})();

function WH_Alcor({ session: t, onNeedLogin: e, toast: r, onBack: n }) {
  const me = Di(t);
  const [tab, setTab] = De.useState(() => WH.takeSub("receive", ["receive", "swap", "paid", "activity"]));
  const [confirm, setConfirm] = De.useState(null);
  const [busy, setBusy] = De.useState(false);
  const [tick, setTick] = De.useState(0);
  const ask = (c) => (t ? setConfirm(c) : e());
  async function run() {
    setBusy(true);
    try {
      const acts = confirm.refresh ? await confirm.refresh() : confirm.actions;
      const res = await yo(t, acts);
      r(pn(res) ? `Transaction sent\n${pn(res)}` : "Transaction sent", "success");
      setConfirm(null);
      setTimeout(() => {
        setTick((x) => x + 1);
        setTab("activity");
      }, 1500);
    } catch (err) {
      r(err?.message || String(err), "error");
    } finally {
      setBusy(false);
    }
  }
  const p = { me, signedIn: !!t, login: e, ask, toast: r, tick };
  return (
    <>
      <div className="back-row">
        <button className="btn sm" onClick={n}>
          ← More
        </button>
        <h1 style={{ margin: 0, flex: 1 }}>Cross-chain</h1>
      </div>
      <p className="sub">Move value between {WHCHAIN.name} and Ethereum, BNB Chain, Polygon, TON, NEAR, Sui and the other Antelope chains, powered by the Alcor bridge. No bridge fee: only network costs.</p>
      <div className="tabs" style={{ flexWrap: "wrap" }}>
        {[
          ["receive", "Receive"],
          ["swap", "Swap across chains"],
          ["paid", "Get paid in…"],
          ["activity", "Activity"],
        ].map(([k, l]) => (
          <button key={k} className={`tab ${tab === k ? "on" : ""}`} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </div>
      {tab === "receive" && <AX_Receive {...p} />}
      {tab === "swap" && <AX_Swap {...p} />}
      {tab === "paid" && <AX_Paid {...p} />}
      {tab === "activity" && <AX_Activity {...p} />}
      <WH_Confirm open={!!confirm} title={confirm?.title || ""} details={confirm?.details || []} warning={confirm?.warning} busy={busy} onClose={() => !busy && setConfirm(null)} onConfirm={run} />
    </>
  );
}

/* --------------------------------------------- deposit address card */
function AX_AddressCard({ d, label, swapNote }) {
  const [fees, setFees] = De.useState(null);
  const [st, setSt] = De.useState(null);
  const [other, setOther] = De.useState(false);
  De.useEffect(() => {
    WHAX.fees().then(setFees).catch(() => {});
  }, []);
  De.useEffect(() => {
    let live = true;
    const load = () => WHAX.get(`/deposit-addresses/${d.address}`).then((x) => live && setSt(x)).catch(() => {});
    load();
    const id = setInterval(load, 15e3);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, [d.address]);
  const extras = [
    ["ton", d.ton],
    ["near", d.near],
    ["sui", d.sui],
  ].filter(([k, x]) => x?.address && (k !== "near" || x.ready));
  const pend = st?.pending || [];
  return (
    <div className="card">
      <div className="label">{label}</div>
      <div style={{ textAlign: "center", margin: "6px 0 10px" }}>
        <WH_QrImg text={d.address} />
      </div>
      <div className="row" style={{ justifyContent: "center", gap: 6 }}>
        <span className="mono" style={{ fontSize: 12.5, wordBreak: "break-all" }}>{d.address}</span>
        <WH_CopyBtn text={d.address} label="Copy address" />
      </div>
      <div className="pill good" style={{ display: "inline-block", marginTop: 8 }}>
        Checked on this device ✓
      </div>
      <div className="warn" style={{ marginTop: 10 }}>
        <b>Only on these networks:</b> {(d.chains || []).map((c) => c.name).join(", ")}. Sending on any other network (Arbitrum, Base, Tron…) may lose the money.
      </div>
      {(d.chains || []).map((c) => (
        <div key={c.id} style={{ margin: "8px 0" }}>
          <b>{c.name}</b>
          {c.tokens.map((x) => (
            <div className="kv" key={x.symbol} style={{ margin: 0 }}>
              <span>{x.symbol}</span>
              <span className="faint">send at least {WHAX.raw(WHAX.sendAtLeast(fees, c.id, x), x.decimals)}</span>
            </div>
          ))}
        </div>
      ))}
      <p className="muted" style={{ fontSize: 12.5 }}>
        You can withdraw straight from an exchange to this address. {swapNote || "It's yours permanently and works every time."} Alcor takes no bridge fee; the gas to move the deposit in comes out of it and is never more than 1%.
      </p>
      {extras.length > 0 && (
        <>
          <button className="btn sm" onClick={() => setOther(!other)}>
            {other ? "Hide" : "Show"} TON / NEAR / Sui addresses
          </button>
          {other &&
            extras.map(([k, x]) => (
              <div key={k} style={{ marginTop: 10 }}>
                <b>{WHAX.NAMES[k]}</b>{" "}
                <span className="faint" style={{ fontSize: 11.5 }}>
                  ({x.tokens?.filter((y) => y.ready !== false).map((y) => `${y.symbol} min ${WHAX.raw(y.min, y.decimals)}`).join(", ")})
                </span>
                <div className="row" style={{ justifyContent: "flex-start", gap: 6 }}>
                  <span className="mono" style={{ fontSize: 12, wordBreak: "break-all" }}>{x.address}</span>
                  <WH_CopyBtn text={x.address} label={`Copy ${WHAX.NAMES[k]} address`} />
                </div>
              </div>
            ))}
          {other && <div className="faint" style={{ fontSize: 11.5, marginTop: 6 }}>These come from Alcor's other address factories and can't be recomputed on this device. Send a small amount first.</div>}
        </>
      )}
      {st && (pend.length > 0 || (st.held || []).length > 0) && (
        <div style={{ marginTop: 12 }}>
          {pend.map((x, i) => (
            <div className="kv" key={"p" + i}>
              <span>Received, forwarding… {x.symbol || ""}</span>
              <span className="faint">{x.reason || ""}</span>
            </div>
          ))}
          {(st.held || []).map((x, i) => (
            <div className="kv" key={"h" + i}>
              <span>Waiting for Alcor support: {x.symbol || ""}</span>
              <span className="faint">{x.reason || ""}</span>
            </div>
          ))}
        </div>
      )}
      {st && (st.forwards || []).length > 0 && <div className="faint" style={{ fontSize: 12, marginTop: 8 }}>{st.forwards.length} deposit(s) forwarded so far. Follow them in Activity.</div>}
    </div>
  );
}

/* ---------------------------------------------------------- receive */
function AX_Receive({ me, signedIn, login, toast }) {
  const [to, setTo] = De.useState(me || "");
  const [memo, setMemo] = De.useState("");
  const [adv, setAdv] = De.useState(false);
  const [d, setD] = De.useState(null);
  const [err, setErr] = De.useState("");
  const [busy, setBusy] = De.useState(false);
  De.useEffect(() => {
    if (me && !to) setTo(me);
  }, [me]);
  const chain = WHAX.MINE;
  const memoOk = !memo || /^[A-Za-z0-9._:-]{1,64}$/.test(memo);
  async function make() {
    setErr("");
    setD(null);
    setBusy(true);
    try {
      const c = WH.checkAccountName(to);
      if (!c.ok) throw new Error("Enter a valid account name.");
      const res = await WHAX.post("/deposit-addresses", { chain, to: c.value, ...(memo ? { memo } : {}) });
      const mineAddr = WHAC.depositAddress(chain, c.value, memo);
      if (!WHAC.same(res.address, mineAddr)) throw new Error("The address Alcor sent doesn't match the one this device computed for your account. For your safety it isn't shown. Please report this to Alcor.");
      setD(res);
    } catch (x) {
      setErr(x?.message || String(x));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <CR_Help title="How it works">
        <p>Get your own deposit address on Ethereum, BNB Chain and Polygon (and TON, NEAR, Sui). Anything you send there, even straight from an exchange, arrives in your {WHCHAIN.name} account in a few minutes. No wallet connection, no gas, nothing to sign.</p>
        <p>USDC, USDT, ETH, BNB and POL arrive as Alcor's bridged tokens (wrap.alcor) on {WHCHAIN.name}.</p>
      </CR_Help>
      {!signedIn && !to && <BR_SignIn login={login} what="make an address for your own account" />}
      <div className="card">
        <CR_F label={`Pay out to (${WHCHAIN.name} account)`} hint="Your own account, or anyone else's">
          <input className="input" value={to} onChange={(ev) => setTo(ev.target.value.toLowerCase().trim())} placeholder="account name" autoCapitalize="none" />
        </CR_F>
        <button className="btn sm ghost" onClick={() => setAdv(!adv)}>
          {adv ? "Hide" : "Advanced:"} memo for exchanges or apps
        </button>
        {adv && (
          <CR_F label="Memo (optional)" hint="Only if the receiving account needs one, e.g. an exchange deposit memo. Another memo makes another address." err={memoOk ? "" : "1–64 of A–Z a–z 0–9 . _ - :"}>
            <input className="input mono" value={memo} onChange={(ev) => setMemo(ev.target.value.trim())} />
          </CR_F>
        )}
        <button className="btn primary block" style={{ marginTop: 8 }} disabled={busy || !WH.checkAccountName(to).ok || !memoOk} onClick={make}>
          {busy ? <div className="spinner" /> : "Show my deposit address"}
        </button>
        {err && <div className="warn" style={{ marginTop: 10 }}>{err}</div>}
      </div>
      {d && <AX_AddressCard d={d} label={`Deposit address for ${d.destination?.to} on ${WHCHAIN.name}${d.memo ? ` (memo ${d.memo})` : ""}`} />}
    </>
  );
}

/* ------------------------------------------------------------- swap */
function AX_Swap({ me, signedIn, login, ask, toast }) {
  const [bals, setBals] = De.useState([]);
  const [rts, setRts] = De.useState(null);
  const [fees, setFees] = De.useState(null);
  const [from, setFrom] = De.useState("");
  const [amt, setAmt] = De.useState("");
  const [dest, setDest] = De.useState("telos");
  const [sym, setSym] = De.useState("");
  const [to, setTo] = De.useState("");
  const [courier, setCourier] = De.useState(true);
  const [plan, setPlan] = De.useState(null);
  const [busy, setBusy] = De.useState(false);
  De.useEffect(() => {
    me ? H9(me).then((b) => setBals((b || []).filter((x) => Number(x.amount) > 0))).catch(() => setBals([])) : setBals([]);
  }, [me]);
  De.useEffect(() => {
    WHAX.routes().then(setRts).catch(() => setRts({ routes: [] }));
    WHAX.fees().then(setFees).catch(() => {});
  }, []);
  const list = rts?.routes || (Array.isArray(rts) ? rts : []);
  const dests = [...new Set(list.filter((x) => x.open).map((x) => x.to))];
  const syms = [...new Set(list.filter((x) => x.open && x.to === dest).map((x) => x.symbol))].sort();
  const toSym = syms.includes(sym) ? sym : syms[0] || "";
  const src = bals.find((b) => `${b.currency}@${b.contract}` === from) || bals[0];
  const a = Number(String(amt).replace(",", "."));
  const fee = WHAX.COURIER.includes(dest) && courier ? WHAX.courierFee(fees, dest, toSym) : null;
  const recip = to.trim();
  const ok = src && a > 0 && a <= Number(src.amount) && toSym && WHAX.recipientOk(dest, recip);
  De.useEffect(() => setPlan(null), [from, amt, dest, sym, to, courier]);
  De.useEffect(() => {
    if (WHAX.ANT.includes(dest) && me && !to) setTo(me);
  }, [dest, me]);
  const q = () =>
    `/swap/plan?from=${encodeURIComponent(`${WHAX.MINE}:${src.currency}@${src.contract}`)}&to=${encodeURIComponent(`${dest}:${toSym}`)}&amount=${encodeURIComponent(a.toFixed(src.decimals))}&recipient=${encodeURIComponent(recip)}&sender=${me}${fee ? `&courierFee=${fee}` : ""}`;
  async function quote() {
    setBusy(true);
    setPlan(null);
    try {
      const pl = await WHAX.get(q());
      setPlan(pl);
    } catch (x) {
      setPlan({ possible: false, reason: x?.message || String(x) });
    } finally {
      setBusy(false);
    }
  }
  const problem = plan && WHAX.checkPlan(plan, me, recip, dest);
  const sameToken = plan && !plan.possible && /same token on both ends/i.test(plan.reason || "");
  function review() {
    ask({
      title: `Swap to ${toSym} on ${WHAX.NAMES[dest]}`,
      actions: plan.sign.actions,
      // quotes move: plan again right before signing, and check it again
      refresh: async () => {
        const fresh = await WHAX.get(q());
        const bad = WHAX.checkPlan(fresh, me, recip, dest);
        if (bad) throw new Error(bad);
        return fresh.sign.actions;
      },
      details: [
        { label: "You send", value: `${a.toFixed(src.decimals)} ${src.currency}` },
        { label: "They receive (about)", value: `${plan.to.expected} ${plan.to.symbol} on ${WHAX.NAMES[dest]}` },
        { label: "At least", value: `${plan.to.least} ${plan.to.symbol}` },
        { label: "To", value: recip },
        { label: "Contract actions", value: plan.sign.actions.map((x) => `${x.account}::${x.name} → ${x.data?.to || ""}`).join("\n") },
      ],
      warning: plan.release === "user" ? `Without a courier fee the recipient must release the tokens on ${WHAX.NAMES[dest]} themselves.` : "The price is re-checked when you approve. If it moves below the minimum, the swap doesn't happen and your tokens come back.",
    });
  }
  if (!signedIn) return <BR_SignIn login={login} what="swap from your account to another chain" />;
  return (
    <>
      <CR_Help title="How it works">
        <p>Pick a token you hold on {WHCHAIN.name} and what you want, on which chain. Alcor finds the best path (swaps on {WHCHAIN.name}, on Telos or at the destination) and you sign once. Typical time: one to five minutes.</p>
      </CR_Help>
      <div className="card">
        <CR_F label="1. You send (from your wallet)">
          <select className="select" value={src ? `${src.currency}@${src.contract}` : ""} onChange={(ev) => setFrom(ev.target.value)}>
            {bals.map((b) => (
              <option key={b.contract + b.currency} value={`${b.currency}@${b.contract}`}>
                {b.currency} ({NV.fmt(b.amount, 8)}) · {b.contract}
              </option>
            ))}
          </select>
        </CR_F>
        {src && <WH_AmountInput label="Amount" value={amt} max={String(src.amount)} symbol={src.currency} onChange={setAmt} />}
        <div className="row" style={{ gap: 8 }}>
          <CR_F label="2. Receive on">
            <select className="select" value={dest} onChange={(ev) => { setDest(ev.target.value); setTo(""); }}>
              {dests.map((c) => (
                <option key={c} value={c}>
                  {WHAX.NAMES[c] || c}
                </option>
              ))}
            </select>
          </CR_F>
          <CR_F label="Token">
            <select className="select" value={toSym} onChange={(ev) => setSym(ev.target.value)}>
              {syms.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </CR_F>
        </div>
        <CR_F label="3. Recipient">
          <input className={`input ${recip && !WHAX.recipientOk(dest, recip) ? "wh-invalid" : ""}`} value={to} onChange={(ev) => setTo(ev.target.value.trim())} placeholder={WHAX.placeholder(dest)} autoCapitalize="none" spellCheck={false} />
        </CR_F>
        {WHAX.COURIER.includes(dest) && (
          <label className="row" style={{ justifyContent: "flex-start", gap: 8, margin: "4px 0 10px" }}>
            <input className="check" type="checkbox" checked={courier} onChange={(ev) => setCourier(ev.target.checked)} />
            <span style={{ fontSize: 13 }}>Deliver it for me (a small courier fee is taken from what arrives). Otherwise the recipient has to release it on {WHAX.NAMES[dest]} with their own wallet and gas.</span>
          </label>
        )}
        <button className="btn primary block" disabled={!ok || busy} onClick={quote}>
          {busy ? <div className="spinner" /> : "Get a quote"}
        </button>
      </div>
      {plan && (
        <div className="card">
          {sameToken ? (
            <>
              <p style={{ marginTop: 0 }}>{src.currency} to {toSym} is the same token, so it's a plain bridge transfer, not a swap.</p>
              <button className="btn primary block" onClick={() => WH.nav({ tab: "more", tool: "bridges", sub: "alcor" })}>
                Send it with Bridges → Alcor
              </button>
            </>
          ) : problem ? (
            <div className="warn" style={{ margin: 0 }}>{problem}</div>
          ) : (
            <>
              <div className="kv">
                <span>Recipient gets about</span>
                <b>
                  {plan.to.expected} {plan.to.symbol}
                </b>
              </div>
              <div className="kv">
                <span>At least</span>
                <span>
                  {plan.to.least} {plan.to.symbol}
                </span>
              </div>
              <div className="kv">
                <span>Price impact</span>
                <span className={Number(plan.priceImpact) > 3 ? "bad" : ""}>{plan.priceImpact}%</span>
              </div>
              {plan.courierFee && (
                <div className="kv">
                  <span>Courier fee (included)</span>
                  <span>
                    {plan.courierFee} {plan.to.symbol}
                  </span>
                </div>
              )}
              <div className="kv">
                <span>Time</span>
                <span>about {Math.max(1, Math.round((plan.eta?.seconds || 120) / 60))} min</span>
              </div>
              <div className="faint" style={{ fontSize: 12 }}>
                Path: {(plan.swaps || []).map((s) => `${s.input} → ${s.expected} on ${WHAX.NAMES[s.chain] || s.chain}`).join(", then ") || "a direct crossing"}
                {plan.leftover ? `. Any rounding left over (${plan.leftover.asset}) stays in your wallet.` : ""}
              </div>
              {Number(plan.priceImpact) > 3 && <div className="warn">High price impact: you lose over 3% to the pools. Try a smaller amount.</div>}
              <button className="btn primary block" style={{ marginTop: 10 }} onClick={review}>
                Review and sign
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}

/* --------------------------------------------- get paid in a token */
function AX_Paid({ me, signedIn, login }) {
  const [rts, setRts] = De.useState(null);
  const [dest, setDest] = De.useState(WHAX.MINE);
  const [sym, setSym] = De.useState("");
  const [to, setTo] = De.useState(me || "");
  const [refund, setRefund] = De.useState("");
  const [d, setD] = De.useState(null);
  const [err, setErr] = De.useState("");
  const [busy, setBusy] = De.useState(false);
  const [est, setEst] = De.useState({ net: "", tok: "", amt: "", res: null });
  De.useEffect(() => {
    WHAX.routes().then(setRts).catch(() => setRts({ routes: [] }));
  }, []);
  const list = rts?.routes || (Array.isArray(rts) ? rts : []);
  const dests = [...new Set(list.filter((x) => x.open).map((x) => x.to))];
  const syms = [...new Set(list.filter((x) => x.open && x.to === dest).map((x) => x.symbol))].sort();
  const toSym = syms.includes(sym) ? sym : syms[0] || "";
  const okTo = WHAX.recipientOk(dest, to.trim());
  const okRefund = !refund || /^0x[0-9a-fA-F]{40}$/.test(refund.trim());
  async function make() {
    setErr("");
    setD(null);
    setBusy(true);
    try {
      const res = await WHAX.post("/deposit-addresses", { chain: dest, to: to.trim(), token: toSym, ...(refund ? { refund: refund.trim() } : {}) });
      // the address must be the factory's for the route it claims, and that route must buy this token for this recipient
      const leg = String(res.leg || "");
      const legOk = leg.includes(`${toSym}@`) && leg.toLowerCase().includes(to.trim().toLowerCase().replace(/^(uq|eq)/, ""));
      const addrOk = res.telosTo && WHAC.same(WHAC.addressFor(res.telosTo, leg), res.address);
      if (!addrOk || (WHAX.ANT.includes(dest) || WHAX.EVM.includes(dest) ? !legOk : !leg.includes(`${toSym}@`))) throw new Error("The address Alcor sent couldn't be verified on this device, so it isn't shown. Please report this to Alcor.");
      setD(res);
    } catch (x) {
      setErr(x?.message || String(x));
    } finally {
      setBusy(false);
    }
  }
  async function estimate(net, tok, dec) {
    const n = Number(String(est.amt).replace(",", "."));
    if (!(n > 0)) return;
    const rawAmt = BigInt(Math.round(n * 1e6)) * 10n ** BigInt(dec) / 1000000n;
    try {
      const res = await WHAX.get(`/deposit-addresses/${d.address}/estimate?chain=${net}&token=${encodeURIComponent(tok)}&amount=${rawAmt}`);
      setEst({ ...est, res });
    } catch (x) {
      setEst({ ...est, res: { possible: false, reason: x?.message } });
    }
  }
  const sendNets = (d?.chains || []).flatMap((c) => c.tokens.map((x) => ({ net: c.id, name: c.name, ...x })));
  const pick = sendNets.find((x) => `${x.net}:${x.symbol}` === `${est.net}:${est.tok}`) || sendNets[0];
  return (
    <>
      <CR_Help title="What is this? (beta)">
        <p>An address that converts. Anything sent to it on Ethereum, BNB Chain or Polygon is swapped on Telos into the token you choose and delivered to the recipient, on the chain you choose. Handy for getting paid by people who use other chains or exchanges.</p>
        <p>The swap happens at the market rate when the deposit arrives. Alcor marks this feature as beta: start with a small amount.</p>
      </CR_Help>
      <div className="card">
        <div className="row" style={{ gap: 8 }}>
          <CR_F label="Deliver on">
            <select className="select" value={dest} onChange={(ev) => { setDest(ev.target.value); setD(null); }}>
              {dests.map((c) => (
                <option key={c} value={c}>
                  {WHAX.NAMES[c] || c}
                </option>
              ))}
            </select>
          </CR_F>
          <CR_F label="As token">
            <select className="select" value={toSym} onChange={(ev) => { setSym(ev.target.value); setD(null); }}>
              {syms.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </CR_F>
        </div>
        <CR_F label="Recipient">
          <input className={`input ${to && !okTo ? "wh-invalid" : ""}`} value={to} onChange={(ev) => { setTo(ev.target.value.trim()); setD(null); }} placeholder={WHAX.placeholder(dest)} autoCapitalize="none" spellCheck={false} />
        </CR_F>
        <CR_F label="Refund address (strongly advised)" hint="Your own EVM wallet (never an exchange address). A deposit that can't be swapped goes back here. Without one it waits for Alcor support." err={okRefund ? "" : "An EVM address: 0x and 40 hex characters"}>
          <input className="input mono" value={refund} onChange={(ev) => { setRefund(ev.target.value.trim()); setD(null); }} placeholder="0x…" autoCapitalize="none" spellCheck={false} />
        </CR_F>
        {!signedIn && !to && <BR_SignIn login={login} what="fill in your own account" />}
        <button className="btn primary block" disabled={busy || !okTo || !okRefund || !toSym} onClick={make}>
          {busy ? <div className="spinner" /> : "Make the address"}
        </button>
        {err && <div className="warn" style={{ marginTop: 10 }}>{err}</div>}
      </div>
      {d && (
        <>
          <AX_AddressCard d={d} label={`Pays ${to.trim()} in ${toSym} on ${WHAX.NAMES[dest]}`} swapNote={`Every deposit is swapped into ${toSym} at the rate when it arrives; minimums move with prices.`} />
          {pick && (
            <div className="card">
              <div className="label">Estimate a payment</div>
              <div className="row" style={{ gap: 8 }}>
                <select className="select" value={`${pick.net}:${pick.symbol}`} onChange={(ev) => { const [n2, t2] = ev.target.value.split(":"); setEst({ ...est, net: n2, tok: t2, res: null }); }}>
                  {sendNets.map((x) => (
                    <option key={x.net + x.symbol} value={`${x.net}:${x.symbol}`}>
                      {x.symbol} on {x.name}
                    </option>
                  ))}
                </select>
                <input className="input" inputMode="decimal" placeholder="Amount" value={est.amt} onChange={(ev) => setEst({ ...est, amt: ev.target.value, res: null })} />
                <button className="btn" onClick={() => estimate(pick.net, pick.symbol, pick.decimals)}>
                  Estimate
                </button>
              </div>
              {est.res &&
                (est.res.possible ? (
                  <div className="kv">
                    <span>Arrives (now)</span>
                    <b>
                      ≈ {est.res.receive.expected} {est.res.receive.symbol}
                    </b>
                  </div>
                ) : (
                  <div className="warn">{est.res.reason}</div>
                ))}
              {est.res?.possible && <div className="faint" style={{ fontSize: 12 }}>At the rate when your deposit arrives. At least {est.res.receive.least} {est.res.receive.symbol}, or it isn't swapped.</div>}
            </div>
          )}
        </>
      )}
    </>
  );
}

/* --------------------------------------------------------- activity */
function AX_Activity({ me, signedIn, login, ask, tick }) {
  const [party, setParty] = De.useState(me || "");
  const [hops, setHops] = De.useState(null);
  const [err, setErr] = De.useState("");
  const [precs, setPrecs] = De.useState({});
  De.useEffect(() => {
    WHAX.routes()
      .then((x) => setPrecs(Object.fromEntries((x.routes || []).map((r) => [r.symbol, r.precision]))))
      .catch(() => {});
  }, []);
  const load = (p) => {
    if (!p) return;
    setErr("");
    WHAX.get(`/hops?party=${encodeURIComponent(p)}&limit=20`)
      .then((x) => setHops(x.hops || []))
      .catch((x) => (setErr(x?.message || String(x)), setHops([])));
  };
  De.useEffect(() => {
    load(party);
    const id = setInterval(() => party && load(party), 15e3);
    return () => clearInterval(id);
  }, [party, tick]);
  const name = (c) => WHAX.NAMES[c] || c;
  return (
    <>
      <form
        className="search"
        onSubmit={(ev) => {
          ev.preventDefault();
          load(party);
        }}
      >
        <input className="input" value={party} onChange={(ev) => setParty(ev.target.value.trim())} placeholder="Account, 0x address or deposit address" autoCapitalize="none" />
        <button className="btn primary" type="submit">
          Look up
        </button>
      </form>
      {!party && !signedIn && <BR_SignIn login={login} what="see your own transfers" />}
      {err && <div className="warn">{err}</div>}
      {hops && hops.length === 0 && !err && <WH_Empty title="No cross-chain transfers" text="Transfers through the Alcor bridge for this account or address appear here." />}
      {(hops || []).map((h) => {
        const dep = h.deposit || {};
        const prec = dep.precision ?? precs[dep.symbol];
        return (
          <div className="card" key={h.key}>
            <div className="row" style={{ alignItems: "flex-start" }}>
              <b>
                {dep.symbol} {name(h.from?.chain)} → {name(h.to?.chain)}
              </b>
              <span className={`pill ${["delivered", "returned"].includes(h.status) ? "good" : ["bounced", "returning"].includes(h.status) ? "bad" : "accent"}`}>{h.status}</span>
            </div>
            <div className="faint" style={{ fontSize: 12 }}>
              {h.progress?.stage || ""} {h.progress?.etaSeconds ? `· about ${Math.max(1, Math.round(h.progress.etaSeconds / 60))} min left` : ""}
            </div>
            <div className="kv">
              <span>Amount</span>
              <span>
                {dep.amount && prec !== undefined ? WHAX.raw(dep.amount, prec) : "…"} {dep.symbol}
              </span>
            </div>
            <div className="kv">
              <span>To</span>
              <span className="mono" style={{ fontSize: 11.5, wordBreak: "break-all" }}>{h.to?.recipient}</span>
            </div>
            {dep.src_time && <div className="faint" style={{ fontSize: 11.5 }}>{new Date(dep.src_time * 1000).toLocaleString()} · {h.key}</div>}
            {h.recover && (
              <div className="warn" style={{ marginTop: 8 }}>
                This transfer came back from {name(h.to?.chain)} and is waiting to be sent back to {h.back?.recipient}.{" "}
                {WHCHAIN.key === "telos" && h.recover.account === "hop.alcor" ? (
                  <button className="btn sm primary" onClick={() => ask({ title: "Send it back", actions: [{ account: h.recover.account, name: h.recover.name, data: h.recover.data }], details: [{ label: "Transfer", value: h.key }, { label: "Back to", value: `${h.back?.recipient} on ${name(h.back?.chain)}` }] })}>
                    Recover now
                  </button>
                ) : (
                  "Anyone can push it from Telos (Cross-chain → Activity on Telos), and Alcor's relayer usually does within a minute."
                )}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
