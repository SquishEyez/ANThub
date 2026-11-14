// XPR Network DeFi and identity, from the XPR Network developer skill
// (github.com/XPRNetwork/xpr-network-dev-skill), checked against the live ABIs:
//   LOAN       lending.loan: supply = entermarkets + <token>::transfer memo "mint";
//              redeem(redeemer, {quantity L-token, contract shares.loan}); borrow(borrower,
//              {quantity, contract}, false); repay = transfer memo "repay"; claimrewards(claimer, markets[])
//              value of a share = (cash + borrows - reserves) / share supply; debt = principal
//              * market.borrow_index / snapshot.variable_interest_index; prices from `oracles`
//   SimpleDEX  simpledex: swap = transfer memo "swap:POOL:MIN_OUT:IS_A_IN" (min out net of the
//              protocol fee); remliquidity(account, poolId, lpTokens, minA, minB);
//              withdrawdep(account, depositId) returns a pending deposit
//   Metal X    dex: cancelorder(account, order_id); open orders from the Metal X API
//   Profiles   eosio.proton usersinfo (name, avatar, KYC)

const WHX = (() => {
  const raw = (n, p) => Number(n) / 10 ** p;
  const sp = (s) => {
    const [p, c] = String(s).split(",");
    return { p: Number(p), c };
  };
  const q = (n, p, c) => `${(Math.floor(Number(n) * 10 ** p) / 10 ** p).toFixed(p)} ${c}`;
  const all = async (code, table, scope = code) => {
    const out = [];
    let lb;
    for (let k = 0; k < 10; k++) {
      const r = await qr({ code, scope, table, limit: 1000, ...(lb !== void 0 ? { lower_bound: lb } : {}) });
      out.push(...(r.rows || []));
      if (!r.more || !r.next_key) break;
      lb = r.next_key;
    }
    return out;
  };
  const one = (code, table, key, scope = code) => qr({ code, scope, table, lower_bound: key, upper_bound: key, limit: 1 }).then((r) => (r.rows || []).find((x) => (x.account || x.acc) === key) || null);
  let prices = null;
  async function oracle() {
    if (prices) return prices;
    const [feeds, data] = await Promise.all([qr({ code: "oracles", scope: "oracles", table: "feeds", limit: 100 }), qr({ code: "oracles", scope: "oracles", table: "data", limit: 100 })]);
    const val = Object.fromEntries((data.rows || []).map((d) => [d.feed_index, Number(d.aggregate?.d_double ?? d.aggregate?.d_uint64_t ?? 0)]));
    prices = (feeds.rows || []).map((f) => ({ index: f.index, name: f.name, value: val[f.index] }));
    return prices;
  }
  // LOAN: markets with share value and price, and the user's position
  async function loan(me) {
    const [mk, ms, px] = await Promise.all([all("lending.loan", "markets"), all("lending.loan", "marketshares"), oracle()]);
    const supply = Object.fromEntries(ms.map((x) => [String(x.asset.quantity).split(" ")[1], Number(String(x.asset.quantity).split(" ")[0])]));
    const pmap = Object.fromEntries(px.map((p) => [p.index, p.value]));
    const markets = await Promise.all(
      mk.map(async (m) => {
        const s = sp(m.share_symbol.sym),
          u = sp(m.underlying_symbol.sym);
        const cash = await r0("/v1/chain/get_currency_balance", { code: m.underlying_symbol.contract, account: "lending.loan", symbol: u.c })
          .then((r) => Number(String(r[0] || "0").split(" ")[0]))
          .catch(() => 0);
        const n = (a) => Number(String(a?.quantity || "0").split(" ")[0]);
        const borrows = n(m.total_variable_borrows) + n(m.total_stable_borrows);
        const shares = supply[s.c] || 0;
        const rate = shares > 0 ? (cash + borrows - n(m.total_reserves)) / shares : 1;
        return { share: s, shareContract: m.share_symbol.contract, under: u, underContract: m.underlying_symbol.contract, cf: Number(m.collateral_factor), borrowIndex: Number(m.borrow_index), rate, cash, borrows, price: pmap[m.oracle_feed_index] || 0, util: cash + borrows > 0 ? borrows / (cash + borrows) : 0 };
      }),
    );
    if (!me) return { markets };
    const [sh, br, rw] = await Promise.all([one("lending.loan", "shares", me), one("lending.loan", "borrows", me), one("lending.loan", "rewards", me)]);
    const pos = markets.map((m) => {
      const s = (sh?.tokens || []).find((t) => t.key.sym.endsWith("," + m.share.c));
      const b = (br?.tokens || []).find((t) => t.key.sym.endsWith("," + m.under.c) && t.key.contract === m.underContract);
      const shares = s ? raw(s.value, m.share.p) : 0;
      const debt = b && Number(b.value.variable_principal) > 0 ? (raw(b.value.variable_principal, m.under.p) * m.borrowIndex) / Number(b.value.variable_interest_index) + raw(b.value.stable_principal || 0, m.under.p) : 0;
      const reward = (rw?.markets || []).find((x) => x.key === m.share.c);
      return { ...m, shares, supplied: shares * m.rate, debt, reward: reward ? raw(reward.value.accrued_amount, 4) : 0 };
    });
    return { markets, pos };
  }
  // health factor with an optional change (in underlying units) to one market
  function health(pos, change) {
    let coll = 0,
      debt = 0;
    for (const m of pos || []) {
      const sup = m.supplied + (change?.c === m.share.c ? change.supply || 0 : 0);
      const d = m.debt + (change?.c === m.share.c ? change.debt || 0 : 0);
      coll += Math.max(0, sup) * m.price * m.cf;
      debt += Math.max(0, d) * m.price;
    }
    return debt > 0 ? coll / debt : Infinity;
  }
  // SimpleDEX constant product, net of the protocol fee (raw units, BigInt)
  function swapOut(amountIn, reserveIn, reserveOut, feeRate, feeShareBps) {
    const a = BigInt(amountIn),
      inF = a * (10000n - BigInt(feeRate));
    const out = (BigInt(reserveOut) * inF) / (BigInt(reserveIn) * 10000n + inF);
    const fee = (((out * BigInt(feeRate)) / 10000n) * BigInt(feeShareBps || 0)) / 10000n;
    return fee > 0n && fee < out ? out - fee : out;
  }
  let poolCache = null;
  const pools = () => (poolCache = poolCache || all("simpledex", "pools").catch((e) => ((poolCache = null), Promise.reject(e))));
  const METALX = "https://dex.api.mainnet.metalx.com";
  async function openOrders(me) {
    const r = await Wf(`${METALX}/dex/v1/orders/open?account=${me}&limit=100`, { method: "GET" }, 15e3);
    if (!r.ok) throw new Error(`Metal X API ${r.status}`);
    const j = await r.json();
    return j.data || j || [];
  }
  return { raw, sp, q, all, one, oracle, loan, health, swapOut, pools, openOrders };
})();

