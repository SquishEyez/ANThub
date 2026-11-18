// Packs you own. A pack is an AtomicAssets NFT whose template is registered as a
// pack on one of the pack contracts (atomicpacksx, neftyblocksp, nfthivepacks).
// Those contracts have no owner index, but their `packs` table has a secondary
// index on the template id (index 2, i64; checked on mainnet). So:
//   1. list the templates the account owns (AtomicAssets API, one call;
//      falls back to reading the account's assets from the chain),
//   2. find which of them are packs:
//      - a few hundred templates or fewer: jump through the template index,
//        one small lookup per owned template at most;
//      - big collections: a template -> pack id index of the whole contract,
//        read once in parallel and kept on the device, then topped up with
//        only the packs created since,
//   3. fetch the pack NFTs of just those templates.
const WHPACKS = (() => {
  const tplField = (contract) => (contract === "nfthivepacks" ? "template_id" : "pack_template_id");
  const SMALL = 250; // owned templates handled by direct lookups
  const PAGE = 100;
  const PARALLEL = 6;

  // Few templates: jump through index 2, from one owned template to the next.
  async function lookup(contract, want) {
    const found = new Map();
    let i = 0;
    for (let calls = 0; i < want.length && calls < SMALL * 2; calls++) {
      const r = await qr({ code: contract, scope: contract, table: "packs", index_position: 2, key_type: "i64", lower_bound: String(want[i]), limit: 1 });
      const row = (r.rows || [])[0];
      if (!row) break; // no pack templates at or above this one
      const t = Number(row[tplField(contract)]);
      if (t === want[i]) {
        found.set(t, row);
        i++;
      } else {
        while (i < want.length && want[i] < t) i++; // skip owned templates that aren't packs
      }
    }
    return found;
  }

  // Many templates: the whole contract's template -> pack id index, cached.
  const cacheKey = (contract) => `waxhub.packidx.${WHCHAIN.key}.${contract}`;
  async function readRange(contract, from, until, into) {
    let lb = from;
    while (lb <= until) {
      const r = await qr({ code: contract, scope: contract, table: "packs", lower_bound: String(lb), upper_bound: String(until), limit: PAGE });
      for (const row of r.rows || []) into[Number(row[tplField(contract)])] = Number(row.pack_id);
      if (!r.more || !(r.rows || []).length) break;
      lb = Number(r.rows[r.rows.length - 1].pack_id) + 1;
    }
  }
  async function index(contract) {
    let idx = { last: 0, t: {} };
    try {
      idx = JSON.parse(localStorage.getItem(cacheKey(contract)) || "null") || idx;
    } catch {}
    const top = Number(((await qr({ code: contract, scope: contract, table: "packs", reverse: !0, limit: 1 })).rows || [])[0]?.pack_id || 0);
    if (top > idx.last) {
      const span = top - idx.last;
      const step = Math.max(PAGE, Math.ceil(span / PARALLEL));
      const jobs = [];
      for (let a = idx.last + 1; a <= top; a += step) jobs.push(readRange(contract, a, Math.min(top, a + step - 1), idx.t));
      await Promise.all(jobs);
      idx.last = top;
      try {
        localStorage.setItem(cacheKey(contract), JSON.stringify(idx));
      } catch {} // storage full: still works, just rebuilt next time
    }
    return idx.t;
  }
  async function fromIndex(contract, want) {
    const t = await index(contract);
    const hits = want.filter((w) => t[w]);
    const found = new Map();
    // fetch the current row of each hit (also confirms the pack still exists)
    await Promise.all(
      hits.map(async (w) => {
        const r = await qr({ code: contract, scope: contract, table: "packs", lower_bound: String(t[w]), upper_bound: String(t[w]), limit: 1 });
        const row = (r.rows || [])[0];
        if (row && Number(row[tplField(contract)]) === w) found.set(w, row);
      }),
    );
    return found;
  }

  // Map of template id -> pack row, for the owned templates that are packs on `contract`.
  async function packTemplates(contract, templateIds) {
    const want = [...new Set(templateIds.map(Number))].filter((n) => n > 0).sort((x, y) => x - y);
    return want.length <= SMALL ? lookup(contract, want) : fromIndex(contract, want);
  }

  const display = (row) => {
    try {
      return JSON.parse(row?.display_data || "{}");
    } catch {
      return {};
    }
  };

  // Templates the account owns: AtomicAssets API, else the chain itself.
  async function ownedTemplates(owner) {
    try {
      const r = await to(`/atomicassets/v1/accounts/${owner}`);
      return (r.data?.templates || []).filter((t) => Number(t.assets) > 0).map((t) => Number(t.template_id));
    } catch {
      const rows = [];
      let lb;
      for (let p = 0; p < 10; p++) {
        const r = await qr({ code: "atomicassets", scope: owner, table: "assets", limit: 500, ...(lb ? { lower_bound: lb } : {}) });
        rows.push(...(r.rows || []));
        if (!r.more || !r.next_key) break;
        lb = r.next_key;
      }
      return rows.map((a) => Number(a.template_id));
    }
  }

  // The pack NFTs `owner` holds for `contract`, each with its pack row as `pack`.
  async function owned(owner, contract) {
    const packs = await packTemplates(contract, await ownedTemplates(owner));
    if (!packs.size) return [];
    const ids = [...packs.keys()];
    const out = [];
    for (let k = 0; k < ids.length; k += 50) {
      const list = ids.slice(k, k + 50).join(",");
      for (let page = 1; page <= 10; page++) {
        const r = await to(`/atomicassets/v1/assets?owner=${owner}&template_whitelist=${list}&limit=100&page=${page}`);
        out.push(...(r.data || []));
        if ((r.data || []).length < 100) break;
      }
    }
    return out.map((a) => {
      const pack = packs.get(Number(a.template?.template_id));
      const d = display(pack);
      return { ...a, pack, name: a.name || d.name || `Pack #${a.asset_id}`, img: a.data?.img || a.template?.immutable_data?.img || d.img || a.data?.video || a.template?.immutable_data?.video || "" };
    });
  }

  return { owned, packTemplates };
})();

