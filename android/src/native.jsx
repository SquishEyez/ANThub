// "<Chain> essentials": features unique to each network, calling its own
// on-chain contracts. Every action and data shape below was checked against
// the live ABI and against recent successful mainnet transactions:
//   EOS / Telos / Jungle: REX (deposit, buyrex, sellrex, withdraw), Telos unstaketorex
//   EOS / Jungle:         giftram, ramtransfer, ungiftram, bidname, bidrefund
//   XPR:                  stakexpr, unstakexpr, refundxpr, voterclaimst, dex::withdrawall
//   Libre:                LIBRE staking (transfer memo "stakefor:<days>", stake.libre::claim),
//                         DAO voting (dao.libre::votefor / voteagainst)
//   WAX:                  voting rewards (claimgbmvote), genesis claim

const NV = (() => {
  const SYS = WHCHAIN.key;
  const has = {
    rex: ["eos", "telos", "jungle4"].includes(SYS),
    toRex: SYS === "telos",
    ram: ["eos", "jungle4"].includes(SYS),
    names: ["eos", "jungle4"].includes(SYS),
    xpr: SYS === "xpr",
    metalx: SYS === "xpr",
    libre: SYS === "libre",
    wax: SYS === "wax",
  };
  const num = (a) => Number(String(a || "0").split(" ")[0]) || 0;
  const fmt = (n, d = 4) => Number(n).toLocaleString(void 0, { maximumFractionDigits: d });
  const amt = (n) => `${Number(n).toFixed(WHCHAIN.prec)} ${WHCHAIN.sym}`;
  const one = (code, table, key, scope = code) =>
    qr({ code, scope, table, lower_bound: key, upper_bound: key, limit: 1 }).then((r) => (r.rows || [])[0] || null);
  const blurb = {
    wax: "Voting rewards and genesis WAX: the WAX-only system features.",
    eos: "Staking (REX), gift or transfer RAM, and premium-name auctions.",
    telos: "Vote in Telos Decide, earn staking rewards with REX, and move TLOS to Telos EVM (see Bridges).",
    xpr: "Stake XPR for daily rewards, and withdraw funds from Metal X.",
    libre: "Stake LIBRE for yield, and vote on Libre DAO proposals.",
    jungle4: "Practise REX, RAM gifting and name bids with free test tokens.",
  }[SYS];
  return { has, num, fmt, amt, one, blurb };
})();

function NV_Card({ title, tag, children }) {
  return (
    <div className="card">
      <div className="row" style={{ marginBottom: 6 }}>
        <h3 style={{ margin: 0 }}>{title}</h3>
        {tag && <span className="pill">{tag}</span>}
      </div>
      {children}
    </div>
  );
}

function WH_Native({ session: t, onNeedLogin: e, toast: r, onBack: n }) {
  const me = Di(t);
  const [tick, setTick] = De.useState(0);
  const [confirm, setConfirm] = De.useState(null);
  const [busy, setBusy] = De.useState(false);
  const refresh = () => setTick((x) => x + 1);
  const ask = (title, acts, details = [], warning) => {
    if (!t) return e();
    setConfirm({ title, acts, details: [{ label: "Account", value: me }, ...details], warning });
  };
  async function run() {
    setBusy(true);
    try {
      const res = await yo(t, confirm.acts);
      r(pn(res) ? `Transaction sent\n${pn(res)}` : "Transaction sent", "success");
      setConfirm(null);
      setTimeout(refresh, 1800);
    } catch (err) {
      r(err?.message || String(err), "error");
    } finally {
      setBusy(false);
    }
  }
  const p = { me, signedIn: !!t, ask, tick, toast: r };
  return (
    <>
      <div className="back-row">
        <button className="btn sm" onClick={n}>
          ← More
        </button>
        <h1 style={{ margin: 0, flex: 1 }}>{WHCHAIN.name} essentials</h1>
      </div>
      <p className="sub">{NV.blurb}</p>
      {!t && <div className="warn">Sign in to see your balances here and to make changes.</div>}
      {NV.has.wax && <NV_Wax {...p} />}
      {WHCHAIN.key === "telos" && <NV_TelosDecide {...p} />}
      {NV.has.rex && <NV_Rex {...p} />}
      {NV.has.ram && <NV_Ram {...p} />}
      {NV.has.names && <NV_Names {...p} />}
      {NV.has.xpr && <NV_XprStake {...p} />}
      {NV.has.metalx && <NV_MetalX {...p} />}
      {NV.has.libre && <NV_LibreStake {...p} />}
      {NV.has.libre && <NV_LibreDao {...p} />}
      <WH_Confirm open={!!confirm} title={confirm?.title || ""} details={confirm?.details || []} warning={confirm?.warning} busy={busy} onClose={() => !busy && setConfirm(null)} onConfirm={run} />
    </>
  );
}

