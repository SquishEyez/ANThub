// Swap: best-price token swaps on Alcor (WAX, Vaulta/EOS, Telos, XPR Network).
//
// Built on Alcor's current developer services (docs.alcor.exchange):
//   - token list with USD price, score and a scam flag:
//       GET https://api.alcor.exchange/<chain>/tokens            (chain: wax, eos, telos, xpr)
//   - Swap route v3: the best route through the AMM pools and the spot order books,
//     split over up to 5 paths, answered as the transfers to send:
//       GET https://<host>.alcor.exchange/api/v3/swapRouter/getRoute
//           ?tradeType=exactIn&input=<id>&output=<id>&amount=&slippage=&account=
//     An AMM leg is a transfer to swap.alcor ("swapexactin#pools#recipient#min SYM@contract#0");
//     an order book leg is a transfer to the chain's DEX contract ("<min> SYM@contract|min").
// Token ids are "<symbol lower case>-<contract>". Nothing the API returns is signed as is:
// the app rebuilds every transfer itself and checks it first (see WHSWAP.check).
const WHSWAP = (() => {
  const CHAIN = { wax: "wax", eos: "eos", telos: "telos", xpr: "xpr" }[WHCHAIN.key];
  const HOST = { wax: "wax", eos: "eos", telos: "telos", xpr: "proton" }[WHCHAIN.key];
  const BOOK = { wax: "alcordexmain", eos: "eostokensdex", telos: "eostokensdex", xpr: "alcor" }[WHCHAIN.key];
  const AMM = "swap.alcor";
  const id = (symbol, contract) => `${String(symbol).toLowerCase()}-${contract}`;

  async function getJson(url) {
    const r = await Wf(url, { method: "GET" }, 15e3);
    const text = await r.text();
    let j = null;
    try {
      j = JSON.parse(text);
    } catch {}
    if (!r.ok) throw new Error(j?.error || text || `Alcor ${r.status}`);
    return j;
  }

  // Alcor's token list, without tokens it flags as scams (cached per session)
  let tokCache = null;
  const tokens = () =>
    (tokCache =
      tokCache ||
      getJson(`https://api.alcor.exchange/${CHAIN}/tokens`)
        .then((j) => (j.tokens || []).filter((t) => !t.scam))
        .catch((e) => ((tokCache = null), Promise.reject(e))));

  async function quote({ input, output, amount, slippage, account }) {
    const q = new URLSearchParams({ tradeType: "exactIn", input, output, amount: String(amount), slippage: String(slippage), account });
    return getJson(`https://${HOST}.alcor.exchange/api/v3/swapRouter/getRoute?${q}`);
  }

  // On Vaulta a route may first convert EOS <-> A through core.vaulta (a plain transfer,
  // empty memo, paid back 1:1), then trade the converted token.
  const V = WHCHAIN.vaulta;
  const twin = (tok) =>
    !V ? null : tok.contract === "eosio.token" && tok.symbol === WHCHAIN.sym ? { contract: V.contract, symbol: V.sym } : tok.contract === V.contract && tok.symbol === V.sym ? { contract: "eosio.token", symbol: WHCHAIN.sym } : null;

  // Turn a route into actions, accepting only what a swap should look like: transfers of
  // the input token from the user to swap.alcor or the chain's Alcor DEX (or to core.vaulta
  // to convert it), every trade paying the user the token they chose, and no more spent
  // than the amount entered.
  function check(route, { me, inTok, outTok, amount }) {
    const transfers = route?.transfers || [];
    if (!transfers.length) throw new Error("Alcor returned no route.");
    const outTag = `${outTok.symbol}@${outTok.contract}`;
    const alt = twin(inTok);
    let spent = 0,
      converted = 0,
      spentConverted = 0;
    for (const t of transfers) {
      const [n, sym] = String(t.quantity).split(" ");
      const memo = String(t.memo || "");
      const isIn = t.tokenContract === inTok.contract && sym === inTok.symbol;
      const isAlt = alt && t.tokenContract === alt.contract && sym === alt.symbol;
      if (!isIn && !isAlt) throw new Error("Route pays with an unexpected token.");
      if (t.to === V?.contract && isIn && memo === "" && alt) {
        converted += Number(n); // conversion leg: comes back 1:1 as the twin token
        spent += Number(n);
        continue;
      }
      if (t.to !== AMM && t.to !== BOOK) throw new Error(`Route sends to an unexpected account (${t.to}).`);
      if (isIn) spent += Number(n);
      else spentConverted += Number(n);
      if (t.to === AMM) {
        const parts = memo.split("#");
        if (parts[0] !== "swapexactin" || parts[2] !== me || !String(parts[3] || "").endsWith(outTag)) throw new Error("Route memo doesn't pay you the token you chose.");
      } else if (!memo.endsWith(`${outTag}|min`)) throw new Error("Order book memo doesn't match the token you chose.");
    }
    const eps = 10 ** -inTok.decimals;
    if (spent > Number(amount) * (1 + 1e-9) + eps) throw new Error("Route spends more than you entered.");
    if (spentConverted > converted + eps) throw new Error("Route spends more than it converts.");
    return transfers.map((t) => ({ account: t.tokenContract, name: "transfer", data: { from: me, to: t.to, quantity: t.quantity, memo: t.memo } }));
  }

  return { tokens, quote, check, id };
})();