// The account's packs on one contract, grouped by template, each with an Open button.
function WH_MyPacks({ packs, signedIn, onOpen }) {
  if (!signedIn) return null;
  if (packs === null)
    return (
      <div className="wh-waiting" style={{ margin: "8px 0 14px" }}>
        <div className="spinner" />
        <span>Looking for your packs…</span>
      </div>
    );
  if (!packs.length) return <WH_Empty title="No packs from this platform" text="Packs you own from the other platforms are on their tabs." />;
  const groups = new Map();
  for (const a of packs) {
    const k = a.template?.template_id || a.pack?.pack_id || a.asset_id;
    if (!groups.has(k)) groups.set(k, { first: a, ids: [] });
    groups.get(k).ids.push(String(a.asset_id));
  }
  const now = Date.now() / 1000;
  return (
    <div style={{ marginBottom: 14 }}>
      {[...groups.values()].map(({ first: a, ids }) => {
        const unlock = Number(a.pack?.unlock_time || 0);
        const locked = unlock > now;
        return (
          <div className="card" key={ids[0]} style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <WH_Media src={a.img} alt={a.name} style={{ width: 64, height: 64, borderRadius: 10, objectFit: "cover", flex: "0 0 64px" }} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <b style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</b>
              <div className="muted" style={{ fontSize: 12 }}>
                {a.collection?.collection_name || a.pack?.collection_name} · {ids.length} owned
              </div>
              {locked && <div className="faint" style={{ fontSize: 12 }}>Opens from {new Date(unlock * 1000).toLocaleString()}</div>}
            </div>
            <button className="btn sm primary" disabled={locked} onClick={() => onOpen(ids[0], a.name)}>
              Open
            </button>
          </div>
        );
      })}
    </div>
  );
}