/* ---------------------------------------------------------------- WAX */
function NV_Wax({ me, signedIn, ask, tick }) {
  const [v, setV] = De.useState(null);
  const [g, setG] = De.useState(null);
  De.useEffect(() => {
    if (!me) return;
    NV.one("eosio", "voters", me).then(setV).catch(() => setV(null));
    qr({ code: "eosio", scope: me, table: "genesis", limit: 1 }).then((x) => setG((x.rows || [])[0] || null)).catch(() => setG(null));
  }, [me, tick]);
  const last = v ? Date.parse(v.last_claim_time + "Z") : 0;
  const ready = v && Number(v.unpaid_voteshare) > 0 && Date.now() - last > 864e5;
  return (
    <>
      <NV_Card title="Voting rewards" tag="WAX">
        <p className="muted" style={{ fontSize: 13, margin: "0 0 10px" }}>
          WAX pays rewards to accounts that vote for block producers (or a proxy). You can claim once every 24 hours. Vote under More → Chain tools → Vote.
        </p>
        {signedIn && v && (
          <div className="faint" style={{ fontSize: 12, marginBottom: 8 }}>
            {v.proxy ? `Voting via proxy ${v.proxy}` : `Voting for ${(v.producers || []).length} producer(s)`} · last claim {last ? new Date(last).toLocaleString() : "never"}
          </div>
        )}
        <button className="btn primary block" disabled={!ready} onClick={() => ask("Claim voting rewards", [{ account: "eosio", name: "claimgbmvote", data: { owner: me } }])}>
          {ready ? "Claim voting rewards" : signedIn ? "Nothing to claim right now" : "Sign in to claim"}
        </button>
      </NV_Card>
      {g && NV.num(g.unclaimed_balance) > 0 && (
        <NV_Card title="Genesis WAX" tag="WAX">
          <p style={{ margin: "0 0 10px" }}>Unclaimed: {WH.trimAsset(g.unclaimed_balance)}</p>
          <button className="btn primary block" onClick={() => ask("Claim genesis WAX", [{ account: "eosio", name: "claimgenesis", data: { claimer: me } }])}>
            Claim
          </button>
        </NV_Card>
      )}
    </>
  );
}

/* ------------------------------------------------------- REX (EOS, Telos) */
// Vaulta staking (docs.vaulta.com, Advanced topics > Staking): deposit + buyrex locks the
// stake in "savings"; mvfrsavings starts a 21-day unstaking period; then sellrex + withdraw.
const REX_UNSTAKE_DAYS = 21;

