// Telos studio: guided access to Telos-only contracts.
//   telos.decide  polls/ballots and community voting tokens ("treasuries")
//     fees are paid from your Decide deposit: eosio.token::transfer TLOS -> telos.decide
//     (any memo but "skip"); leftovers come back with withdraw(voter, quantity)
//     ballot:   newballot + editdetails + [editminmax] + togglebal voteliquid + openvoting
//     treasury: newtreasury + edittrsinfo + toggle(setting)… + regvoter + mint
//     members:  regvoter(voter, symbol, referrer = you), signed by you
//   works.decide  Telos Works funding proposals
//     draftprop, launchprop (fee from your Works deposit: max(min_fee, fee_percent of request)),
//     submitreport, claimfunds, nextms, cancelprop, deleteprop, withdraw(account_name, quantity)
// All formats were checked against recent mainnet transactions.

const WHTS = (() => {
  async function all(code, table, scope = code) {
    const out = [];
    let lb;
    for (let k = 0; k < 30; k++) {
      const r = await qr({ code, scope, table, limit: 1000, ...(lb !== void 0 ? { lower_bound: lb } : {}) });
      out.push(...(r.rows || []));
      if (!r.more || !r.next_key) break;
      lb = r.next_key;
    }
    return out;
  }
  const num = (a) => Number(String(a || "0").split(" ")[0]) || 0;
  const sym = (a) => String(a || "").split(" ")[1] || "";
  const code = (s) => String(s).split(",")[1];
  const tlos = (n) => `${Number(n).toFixed(4)} TLOS`;
  const fee = (cfg, k) => num((cfg?.fees || []).find((f) => f.key === k)?.value || "0");
  const randName = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (x) => "abcdefghijklmnopqrstuvwxyz12345"[x % 31]).join("");
  // option label -> valid on-chain name (a-z, 1-5, dots; max 12)
  function slug(label, used) {
    let s = String(label || "")
      .toLowerCase()
      .replace(/[6-9]/g, "")
      .replace(/0/g, "o")
      .replace(/[^a-z1-5.]/g, "")
      .replace(/^\.+|\.+$/g, "")
      .slice(0, 12);
    if (!s) s = "option";
    let out = s,
      n = 1;
    while (used.has(out)) out = s.slice(0, 11) + "12345"[(n++ - 1) % 5];
    used.add(out);
    return out;
  }
  const iso = (d) => new Date(d).toISOString().slice(0, 19);
  const deposit = (contract, me) =>
    me ? qr({ code: contract, scope: me, table: "accounts", limit: 10 }).then((r) => num((r.rows || []).find((x) => sym(x.balance) === "TLOS")?.balance)).catch(() => 0) : Promise.resolve(0);
  const payFee = (contract, me, need, have, memo) => (need > have + 1e-9 ? [{ account: "eosio.token", name: "transfer", data: { from: me, to: contract, quantity: tlos(need - have), memo } }] : []);
  const METHODS = [
    ["1acct1vote", "One vote per account", "Every registered member counts the same."],
    ["1token1vote", "Weighted by tokens", "Votes count by how many tokens each voter holds."],
    ["1tokennvote", "Tokens on every choice", "Multi-choice: each picked option gets the voter's full token weight."],
  ];
  const CATS = [
    ["poll", "Poll", "A quick question to the community"],
    ["proposal", "Proposal", "Yes / no on an idea or change"],
    ["election", "Election", "Choose between candidates"],
  ];
  const SETTINGS = [
    ["transferable", "Members can send tokens to each other", true],
    ["stakeable", "Members can stake tokens", false],
    ["unstakeable", "Members can unstake tokens", false],
    ["burnable", "Tokens can be burned", false],
    ["reclaimable", "You (the manager) can take tokens back", false],
    ["maxmutable", "You can change the max supply later", false],
  ];
  return { all, num, sym, code, tlos, fee, randName, slug, iso, deposit, payFee, METHODS, CATS, SETTINGS };
})();

