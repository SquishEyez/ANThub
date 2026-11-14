// Independent check of Alcor deposit addresses. An EVM deposit address is a
// CREATE2 clone from Alcor's factory, so it can be computed on the device from
// (telosTo, leg). The app shows an address only when the API's answer matches.
// Reference: https://telos.alcor.exchange/api/bridge/docs ("Check the address yourself").
const WHAC = (() => {
  const RC = [
    "0x0000000000000001", "0x0000000000008082", "0x800000000000808a", "0x8000000080008000", "0x000000000000808b", "0x0000000080000001",
    "0x8000000080008081", "0x8000000000008009", "0x000000000000008a", "0x0000000000000088", "0x0000000080008009", "0x000000008000000a",
    "0x000000008000808b", "0x800000000000008b", "0x8000000000008089", "0x8000000000008003", "0x8000000000008002", "0x8000000000000080",
    "0x000000000000800a", "0x800000008000000a", "0x8000000080008081", "0x8000000000008080", "0x0000000080000001", "0x8000000080008008",
  ].map(BigInt);
  const ROT = [0, 1, 62, 28, 27, 36, 44, 6, 55, 20, 3, 10, 43, 25, 39, 41, 45, 15, 21, 8, 18, 2, 61, 56, 14];
  const M = (1n << 64n) - 1n;
  const rotl = (x, n) => (n === 0 ? x : ((x << BigInt(n)) | (x >> BigInt(64 - n))) & M);
  function f(s) {
    for (let r = 0; r < 24; r++) {
      const C = [0, 1, 2, 3, 4].map((x) => s[x] ^ s[x + 5] ^ s[x + 10] ^ s[x + 15] ^ s[x + 20]);
      for (let x = 0; x < 5; x++) {
        const d = C[(x + 4) % 5] ^ rotl(C[(x + 1) % 5], 1);
        for (let y = 0; y < 25; y += 5) s[y + x] ^= d;
      }
      const B = new Array(25);
      for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) B[y + 5 * ((2 * x + 3 * y) % 5)] = rotl(s[x + 5 * y], ROT[x + 5 * y]);
      for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) s[x + 5 * y] = B[x + 5 * y] ^ (~B[((x + 1) % 5) + 5 * y] & M & B[((x + 2) % 5) + 5 * y]);
      s[0] ^= RC[r];
    }
  }
  function keccak256(bytes) {
    const rate = 136;
    const p = new Uint8Array(Math.ceil((bytes.length + 1) / rate) * rate);
    p.set(bytes);
    p[bytes.length] ^= 0x01;
    p[p.length - 1] ^= 0x80;
    const s = new Array(25).fill(0n);
    for (let o = 0; o < p.length; o += rate) {
      for (let i = 0; i < rate / 8; i++) {
        let v = 0n;
        for (let k = 7; k >= 0; k--) v = (v << 8n) | BigInt(p[o + i * 8 + k]);
        s[i] ^= v;
      }
      f(s);
    }
    const out = new Uint8Array(32);
    for (let i = 0; i < 4; i++) for (let k = 0; k < 8; k++) out[i * 8 + k] = Number((s[i] >> BigInt(8 * k)) & 255n);
    return out;
  }
  const hex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  const unhex = (h) => Uint8Array.from(String(h).replace(/^0x/, "").match(/../g) || [], (x) => parseInt(x, 16));
  const cat = (...a) => {
    const out = new Uint8Array(a.reduce((n, x) => n + x.length, 0));
    let o = 0;
    for (const x of a) (out.set(x, o), (o += x.length));
    return out;
  };
  const word = (n) => unhex(BigInt(n).toString(16).padStart(64, "0"));
  function nameToUint64(name) {
    const CH = ".12345abcdefghijklmnopqrstuvwxyz";
    if (!/^[a-z1-5.]{1,12}$/.test(name) || name.endsWith(".")) throw new Error("not an account name: " + name);
    let v = 0n;
    for (let i = 0; i < name.length; i++) v |= BigInt(CH.indexOf(name[i])) << BigInt(59 - 5 * i);
    return v;
  }
  const FACTORY = "6bc5481445aaed9e37db72fdbd989b857a15c362"; // the same on Ethereum, BNB Smart Chain and Polygon
  const DOMAINS = { wax: "1181148696416462999", xpr: "4057084141687023600", vaulta: "12439917377594391589" };
  function destinationOf(chain, to, memo = "") {
    if (chain === "telos") return [nameToUint64(to), memo];
    nameToUint64(to);
    return [nameToUint64("hop.alcor"), `${DOMAINS[chain]}:${to}${memo ? `:0:${memo}` : ""}`];
  }
  function depositAddress(chain, to, memo = "") {
    const [telosTo, leg] = destinationOf(chain, to, memo);
    return addressFor(telosTo, leg);
  }
  // the factory's CREATE2 address for any (telosTo, leg) pair
  function addressFor(telosTo, leg) {
    telosTo = BigInt(telosTo);
    const f20 = unhex(FACTORY);
    // implementation = CREATE address of the factory at nonce 1: keccak(rlp([factory, 1]))
    const impl = keccak256(cat(Uint8Array.of(0xd6, 0x94), f20, Uint8Array.of(0x01))).slice(12);
    const clone = unhex(`3d602d80600a3d3981f3363d3d373d3d3d363d73${hex(impl)}5af43d82803e903d91602b57fd5bf3`);
    const s = new TextEncoder().encode(leg);
    const pad = new Uint8Array(Math.ceil(s.length / 32) * 32);
    pad.set(s);
    const salt = keccak256(cat(word(telosTo), word(64), word(s.length), pad));
    return "0x" + hex(keccak256(cat(Uint8Array.of(0xff), f20, salt, keccak256(clone))).slice(12));
  }
  const same = (a, b) => String(a || "").toLowerCase() === String(b || "").toLowerCase();
  return { keccak256, hex, depositAddress, addressFor, nameToUint64, same };
})();