const WH_SLIPPAGE = ["0.3", "0.5", "1", "3"];

function WH_AlcorSwap({ session: t, onNeedLogin: e, toast: r, onBack: n }) {
  const me = Di(t);
  const [toks, setToks] = De.useState(null);
  const [bals, setBals] = De.useState([]);
  const [from, setFrom] = De.useState("");
  const [to, setTo] = De.useState("");
  const [find, setFind] = De.useState("");
  const [amt, setAmt] = De.useState("");
  const [slip, setSlip] = De.useState("0.5");
  const [route, setRoute] = De.useState(null);
  const [qErr, setQErr] = De.useState("");
  const [loading, setLoading] = De.useState(false);
  const [confirm, setConfirm] = De.useState(null);
  const [busy, setBusy] = De.useState(false);
  const [tick, setTick] = De.useState(0);
  const [err, setErr] = De.useState("");

  De.useEffect(() => {
    WHSWAP.tokens()
      .then(setToks)
      .catch((x) => (setErr(`Couldn't load Alcor's token list (${x?.message || x}).`), setToks([])));
  }, []);
  De.useEffect(() => {
    if (!me) return;
    H9(me).then((b) => setBals((b || []).filter((x) => Number(x.amount) > 0))).catch(() => setBals([]));
  }, [me, tick]);

  const byId = Object.fromEntries((toks || []).map((x) => [x.token_id, x]));
  // tokens you hold that Alcor knows (and doesn't flag), best known first
  const mine = bals
    .map((b) => ({ ...b, tok: byId[WHSWAP.id(b.currency, b.contract)] }))
    .filter((b) => b.tok)
    .sort((a, b) => (b.tok.price_usd || 0) * b.amount - (a.tok.price_usd || 0) * a.amount);
  const src = mine.find((b) => b.tok.token_id === from) || mine[0];
  const q = find.trim().toLowerCase();
  const targets = (toks || [])
    .filter((x) => x.token_id !== src?.tok.token_id && (x.score >= 30 || x.price_reliable || bals.some((b) => WHSWAP.id(b.currency, b.contract) === x.token_id)))
    .filter((x) => !q || x.symbol.toLowerCase().includes(q) || x.contract.includes(q))
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 80);
  const dst = byId[to] && to !== src?.tok.token_id ? byId[to] : targets[0];
  const a = Number(String(amt).replace(",", "."));
  const inTok = src?.tok, outTok = dst;
  const tooMuch = src && a > Number(src.amount) + 1e-12;

  // live quote, a moment after the last change
  De.useEffect(() => {
    setRoute(null);
    setQErr("");
    if (!me || !inTok || !outTok || !(a > 0) || tooMuch) return;
    let live = true;
    setLoading(true);
    const h = setTimeout(() => {
      WHSWAP.quote({ input: inTok.token_id, output: outTok.token_id, amount: a.toFixed(inTok.decimals), slippage: slip, account: me })
        .then((x) => live && setRoute(x))
        .catch((x) => live && setQErr(/route/i.test(x?.message) ? "No route between these tokens right now." : x?.message || String(x)))
        .finally(() => live && setLoading(false));
    }, 600);
    return () => {
      live = false;
      clearTimeout(h);
      setLoading(false);
    };
  }, [me, inTok?.token_id, outTok?.token_id, amt, slip, tick]);

  const usd = (n, tok) => (tok?.price_usd && n ? ` ≈ $${(Number(n) * tok.price_usd).toLocaleString(void 0, { maximumFractionDigits: 2 })}` : "");
  const impact = Number(route?.priceImpact || 0);
  const hops = (route?.routes || []).map((p) => `${p.percent}%: ${p.hops.map((h) => (h.venue === "orderbook" ? "order book" : `pool ${h.pool}`)).join(" → ")}`);

  async function review() {
    if (!t) return e();
    try {
      // fresh quote right before signing, then check it
      const fresh = await WHSWAP.quote({ input: inTok.token_id, output: outTok.token_id, amount: a.toFixed(inTok.decimals), slippage: slip, account: me });
      const actions = WHSWAP.check(fresh, { me, inTok: { symbol: inTok.symbol, contract: inTok.contract, decimals: inTok.decimals }, outTok: { symbol: outTok.symbol, contract: outTok.contract }, amount: a });
      setRoute(fresh);
      setConfirm({
        title: `Swap ${inTok.symbol} for ${outTok.symbol}`,
        actions,
        details: [
          { label: "Account", value: me },
          { label: "You pay", value: `${a.toFixed(inTok.decimals)} ${inTok.symbol}` },
          { label: "You get about", value: `${fresh.output.amount} ${outTok.symbol}` },
          { label: "At least", value: `${fresh.minReceived} ${outTok.symbol}` },
          { label: "Price impact", value: `${fresh.priceImpact}%` },
          { label: "Route", value: (fresh.routes || []).map((p) => `${p.percent}%: ${p.hops.map((h) => (h.venue === "orderbook" ? "order book" : `pool ${h.pool}`)).join(" → ")}`).join("\n") },
          { label: "Contract actions", value: actions.map((x) => `${x.account}::transfer → ${x.data.to}`).join("\n") },
        ],
        warning: `If the price moves so you'd get less than ${fresh.minReceived} ${outTok.symbol}, the whole swap is refused and nothing is spent.${Number(fresh.priceImpact) > 3 ? ` This trade moves the price by ${fresh.priceImpact}%: consider a smaller amount.` : ""}`,
      });
    } catch (x) {
      r(x?.message || String(x), "error");
    }
  }
  async function run() {
    setBusy(true);
    try {
      const res = await yo(t, confirm.actions);
      r(pn(res) ? `Swap sent\n${pn(res)}` : "Swap sent", "success");
      setConfirm(null);
      setAmt("");
      setTimeout(() => setTick((x) => x + 1), 1800);
    } catch (x) {
      r(x?.message || String(x), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="back-row">
        <button className="btn sm" onClick={n}>
          ← More
        </button>
        <h1 style={{ margin: 0, flex: 1 }}>Swap</h1>
      </div>
      <p className="sub">Best price across Alcor's pools and order books on {WHCHAIN.name}, in one signature. The route can split your trade over several paths.</p>
      {err && <div className="warn">{err}</div>}
      {!t && <BR_SignIn login={e} what="swap tokens" />}
      {t && toks === null && <div className="faint">Loading tokens…</div>}
      {t && toks && (
        <div className="card">
          <CR_F label="You pay">
            <select className="select" value={src?.tok.token_id || ""} onChange={(ev) => (setFrom(ev.target.value), setAmt(""))}>
              {mine.length === 0 && <option value="">No tokens Alcor trades</option>}
              {mine.map((b) => (
                <option key={b.tok.token_id} value={b.tok.token_id}>
                  {b.currency} ({NV.fmt(b.amount, b.tok.decimals)}){b.tok.price_usd ? ` · $${(b.amount * b.tok.price_usd).toFixed(2)}` : ""} · {b.contract}
                </option>
              ))}
            </select>
          </CR_F>
          {src && <WH_AmountInput label="Amount" value={amt} max={String(src.amount)} symbol={src.currency} onChange={setAmt} />}
          {tooMuch && <div className="wh-field-msg err">That's more than you have.</div>}
          <div style={{ textAlign: "center", margin: "2px 0 6px" }}>
            <button
              className="btn sm"
              disabled={!dst || !mine.some((b) => b.tok.token_id === dst.token_id)}
              onClick={() => (setFrom(dst.token_id), setTo(src.tok.token_id), setAmt(""))}
              title="Swap direction"
            >
              ⇅
            </button>
          </div>
          <CR_F label="You get">
            <input className="input" placeholder="Search tokens (symbol or contract)" value={find} onChange={(ev) => setFind(ev.target.value)} autoCapitalize="none" style={{ marginBottom: 6 }} />
            <select className="select" value={dst?.token_id || ""} onChange={(ev) => setTo(ev.target.value)}>
              {targets.map((x) => (
                <option key={x.token_id} value={x.token_id}>
                  {x.symbol} · {x.contract}
                  {x.price_usd ? ` · $${x.price_usd < 0.01 ? x.price_usd.toPrecision(2) : x.price_usd.toFixed(2)}` : ""}
                  {x.trusted ? " ✓" : ""}
                </option>
              ))}
            </select>
          </CR_F>
          <div className="kv" style={{ alignItems: "center" }}>
            <span className="muted">Max slippage</span>
            <span style={{ display: "flex", gap: 6 }}>
              {WH_SLIPPAGE.map((s) => (
                <button key={s} className={`tab ${slip === s ? "on" : ""}`} style={{ padding: "4px 10px" }} onClick={() => setSlip(s)}>
                  {s}%
                </button>
              ))}
            </span>
          </div>
          {loading && (
            <div className="wh-waiting">
              <div className="spinner" />
              <span>Finding the best route…</span>
            </div>
          )}
          {qErr && <div className="wh-field-msg err">{qErr}</div>}
          {route && !loading && (
            <>
              <div className="kv">
                <span className="muted">You get about</span>
                <b>
                  {route.output.amount} {outTok.symbol}
                  <span className="faint" style={{ fontWeight: 400 }}>{usd(route.output.amount, outTok)}</span>
                </b>
              </div>
              <div className="kv">
                <span className="muted">At least</span>
                <span>
                  {route.minReceived} {outTok.symbol}
                </span>
              </div>
              <div className="kv">
                <span className="muted">Price impact</span>
                <span style={impact > 3 ? { color: "var(--bad)" } : null}>{route.priceImpact}%</span>
              </div>
              <div className="faint" style={{ fontSize: 12, margin: "4px 0 8px", whiteSpace: "pre-line" }}>Route: {hops.join("\n")}</div>
            </>
          )}
          <button className="btn primary block" disabled={!route || loading || tooMuch || !(a > 0)} onClick={review}>
            Review swap
          </button>
        </div>
      )}
      <div className="faint" style={{ fontSize: 12 }}>
        Tokens Alcor flags as scams are hidden. Prices and routes come from Alcor; the app checks every transfer before you sign (right token, right contract, paid to you, no more than you entered).
      </div>
      <WH_Confirm open={!!confirm} title={confirm?.title || ""} details={confirm?.details || []} warning={confirm?.warning} busy={busy} onClose={() => !busy && setConfirm(null)} onConfirm={run} />
    </>
  );
}