function WH_TelosStudio({ session: t, onNeedLogin: e, toast: r, onBack: n }) {
  const me = Di(t);
  const [tab, setTab] = De.useState(() => WH.takeSub("polls", ["polls", "tokens", "works", "nfts", "deposits"]));
  const [cfg, setCfg] = De.useState(null);
  const [wcfg, setWcfg] = De.useState(null);
  const [ballots, setBallots] = De.useState(null);
  const [trs, setTrs] = De.useState(null);
  const [mineV, setMineV] = De.useState([]);
  const [props, setProps] = De.useState(null);
  const [dep, setDep] = De.useState({ decide: 0, works: 0 });
  const [bals, setBals] = De.useState([]);
  const [tick, setTick] = De.useState(0);
  const [confirm, setConfirm] = De.useState(null);
  const [busy, setBusy] = De.useState(false);
  De.useEffect(() => {
    qr({ code: "telos.decide", scope: "telos.decide", table: "config", limit: 1 }).then((x) => setCfg(x.rows?.[0] || null)).catch(() => {});
    qr({ code: "works.decide", scope: "works.decide", table: "config", limit: 1 }).then((x) => setWcfg(x.rows?.[0] || null)).catch(() => {});
  }, []);
  De.useEffect(() => {
    WHTS.all("telos.decide", "ballots").then(setBallots).catch(() => setBallots([]));
    WHTS.all("telos.decide", "treasuries").then(setTrs).catch(() => setTrs([]));
    WHTS.all("works.decide", "proposals").then(setProps).catch(() => setProps([]));
    if (me) {
      qr({ code: "telos.decide", scope: me, table: "voters", limit: 100 }).then((x) => setMineV(x.rows || [])).catch(() => setMineV([]));
      Promise.all([WHTS.deposit("telos.decide", me), WHTS.deposit("works.decide", me)]).then(([d, w]) => setDep({ decide: d, works: w }));
      H9(me).then(setBals).catch(() => setBals([]));
    }
  }, [me, tick]);
  const ask = (title, actions, details = [], warning) => {
    if (!t) return e();
    setConfirm({ title, actions, details: [{ label: "Account", value: me }, { label: "Contract actions", value: actions.map((a) => `${a.account}::${a.name}`).join("\n") }, ...details], warning });
  };
  async function run() {
    setBusy(true);
    try {
      const res = await yo(t, confirm.actions);
      r(pn(res) ? `Transaction sent\n${pn(res)}` : "Transaction sent", "success");
      const after = confirm.after;
      setConfirm(null);
      setTimeout(() => {
        setTick((x) => x + 1);
        after && after();
      }, 2000);
    } catch (err) {
      r(err?.message || String(err), "error");
    } finally {
      setBusy(false);
    }
  }
  const tlos = Number((bals || []).find((b) => b.contract === "eosio.token" && b.currency === "TLOS")?.amount || 0);
  const p = { me, signedIn: !!t, login: e, ask, cfg, wcfg, ballots, trs, mineV, props, dep, tlos, toast: r, setConfirm };
  const TABS = [
    ["polls", "Polls & ballots"],
    ["tokens", "Tokens & DAOs"],
    ["works", "Telos Works"],
    ["nfts", "NFTs"],
    ["deposits", "Deposits"],
  ];
  return (
    <>
      <div className="back-row">
        <button className="btn sm" onClick={n}>
          ← More
        </button>
        <h1 style={{ margin: 0, flex: 1 }}>Telos studio</h1>
      </div>
      <p className="sub">Telos has its own on-chain governance toolkit. Run polls, launch a community voting token for your group or DAO, apply for Telos Works funding and mint NFTs, all step by step.</p>
      <div className="tabs" style={{ flexWrap: "wrap" }}>
        {TABS.map(([k, l]) => (
          <button key={k} className={`tab ${tab === k ? "on" : ""}`} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </div>
      {!t && (
        <div className="card" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, fontSize: 13 }}>You can browse everything. Sign in to create or manage.</div>
          <button className="btn primary sm" onClick={e}>
            Sign in
          </button>
        </div>
      )}
      {tab === "polls" && <TS_Polls {...p} />}
      {tab === "tokens" && <TS_Tokens {...p} />}
      {tab === "works" && <TS_Works {...p} />}
      {tab === "nfts" && <TS_Nfts />}
      {tab === "deposits" && <TS_Deposits {...p} />}
      <WH_Confirm open={!!confirm} title={confirm?.title || ""} details={confirm?.details || []} warning={confirm?.warning} busy={busy} onClose={() => !busy && setConfirm(null)} onConfirm={run} />
    </>
  );
}

/* ------------------------------------------------------------ polls */
function TS_Polls({ me, signedIn, login, ask, cfg, ballots, trs, mineV, dep, tlos }) {
  const [make, setMake] = De.useState(false);
  const mine = (ballots || []).filter((b) => me && b.publisher === me).sort((a, b) => Date.parse(b.begin_time || 0) - Date.parse(a.begin_time || 0));
  const now = Date.now();
  return (
    <>
      <CR_Help title="How Telos polls work">
        <p>Telos Decide runs votes on-chain. Each ballot is counted with one voting token: <b>VOTE</b> (every Telos account that stakes TLOS gets VOTE) or a community token you or another group created.</p>
        <p>Creating a ballot costs {cfg ? WHTS.tlos(WHTS.fee(cfg, "ballot")) : "a small fee"}, paid from your Decide deposit. The app adds the deposit to the same transaction when needed. Voting itself is free: people vote in {WHCHAIN.name} essentials → Telos Decide.</p>
      </CR_Help>
      {!make && (
        <button className="btn primary block" onClick={() => (signedIn ? setMake(true) : login())}>
          {signedIn ? "Create a poll or ballot" : "Sign in to create a poll"}
        </button>
      )}
      {make && <TS_NewBallot me={me} ask={ask} cfg={cfg} ballots={ballots} trs={trs} mineV={mineV} dep={dep} tlos={tlos} onDone={() => setMake(false)} />}
      <h2>Your ballots</h2>
      {!signedIn && <div className="faint" style={{ fontSize: 13 }}>Sign in to see the ballots you've published.</div>}
      {signedIn && ballots && mine.length === 0 && <WH_Empty title="No ballots yet" text="Ballots you create appear here, with live results and tools to close or cancel them." />}
      {mine.map((b) => {
        const ended = b.end_time && Date.parse(b.end_time + "Z") <= now;
        const total = (b.options || []).reduce((s, o) => s + WHTS.num(o.value), 0);
        return (
          <div className="card" key={b.ballot_name}>
            <div className="row" style={{ alignItems: "flex-start" }}>
              <div style={{ minWidth: 0 }}>
                <b>{b.title || b.ballot_name}</b>
                <div className="faint mono" style={{ fontSize: 11 }}>
                  {b.ballot_name} · {b.category} · {WHTS.code(b.treasury_symbol)}
                </div>
              </div>
              <span className={`pill ${b.status === "voting" && !ended ? "good" : ""}`}>{b.status === "voting" && ended ? "ended" : b.status}</span>
            </div>
            {(b.options || []).map((o) => (
              <div key={o.key} style={{ margin: "6px 0" }}>
                <div className="kv" style={{ margin: 0 }}>
                  <span>{o.key}</span>
                  <span>{WH.trimAsset(o.value)}</span>
                </div>
                <div className="progress">
                  <i style={{ width: `${total ? (WHTS.num(o.value) / total) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
            <div className="faint" style={{ fontSize: 12 }}>
              {b.total_voters} voter{b.total_voters === 1 ? "" : "s"}
              {b.end_time && b.status === "voting" ? ` · ${ended ? "ended" : "ends"} ${new Date(Date.parse(b.end_time + "Z")).toLocaleString()}` : ""}
            </div>
            <div className="wh-chips">
              {b.status === "setup" && (
                <button className="btn sm primary" onClick={() => ask("Open voting", [{ account: "telos.decide", name: "openvoting", data: { ballot_name: b.ballot_name, end_time: WHTS.iso(Date.now() + 7 * 864e5) } }], [{ label: "Ballot", value: b.title || b.ballot_name }, { label: "Ends", value: "in 7 days" }])}>
                  Open voting (7 days)
                </button>
              )}
              {b.status === "voting" && ended && (
                <button className="btn sm primary" onClick={() => ask("Close ballot and publish results", [{ account: "telos.decide", name: "closevoting", data: { ballot_name: b.ballot_name, broadcast: true } }], [{ label: "Ballot", value: b.title || b.ballot_name }])}>
                  Close & publish results
                </button>
              )}
              {b.status === "voting" && !ended && (
                <button className="btn sm" onClick={() => ask("Cancel ballot", [{ account: "telos.decide", name: "cancelballot", data: { ballot_name: b.ballot_name, memo: "cancelled by publisher" } }], [{ label: "Ballot", value: b.title || b.ballot_name }], "Voting stops now and the ballot is marked cancelled. The fee isn't refunded.")}>
                  Cancel
                </button>
              )}
              {["setup", "cancelled"].includes(b.status) && (
                <button className="btn sm" onClick={() => ask("Delete ballot", [{ account: "telos.decide", name: "deleteballot", data: { ballot_name: b.ballot_name } }], [{ label: "Ballot", value: b.title || b.ballot_name }], "Removes the ballot and frees its RAM. The contract may refuse until its cooldown has passed.")}>
                  Delete
                </button>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}

function TS_NewBallot({ me, ask, cfg, ballots, trs, mineV, dep, tlos, onDone }) {
  const opts = new Map([["4,VOTE", "VOTE: every Telos account that stakes TLOS"]]);
  for (const x of trs || []) {
    const [amt, c] = String(x.max_supply).split(" ");
    const s = `${(amt.split(".")[1] || "").length},${c}`;
    const inIt = (mineV || []).some((v) => WHTS.sym(v.liquid) === c);
    if (x.manager === me || (x.access === "public" && inIt)) opts.set(s, `${c}: ${x.title || "community token"}${x.manager === me ? " (yours)" : ""}`);
  }
  const [f, setF] = De.useState({ token: "4,VOTE", cat: "poll", title: "", desc: "", method: "1acct1vote", days: "7", max: "1", options: ["Yes", "No"] });
  const [ids, setIds] = De.useState({});
  const set = (k) => (ev) => setF({ ...f, [k]: ev.target.value });
  const used = new Set();
  const optNames = f.options.map((l, i) => ids[i] || WHTS.slug(l, used));
  const dupe = new Set(optNames).size !== optNames.length;
  const badId = optNames.some((x) => !/^[a-z1-5.]{1,12}$/.test(x) || x.endsWith("."));
  const days = Number(f.days);
  const max = Math.max(1, Math.min(Number(f.max) || 1, f.options.length));
  const feeBallot = WHTS.fee(cfg, "ballot");
  const ok = f.title.trim() && f.options.length >= 2 && !dupe && !badId && days > 0 && days <= 365;
  function submit() {
    const taken = new Set((ballots || []).map((b) => b.ballot_name));
    let bn = WHTS.randName();
    while (taken.has(bn)) bn = WHTS.randName();
    const content = f.options.map((l, i) => `${optNames[i]}: ${l}`).join("\n");
    const acts = [
      ...WHTS.payFee("telos.decide", me, feeBallot, dep.decide, "ballot fee deposit"),
      { account: "telos.decide", name: "newballot", data: { ballot_name: bn, category: f.cat, publisher: me, treasury_symbol: f.token, voting_method: f.method, initial_options: optNames } },
      { account: "telos.decide", name: "editdetails", data: { ballot_name: bn, title: f.title.trim(), description: f.desc.trim(), content } },
      ...(max > 1 ? [{ account: "telos.decide", name: "editminmax", data: { ballot_name: bn, new_min_options: 1, new_max_options: max } }] : []),
      // new ballots count only staked tokens; also count tokens members simply hold
      { account: "telos.decide", name: "togglebal", data: { ballot_name: bn, setting_name: "voteliquid" } },
      { account: "telos.decide", name: "openvoting", data: { ballot_name: bn, end_time: WHTS.iso(Date.now() + days * 864e5) } },
    ];
    ask(
      `Create ballot “${f.title.trim()}”`,
      acts,
      [
        { label: "Voting token", value: WHTS.code(f.token) },
        { label: "Choices", value: f.options.map((l, i) => `${l} (${optNames[i]})`).join("\n") },
        { label: "Runs for", value: `${days} day${days === 1 ? "" : "s"}` },
        { label: "Fee", value: `${WHTS.tlos(feeBallot)}${dep.decide >= feeBallot ? " (from your Decide deposit)" : ""}` },
      ],
      "Ballots can't be edited once voting opens. Check the question and choices.",
    );
  }
  return (
    <div className="card">
      <div className="row">
        <h3 style={{ margin: 0 }}>New ballot</h3>
        <button className="btn sm ghost" onClick={onDone}>
          Close
        </button>
      </div>
      <CR_F label="1. Who votes?" hint="Members need this token to vote. VOTE reaches everyone who stakes TLOS.">
        <select className="select" value={f.token} onChange={set("token")}>
          {[...opts].map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
      </CR_F>
      <CR_F label="2. Type">
        <div className="wh-chips" style={{ marginTop: 0 }}>
          {WHTS.CATS.map(([k, l, d]) => (
            <button type="button" key={k} title={d} className={`wh-chip ${f.cat === k ? "accent" : ""}`} onClick={() => setF({ ...f, cat: k, ...(k === "proposal" ? { options: ["Yes", "No", "Abstain"] } : {}) })}>
              {l}
            </button>
          ))}
        </div>
      </CR_F>
      <CR_F label="3. Question" example="Should we fund a community meetup in March?">
        <input className="input" value={f.title} maxLength={200} onChange={set("title")} placeholder="What are you asking?" />
      </CR_F>
      <CR_F label="Details (optional)" hint="Background, links, what happens if it passes">
        <textarea className="input" rows={3} value={f.desc} onChange={set("desc")} />
      </CR_F>
      <div className="label">4. Choices</div>
      {f.options.map((l, i) => (
        <div key={i} className="row" style={{ gap: 6, marginBottom: 6 }}>
          <input className="input" style={{ flex: 2 }} value={l} onChange={(ev) => setF({ ...f, options: f.options.map((x, k) => (k === i ? ev.target.value : x)) })} placeholder={`Choice ${i + 1}`} />
          <input className={`input mono ${!/^[a-z1-5.]{1,12}$/.test(optNames[i]) ? "wh-invalid" : ""}`} style={{ flex: 1, fontSize: 12 }} value={optNames[i]} title="On-chain id: a–z, 1–5, max 12" onChange={(ev) => setIds({ ...ids, [i]: ev.target.value.toLowerCase() })} />
          {f.options.length > 2 && (
            <button className="btn sm ghost" aria-label="Remove choice" onClick={() => { setF({ ...f, options: f.options.filter((_, k) => k !== i) }); setIds({}); }}>
              ✕
            </button>
          )}
        </div>
      ))}
      <div className="faint" style={{ fontSize: 11.5, marginBottom: 6 }}>The small box is each choice's on-chain id (letters a–z, digits 1–5). The full labels are saved in the ballot's details.</div>
      {dupe && <div className="wh-field-msg err">Two choices have the same id.</div>}
      {f.options.length < 10 && (
        <button className="btn sm" onClick={() => setF({ ...f, options: [...f.options, ""] })}>
          + Add a choice
        </button>
      )}
      <CR_F label="5. Counting">
        <select className="select" value={f.method} onChange={set("method")}>
          {WHTS.METHODS.map(([k, l, d]) => (
            <option key={k} value={k}>
              {l}: {d}
            </option>
          ))}
        </select>
      </CR_F>
      <div className="row" style={{ gap: 8 }}>
        <CR_F label="Choices per voter">
          <input className="input" inputMode="numeric" value={f.max} onChange={set("max")} />
        </CR_F>
        <CR_F label="Runs for (days)">
          <input className="input" inputMode="numeric" value={f.days} onChange={set("days")} />
        </CR_F>
      </div>
      <div className="kv">
        <span>Fee</span>
        <span>
          {WHTS.tlos(feeBallot)} {dep.decide >= feeBallot ? "(covered by your deposit)" : `(you have ${NV.fmt(tlos)} TLOS)`}
        </span>
      </div>
      <button className="btn primary block" disabled={!ok} onClick={submit}>
        Review ballot
      </button>
    </div>
  );
}

/* ------------------------------------------------- tokens / DAOs */
function TS_Tokens({ me, signedIn, login, ask, cfg, trs, mineV, dep, tlos, toast }) {
  const [make, setMake] = De.useState(false);
  const mine = (trs || []).filter((x) => me && x.manager === me);
  const joined = (trs || []).filter((x) => me && x.manager !== me && (mineV || []).some((v) => WHTS.sym(v.liquid) === WHTS.sym(x.max_supply)));
  return (
    <>
      <CR_Help title="What is a community voting token?">
        <p>A Telos Decide <b>treasury</b> is a token made for decisions: a club, a DAO, a project team or a fan community. You choose who can join, issue tokens to members, and run ballots that only your members vote in.</p>
        <p>It's separate from normal tradable tokens. Creating one costs {cfg ? WHTS.tlos(WHTS.fee(cfg, "treasury")) : "a small fee"}, paid from your Decide deposit.</p>
      </CR_Help>
      {!make && (
        <button className="btn primary block" onClick={() => (signedIn ? setMake(true) : login())}>
          {signedIn ? "Create a community token" : "Sign in to create a token"}
        </button>
      )}
      {make && <TS_NewTreasury me={me} ask={ask} cfg={cfg} trs={trs} dep={dep} tlos={tlos} onDone={() => setMake(false)} />}
      {signedIn && (
        <>
          <h2>Tokens you manage</h2>
          {trs && mine.length === 0 && <WH_Empty title="None yet" text="Tokens you create appear here, with tools to add members, issue tokens and change settings." />}
          {mine.map((x) => (
            <TS_Treasury key={x.max_supply} x={x} me={me} ask={ask} toast={toast} />
          ))}
          {joined.length > 0 && (
            <>
              <h2>Tokens you belong to</h2>
              {joined.map((x) => {
                const v = mineV.find((y) => WHTS.sym(y.liquid) === WHTS.sym(x.max_supply));
                return (
                  <div className="card" key={x.max_supply}>
                    <b>{x.title || WHTS.sym(x.max_supply)}</b> <span className="faint mono">{WHTS.sym(x.max_supply)}</span>
                    <div className="kv">
                      <span>Your balance</span>
                      <span>
                        {WH.trimAsset(v.liquid)}
                        {WHTS.num(v.staked) ? ` + ${WH.trimAsset(v.staked)} staked` : ""}
                      </span>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </>
      )}
      <h2>All community tokens</h2>
      {(trs || [])
        .filter((x) => WHTS.sym(x.max_supply) !== "VOTE")
        .map((x) => (
          <div className="kv" key={x.max_supply}>
            <span>
              <b>{WHTS.sym(x.max_supply)}</b> <span className="faint">{(x.title || "").slice(0, 40)}</span>
            </span>
            <span className="faint">
              {x.voters} members · {x.access}
            </span>
          </div>
        ))}
    </>
  );
}

function TS_NewTreasury({ me, ask, cfg, trs, dep, tlos, onDone }) {
  const [f, setF] = De.useState({ code: "", dec: "4", max: "1000000", access: "public", title: "", desc: "", icon: "", mint: "1000" });
  const [st, setSt] = De.useState(() => Object.fromEntries(WHTS.SETTINGS.map(([k, , d]) => [k, d])));
  const set = (k) => (ev) => setF({ ...f, [k]: ev.target.value });
  const code = f.code.toUpperCase();
  const dec = Math.max(0, Math.min(8, Number(f.dec) || 0));
  const taken = (trs || []).some((x) => WHTS.sym(x.max_supply) === code);
  const codeErr = code && (!/^[A-Z]{1,7}$/.test(code) ? "1–7 letters A–Z" : taken ? `${code} already exists on Telos Decide` : "");
  const max = Number(f.max);
  const mint = Number(f.mint) || 0;
  const feeT = WHTS.fee(cfg, "treasury");
  const ok = code && !codeErr && max > 0 && mint >= 0 && mint <= max && f.title.trim();
  const sym = `${dec},${code}`;
  const q = (n) => `${Number(n).toFixed(dec)} ${code}`;
  function submit() {
    const acts = [
      ...WHTS.payFee("telos.decide", me, feeT, dep.decide, "treasury fee deposit"),
      { account: "telos.decide", name: "newtreasury", data: { manager: me, max_supply: q(max), access: f.access } },
      { account: "telos.decide", name: "edittrsinfo", data: { treasury_symbol: sym, title: f.title.trim(), description: f.desc.trim(), icon: f.icon.trim() } },
      ...WHTS.SETTINGS.filter(([k]) => st[k]).map(([k]) => ({ account: "telos.decide", name: "toggle", data: { treasury_symbol: sym, setting_name: k } })),
      { account: "telos.decide", name: "regvoter", data: { voter: me, treasury_symbol: sym, referrer: null } },
      ...(mint > 0 ? [{ account: "telos.decide", name: "mint", data: { to: me, quantity: q(mint), memo: "initial supply" } }] : []),
    ];
    ask(
      `Create ${code}`,
      acts,
      [
        { label: "Token", value: `${code} (${dec} decimals), max ${q(max)}` },
        { label: "Who can join", value: f.access },
        { label: "Settings on", value: WHTS.SETTINGS.filter(([k]) => st[k]).map(([, l]) => l).join("\n") || "none" },
        { label: "Issued to you now", value: mint > 0 ? q(mint) : "nothing" },
        { label: "Fee", value: `${WHTS.tlos(feeT)}${dep.decide >= feeT ? " (from your Decide deposit)" : ""}` },
      ],
      "The symbol and decimals are permanent. Settings can be switched later from this screen.",
    );
  }
  return (
    <div className="card">
      <div className="row">
        <h3 style={{ margin: 0 }}>New community token</h3>
        <button className="btn sm ghost" onClick={onDone}>
          Close
        </button>
      </div>
      <div className="row" style={{ gap: 8 }}>
        <CR_F label="1. Symbol" err={codeErr} example="CLUB">
          <input className="input mono" value={code} maxLength={7} onChange={(ev) => setF({ ...f, code: ev.target.value.toUpperCase().replace(/[^A-Z]/g, "") })} />
        </CR_F>
        <CR_F label="Decimals" hint="4 is normal; 0 = whole tokens only">
          <input className="input" inputMode="numeric" value={f.dec} onChange={set("dec")} />
        </CR_F>
      </div>
      <CR_F label="Max supply" hint="The most tokens that can ever exist">
        <input className="input" inputMode="decimal" value={f.max} onChange={set("max")} />
      </CR_F>
      <CR_F label="2. Who can join?">
        <select className="select" value={f.access} onChange={set("access")}>
          <option value="public">Anyone (public): people join themselves</option>
          <option value="private">Only people you add (private)</option>
          <option value="invite">By invitation (invite)</option>
        </select>
      </CR_F>
      <CR_F label="3. Name" example="Telos Gardeners Club">
        <input className="input" value={f.title} maxLength={100} onChange={set("title")} />
      </CR_F>
      <CR_F label="Description (optional)">
        <textarea className="input" rows={2} value={f.desc} onChange={set("desc")} />
      </CR_F>
      <CR_F label="Icon link (optional)" hint="https:// or ipfs:// link to a square image">
        <input className="input" value={f.icon} onChange={set("icon")} autoCapitalize="none" />
      </CR_F>
      <div className="label">4. Rules</div>
      {WHTS.SETTINGS.map(([k, l]) => (
        <label key={k} className="row" style={{ justifyContent: "flex-start", gap: 8, margin: "4px 0" }}>
          <input className="check" type="checkbox" checked={!!st[k]} onChange={(ev) => setSt({ ...st, [k]: ev.target.checked })} />
          <span style={{ fontSize: 13 }}>{l}</span>
        </label>
      ))}
      <CR_F label="5. Issue to yourself now" hint="You can issue more to members later, up to the max supply">
        <input className="input" inputMode="decimal" value={f.mint} onChange={set("mint")} />
      </CR_F>
      <div className="kv">
        <span>Fee</span>
        <span>
          {WHTS.tlos(feeT)} {dep.decide >= feeT ? "(covered by your deposit)" : `(you have ${NV.fmt(tlos)} TLOS)`}
        </span>
      </div>
      <button className="btn primary block" disabled={!ok} onClick={submit}>
        Review token
      </button>
    </div>
  );
}

function TS_Treasury({ x, me, ask }) {
  const [mode, setMode] = De.useState(null);
  const [who, setWho] = De.useState("");
  const [amt, setAmt] = De.useState("");
  const [info, setInfo] = De.useState({ title: x.title || "", description: x.description || "", icon: x.icon || "" });
  const [reg, setReg] = De.useState(undefined);
  const [amtS, code] = String(x.max_supply).split(" ");
  const dec = (amtS.split(".")[1] || "").length;
  const sym = `${dec},${code}`;
  const q = (n) => `${Number(n).toFixed(dec)} ${code}`;
  const settings = Object.fromEntries((x.settings || []).map((s) => [s.key, !!s.value]));
  const chk = WH.checkAccountName(who);
  De.useEffect(() => {
    setReg(undefined);
    if (!chk.ok) return;
    const id = setTimeout(
      () =>
        qr({ code: "telos.decide", scope: chk.value, table: "voters", limit: 100 })
          .then((r) => setReg((r.rows || []).some((v) => WHTS.sym(v.liquid) === code)))
          .catch(() => setReg(null)),
      400,
    );
    return () => clearTimeout(id);
  }, [who]);
  const room = WHTS.num(x.max_supply) - WHTS.num(x.supply);
  const a = Number(String(amt).replace(",", "."));
  const regAct = { account: "telos.decide", name: "regvoter", data: { voter: chk.value, treasury_symbol: sym, referrer: me } };
  return (
    <div className="card">
      <div className="row" style={{ alignItems: "flex-start" }}>
        <div>
          <b>{x.title || code}</b> <span className="faint mono">{code}</span>
          <div className="faint" style={{ fontSize: 12 }}>
            {x.access} · {x.voters} member{x.voters === 1 ? "" : "s"} · {x.open_ballots} open ballot{x.open_ballots === 1 ? "" : "s"}
          </div>
        </div>
        {x.locked ? <span className="pill">locked</span> : null}
      </div>
      <div className="kv">
        <span>Issued</span>
        <span>
          {WH.trimAsset(x.supply)} of {WH.trimAsset(x.max_supply)}
        </span>
      </div>
      <div className="wh-chips">
        {[
          ["members", "Add member"],
          ["mint", "Issue tokens"],
          ["rules", "Rules"],
          ["info", "Edit details"],
        ].map(([k, l]) => (
          <button key={k} className={`btn sm ${mode === k ? "primary" : ""}`} onClick={() => setMode(mode === k ? null : k)}>
            {l}
          </button>
        ))}
      </div>
      {(mode === "members" || mode === "mint") && (
        <div style={{ marginTop: 10 }}>
          <input className={`input ${who && !chk.ok ? "wh-invalid" : ""}`} placeholder="Telos account name" value={who} onChange={(ev) => setWho(ev.target.value.toLowerCase().trim())} autoCapitalize="none" />
          {chk.ok && <div className="wh-field-msg">{reg === undefined ? "Checking…" : reg ? `${chk.value} is already a member` : reg === false ? `${chk.value} isn't a member yet${mode === "mint" ? ": they'll be added in the same transaction" : ""}` : "Couldn't check membership"}</div>}
          {mode === "members" && (
            <button className="btn primary block" style={{ marginTop: 8 }} disabled={!chk.ok || reg !== false} onClick={() => ask(`Add ${chk.value} to ${code}`, [regAct], [{ label: "Member", value: chk.value }], "You pay the small amount of RAM for their membership record.")}>
              Add member
            </button>
          )}
          {mode === "mint" && (
            <>
              <div style={{ height: 8 }} />
              <WH_AmountInput label={`Amount (up to ${NV.fmt(room, dec)} left)`} value={amt} max={String(room)} symbol={code} onChange={setAmt} />
              <button
                className="btn primary block"
                disabled={!chk.ok || reg === undefined || !(a > 0) || a > room + 1e-9}
                onClick={() => ask(`Issue ${q(a)}`, [...(reg === false ? [regAct] : []), { account: "telos.decide", name: "mint", data: { to: chk.value, quantity: q(a), memo: "issued with Antelope Hub" } }], [{ label: "To", value: chk.value }, { label: "Amount", value: q(a) }])}
              >
                Review
              </button>
            </>
          )}
        </div>
      )}
      {mode === "rules" && (
        <div style={{ marginTop: 10 }}>
          {WHTS.SETTINGS.map(([k, l]) => (
            <div className="kv" key={k} style={{ alignItems: "center" }}>
              <span style={{ fontSize: 13 }}>
                {l}: <b>{settings[k] ? "on" : "off"}</b>
              </span>
              <button className="btn sm" onClick={() => ask(`Turn ${settings[k] ? "off" : "on"}: ${l}`, [{ account: "telos.decide", name: "toggle", data: { treasury_symbol: sym, setting_name: k } }], [{ label: "Token", value: code }])}>
                Turn {settings[k] ? "off" : "on"}
              </button>
            </div>
          ))}
        </div>
      )}
      {mode === "info" && (
        <div style={{ marginTop: 10 }}>
          <CR_F label="Name">
            <input className="input" value={info.title} onChange={(ev) => setInfo({ ...info, title: ev.target.value })} />
          </CR_F>
          <CR_F label="Description">
            <textarea className="input" rows={2} value={info.description} onChange={(ev) => setInfo({ ...info, description: ev.target.value })} />
          </CR_F>
          <CR_F label="Icon link">
            <input className="input" value={info.icon} onChange={(ev) => setInfo({ ...info, icon: ev.target.value })} />
          </CR_F>
          <button className="btn primary block" onClick={() => ask(`Update ${code} details`, [{ account: "telos.decide", name: "edittrsinfo", data: { treasury_symbol: sym, title: info.title.trim(), description: info.description.trim(), icon: info.icon.trim() } }])}>
            Save details
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------- Works */
function TS_Works({ me, signedIn, login, ask, wcfg, props, ballots, dep, tlos }) {
  const [make, setMake] = De.useState(false);
  const live = (props || []).filter((x) => x.status === "inprogress");
  const mine = (props || []).filter((x) => me && x.proposer === me);
  const ballot = (n) => (ballots || []).find((b) => b.ballot_name === n);
  return (
    <>
      <CR_Help title="What is Telos Works?">
        <p>Telos Works funds projects that grow Telos. Anyone can apply: a proposal asks for TLOS paid in milestones, and VOTE holders approve each milestone in Telos Decide.</p>
        {wcfg && (
          <p>
            Requests can be {WH.trimAsset(wcfg.min_requested)} to {WH.trimAsset(wcfg.max_requested)}. Launching costs {wcfg.fee_percent}% of the request (at least {WH.trimAsset(wcfg.min_fee)}). A milestone passes with {wcfg.quorum_threshold}% turnout and {wcfg.yes_threshold}% yes; the fee is refunded above {wcfg.quorum_refund_threshold}% turnout and {wcfg.yes_refund_threshold}% yes.
          </p>
        )}
      </CR_Help>
      {wcfg && (
        <div className="card">
          <div className="kv">
            <span>Available to fund</span>
            <b>{WH.trimAsset(wcfg.available_funds)}</b>
          </div>
          <div className="kv">
            <span>Paid out so far</span>
            <span>{WH.trimAsset(wcfg.paid_funds)}</span>
          </div>
        </div>
      )}
      {!make && (
        <button className="btn primary block" onClick={() => (signedIn ? setMake(true) : login())}>
          {signedIn ? "Write a funding proposal" : "Sign in to apply for funding"}
        </button>
      )}
      {make && <TS_NewProposal me={me} ask={ask} wcfg={wcfg} props={props} onDone={() => setMake(false)} />}
      {signedIn && mine.length > 0 && (
        <>
          <h2>Your proposals</h2>
          {mine.map((x) => (
            <TS_MyProposal key={x.proposal_name} x={x} me={me} ask={ask} wcfg={wcfg} dep={dep} ballot={ballot(x.current_ballot)} ballots={ballots} />
          ))}
        </>
      )}
      <h2>Funded projects in progress</h2>
      {props && live.length === 0 && <WH_Empty title="Nothing in progress" text="No Telos Works proposals are running right now." />}
      {live.map((x) => {
        const b = ballot(x.current_ballot);
        const open = b && b.status === "voting" && Date.parse(b.end_time + "Z") > Date.now();
        return (
          <div className="card" key={x.proposal_name}>
            <div className="row" style={{ alignItems: "flex-start" }}>
              <b style={{ minWidth: 0 }}>{x.title}</b>
              {open && <span className="pill good">Voting now</span>}
            </div>
            <div className="faint" style={{ fontSize: 12 }}>
              by {x.proposer} · {x.category} · milestone {x.current_milestone} of {x.milestones}
            </div>
            <div className="kv">
              <span>Requested</span>
              <span>{WH.trimAsset(x.total_requested)}</span>
            </div>
            {x.description && <div className="muted" style={{ fontSize: 12.5 }}>{String(x.description).slice(0, 240)}</div>}
            {open && (
              <button className="btn sm primary" style={{ marginTop: 8 }} onClick={() => WH.nav({ tab: "more", tool: "native" })}>
                Vote in Telos Decide
              </button>
            )}
          </div>
        );
      })}
    </>
  );
}

function TS_NewProposal({ me, ask, wcfg, props, onDone }) {
  const [f, setF] = De.useState({ title: "", desc: "", content: "", cat: "apps", amount: "", ms: "1" });
  const set = (k) => (ev) => setF({ ...f, [k]: ev.target.value });
  const a = Number(f.amount);
  const lo = WHTS.num(wcfg?.min_requested || "1000"),
    hi = WHTS.num(wcfg?.max_requested || "500000");
  const ms = Math.max(Number(wcfg?.min_milestones || 1), Math.min(Number(wcfg?.max_milestones || 12), Number(f.ms) || 1));
  const fee = Math.max(WHTS.num(wcfg?.min_fee || "30"), ((Number(wcfg?.fee_percent) || 5) / 100) * (a || 0));
  const ok = f.title.trim() && f.desc.trim() && a >= lo && a <= hi;
  function submit() {
    const taken = new Set((props || []).map((x) => x.proposal_name));
    let pn2 = WHTS.randName();
    while (taken.has(pn2)) pn2 = WHTS.randName();
    ask(
      "Save proposal draft",
      [{ account: "works.decide", name: "draftprop", data: { title: f.title.trim(), description: f.desc.trim(), content: f.content.trim(), proposal_name: pn2, proposer: me, category: f.cat, total_requested: WHTS.tlos(a), milestones: ms } }],
      [
        { label: "Title", value: f.title.trim() },
        { label: "Requested", value: `${WHTS.tlos(a)} over ${ms} milestone${ms === 1 ? "" : "s"}` },
        { label: "Launch fee later", value: WHTS.tlos(fee) },
      ],
      "This saves a draft only; nothing is paid yet. Launch it from “Your proposals” when you're ready.",
    );
  }
  return (
    <div className="card">
      <div className="row">
        <h3 style={{ margin: 0 }}>New funding proposal</h3>
        <button className="btn sm ghost" onClick={onDone}>
          Close
        </button>
      </div>
      <CR_F label="1. Title" example="Telos onboarding videos in Spanish">
        <input className="input" value={f.title} maxLength={256} onChange={set("title")} />
      </CR_F>
      <CR_F label="2. Summary" hint="What you'll build or do, and why it helps Telos">
        <textarea className="input" rows={3} value={f.desc} onChange={set("desc")} />
      </CR_F>
      <CR_F label="Full proposal link (recommended)" hint="A public document with your plan, budget and team">
        <input className="input" value={f.content} onChange={set("content")} placeholder="https://…" autoCapitalize="none" />
      </CR_F>
      <CR_F label="3. Category">
        <select className="select" value={f.cat} onChange={set("cat")}>
          {["apps", "developers", "marketing", "education"].map((c) => (
            <option key={c} value={c}>
              {c[0].toUpperCase() + c.slice(1)}
            </option>
          ))}
        </select>
      </CR_F>
      <div className="row" style={{ gap: 8 }}>
        <CR_F label={`4. Amount (TLOS, ${NV.fmt(lo)}–${NV.fmt(hi)})`} err={f.amount && !(a >= lo && a <= hi) ? "Outside the allowed range" : ""}>
          <input className="input" inputMode="decimal" value={f.amount} onChange={set("amount")} />
        </CR_F>
        <CR_F label="Milestones" hint="Paid in equal parts">
          <input className="input" inputMode="numeric" value={f.ms} onChange={set("ms")} />
        </CR_F>
      </div>
      <div className="kv">
        <span>Launch fee</span>
        <span>{WHTS.tlos(fee)}</span>
      </div>
      <button className="btn primary block" disabled={!ok} onClick={submit}>
        Review draft
      </button>
    </div>
  );
}

function TS_MyProposal({ x, me, ask, wcfg, dep, ballot, ballots }) {
  const [rep, setRep] = De.useState("");
  const fee = Math.max(WHTS.num(wcfg?.min_fee || "30"), ((Number(wcfg?.fee_percent) || 5) / 100) * WHTS.num(x.total_requested));
  const pn2 = x.proposal_name;
  const ended = ballot && ballot.end_time && Date.parse(ballot.end_time + "Z") <= Date.now();
  return (
    <div className="card">
      <div className="row" style={{ alignItems: "flex-start" }}>
        <b>{x.title}</b>
        <span className="pill">{x.status}</span>
      </div>
      <div className="faint mono" style={{ fontSize: 11 }}>
        {pn2} · {WH.trimAsset(x.total_requested)} · milestone {x.current_milestone}/{x.milestones}
      </div>
      {ballot && (
        <div className="faint" style={{ fontSize: 12, marginTop: 4 }}>
          Ballot {ballot.ballot_name}: {ballot.status}
          {ballot.end_time ? `, ${ended ? "ended" : "ends"} ${new Date(Date.parse(ballot.end_time + "Z")).toLocaleDateString()}` : ""} · {(ballot.options || []).map((o) => `${o.key} ${WH.trimAsset(o.value)}`).join(", ")}
        </div>
      )}
      <div className="wh-chips">
        {x.status === "drafting" && (
          <>
            <button className="btn sm primary" onClick={() => ask("Launch proposal", [...WHTS.payFee("works.decide", me, fee, dep.works, "works fee deposit"), { account: "works.decide", name: "launchprop", data: { proposal_name: pn2 } }], [{ label: "Proposal", value: x.title }, { label: "Fee", value: WHTS.tlos(fee) }], "Launching opens the first milestone ballot. The fee is refunded only if the vote clears the refund thresholds.")}>
              Launch ({WHTS.tlos(fee)})
            </button>
            <button className="btn sm" onClick={() => ask("Delete draft", [{ account: "works.decide", name: "deleteprop", data: { proposal_name: pn2 } }], [{ label: "Proposal", value: x.title }])}>
              Delete draft
            </button>
          </>
        )}
        {x.status === "inprogress" && (
          <>
            <button className="btn sm primary" onClick={() => ask("Claim milestone funds", [{ account: "works.decide", name: "claimfunds", data: { proposal_name: pn2 } }], [{ label: "Proposal", value: x.title }], "Works only after the milestone's ballot has passed and closed.")}>
              Claim funds
            </button>
            <button
              className="btn sm"
              onClick={() => {
                const taken = new Set((ballots || []).map((b) => b.ballot_name));
                let bn = WHTS.randName();
                while (taken.has(bn)) bn = WHTS.randName();
                ask("Start next milestone", [{ account: "works.decide", name: "nextms", data: { proposal_name: pn2, ballot_name: bn } }], [{ label: "Proposal", value: x.title }, { label: "New ballot", value: bn }], "Opens the vote for your next milestone. Submit a report for the current one first.");
              }}
            >
              Next milestone
            </button>
            <button className="btn sm" onClick={() => ask("Cancel proposal", [{ account: "works.decide", name: "cancelprop", data: { proposal_name: pn2, memo: "cancelled by proposer" } }], [{ label: "Proposal", value: x.title }], "Cancelling stops all future milestones.")}>
              Cancel
            </button>
          </>
        )}
      </div>
      {x.status === "inprogress" && (
        <div style={{ marginTop: 10 }}>
          <CR_F label="Milestone report" hint="What you delivered, with links. Voters read this before the next ballot.">
            <textarea className="input" rows={2} value={rep} onChange={(ev) => setRep(ev.target.value)} />
          </CR_F>
          <button className="btn sm block" disabled={!rep.trim()} onClick={() => ask("Submit milestone report", [{ account: "works.decide", name: "submitreport", data: { proposal_name: pn2, report: rep.trim() } }], [{ label: "Proposal", value: x.title }])}>
            Submit report
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ NFTs */
function TS_Nfts() {
  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Make NFTs on Telos</h3>
      <p className="muted" style={{ fontSize: 13 }}>Telos runs the same AtomicAssets NFT standard as WAX. The Creator studio walks you through it: collection → schema → template → mint, then blends. The app reads Telos NFT data straight from the chain, so it works without any outside indexer.</p>
      <button className="btn primary block" onClick={() => WH.nav({ tab: "more", tool: "creator" })}>
        Open Creator studio
      </button>
    </div>
  );
}

/* -------------------------------------------------------- deposits */
function TS_Deposits({ me, signedIn, login, ask, dep }) {
  if (!signedIn) return <BR_SignIn login={login} what="see your Telos Decide and Telos Works deposits" />;
  const row = (label, contract, amount, data) => (
    <div className="card">
      <div className="row">
        <b>{label}</b>
        <span>{WHTS.tlos(amount)}</span>
      </div>
      <p className="faint" style={{ fontSize: 12 }}>TLOS you sent to {contract} to pay fees. Anything not used yet can be withdrawn at any time.</p>
      <button className="btn sm primary" disabled={!(amount > 0)} onClick={() => ask(`Withdraw from ${label}`, [{ account: contract, name: "withdraw", data }], [{ label: "Amount", value: WHTS.tlos(amount) }])}>
        Withdraw all
      </button>
    </div>
  );
  return (
    <>
      {row("Telos Decide deposit", "telos.decide", dep.decide, { voter: me, quantity: WHTS.tlos(dep.decide) })}
      {row("Telos Works deposit", "works.decide", dep.works, { account_name: me, quantity: WHTS.tlos(dep.works) })}
    </>
  );
}