function NV_Rex({ me, signedIn, ask, tick }) {
  const [d, setD] = De.useState({});
  const [stakeAmt, setStakeAmt] = De.useState("");
  const [sellAmt, setSellAmt] = De.useState("");
  De.useEffect(() => {
    let live = true;
    Promise.all([
      qr({ code: "eosio", scope: "eosio", table: "rexpool", limit: 1 }).then((x) => (x.rows || [])[0]),
      me ? NV.one("eosio", "rexbal", me) : null,
      me ? NV.one("eosio", "rexfund", me) : null,
      me ? FC(me).catch(() => null) : null,
      me && WHCHAIN.vaulta ? qr({ code: WHCHAIN.vaulta.contract, scope: me, table: "accounts", limit: 10 }).then((x) => NV.num((x.rows || []).find((r) => String(r.balance).endsWith(" " + WHCHAIN.vaulta.sym))?.balance)).catch(() => 0) : 0,
    ])
      .then(([pool, bal, fund, acct, aBal]) => live && setD({ pool, bal, fund, acct, aBal }))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [me, tick]);
  const ratio = d.pool ? NV.num(d.pool.total_lendable) / NV.num(d.pool.total_rex) : 0;
  const rex = NV.num(d.bal?.rex_balance);
  const now = Date.now();
  const SAVINGS = Date.parse("2100-01-01T00:00:00Z");
  const buckets = (d.bal?.rex_maturities || []).map((m) => ({ t: Date.parse((m.first || m.key) + "Z"), v: Number(m.second || m.value) / 1e4 }));
  const matured = Number(d.bal?.matured_rex || 0) / 1e4 + buckets.filter((b) => b.t <= now).reduce((s, b) => s + b.v, 0);
  const savings = buckets.filter((b) => b.t >= SAVINGS).reduce((s, b) => s + b.v, 0);
  const pending = buckets.filter((b) => b.t > now && b.t < SAVINGS);
  const fund = NV.num(d.fund?.balance);
  const liquid = NV.num(d.acct?.core_liquid_balance);
  const self = d.acct?.self_delegated_bandwidth;
  const telos = WHCHAIN.key === "telos";
  const s = Number(String(stakeAmt).replace(",", "."));
  const sr = Number(String(sellAmt).replace(",", "."));
  // EOS was rebranded to Vaulta: the system contract refuses REX deposit/withdraw
  // and they go through core.vaulta in A. A shortfall of A is converted from
  // EOS in the same transaction (a transfer of EOS to core.vaulta returns A).
  const V = WHCHAIN.vaulta;
  const aBal = d.aBal || 0;
  const spendable = V ? (V.converts ? liquid + aBal : aBal) : liquid;
  const qA = (n) => `${Number(n).toFixed(V ? V.prec : WHCHAIN.prec)} ${V ? V.sym : WHCHAIN.sym}`;
  const lendActs = () => {
    if (!V) return [{ account: "eosio", name: "deposit", data: { owner: me, amount: NV.amt(s) } }, { account: "eosio", name: "buyrex", data: { from: me, amount: NV.amt(s) } }];
    const short = Math.max(0, Math.round((s - aBal) * 1e4) / 1e4);
    return [
      ...(short > 0 ? [{ account: "eosio.token", name: "transfer", data: { from: me, to: V.contract, quantity: NV.amt(short), memo: "" } }] : []),
      { account: V.contract, name: "deposit", data: { owner: me, amount: qA(s) } },
      { account: V.contract, name: "buyrex", data: { from: me, amount: qA(s) } },
    ];
  };
  return (
    <NV_Card title={telos ? "Staking rewards (REX)" : V ? "Vaulta staking (REX)" : "REX yield"} tag="REX">
      <p className="muted" style={{ fontSize: 13, margin: "0 0 10px" }}>
        {telos
          ? "On Telos, staking rewards are paid through REX. Put TLOS into REX and its value grows over time. You can sell matured REX back to TLOS."
          : V
            ? `Stake ${WHCHAIN.sym} or ${V.sym} to earn the network's staking rewards. You get REX, whose value only goes up. Your stake stays locked until you start unstaking; after ${REX_UNSTAKE_DAYS} days you can sell it and withdraw.`
            : `Lend ${WHCHAIN.sym} to the network's resource market (REX) and earn a share of PowerUp and RAM fees. REX can be sold back once it matures.`}
      </p>
      {d.pool && (
        <div className="faint" style={{ fontSize: 12, marginBottom: 10 }}>
          1 REX ≈ {ratio.toFixed(8)} {WHCHAIN.sym} · pool {NV.fmt(NV.num(d.pool.total_lendable), 0)} {WHCHAIN.sym}
        </div>
      )}
      {signedIn && (
        <div className="stat-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
          <div className="stat">
            <div className="v">{NV.fmt(rex * ratio)}</div>
            <div className="k">{WHCHAIN.sym} in REX</div>
          </div>
          <div className="stat">
            <div className="v">{NV.fmt(matured * ratio)}</div>
            <div className="k">sellable now</div>
          </div>
          <div className="stat">
            <div className="v">{NV.fmt(fund)}</div>
            <div className="k">ready to withdraw</div>
          </div>
        </div>
      )}
      {signedIn && pending.length > 0 && (
        <div className="faint" style={{ fontSize: 12, marginBottom: 8 }}>
          Maturing: {pending.slice(0, 4).map((b) => `${NV.fmt(b.v * ratio)} on ${new Date(b.t).toLocaleDateString()}`).join(" · ")}
        </div>
      )}
      {signedIn && savings > 0 && (
        <div className="kv" style={{ alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 13, textAlign: "left", flex: 1, minWidth: 0 }}>
            <b>{NV.fmt(savings * ratio)} {WHCHAIN.sym}</b> staked and locked
            <span className="faint" style={{ display: "block", fontSize: 12, textAlign: "left" }}>
              {V ? `Unstaking takes ${REX_UNSTAKE_DAYS} days, then you can sell and withdraw.` : "Move it out of savings to start the unstaking period."}
            </span>
          </span>
          <button
            className="btn sm"
            style={{ flex: "0 0 auto", marginLeft: 10 }}
            onClick={() =>
              ask(
                "Start unstaking",
                // Vaulta staking docs: mvfrsavings starts the unstaking period; same day = same bucket
                [{ account: "eosio", name: "mvfrsavings", data: { owner: me, rex: `${(Math.floor(savings * 1e4) / 1e4).toFixed(4)} REX` } }],
                [{ label: "Unstake", value: `${(Math.floor(savings * 1e4) / 1e4).toFixed(4)} REX (≈ ${NV.fmt(savings * ratio)} ${WHCHAIN.sym})` }, ...(V ? [{ label: "Ready to sell", value: new Date(Date.now() + REX_UNSTAKE_DAYS * 864e5).toLocaleDateString() }] : [])],
                `Your REX keeps its value while it matures${V ? ` for ${REX_UNSTAKE_DAYS} days` : ""}, then appears under "sellable now". Sell it, then withdraw.`,
              )
            }
          >
            Start unstaking
          </button>
        </div>
      )}
      <WH_AmountInput label={V ? `Stake ${WHCHAIN.sym} or ${V.sym}` : `Put ${WHCHAIN.sym} into REX`} value={stakeAmt} max={signedIn ? String(spendable) : ""} symbol={V ? V.sym : WHCHAIN.sym} onChange={setStakeAmt} />
      {V && signedIn && V.converts && <div className="faint" style={{ fontSize: 11.5, margin: "-4px 0 8px" }}>REX now runs in {V.sym}. You have {NV.fmt(aBal)} {V.sym} and {NV.fmt(liquid)} {WHCHAIN.sym}; any {WHCHAIN.sym} needed is converted 1:1 in the same transaction.</div>}
      {V && !V.converts && <div className="warn">REX on {WHCHAIN.name} now needs {V.sym} test tokens from {V.contract}, and {WHCHAIN.sym} can't be converted here. {signedIn ? `You have ${NV.fmt(aBal)} ${V.sym}.` : ""}</div>}
      <button
        className="btn primary block"
        disabled={!(s > 0) || (signedIn && s > spendable + 1e-9)}
        onClick={() =>
          ask(V ? "Stake" : "Put into REX", lendActs(), [{ label: "Amount", value: qA(s) }, ...(V && s > aBal ? [{ label: "Converted from " + WHCHAIN.sym, value: NV.amt(Math.max(0, s - aBal)) }] : []), { label: "Receive", value: ratio ? `≈ ${NV.fmt(s / ratio)} REX` : "REX" }], V ? `Your stake is locked until you choose to unstake; unstaking then takes ${REX_UNSTAKE_DAYS} days.` : "REX can only be sold after it matures.")
        }
      >
        Review
      </button>
      {signedIn && matured > 0 && (
        <>
          <div style={{ height: 14 }} />
          <WH_AmountInput label="Sell matured REX" value={sellAmt} max={String(Math.floor(matured * 1e4) / 1e4)} symbol="REX" onChange={setSellAmt} />
          <button
            className="btn block"
            disabled={!(sr > 0) || sr > matured + 1e-9}
            onClick={() => ask("Sell REX", [{ account: "eosio", name: "sellrex", data: { from: me, rex: `${sr.toFixed(4)} REX` } }], [{ label: "Sell", value: `${sr.toFixed(4)} REX` }, { label: "Receive", value: `≈ ${NV.amt(sr * ratio)} into your REX fund` }], "The proceeds go to your REX fund. Withdraw them afterwards with the button below.")}
          >
            Review sale
          </button>
        </>
      )}
      {signedIn && fund > 0 && (
        <button className="btn primary block" style={{ marginTop: 10 }} onClick={() => ask("Withdraw REX fund", [V ? { account: V.contract, name: "withdraw", data: { owner: me, amount: qA(fund) } } : { account: "eosio", name: "withdraw", data: { owner: me, amount: d.fund.balance } }], [{ label: "Amount", value: V ? `${qA(fund)} (arrives as ${V.sym})` : d.fund.balance }])}>
          Withdraw {WH.trimAsset(d.fund.balance)} to your wallet
        </button>
      )}
      {telos && signedIn && self && (NV.num(self.cpu_weight) > 0 || NV.num(self.net_weight) > 0) && (
        <button
          className="btn block"
          style={{ marginTop: 10 }}
          onClick={() =>
            ask("Move staked TLOS into REX", [{ account: "eosio", name: "unstaketorex", data: { owner: me, receiver: me, from_net: self.net_weight, from_cpu: self.cpu_weight } }], [{ label: "From CPU", value: self.cpu_weight }, { label: "From NET", value: self.net_weight }], "Your account's CPU/NET from staking goes down. On Telos you can rent resources with PowerUp instead.")
          }
        >
          Move my staked CPU/NET ({WH.trimAsset(self.cpu_weight)} + {WH.trimAsset(self.net_weight)}) into REX
        </button>
      )}
    </NV_Card>
  );
}

/* ------------------------------------------------------ EOS RAM gifting */
function NV_Ram({ me, signedIn, ask, tick }) {
  const [mode, setMode] = De.useState("gift");
  const [to, setTo] = De.useState("");
  const [kb, setKb] = De.useState("");
  const [memo, setMemo] = De.useState("");
  const [acct, setAcct] = De.useState(null);
  De.useEffect(() => {
    me && FC(me).then(setAcct).catch(() => setAcct(null));
  }, [me, tick]);
  const free = acct ? Number(acct.ram_quota) - Number(acct.ram_usage) : 0;
  const bytes = Math.floor(Number(String(kb).replace(",", ".")) * 1024);
  const ck = WH.checkAccountName(to);
  const label = { gift: "Gift RAM", transfer: "Transfer RAM", ungift: "Take back gifted RAM" }[mode];
  return (
    <NV_Card title="RAM: gift or transfer" tag={WHCHAIN.key === "jungle4" ? "Testnet" : "EOS"}>
      <p className="muted" style={{ fontSize: 13, margin: "0 0 10px" }}>
        EOS lets you move RAM between accounts. A <b>gift</b> lends RAM that you can take back later (handy for onboarding friends). A <b>transfer</b> gives it away permanently.
      </p>
      <div className="tabs">
        {[
          ["gift", "Gift"],
          ["transfer", "Transfer"],
          ["ungift", "Take back gift"],
        ].map(([k, l]) => (
          <button key={k} className={`tab ${mode === k ? "on" : ""}`} onClick={() => setMode(k)}>
            {l}
          </button>
        ))}
      </div>
      {signedIn && acct && <div className="faint" style={{ fontSize: 12, marginBottom: 8 }}>Your free RAM: {Jd(Math.max(0, free))}</div>}
      <WH_RecipientInput value={to} self={me} onChange={setTo} />
      {mode !== "ungift" && (
        <CR_F label="Amount (KB)" example="3 = enough for a new account">
          <input className="input" inputMode="decimal" value={kb} onChange={(ev) => setKb(ev.target.value.replace(/[^0-9.,]/g, ""))} />
        </CR_F>
      )}
      <CR_F label="Memo (optional)">
        <input className="input" value={memo} onChange={(ev) => setMemo(ev.target.value)} />
      </CR_F>
      <button
        className="btn primary block"
        disabled={!ck.ok || ck.value === me || (mode !== "ungift" && !(bytes > 0)) || (signedIn && mode !== "ungift" && bytes > free)}
        onClick={() => {
          const data = mode === "ungift" ? { from: me, to: ck.value, memo } : { from: me, to: ck.value, bytes, memo };
          const name = { gift: "giftram", transfer: "ramtransfer", ungift: "ungiftram" }[mode];
          ask(label, [{ account: "eosio", name, data }], [{ label: "To", value: ck.value }, ...(mode !== "ungift" ? [{ label: "RAM", value: `${Jd(bytes)} (${bytes} bytes)` }] : [])], mode === "transfer" ? "A transfer is permanent. Use Gift if you want the RAM back later." : void 0);
        }}
      >
        Review
      </button>
    </NV_Card>
  );
}

/* -------------------------------------------------- premium-name auctions */
function NV_Names({ me, signedIn, ask, tick }) {
  const [name, setName] = De.useState("");
  const [bid, setBid] = De.useState(null);
  const [refund, setRefund] = De.useState(null);
  const [amount, setAmount] = De.useState("");
  const [checked, setChecked] = De.useState("");
  const [taken, setTaken] = De.useState(false);
  const valid = /^[a-z1-5]{1,12}$/.test(name) && name.length < 12;
  async function look() {
    if (!valid) return;
    const [b, rf] = await Promise.all([NV.one("eosio", "namebids", name).catch(() => null), me ? qr({ code: "eosio", scope: name, table: "bidrefunds", lower_bound: me, upper_bound: me, limit: 1 }).then((x) => (x.rows || [])[0] || null).catch(() => null) : null]);
    let exists = false;
    if (!b) exists = await FC(name).then(() => true).catch(() => false);
    setBid(b);
    setRefund(rf);
    setTaken(exists);
    setChecked(name);
  }
  De.useEffect(() => {
    checked && look();
  }, [tick]);
  const high = bid ? Number(bid.high_bid) / 10 ** WHCHAIN.prec : 0;
  const min = high ? high * 1.1 : 0.0001;
  const a = Number(String(amount).replace(",", "."));
  return (
    <NV_Card title="Premium names" tag="Auction">
      <p className="muted" style={{ fontSize: 13, margin: "0 0 10px" }}>
        Short names (under 12 characters, no dots, e.g. <span className="mono">belle</span>) are auctioned. Each new bid must be at least 10% higher. If someone outbids you, claim your refund here. The winner can then create the account.
      </p>
      <form
        className="search"
        onSubmit={(ev) => {
          ev.preventDefault();
          look();
        }}
      >
        <input className="input" placeholder="name to check" value={name} maxLength={11} autoCapitalize="none" onChange={(ev) => setName(ev.target.value.toLowerCase().replace(/[^a-z1-5]/g, ""))} />
        <button className="btn" type="submit" disabled={!valid}>
          Check
        </button>
      </form>
      {checked && (
        <div className="faint" style={{ fontSize: 12.5, marginBottom: 8 }}>
          {bid
            ? Number(bid.high_bid) < 0
              ? `“${checked}” has been won by ${bid.high_bidder}.`
              : `Highest bid: ${high.toFixed(WHCHAIN.prec)} ${WHCHAIN.sym} by ${bid.high_bidder} (last bid ${new Date(bid.last_bid_time + "Z").toLocaleString()}).`
            : taken
              ? `“${checked}” is already a registered account.`
              : `No bids on “${checked}” yet. You can open the auction.`}
        </div>
      )}
      {checked && !taken && !(bid && Number(bid.high_bid) < 0) && (
        <>
          <WH_AmountInput label={`Your bid (min ${min.toFixed(WHCHAIN.prec)} ${WHCHAIN.sym})`} value={amount} symbol={WHCHAIN.sym} onChange={setAmount} />
          <button className="btn primary block" disabled={!(a >= min)} onClick={() => ask(`Bid on “${checked}”`, [{ account: "eosio", name: "bidname", data: { bidder: me, newname: checked, bid: NV.amt(a) } }], [{ label: "Name", value: checked }, { label: "Bid", value: NV.amt(a) }], "Your bid is locked until someone outbids you (then you claim a refund) or you win.")}>
            Review bid
          </button>
        </>
      )}
      {signedIn && refund && (
        <button className="btn block" style={{ marginTop: 10 }} onClick={() => ask("Claim name-bid refund", [{ account: "eosio", name: "bidrefund", data: { bidder: me, newname: checked } }], [{ label: "Name", value: checked }, { label: "Refund", value: refund.amount }])}>
          Claim refund of {WH.trimAsset(refund.amount)}
        </button>
      )}
    </NV_Card>
  );
}

/* -------------------------------------------------------- XPR staking */
function NV_XprStake({ me, signedIn, ask, tick }) {
  const [d, setD] = De.useState({});
  const [stake, setStake] = De.useState("");
  const [unstake, setUnstake] = De.useState("");
  De.useEffect(() => {
    if (!me) return;
    let live = true;
    Promise.all([
      NV.one("eosio", "votersxpr", me).catch(() => null),
      NV.one("eosio", "voters", me).catch(() => null),
      qr({ code: "eosio", scope: me, table: "refundsxpr", limit: 1 }).then((x) => (x.rows || [])[0] || null).catch(() => null),
      qr({ code: "eosio", scope: "eosio", table: "globalsxpr", limit: 1 }).then((x) => (x.rows || [])[0] || null).catch(() => null),
      H9(me).catch(() => []),
    ]).then(([vx, v, rf, gl, bals]) => live && setD({ vx, v, rf, gl, liquid: Number((bals || []).find((b) => b.currency === "XPR" && b.contract === "eosio.token")?.amount || 0) }));
    return () => {
      live = false;
    };
  }, [me, tick]);
  const staked = d.vx ? Number(d.vx.staked) / 1e4 : 0;
  const claim = d.vx ? Number(d.vx.claimamount) / 1e4 : 0;
  const nprod = (d.v?.producers || []).length;
  const need = d.gl ? Number(d.gl.max_bp_per_vote) : 4;
  const period = d.gl ? Number(d.gl.unstake_period) : 86400;
  const refundAt = d.rf ? Date.parse(d.rf.request_time + "Z") + period * 1e3 : 0;
  const s = Number(String(stake).replace(",", "."));
  const u = Number(String(unstake).replace(",", "."));
  return (
    <NV_Card title="Stake XPR" tag="XPR">
      <p className="muted" style={{ fontSize: 13, margin: "0 0 10px" }}>
        Stake XPR and vote for {need} block producers to earn daily staking rewards. Unstaking takes {Math.round(period / 3600)} hour(s), then you claim the refund.
      </p>
      {signedIn && (
        <div className="stat-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
          <div className="stat">
            <div className="v">{NV.fmt(staked)}</div>
            <div className="k">XPR staked</div>
          </div>
          <div className="stat">
            <div className="v">{NV.fmt(claim)}</div>
            <div className="k">rewards to claim</div>
          </div>
          <div className="stat">
            <div className="v">{d.v?.proxy ? "proxy" : `${nprod}/${need}`}</div>
            <div className="k">producers voted</div>
          </div>
        </div>
      )}
      {signedIn && d.vx && !d.vx.isqualified && (
        <div className="warn">
          You're not qualified for rewards yet. Vote for {need} producers (or a proxy) under More → Chain tools → Vote.
        </div>
      )}
      {signedIn && claim > 0 && (
        <button className="btn primary block" style={{ marginBottom: 10 }} onClick={() => ask("Claim XPR staking rewards", [{ account: "eosio", name: "voterclaimst", data: { owner: me } }], [{ label: "Rewards", value: `${claim.toFixed(4)} XPR` }])}>
          Claim {NV.fmt(claim)} XPR rewards
        </button>
      )}
      <WH_AmountInput label="Stake XPR" value={stake} max={signedIn ? String(d.liquid || 0) : ""} symbol="XPR" onChange={setStake} />
      <button className="btn primary block" disabled={!(s > 0) || (signedIn && s > (d.liquid || 0))} onClick={() => ask("Stake XPR", [{ account: "eosio", name: "stakexpr", data: { from: me, receiver: me, stake_xpr_quantity: `${s.toFixed(4)} XPR` } }], [{ label: "Stake", value: `${s.toFixed(4)} XPR` }])}>
        Review stake
      </button>
      {signedIn && staked > 0 && (
        <>
          <div style={{ height: 14 }} />
          <WH_AmountInput label="Unstake XPR" value={unstake} max={String(staked)} symbol="XPR" onChange={setUnstake} />
          <button className="btn block" disabled={!(u > 0) || u > staked + 1e-9} onClick={() => ask("Unstake XPR", [{ account: "eosio", name: "unstakexpr", data: { from: me, receiver: me, unstake_xpr_quantity: `${u.toFixed(4)} XPR` } }], [{ label: "Unstake", value: `${u.toFixed(4)} XPR` }], `You can claim it back after ${Math.round(period / 3600)} hour(s).`)}>
            Review unstake
          </button>
        </>
      )}
      {signedIn && d.rf && (
        <button className="btn primary block" style={{ marginTop: 10 }} disabled={Date.now() < refundAt} onClick={() => ask("Claim XPR refund", [{ account: "eosio", name: "refundxpr", data: { owner: me } }], [{ label: "Refund", value: d.rf.quantity }])}>
          {Date.now() < refundAt ? `Refund of ${WH.trimAsset(d.rf.quantity)} ready ${new Date(refundAt).toLocaleString()}` : `Claim refund of ${WH.trimAsset(d.rf.quantity)}`}
        </button>
      )}
    </NV_Card>
  );
}

/* ----------------------------------------------------- Metal X balances */
function NV_MetalX({ me, signedIn, ask, tick }) {
  const [row, setRow] = De.useState(null);
  De.useEffect(() => {
    me && NV.one("dex", "balances", me).then(setRow).catch(() => setRow(null));
  }, [me, tick]);
  const list = (row?.balances || []).filter((b) => NV.num(b.quantity) > 0);
  return (
    <NV_Card title="Metal X exchange" tag="DEX">
      <p className="muted" style={{ fontSize: 13, margin: "0 0 10px" }}>
        Metal X is XPR Network's on-chain order book (the <span className="mono">dex</span> contract). Funds from filled or cancelled orders wait in the exchange until you withdraw them.
      </p>
      {!signedIn ? null : list.length === 0 ? (
        <div className="faint" style={{ fontSize: 13 }}>Nothing waiting in Metal X for {me}.</div>
      ) : (
        <>
          {list.map((b) => (
            <div className="kv" key={b.contract + b.quantity}>
              <span>{WH.trimAsset(b.quantity)}</span>
              <span className="faint">{b.contract}</span>
            </div>
          ))}
          <button className="btn primary block" style={{ marginTop: 12 }} onClick={() => ask("Withdraw everything from Metal X", [{ account: "dex", name: "withdrawall", data: { account: me } }], [{ label: "Tokens", value: list.map((b) => WH.trimAsset(b.quantity)).join(", ") }])}>
            Withdraw all to my wallet
          </button>
        </>
      )}
    </NV_Card>
  );
}

/* ------------------------------------------------------- Libre staking */
function NV_LibreStake({ me, signedIn, ask, tick }) {
  const [rows, setRows] = De.useState([]);
  const [amt, setAmt] = De.useState("");
  const [days, setDays] = De.useState("30");
  const [liquid, setLiquid] = De.useState(0);
  De.useEffect(() => {
    if (!me) return;
    qr({ code: "stake.libre", scope: "stake.libre", table: "stake", index_position: 2, key_type: "name", lower_bound: me, upper_bound: me, limit: 100 })
      .then((x) => setRows((x.rows || []).filter((r) => r.account === me)))
      .catch(() => setRows([]));
    H9(me).then((b) => setLiquid(Number((b || []).find((x) => x.currency === "LIBRE" && x.contract === "eosio.token")?.amount || 0))).catch(() => {});
  }, [me, tick]);
  const a = Number(String(amt).replace(",", "."));
  const dd = Math.floor(Number(days));
  return (
    <NV_Card title="Stake LIBRE" tag="Libre">
      <p className="muted" style={{ fontSize: 13, margin: "0 0 10px" }}>
        Lock LIBRE for a number of days to earn yield (longer locks pay more) and get DAO voting power. Your LIBRE and rewards come back when the stake ends. Claim them here.
      </p>
      <WH_AmountInput label="Amount" value={amt} max={signedIn ? String(liquid) : ""} symbol="LIBRE" onChange={setAmt} />
      <CR_F label="Lock for (days)" hint="Your LIBRE is locked until the end date">
        <div className="wh-chips" style={{ marginTop: 0 }}>
          {["1", "30", "90", "180", "365"].map((x) => (
            <button key={x} type="button" className={`wh-chip ${days === x ? "accent" : ""}`} onClick={() => setDays(x)}>
              {x} {x === "1" ? "day" : "days"}
            </button>
          ))}
          <input className="input" style={{ width: 110, minHeight: 36 }} inputMode="numeric" value={days} onChange={(ev) => setDays(ev.target.value.replace(/\D/g, ""))} />
        </div>
      </CR_F>
      <button
        className="btn primary block"
        disabled={!(a > 0) || !(dd >= 1) || (signedIn && a > liquid)}
        onClick={() =>
          ask("Stake LIBRE", [{ account: "eosio.token", name: "transfer", data: { from: me, to: "stake.libre", quantity: `${a.toFixed(4)} LIBRE`, memo: `stakefor:${dd}` } }], [{ label: "Stake", value: `${a.toFixed(4)} LIBRE` }, { label: "Locked until", value: new Date(Date.now() + dd * 864e5).toLocaleDateString() }], "Staked LIBRE is locked until the end date.")
        }
      >
        Review stake
      </button>
      {signedIn && rows.length > 0 && <h3 style={{ marginTop: 16 }}>Your stakes</h3>}
      {rows.map((s) => {
        const end = Date.parse(s.payout_date + "Z");
        const done = Date.now() >= end;
        return (
          <div className="kv" key={s.index} style={{ alignItems: "center" }}>
            <span>
              {WH.trimAsset(s.libre_staked)} → <b>{WH.trimAsset(s.payout)}</b>
              <span className="faint" style={{ display: "block", fontSize: 11 }}>
                {Number(s.apy).toFixed(2)}% APY · {done ? "ended" : "ends"} {new Date(end).toLocaleDateString()}
              </span>
            </span>
            {done ? (
              <button className="btn sm primary" onClick={() => ask("Claim LIBRE stake", [{ account: "stake.libre", name: "claim", data: { account: me, index: s.index } }], [{ label: "Payout", value: s.payout }])}>
                Claim
              </button>
            ) : (
              <span className="pill">Locked</span>
            )}
          </div>
        );
      })}
    </NV_Card>
  );
}

/* --------------------------------------------------------- Libre DAO */
function NV_LibreDao({ me, signedIn, ask, tick }) {
  const [props, setProps] = De.useState(null);
  De.useEffect(() => {
    qr({ code: "dao.libre", scope: "dao.libre", table: "proposals", limit: 100, reverse: !0 })
      .then((x) => setProps((x.rows || []).sort((a, b) => (a.created_on < b.created_on ? 1 : -1))))
      .catch(() => setProps([]));
  }, [tick]);
  const now = Date.now();
  const open = (props || []).filter((p) => Date.parse(p.expires_on + "Z") > now);
  const recent = (props || []).filter((p) => Date.parse(p.expires_on + "Z") <= now).slice(0, 3);
  return (
    <NV_Card title="Libre DAO" tag="Vote">
      <p className="muted" style={{ fontSize: 13, margin: "0 0 10px" }}>
        Proposals funded by the Libre DAO. Your voting power comes from staked LIBRE.
      </p>
      {props === null && De.createElement(ra, { h: 40 })}
      {props && open.length === 0 && <div className="faint" style={{ fontSize: 13, marginBottom: 8 }}>No proposals are open for voting right now.</div>}
      {open.map((p) => (
        <div key={p.name} className="cr-help" style={{ background: "var(--card-2)", borderColor: "var(--line)" }}>
          <b>{p.title}</b>
          <div className="faint" style={{ fontSize: 12, margin: "4px 0 8px" }}>
            {WH.trimAsset(p.amount)} to {p.receiver} · votes {NV.fmt(p.votes_for, 0)} for / {NV.fmt(p.votes_against, 0)} against · closes {new Date(p.expires_on + "Z").toLocaleString()}
          </div>
          {p.url && <WH_Link className="wh-chip" href={p.url}>Details ↗</WH_Link>}
          <div className="btn-row">
            <button className="btn primary" disabled={!signedIn} onClick={() => ask(`Vote for “${p.title}”`, [{ account: "dao.libre", name: "votefor", data: { voter: me, proposal: p.name } }])}>
              Vote for
            </button>
            <button className="btn" disabled={!signedIn} onClick={() => ask(`Vote against “${p.title}”`, [{ account: "dao.libre", name: "voteagainst", data: { voter: me, proposal: p.name } }])}>
              Vote against
            </button>
          </div>
        </div>
      ))}
      {recent.length > 0 && (
        <>
          <div className="label" style={{ marginTop: 8 }}>Recently closed</div>
          {recent.map((p) => (
            <div className="kv" key={p.name}>
              <span>{p.title}</span>
              <span className="faint">{NV.fmt(p.votes_for, 0)} / {NV.fmt(p.votes_against, 0)}</span>
            </div>
          ))}
        </>
      )}
    </NV_Card>
  );
}
