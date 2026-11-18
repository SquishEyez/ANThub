// Guided account creation for each Antelope network.
//   WAX / Telos / Jungle 4: eosio::newaccount + buyrambytes + delegatebw
//   EOS (Vaulta):           core.vaulta::newaccount2(creator, name, key) + core.vaulta::buyrambytes(payer, receiver, 4096)
//                           (newaccount2 alone leaves the account without RAM, so it fails; checked by dry run)
//   XPR Network / Libre:    created by their own onboarding wallets (WebAuth, Bitcoin Libre)
// Keys are generated on this device with the wallet library's PrivateKey and are
// never stored or sent anywhere: only the public key goes on-chain.

const WHNA = (() => {
  const K = WHCHAIN.key;
  const FREE = {
    wax: [{ name: "My Cloud Wallet", url: "https://www.mycloudwallet.com/", text: "Free. Sign up with email, Google, Apple or similar and you get a WAX account ending in .wam, with free resources to start. You can sign in to Antelope Hub with it straight away." }],
    eos: [{ name: "Ask someone with an EOS account", text: "EOS has no free sign-up run by the network. Choose \"Someone else creates it\" below: the app makes your keys and a message to send to a friend, a community member or a paid account service." }],
    telos: [{ name: "Telos Wallet", url: "https://wallet.telos.net/", text: "The official Telos wallet can create a Telos account for you at no cost. Then import the key into Anchor to use it here." }],
    xpr: [{ name: "WebAuth wallet", url: "https://webauth.com/", text: "Free. Install WebAuth (iOS, Android or web), pick a name and you're done, with free resources. Then sign in here with WebAuth." }],
    libre: [{ name: "Bitcoin Libre wallet", url: "https://www.bitcoinlibre.io/", text: "Free. The Bitcoin Libre app creates your Libre account and its Bitcoin deposit address. Libre accounts are made through it rather than from another account." }],
    jungle4: [{ name: "Jungle 4 faucet", url: "https://monitor.jungletestnet.io/", text: "Free test accounts: choose \"Create Account\", enter a 12-character name and the public key made below, then use \"Faucet\" for free test tokens." }],
  }[K] || [];
  const funded = ["wax", "telos", "jungle4", "eos"].includes(K);
  const res = { wax: { ram: 4096, cpu: "2", net: "0.5" }, telos: { ram: 4096, cpu: "1", net: "0.1" }, jungle4: { ram: 4096, cpu: "1", net: "0.1" } }[K];
  const q = (n) => `${Number(n || 0).toFixed(WHCHAIN.prec)} ${WHCHAIN.sym}`;
  function nameRule(v, creator) {
    const c = WH.checkAccountName(v);
    if (!c.ok) return c.msg ? c : { ok: false, msg: "" };
    if (c.value.includes(".") && !(creator && c.value.endsWith("." + creator)))
      return { ok: false, msg: creator ? `Names with a dot must end in .${creator} (your account). Otherwise use exactly 12 characters without dots.` : "Use exactly 12 characters without dots." };
    if (!c.value.includes(".") && c.value.length !== 12) return { ok: false, msg: `Names must be exactly 12 characters (this has ${c.value.length}). Shorter names are premium names${K === "eos" || K === "jungle4" ? ", won in name auctions (essentials → Name auctions)" : ""}.` };
    return { ok: true, value: c.value };
  }
  // true = free, false = taken, null = couldn't check
  async function available(name) {
    for (const u of WHCHAIN.rpc) {
      try {
        const r = await Wf(`${u}/v1/chain/get_account`, { method: "POST", body: JSON.stringify({ account_name: name }) }, 1e4);
        if (r.ok) return false;
        const j = await r.json().catch(() => null);
        const s = JSON.stringify(j || {});
        if (/unknown key|account_query_exception|does not exist|unknown_key/i.test(s)) return true;
      } catch {}
    }
    return null;
  }
  function keyOk(k) {
    try {
      return rn.from(String(k).trim()).toString();
    } catch {
      return null;
    }
  }
  function newKey() {
    const p = Hs.generate("K1");
    return { priv: p.toWif(), privNew: p.toString(), pub: p.toPublic().toLegacyString(), pubNew: p.toPublic().toString() };
  }
  async function ramCost(bytes) {
    try {
      const r = (await qr({ code: "eosio", scope: "eosio", table: "rammarket", limit: 1 })).rows?.[0];
      const base = Number(String(r.base.balance).split(" ")[0]);
      const quote = Number(String(r.quote.balance).split(" ")[0]);
      return ((bytes * quote) / base) * 1.006;
    } catch {
      return null;
    }
  }
  function actions(creator, name, pub, o) {
    if (K === "eos")
      return [
        { account: "core.vaulta", name: "newaccount2", data: { creator, name, key: pub } },
        { account: "core.vaulta", name: "buyrambytes", data: { payer: creator, receiver: name, bytes: 4096 } },
      ];
    const auth = { threshold: 1, keys: [{ key: pub, weight: 1 }], accounts: [], waits: [] };
    const out = [
      { account: "eosio", name: "newaccount", data: { creator, name, owner: auth, active: auth } },
      { account: "eosio", name: "buyrambytes", data: { payer: creator, receiver: name, bytes: Number(o.ram) } },
    ];
    if (Number(o.cpu) > 0 || Number(o.net) > 0) out.push({ account: "eosio", name: "delegatebw", data: { from: creator, receiver: name, stake_net_quantity: q(o.net), stake_cpu_quantity: q(o.cpu), transfer: !!o.gift } });
    return out;
  }
  return { FREE, funded, res, nameRule, available, keyOk, newKey, ramCost, actions, q };
})();