function WH_XprDefi({ session: t, onNeedLogin: e, toast: r, onBack: n }) {
  const me = Di(t);
  const [tab, setTab] = De.useState(() => WH.takeSub("loan", ["loan", "simpledex", "metalx", "prices", "profile"]));
  const [confirm, setConfirm] = De.useState(null);
  const [busy, setBusy] = De.useState(false);
  const [tick, setTick] = De.useState(0);
  const ask = (title, actions, details = [], warning) => {
    if (!t) return e();
    setConfirm({ title, actions, details: [{ label: "Account", value: me }, { label: "Contract actions", value: actions.map((a) => `${a.account}::${a.name}`).join("\n") }, ...details], warning });
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
  const p = { me, signedIn: !!t, login: e, ask, tick, toast: r };
  const TABS = [
    ["loan", "Lending (LOAN)"],
    ["simpledex", "SimpleDEX"],
    ["metalx", "Metal X orders"],
    ["prices", "Prices"],
    ["profile", "Profile & KYC"],
  ];
  return (
    <>
      <div className="back-row">
        <button className="btn sm" onClick={n}>
          ← More
        </button>
        <h1 style={{ margin: 0, flex: 1 }}>XPR DeFi</h1>
      </div>
      <p className="sub">Lend and borrow on LOAN, swap and manage liquidity on SimpleDEX, cancel Metal X orders, see XPR Network's oracle prices and your WebAuth profile. All gas-free.</p>
      <div className="tabs" style={{ flexWrap: "wrap" }}>
        {TABS.map(([k, l]) => (
          <button key={k} className={`tab ${tab === k ? "on" : ""}`} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </div>
      {tab === "loan" && <XP_Loan {...p} />}
      {tab === "simpledex" && <XP_SimpleDex {...p} />}
      {tab === "metalx" && <XP_MetalX {...p} />}
      {tab === "prices" && <XP_Prices />}
      {tab === "profile" && <XP_Profile {...p} />}
      <WH_Confirm open={!!confirm} title={confirm?.title || ""} details={confirm?.details || []} warning={confirm?.warning} busy={busy} onClose={() => !busy && setConfirm(null)} onConfirm={run} />
    </>
  );
}

/* ---------------------------------------------------------------- LOAN */
function XP_Loan({ me, signedIn, login, ask, tick }) {
  const [d, setD] = De.useState(null);
  const [err, setErr] = De.useState("");
  const [bals, setBals] = De.useState([]);
  const [open, setOpen] = De.useState(null); // { c, mode }
  const [amt, setAmt] = De.useState("");
  De.useEffect(() => {
    setErr("");
    WHX.loan(me)
      .then(setD)
      .catch((x) => setErr(x?.message || String(x)));
    me ? H9(me).then(setBals).catch(() => setBals([])) : setBals([]);
  }, [me, tick]);
  const list = d?.pos || d?.markets || [];
  const hf = d?.pos ? WHX.health(d.pos) : Infinity;
  const rewards = (d?.pos || []).filter((m) => m.reward > 0);
  const wallet = (m) => Number((bals || []).find((b) => b.contract === m.underContract && b.currency === m.under.c)?.amount || 0);
  const a = Number(String(amt).replace(",", "."));
  function act(m, mode) {
    const under = (x) => WHX.q(x, m.under.p, m.under.c);
    if (mode === "supply")
      return ask(`Supply ${m.under.c} to LOAN`, [
        { account: "lending.loan", name: "entermarkets", data: { payer: me, user: me, markets: [m.share.c] } },
        { account: m.underContract, name: "transfer", data: { from: me, to: "lending.loan", quantity: under(a), memo: "mint" } },
      ], [{ label: "Supply", value: under(a) }, { label: "You receive", value: `≈ ${NV.fmt(a / m.rate, m.share.p)} ${m.share.c} (interest-bearing)` }], "Supplied tokens earn interest and LOAN rewards, and count as collateral. Withdraw any time while they aren't backing a loan.");
    if (mode === "withdraw") {
      const all = a >= m.supplied - 10 ** -m.under.p;
      const shares = all ? m.shares : Math.min(m.shares, a / m.rate);
      return ask(`Withdraw ${m.under.c} from LOAN`, [{ account: "lending.loan", name: "redeem", data: { redeemer: me, token: { quantity: WHX.q(shares, m.share.p, m.share.c), contract: m.shareContract } } }], [{ label: "Withdraw", value: `≈ ${under(shares * m.rate)}` }, { label: "Shares redeemed", value: WHX.q(shares, m.share.p, m.share.c) }]);
    }
    if (mode === "borrow")
      return ask(`Borrow ${m.under.c}`, [{ account: "lending.loan", name: "borrow", data: { borrower: me, underlying: { quantity: under(a), contract: m.underContract }, use_stable_rate: false } }], [{ label: "Borrow", value: under(a) }, { label: "Health after", value: NV.fmt(WHX.health(d.pos, { c: m.share.c, debt: a }), 2) }], "Variable interest accrues every second. If your health falls below 1.0 your collateral can be liquidated: repay or add collateral well before that.");
    if (mode === "repay") {
      const pay = Math.min(a, wallet(m));
      return ask(`Repay ${m.under.c}`, [{ account: m.underContract, name: "transfer", data: { from: me, to: "lending.loan", quantity: under(pay), memo: "repay" } }], [{ label: "Repay", value: under(pay) }, { label: "Debt now", value: `≈ ${under(m.debt)}` }]);
    }
  }
  const limitFor = (m, mode) => {
    if (!d?.pos) return 0;
    if (mode === "supply") return wallet(m);
    if (mode === "withdraw") {
      // keep health ≥ 1.25 when there is debt
      let hi = m.supplied;
      if (d.pos.some((x) => x.debt > 0)) {
        let lo = 0;
        for (let i = 0; i < 40; i++) {
          const mid = (lo + hi) / 2;
          WHX.health(d.pos, { c: m.share.c, supply: -mid }) >= 1.25 ? (lo = mid) : (hi = mid);
        }
        hi = lo;
      }
      return Math.max(0, hi);
    }
    if (mode === "borrow") {
      let lo = 0,
        hi = m.cash;
      for (let i = 0; i < 50; i++) {
        const mid = (lo + hi) / 2;
        WHX.health(d.pos, { c: m.share.c, debt: mid }) >= 1.25 ? (lo = mid) : (hi = mid);
      }
      return lo;
    }
    if (mode === "repay") return Math.min(wallet(m), Math.ceil(m.debt * 1.0001 * 10 ** m.under.p) / 10 ** m.under.p);
    return 0;
  };
  return (
    <>
      <CR_Help title="How LOAN works">
        <p>Supply a token and it earns interest from borrowers, plus LOAN token rewards. Supplied tokens also count as collateral, so you can borrow other tokens against them.</p>
        <p>Your <b>health</b> is collateral value (after each market's collateral factor) divided by what you owe. Below 1.0 your collateral can be liquidated. The app won't let you borrow or withdraw below 1.25.</p>
      </CR_Help>
      {err && <div className="warn">{err}</div>}
      {!d && !err && De.createElement(ra, { h: 60 })}
      {d?.pos && (
        <div className="card">
          <div className="stat-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
            <div className="stat">
              <div className="v">${NV.fmt(d.pos.reduce((s, m) => s + m.supplied * m.price, 0), 2)}</div>
              <div className="k">supplied</div>
            </div>
            <div className="stat">
              <div className="v">${NV.fmt(d.pos.reduce((s, m) => s + m.debt * m.price, 0), 2)}</div>
              <div className="k">borrowed</div>
            </div>
            <div className="stat">
              <div className="v" style={{ color: hf < 1.25 ? "var(--bad, #e5484d)" : void 0 }}>{hf === Infinity ? "∞" : NV.fmt(hf, 2)}</div>
              <div className="k">health</div>
            </div>
          </div>
          {rewards.length > 0 && (
            <button className="btn primary block" style={{ marginTop: 10 }} onClick={() => ask("Claim LOAN rewards", [{ account: "lending.loan", name: "claimrewards", data: { claimer: me, markets: rewards.map((m) => m.share.c) } }], [{ label: "Rewards", value: `${NV.fmt(rewards.reduce((s, m) => s + m.reward, 0), 4)} LOAN` }])}>
              Claim {NV.fmt(rewards.reduce((s, m) => s + m.reward, 0), 4)} LOAN rewards
            </button>
          )}
        </div>
      )}
      {!signedIn && <BR_SignIn login={login} what="supply, borrow and see your positions" />}
      {list.map((m) => {
        const isOpen = open?.c === m.share.c;
        return (
          <div className="card" key={m.share.c}>
            <div className="row" style={{ alignItems: "flex-start" }}>
              <div>
                <b>{m.under.c}</b> <span className="faint" style={{ fontSize: 12 }}>{m.underContract}</span>
                <div className="faint" style={{ fontSize: 12 }}>
                  {NV.fmt(m.util * 100, 1)}% borrowed · collateral factor {NV.fmt(m.cf * 100, 0)}%{m.price ? ` · $${NV.fmt(m.price, m.price < 1 ? 6 : 2)}` : ""}
                </div>
              </div>
              {m.supplied > 0 || m.debt > 0 ? <span className="pill good">yours</span> : null}
            </div>
            {(m.supplied > 0 || m.debt > 0) && (
              <>
                {m.supplied > 0 && (
                  <div className="kv">
                    <span>Supplied</span>
                    <span>
                      {NV.fmt(m.supplied, m.under.p)} {m.under.c}
                    </span>
                  </div>
                )}
                {m.debt > 0 && (
                  <div className="kv">
                    <span>Borrowed</span>
                    <span>
                      {NV.fmt(m.debt, m.under.p)} {m.under.c}
                    </span>
                  </div>
                )}
              </>
            )}
            {signedIn && (
              <div className="wh-chips">
                {[
                  ["supply", "Supply"],
                  ...(m.supplied > 0 ? [["withdraw", "Withdraw"]] : []),
                  ["borrow", "Borrow"],
                  ...(m.debt > 0 ? [["repay", "Repay"]] : []),
                ].map(([k, l]) => (
                  <button key={k} className={`btn sm ${isOpen && open.mode === k ? "primary" : ""}`} onClick={() => { setOpen(isOpen && open.mode === k ? null : { c: m.share.c, mode: k }); setAmt(""); }}>
                    {l}
                  </button>
                ))}
              </div>
            )}
            {isOpen && d?.pos && (
              <div style={{ marginTop: 10 }}>
                <WH_AmountInput label={`${open.mode[0].toUpperCase() + open.mode.slice(1)} (up to ${NV.fmt(limitFor(m, open.mode), m.under.p)})`} value={amt} max={String(Math.floor(limitFor(m, open.mode) * 10 ** m.under.p) / 10 ** m.under.p)} symbol={m.under.c} onChange={setAmt} />
                {open.mode === "borrow" && limitFor(m, "borrow") <= 0 && <div className="faint" style={{ fontSize: 12 }}>Supply collateral first: you can borrow up to its collateral factor while keeping health above 1.25.</div>}
                <button className="btn primary block" disabled={!(a > 0) || a > limitFor(m, open.mode) + 10 ** -m.under.p} onClick={() => act(m, open.mode)}>
                  Review
                </button>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

/* ----------------------------------------------------------- SimpleDEX */
function XP_SimpleDex({ me, signedIn, login, ask, tick }) {
  const [lp, setLp] = De.useState([]);
  const [deps, setDeps] = De.useState([]);
  const [pools, setPools] = De.useState(null);
  const [fee, setFee] = De.useState(null);
  const [bals, setBals] = De.useState([]);
  const [from, setFrom] = De.useState("");
  const [pid, setPid] = De.useState("");
  const [amt, setAmt] = De.useState("");
  const [slip, setSlip] = De.useState("1");
  const [err, setErr] = De.useState("");
  De.useEffect(() => {
    WHX.pools().then(setPools).catch((x) => (setErr(x?.message || String(x)), setPools([])));
    qr({ code: "simpledex", scope: "simpledex", table: "protofee", limit: 1 }).then((x) => setFee(x.rows?.[0] || null)).catch(() => {});
  }, []);
  De.useEffect(() => {
    if (!me) return;
    qr({ code: "simpledex", scope: me, table: "lp", limit: 100 }).then((x) => setLp((x.rows || []).filter((r) => Number(r.lpTokens) > 0))).catch(() => setLp([]));
    qr({ code: "simpledex", scope: me, table: "deposits", limit: 100 }).then((x) => setDeps(x.rows || [])).catch(() => setDeps([]));
    H9(me).then((b) => setBals((b || []).filter((x) => Number(x.amount) > 0))).catch(() => setBals([]));
  }, [me, tick]);
  const byId = Object.fromEntries((pools || []).map((p) => [String(p.id), p]));
  const sym = (s) => WHX.sp(s);
  const src = bals.find((b) => `${b.currency}@${b.contract}` === from) || bals[0];
  const match = src ? (pools || []).filter((p) => !Number(p.paused) && ((p.tokenAContract === src.contract && sym(p.tokenASymbol).c === src.currency) || (p.tokenBContract === src.contract && sym(p.tokenBSymbol).c === src.currency)) && Number(p.reserveA) > 0 && Number(p.reserveB) > 0) : [];
  const pool = match.find((p) => String(p.id) === pid) || match.sort((x, y) => Number(y.reserveA) - Number(x.reserveA))[0];
  const aIn = pool && src && pool.tokenAContract === src.contract && sym(pool.tokenASymbol).c === src.currency;
  const inS = pool && sym(aIn ? pool.tokenASymbol : pool.tokenBSymbol),
    outS = pool && sym(aIn ? pool.tokenBSymbol : pool.tokenASymbol);
  const a = Number(String(amt).replace(",", "."));
  let out = 0n;
  if (pool && a > 0) out = WHX.swapOut(BigInt(Math.round(a * 10 ** inS.p)), aIn ? pool.reserveA : pool.reserveB, aIn ? pool.reserveB : pool.reserveA, pool.feeRate, fee && Number(fee.enabled) ? fee.feeShareBps : 0);
  const minOut = (out * BigInt(Math.round((100 - Number(slip || 1)) * 100))) / 10000n;
  return (
    <>
      <CR_Help title="About SimpleDEX">
        <p>SimpleDEX is XPR Network's token-launch and swap exchange (simpledex.fun). Swaps go straight to a pool in one transfer. Liquidity providers earn the pool fee through the pool's growth, collected when they remove liquidity.</p>
      </CR_Help>
      {!signedIn && <BR_SignIn login={login} what="swap and see your liquidity" />}
      {deps.length > 0 && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Unfinished deposits</h3>
          <p className="muted" style={{ fontSize: 12.5 }}>Tokens you sent to SimpleDEX for adding liquidity that was never completed. Withdraw them back to your wallet.</p>
          {deps.map((x) => (
            <div className="kv" key={x.id} style={{ alignItems: "center" }}>
              <span>
                {WH.trimAsset(x.amount)} <span className="faint">pool #{x.poolId}</span>
              </span>
              <button className="btn sm primary" onClick={() => ask("Withdraw unfinished deposit", [{ account: "simpledex", name: "withdrawdep", data: { account: me, depositId: x.id } }], [{ label: "Amount", value: x.amount }])}>
                Withdraw
              </button>
            </div>
          ))}
        </div>
      )}
      {lp.length > 0 && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Your liquidity</h3>
          {lp.map((x) => {
            const p = byId[String(x.poolId)];
            if (!p) return <div key={x.poolId} className="faint">Pool #{x.poolId}…</div>;
            const share = Number(x.lpTokens) / Number(p.totalLpTokens);
            const A = sym(p.tokenASymbol),
              B = sym(p.tokenBSymbol);
            const ra = Number(p.reserveA) * share,
              rb = Number(p.reserveB) * share;
            return (
              <div className="kv" key={x.poolId} style={{ alignItems: "center" }}>
                <span>
                  {NV.fmt(ra / 10 ** A.p, A.p)} {A.c} + {NV.fmt(rb / 10 ** B.p, B.p)} {B.c} <span className="faint">pool #{x.poolId}</span>
                </span>
                <button
                  className="btn sm"
                  onClick={() =>
                    ask(
                      "Remove liquidity",
                      [{ account: "simpledex", name: "remliquidity", data: { account: me, poolId: x.poolId, lpTokens: String(x.lpTokens), minAmountA: String(Math.floor(ra * 0.98)), minAmountB: String(Math.floor(rb * 0.98)) } }],
                      [{ label: "You receive (about)", value: `${NV.fmt(ra / 10 ** A.p, A.p)} ${A.c} + ${NV.fmt(rb / 10 ** B.p, B.p)} ${B.c}` }],
                      "If the pool moves more than 2% before this runs, it's refused and nothing changes.",
                    )
                  }
                >
                  Remove all
                </button>
              </div>
            );
          })}
        </div>
      )}
      {signedIn && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Swap</h3>
          {err && <div className="warn">{err}</div>}
          {pools === null && <div className="faint">Loading pools…</div>}
          <CR_F label="You pay">
            <select className="select" value={src ? `${src.currency}@${src.contract}` : ""} onChange={(ev) => { setFrom(ev.target.value); setPid(""); }}>
              {bals.map((b) => (
                <option key={b.contract + b.currency} value={`${b.currency}@${b.contract}`}>
                  {b.currency} ({NV.fmt(b.amount, 8)}) · {b.contract}
                </option>
              ))}
            </select>
          </CR_F>
          {pools && src && match.length === 0 && <div className="faint" style={{ fontSize: 12.5 }}>No SimpleDEX pool trades {src.currency}.</div>}
          {pool && (
            <>
              <CR_F label="You get">
                <select className="select" value={String(pool.id)} onChange={(ev) => setPid(ev.target.value)}>
                  {match.slice(0, 40).map((p) => {
                    const o = sym(p.tokenAContract === src.contract && sym(p.tokenASymbol).c === src.currency ? p.tokenBSymbol : p.tokenASymbol);
                    return (
                      <option key={p.id} value={String(p.id)}>
                        {o.c} (pool #{p.id})
                      </option>
                    );
                  })}
                </select>
              </CR_F>
              <WH_AmountInput label="Amount" value={amt} max={String(src.amount)} symbol={src.currency} onChange={setAmt} />
              <div className="kv">
                <span>You get about</span>
                <b>
                  {NV.fmt(Number(out) / 10 ** outS.p, outS.p)} {outS.c}
                </b>
              </div>
              <div className="kv" style={{ alignItems: "center" }}>
                <span>Max slippage</span>
                <select className="select" style={{ width: 90 }} value={slip} onChange={(ev) => setSlip(ev.target.value)}>
                  {["0.5", "1", "2", "5"].map((x) => (
                    <option key={x} value={x}>
                      {x}%
                    </option>
                  ))}
                </select>
              </div>
              <button
                className="btn primary block"
                disabled={!(a > 0) || a > Number(src.amount) || out <= 0n}
                onClick={() =>
                  ask(
                    `Swap ${src.currency} for ${outS.c}`,
                    [{ account: src.contract, name: "transfer", data: { from: me, to: "simpledex", quantity: WHX.q(a, inS.p, inS.c), memo: `swap:${pool.id}:${minOut}:${aIn ? "true" : "false"}` } }],
                    [{ label: "Pay", value: WHX.q(a, inS.p, inS.c) }, { label: "Receive (at least)", value: `${NV.fmt(Number(minOut) / 10 ** outS.p, outS.p)} ${outS.c}` }],
                    "If the price moves past your slippage limit, the swap is refused and your tokens stay put.",
                  )
                }
              >
                Review swap
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------- Metal X */
function XP_MetalX({ me, signedIn, login, ask, tick }) {
  const [orders, setOrders] = De.useState(null);
  const [bal, setBal] = De.useState(null);
  const [err, setErr] = De.useState("");
  const [mk, setMk] = De.useState({});
  De.useEffect(() => {
    // market id -> "BID/ASK" names from the dex contract's markets table
    qr({ code: "dex", scope: "dex", table: "markets", limit: 200 })
      .then((x) => setMk(Object.fromEntries((x.rows || []).map((m) => [String(m.market_id), `${WHX.sp(m.bid_token.sym).c}/${String(m.ask_token.quantity || m.ask_token.sym || "").split(/[ ,]/).pop()}`]))))
      .catch(() => {});
  }, []);
  De.useEffect(() => {
    if (!me) return;
    setErr("");
    WHX.openOrders(me)
      .then((x) => setOrders(Array.isArray(x) ? x : []))
      .catch((x) => (setErr(`Couldn't reach the Metal X API (${x?.message || x}). Your exchange balance below still comes from the chain.`), setOrders([])));
    qr({ code: "dex", scope: "dex", table: "balances", lower_bound: me, upper_bound: me, limit: 1 }).then((x) => setBal((x.rows || [])[0]?.balances || [])).catch(() => setBal([]));
  }, [me, tick]);
  if (!signedIn) return <BR_SignIn login={login} what="see and cancel your Metal X orders" />;
  const nb = (bal || []).filter((b) => NV.num(b.quantity) > 0);
  return (
    <>
      <div className="warn">Sending tokens to Metal X's <span className="mono">dex</span> contract with any memo loses them: deposits must have an empty memo. Antelope Hub blocks such transfers on XPR Network.</div>
      {err && <div className="warn">{err}</div>}
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Open orders</h3>
        {orders === null && <div className="faint">Loading…</div>}
        {orders && orders.length === 0 && !err && <div className="faint" style={{ fontSize: 13 }}>No open orders.</div>}
        {(orders || []).map((o) => (
          <div className="kv" key={o.order_id} style={{ alignItems: "center" }}>
            <span style={{ fontSize: 13 }}>
              {o.order_side === 1 || o.order_side === "buy" ? "Buy" : "Sell"} {o.quantity_curr ?? o.quantity_init ?? o.quantity} · {mk[String(o.market_id)] || o.market_symbol || `market ${o.market_id}`} @ {o.price}
              {o.created_at ? <span className="faint"> · since {new Date(o.created_at).toLocaleDateString()}</span> : null}
            </span>
            <button className="btn sm" onClick={() => ask("Cancel order", [{ account: "dex", name: "cancelorder", data: { account: me, order_id: String(o.order_id) } }], [{ label: "Order", value: `#${o.order_id}` }], "The unfilled part returns to your Metal X balance. Withdraw it below.")}>
              Cancel
            </button>
          </div>
        ))}
        {orders && orders.length > 1 && (
          <button className="btn block" style={{ marginTop: 8 }} onClick={() => ask(`Cancel ${orders.length} orders`, orders.slice(0, 20).map((o) => ({ account: "dex", name: "cancelorder", data: { account: me, order_id: String(o.order_id) } })), [{ label: "Orders", value: orders.slice(0, 20).map((o) => "#" + o.order_id).join(", ") }])}>
            Cancel all{orders.length > 20 ? " (first 20)" : ""}
          </button>
        )}
      </div>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Exchange balance</h3>
        {nb.length === 0 ? <div className="faint" style={{ fontSize: 13 }}>Nothing on the exchange.</div> : nb.map((b) => <div className="kv" key={b.contract + b.quantity}><span>{WH.trimAsset(b.quantity)}</span><span className="faint">{b.contract}</span></div>)}
        {nb.length > 0 && (
          <button className="btn primary block" style={{ marginTop: 8 }} onClick={() => ask("Withdraw everything from Metal X", [{ account: "dex", name: "withdrawall", data: { account: me } }], [{ label: "Balances", value: nb.map((b) => b.quantity).join("\n") }])}>
            Withdraw all to my wallet
          </button>
        )}
      </div>
    </>
  );
}

/* -------------------------------------------------------------- Prices */
function XP_Prices() {
  const [px, setPx] = De.useState(null);
  De.useEffect(() => {
    WHX.oracle().then(setPx).catch(() => setPx([]));
  }, []);
  return (
    <div className="card">
      <p className="muted" style={{ fontSize: 12.5, marginTop: 0 }}>Live prices from XPR Network's on-chain oracles (the same feeds LOAN uses for collateral).</p>
      {px === null && <div className="faint">Loading…</div>}
      {(px || [])
        .filter((p) => p.value > 0)
        .map((p) => (
          <div className="kv" key={p.index}>
            <span>{p.name}</span>
            <b>{/\/USD$/.test(p.name) ? `$${NV.fmt(p.value, p.value < 1 ? 6 : 2)}` : NV.fmt(p.value, 10)}</b>
          </div>
        ))}
    </div>
  );
}

/* ------------------------------------------------------------- Profile */
function XP_Profile({ me, signedIn, login }) {
  const [who, setWho] = De.useState(me || "");
  const [u, setU] = De.useState(undefined);
  const [provs, setProvs] = De.useState([]);
  const load = (a) => {
    setU(undefined);
    WHX.one("eosio.proton", "usersinfo", a, "eosio.proton").then(setU).catch(() => setU(null));
  };
  De.useEffect(() => {
    me && !who && setWho(me);
    (me || who) && load(me || who);
    qr({ code: "eosio.proton", scope: "eosio.proton", table: "kycproviders", limit: 50 }).then((x) => setProvs(x.rows || [])).catch(() => {});
  }, [me]);
  const avatar = u?.avatar ? (/^data:|^https?:/.test(u.avatar) ? u.avatar : `data:image/png;base64,${u.avatar}`) : "";
  const pname = (k) => provs.find((p) => p.kyc_provider === k)?.name || k;
  return (
    <>
      <form
        className="search"
        onSubmit={(ev) => {
          ev.preventDefault();
          const c = WH.checkAccountName(who);
          c.ok && load(c.value);
        }}
      >
        <input className="input" value={who} onChange={(ev) => setWho(ev.target.value.toLowerCase().trim())} placeholder="XPR account" autoCapitalize="none" />
        <button className="btn primary" type="submit">
          Look up
        </button>
      </form>
      {!signedIn && !who && <BR_SignIn login={login} what="see your own profile" />}
      {u === null && <WH_Empty title="No profile" text="This account has no WebAuth profile on-chain." />}
      {u && (
        <div className="card">
          <div className="row" style={{ justifyContent: "flex-start", gap: 12 }}>
            {avatar ? <img src={avatar} alt="" width={56} height={56} style={{ borderRadius: "50%", objectFit: "cover" }} /> : <div className="brand-mark" style={{ width: 56, height: 56 }}>{(u.name || u.acc || "?")[0].toUpperCase()}</div>}
            <div>
              <b style={{ fontSize: 17 }}>{u.name || u.acc}</b>
              <div className="faint mono" style={{ fontSize: 12 }}>@{u.acc}</div>
            </div>
            {Number(u.verified) ? <span className="pill good">Verified</span> : <span className="pill">Not verified</span>}
          </div>
          {(u.kyc || []).length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div className="label">Identity checks (KYC)</div>
              {u.kyc.map((k, i) => (
                <div className="kv" key={i}>
                  <span>{pname(k.kyc_provider)}</span>
                  <span className="faint" style={{ textAlign: "right" }}>
                    {String(k.kyc_level || "").split(",").filter(Boolean).map((x) => x.split(":").pop().replace(/of/g, " of ").replace(/name$/, " name")).join(", ")}
                    {k.kyc_date ? ` · ${new Date(Number(k.kyc_date) * 1000).toLocaleDateString()}` : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
          {u.date ? <div className="faint" style={{ fontSize: 12, marginTop: 8 }}>Account created {new Date(Number(u.date) * 1000).toLocaleDateString()}</div> : null}
          <p className="faint" style={{ fontSize: 12 }}>Your name, avatar and identity checks are managed in the WebAuth wallet. The details of a KYC check stay with its provider; only the result is on-chain.</p>
          <a className="btn block" href="https://webauth.com/" target="_blank" rel="noopener noreferrer" style={{ textAlign: "center", textDecoration: "none" }}>
            Edit in WebAuth
          </a>
        </div>
      )}
    </>
  );
}
