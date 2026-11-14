// Dry-run Antelope transactions with /v1/chain/compute_transaction.
// The node executes the actions against current chain state and returns the
// trace or the contract's error, but never adds them to a block. Nothing is
// signed (signatures aren't checked) and nothing is broadcast.
//
//   import { dry } from "./dry.mjs";
//   await dry("https://jungle4.greymass.com",
//     [{ account: "eosio.token", name: "transfer", data: { from: "alice", to: "bob", quantity: "1.0000 EOS", memo: "" } }],
//     "alice");
//   // → { ok, error, actions: [...trace] }
import { ABI, Action, Transaction, SignedTransaction, PackedTransaction, Serializer } from "@wharfkit/antelope";

const HEADERS = { "User-Agent": "antelope-hub-dryrun", "Content-Type": "application/json" };
const abiCache = {};
async function rpc(base, path, body) {
  const r = await fetch(base + path, { method: "POST", headers: HEADERS, body: JSON.stringify(body) });
  return { ok: r.ok, j: await r.json() };
}
async function abiOf(base, account) {
  const k = base + account;
  if (!abiCache[k]) abiCache[k] = (await rpc(base, "/v1/chain/get_abi", { account_name: account })).j.abi;
  return abiCache[k];
}

// actions: [{ account, name, data, auth?: [{ actor, permission }] }]
export async function dry(base, actions, actor) {
  const info = (await rpc(base, "/v1/chain/get_info", {})).j;
  const acts = [];
  for (const a of actions) {
    const abi = ABI.from(await abiOf(base, a.account));
    acts.push(Action.from({ account: a.account, name: a.name, authorization: a.auth || [{ actor, permission: "active" }], data: a.data }, abi));
  }
  const header = {
    expiration: new Date(Date.now() + 120e3).toISOString().slice(0, 19),
    ref_block_num: info.last_irreversible_block_num & 0xffff,
    ref_block_prefix: Buffer.from(info.last_irreversible_block_id, "hex").readUInt32LE(8),
  };
  const trx = Transaction.from({ ...header, actions: acts });
  const packed = PackedTransaction.fromSigned(SignedTransaction.from({ ...trx, signatures: [], context_free_data: [] }));
  const { ok, j } = await rpc(base, "/v1/chain/compute_transaction", { transaction: Serializer.objectify(packed) });
  if (!ok) return { ok: false, error: `${j?.error?.name || "error"}: ${j?.error?.details?.map((x) => x.message).filter(Boolean).join(" | ")}` };
  const tr = j.processed;
  const fmt = (x) => String(x?.format || "").replace(/\$\{(\w+)\}/g, (m, k) => (x?.data?.[k] !== undefined ? (typeof x.data[k] === "object" ? JSON.stringify(x.data[k]) : x.data[k]) : m));
  const msg = (e) => e?.stack?.map((x) => x?.data?.s || fmt(x)).filter(Boolean).join(" | ") || e?.message || "";
  const error = tr?.except ? `${tr.except.name}: ${msg(tr.except)}` : null;
  return { ok: !error, error, actions: (tr?.action_traces || []).map((t) => `${t.act.account}::${t.act.name}${t.receiver !== t.act.account ? `→${t.receiver}` : ""}`) };
}