function WH_NewAccount({ session: t, onNeedLogin: e, toast: r, onBack: n }) {
  const me = Di(t);
  const [path, setPath] = De.useState(null); // "free" | "me" | "friend"
  const [step, setStep] = De.useState(0); // 0 keys, 1 name, 2 review, 3 done
  const [keyMode, setKeyMode] = De.useState("new");
  const [keys, setKeys] = De.useState(null);
  const [pasted, setPasted] = De.useState("");
  const [saved, setSaved] = De.useState(false);
  const [show, setShow] = De.useState(false);
  const [name, setName] = De.useState("");
  const [avail, setAvail] = De.useState(undefined);
  const [opt, setOpt] = De.useState(() => ({ ...(WHNA.res || {}), gift: true }));
  const [cost, setCost] = De.useState(null);
  const [confirm, setConfirm] = De.useState(null);
  const [busy, setBusy] = De.useState(false);
  const [tx, setTx] = De.useState("");
  const pub = keyMode === "new" ? keys?.pub : WHNA.keyOk(pasted);
  const creator = path === "me" ? me : null;
  const rule = WHNA.nameRule(name, creator);
  De.useEffect(() => {
    setAvail(undefined);
    if (!rule.ok) return;
    const id = setTimeout(() => WHNA.available(rule.value).then(setAvail), 450);
    return () => clearTimeout(id);
  }, [name, path]);
  De.useEffect(() => {
    if (path === "me") WHNA.ramCost(WHCHAIN.key === "eos" ? 4096 : Number(opt.ram || 0)).then(setCost);
  }, [path, opt.ram]);
  // drop keys from memory when leaving the screen
  De.useEffect(() => () => setKeys(null), []);
  const pick = (p) => {
    if (p === "me" && !t) return e();
    setPath(p);
    setStep(0);
  };
  const keysReady = keyMode === "new" ? !!keys && saved : !!pub;
  const sym = WHCHAIN.sym;
  async function create() {
    setBusy(true);
    try {
      const res = await yo(t, confirm.actions);
      setTx(pn(res) || "");
      setConfirm(null);
      setStep(3);
      r(`Account ${rule.value} created`, "success");
    } catch (err) {
      r(err?.message || String(err), "error");
    } finally {
      setBusy(false);
    }
  }
  const review = () =>
    setConfirm({
      title: `Create ${rule.value}`,
      actions: WHNA.actions(me, rule.value, pub, opt),
      details: [
        { label: "Paid by", value: me },
        { label: "New account", value: rule.value },
        { label: "Public key", value: pub },
        ...(WHCHAIN.key === "eos"
          ? [{ label: "RAM", value: `4096 bytes${cost ? ` (≈ ${NV.fmt(cost, 4)} ${sym})` : ""}, bought for it in the same transaction` }]
          : [
              { label: "RAM", value: `${opt.ram} bytes${cost ? ` (≈ ${NV.fmt(cost, 4)} ${sym})` : ""}` },
              { label: "Staked for it", value: `${WHNA.q(opt.cpu)} CPU, ${WHNA.q(opt.net)} NET${opt.gift ? " (given to the new account)" : " (stays yours)"}` },
            ]),
      ],
      warning: "Only the holder of the private key for that public key can use the new account. Make sure it's saved before you approve.",
    });
  const shareText = `Hi! Could you create the ${WHCHAIN.name} account "${rule.value || "<name>"}" for me, with this public key for owner and active:\n${pub || ""}`;

  const Step = ({ i, label }) => (
    <span className={`pill ${step === i ? "accent" : step > i ? "good" : ""}`} style={{ fontSize: 11 }}>
      {i + 1}. {label}
    </span>
  );

  return (
    <>
      <div className="back-row">
        <button className="btn sm" onClick={() => (path && step < 3 ? (step > 0 ? setStep(step - 1) : setPath(null)) : n())}>
          ← {path && step < 3 ? "Back" : "More"}
        </button>
        <h1 style={{ margin: 0, flex: 1 }}>New account</h1>
      </div>
      <p className="sub">Get a {WHCHAIN.name} account in a few guided steps. An account is your name on the chain; it's controlled by a private key that only you hold.</p>

      {!path && (
        <>
          {WHNA.FREE.map((f) => (
            <div className="card" key={f.name}>
              <div className="row" style={{ alignItems: "flex-start" }}>
                <h3 style={{ margin: 0 }}>{f.name}</h3>
                {f.url && <span className="pill good">Easiest</span>}
              </div>
              <p className="muted" style={{ fontSize: 13, margin: "6px 0 10px" }}>{f.text}</p>
              {f.url && (
                <a className="btn primary block" href={f.url} target="_blank" rel="noopener noreferrer" style={{ textAlign: "center", textDecoration: "none" }}>
                  Open {f.name}
                </a>
              )}
              {WHCHAIN.key === "jungle4" && (
                <button className="btn block" style={{ marginTop: 8 }} onClick={() => pick("friend")}>
                  Make keys for the faucet
                </button>
              )}
            </div>
          ))}
          {WHNA.funded && (
            <div className="card">
              <h3 style={{ margin: 0 }}>Create it from my account</h3>
              <p className="muted" style={{ fontSize: 13, margin: "6px 0 10px" }}>
                {WHCHAIN.key === "eos"
                  ? "Your signed-in account pays for the new account's RAM (about 4 KB). Great for a second account or for a friend."
                  : `Your signed-in account pays for the new account's RAM and stakes a little ${sym} for its CPU and NET. Great for a second account or for a friend.`}
              </p>
              <button className="btn primary block" onClick={() => pick("me")}>
                {t ? `Start (paid by ${me})` : "Sign in to start"}
              </button>
            </div>
          )}
          {["wax", "eos", "telos"].includes(WHCHAIN.key) && (
            <div className="card">
              <h3 style={{ margin: 0 }}>Someone else creates it</h3>
              <p className="muted" style={{ fontSize: 13, margin: "6px 0 10px" }}>Make your keys here, pick a name, and send the ready-made message to whoever creates it. You never share your private key.</p>
              <button className="btn block" onClick={() => pick("friend")}>
                Make keys and a request
              </button>
            </div>
          )}
          <CR_Help title="What are keys?">
            <p>Your private key is the password to your account, and it can't be reset. Anyone who has it controls the account. The public key is safe to share: it's what gets written on-chain.</p>
            <p>Antelope Hub makes keys on this device and never stores or sends the private key. After creating the account, add the private key to Anchor (or another Antelope wallet) and sign in here with it.</p>
          </CR_Help>
        </>
      )}

      {path && path !== "free" && step < 3 && (
        <div className="wh-chips" style={{ marginBottom: 10 }}>
          <Step i={0} label="Keys" />
          <Step i={1} label="Name" />
          {path === "me" ? <Step i={2} label="Create" /> : <Step i={2} label="Send" />}
        </div>
      )}

      {path && step === 0 && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>1. Keys</h3>
          <div className="seg" style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            <button className={`btn sm ${keyMode === "new" ? "primary" : ""}`} onClick={() => setKeyMode("new")}>
              Make new keys
            </button>
            <button className={`btn sm ${keyMode === "paste" ? "primary" : ""}`} onClick={() => setKeyMode("paste")}>
              I have a public key
            </button>
          </div>
          {keyMode === "new" ? (
            !keys ? (
              <>
                <p className="muted" style={{ fontSize: 13 }}>Keys are made on this device using its secure random generator. Do this somewhere private: no one should see your screen.</p>
                <button className="btn primary block" onClick={() => { setKeys(WHNA.newKey()); setSaved(false); setShow(false); }}>
                  Make my keys
                </button>
              </>
            ) : (
              <>
                <div className="label">Public key (safe to share)</div>
                <div className="row" style={{ justifyContent: "flex-start", gap: 6 }}>
                  <span className="mono" style={{ fontSize: 12, wordBreak: "break-all" }}>{keys.pub}</span>
                  <WH_CopyBtn text={keys.pub} label="Copy public key" toast={r} />
                </div>
                <div className="label" style={{ marginTop: 12 }}>Private key (secret: never share it)</div>
                <div className="row" style={{ justifyContent: "flex-start", gap: 6 }}>
                  <span className="mono" style={{ fontSize: 12, wordBreak: "break-all", filter: show ? "none" : "blur(5px)", userSelect: show ? "text" : "none" }}>{keys.priv}</span>
                  <button className="btn sm" onClick={() => setShow(!show)}>
                    {show ? "Hide" : "Show"}
                  </button>
                  <WH_CopyBtn text={keys.priv} label="Copy private key" toast={r} />
                </div>
                <div className="warn" style={{ marginTop: 12 }}>
                  Write the private key on paper or save it in a password manager now. Antelope Hub doesn't keep a copy: if you lose it, the account is lost. Clear your clipboard after pasting it into your wallet.
                </div>
                <label className="row" style={{ justifyContent: "flex-start", gap: 8, margin: "8px 0 12px" }}>
                  <input className="check" type="checkbox" checked={saved} onChange={(ev) => setSaved(ev.target.checked)} />
                  <span style={{ fontSize: 13 }}>I've saved my private key somewhere safe</span>
                </label>
                <button className="btn sm ghost" onClick={() => { setKeys(WHNA.newKey()); setSaved(false); setShow(false); }}>
                  Make different keys
                </button>
              </>
            )
          ) : (
            <>
              <p className="muted" style={{ fontSize: 13 }}>Paste the public key from your wallet (Anchor: Manage keys → copy public key). It starts with PUB_K1_ or EOS.</p>
              <input className={`input ${pasted && !pub ? "wh-invalid" : ""}`} placeholder="PUB_K1_… or EOS…" value={pasted} onChange={(ev) => setPasted(ev.target.value.trim())} autoCapitalize="none" spellCheck={false} />
              {pasted && !pub && <div className="wh-field-msg err">That isn't a valid public key.</div>}
            </>
          )}
          <button className="btn primary block" style={{ marginTop: 12 }} disabled={!keysReady} onClick={() => setStep(WHCHAIN.key === "jungle4" && path === "friend" ? 2 : 1)}>
            Next
          </button>
        </div>
      )}

      {path && step === 1 && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>2. Choose a name</h3>
          <p className="muted" style={{ fontSize: 13 }}>Exactly 12 characters: letters a–z and digits 1–5. It can't be changed later.{creator ? ` Or a shorter name ending in .${creator}.` : ""}</p>
          <input className={`input ${name && !rule.ok ? "wh-invalid" : ""}`} placeholder="e.g. alicewallet1" value={name} onChange={(ev) => setName(ev.target.value.toLowerCase().trim())} autoCapitalize="none" spellCheck={false} maxLength={12} />
          {name && !rule.ok && rule.msg && <div className="wh-field-msg err">{rule.msg}</div>}
          {rule.ok && (
            <div className={`wh-field-msg ${avail === false ? "err" : ""}`} style={{ color: avail ? "var(--good, #3fb68b)" : void 0 }}>
              {avail === undefined ? "Checking…" : avail ? `${rule.value} is available` : avail === false ? `${rule.value} is already taken` : "Couldn't check right now; you can still continue."}
            </div>
          )}
          <button className="btn primary block" style={{ marginTop: 12 }} disabled={!rule.ok || avail === false || avail === undefined} onClick={() => setStep(2)}>
            Next
          </button>
        </div>
      )}

      {path === "me" && step === 2 && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>3. Create</h3>
          <div className="kv"><span>New account</span><b>{rule.value}</b></div>
          <div className="kv"><span>Paid by</span><b>{me}</b></div>
          {WHCHAIN.key === "eos" ? (
            <p className="muted" style={{ fontSize: 12.5 }}>core.vaulta creates the account with your key as owner and active, and the same transaction buys its 4 KB of RAM{cost ? ` (≈ ${NV.fmt(cost, 4)} ${sym})` : ""}, paid by {me}. New EOS accounts use PowerUp for CPU: after creating it, use Get CPU (PowerUp) with the new name as receiver.</p>
          ) : (
            <>
              <CR_F label={`RAM bytes${cost ? ` (≈ ${NV.fmt(cost, 4)} ${sym})` : ""}`}>
                <input className="input" inputMode="numeric" value={opt.ram} onChange={(ev) => setOpt({ ...opt, ram: ev.target.value.replace(/\D/g, "") })} />
              </CR_F>
              <div className="row" style={{ gap: 8 }}>
                <CR_F label={`CPU stake (${sym})`}>
                  <input className="input" inputMode="decimal" value={opt.cpu} onChange={(ev) => setOpt({ ...opt, cpu: ev.target.value })} />
                </CR_F>
                <CR_F label={`NET stake (${sym})`}>
                  <input className="input" inputMode="decimal" value={opt.net} onChange={(ev) => setOpt({ ...opt, net: ev.target.value })} />
                </CR_F>
              </div>
              <label className="row" style={{ justifyContent: "flex-start", gap: 8, margin: "4px 0 10px" }}>
                <input className="check" type="checkbox" checked={opt.gift} onChange={(ev) => setOpt({ ...opt, gift: ev.target.checked })} />
                <span style={{ fontSize: 13 }}>Give the stake to the new account (otherwise it stays yours and you can unstake it later)</span>
              </label>
              <p className="faint" style={{ fontSize: 12 }}>The defaults are enough for a new account to make its first transactions. It needs at least about 3 KB of RAM to exist.</p>
            </>
          )}
          <button className="btn primary block" disabled={WHCHAIN.key !== "eos" && !(Number(opt.ram) >= 3000)} onClick={review}>
            Review and create
          </button>
        </div>
      )}

      {path === "friend" && step === 2 && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>{WHCHAIN.key === "jungle4" ? "Use the faucet" : "3. Send the request"}</h3>
          {WHCHAIN.key === "jungle4" ? (
            <>
              <p className="muted" style={{ fontSize: 13 }}>Open the faucet, choose Create Account, enter a 12-character name and paste this public key:</p>
              <div className="row" style={{ justifyContent: "flex-start", gap: 6 }}>
                <span className="mono" style={{ fontSize: 12, wordBreak: "break-all" }}>{pub}</span>
                <WH_CopyBtn text={pub} label="Copy public key" toast={r} />
              </div>
              <a className="btn primary block" style={{ marginTop: 10, textAlign: "center", textDecoration: "none" }} href="https://monitor.jungletestnet.io/" target="_blank" rel="noopener noreferrer">
                Open the Jungle 4 faucet
              </a>
            </>
          ) : (
            <>
              <p className="muted" style={{ fontSize: 13 }}>Send this to the person or service creating your account. It contains only your public key.</p>
              <pre className="mono" style={{ whiteSpace: "pre-wrap", fontSize: 12, background: "rgba(127,127,127,.1)", padding: 10, borderRadius: 8 }}>{shareText}</pre>
              <div className="wh-chips">
                <WH_CopyBtn text={shareText} label="Copy message" toast={r} className="btn sm primary" />
                {navigator.share && (
                  <button className="btn sm" onClick={() => navigator.share({ text: shareText }).catch(() => {})}>
                    Share…
                  </button>
                )}
              </div>
              <p className="faint" style={{ fontSize: 12, marginTop: 10 }}>Once it exists, add your private key to Anchor and sign in here. You can check whether the name exists yet with the Account lookup on the More screen.</p>
            </>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>{rule.value} is live on {WHCHAIN.name}</h3>
          {tx && WH.txUrl(tx) && (
            <a className="wh-chip" href={WH.txUrl(tx)} target="_blank" rel="noopener noreferrer">
              View transaction
            </a>
          )}
          <ol className="muted" style={{ fontSize: 13, paddingLeft: 18 }}>
            <li>Open Anchor (or another Antelope wallet) and import the private key you saved.</li>
            <li>Choose {WHCHAIN.name} and the account {rule.value}.</li>
            <li>Sign in to Antelope Hub with it.</li>
            {WHCHAIN.key === "eos" && <li>Give it CPU with PowerUp (More → Tools → PowerUp) before its first transaction.</li>}
          </ol>
          <div className="wh-chips">
            {WHCHAIN.key === "eos" && (
              <button className="btn sm primary" onClick={() => WH.nav({ tab: "more", tool: "tools", sub: "power" })}>
                PowerUp the new account
              </button>
            )}
            <button className="btn sm" onClick={() => { setPath(null); setStep(0); setKeys(null); setName(""); setTx(""); }}>
              Create another
            </button>
          </div>
        </div>
      )}
      <WH_Confirm open={!!confirm} title={confirm?.title || ""} details={confirm?.details || []} warning={confirm?.warning} busy={busy} onClose={() => !busy && setConfirm(null)} onConfirm={create} />
    </>
  );
}
