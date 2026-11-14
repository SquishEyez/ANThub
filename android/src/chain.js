// Multi-chain support: the active Antelope chain and everything that differs
// per chain. Injected before the app's own constants, so the chain id, nodes,
// APIs, core token and price feed all come from here. Switching chain saves the
// choice and reloads the app.
//
// Values were checked against each chain's live nodes (get_info, the eosio
// ABI, contract presence, the Delphi oracle pairs).

const WHCHAINS = {
  wax: {
    key: "wax",
    chip: "WAX",
    name: "WAX",
    tagline: "NFTs, games and the biggest dApp set",
    color: "#ff8a00",
    id: "1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4",
    sym: "WAX",
    prec: 8,
    rpc: ["https://wax.greymass.com", "https://wax.eosusa.io", "https://apiwax.3dkrender.com", "https://wax.pink.gg", "https://wax.eosphere.io", "https://wax.eosrio.io", "https://api.waxsweden.org"],
    atomic: ["https://wax.api.atomicassets.io", "https://wax-atomic-api.eosphere.io", "https://atomic.wax.eosrio.io"],
    hyperion: ["https://wax.eosusa.io", "https://api.waxsweden.org", "https://wax.eosrio.io"],
    lightapi: "wax",
    delphi: "waxpusd",
    delphiPrec: 4,
    explorer: { tx: "https://waxblock.io/transaction/", acct: "https://waxblock.io/account/" },
    cloudWallet: true,
    staking: true,
    ram: true,
    powerup: true,
    voteRewards: true,
    contracts: "*",
  },
  eos: {
    key: "eos",
    chip: "EOS",
    name: "EOS",
    tagline: "Vaulta network: EOS and the new $A token",
    color: "#e4e4e7",
    id: "aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906",
    sym: "EOS",
    prec: 4,
    rpc: ["https://eos.greymass.com", "https://eos.eosusa.io", "https://eos.api.eosnation.io"],
    atomic: ["https://eos.api.atomicassets.io"],
    hyperion: ["https://eos.eosusa.io"],
    lightapi: "eos",
    delphi: "eosusd",
    delphiPrec: 4,
    explorer: { tx: "https://bloks.io/transaction/", acct: "https://bloks.io/account/" },
    staking: true,
    ram: true,
    powerup: true,
    contracts: ["atomicassets", "atomicmarket", "atomictoolsx", "atomicdropsx", "swap.alcor", "delphioracle", "core.vaulta"],
    // converts: a transfer of EOS to core.vaulta returns A (true on mainnet; checked by dry run)
    vaulta: { contract: "core.vaulta", sym: "A", prec: 4, delphi: "ausd", delphiPrec: 4, converts: true },
  },
  telos: {
    key: "telos",
    chip: "Telos",
    name: "Telos",
    tagline: "Fast, low-fee chain with an EVM side",
    color: "#a259ff",
    id: "4667b205c6838ef70ff7988f6e8257e8be0e1284a2f59699054a018f743b1d11",
    sym: "TLOS",
    prec: 4,
    rpc: ["https://telos.greymass.com", "https://telos.eosusa.io", "https://telos.api.eosnation.io"],
    atomic: [],
    hyperion: ["https://telos.eosusa.io"],
    lightapi: "telos",
    delphi: "tlosusd",
    delphiPrec: 4,
    explorer: { tx: "https://explorer.telos.net/transaction/", acct: "https://explorer.telos.net/account/" },
    staking: true,
    ram: true,
    powerup: true,
    contracts: ["atomicassets", "atomicmarket", "atomictoolsx", "blend.nefty", "swap.alcor", "delphioracle", "book.alcor", "telos.decide", "works.decide", "amend.decide", "tf", "eosio.evm", "bridge.alcor", "simpleassets"],
  },
  xpr: {
    key: "xpr",
    chip: "XPR",
    name: "XPR Network",
    tagline: "Free transactions, payments and DeFi",
    color: "#7543e3",
    id: "384da888112027f0321850a169f737c33e53b388aad48b5adace4bab97f437e0",
    sym: "XPR",
    prec: 4,
    rpc: ["https://proton.greymass.com", "https://proton.eosusa.io"],
    atomic: ["https://proton.api.atomicassets.io"],
    hyperion: ["https://proton.eosusa.io"],
    lightapi: "proton",
    delphi: "xprusd",
    delphiPrec: 6,
    explorer: { tx: "https://explorer.xprnetwork.org/transaction/", acct: "https://explorer.xprnetwork.org/account/" },
    freeResources: true,
    ram: true,
    contracts: ["atomicassets", "atomicmarket", "atomictoolsx", "atomicdropsx", "blend.nefty", "swap.alcor", "delphioracle", "dex", "book.alcor"],
  },
  libre: {
    key: "libre",
    chip: "Libre",
    name: "Libre",
    tagline: "Bitcoin-focused chain with free resources",
    color: "#2c73ff",
    id: "38b1d7815474d0c60683ecbea321d723e83f5da6ae5f1c1f9fecc69d9ba96465",
    sym: "LIBRE",
    prec: 4,
    rpc: ["https://libre.greymass.com", "https://libre.eosusa.io"],
    atomic: [],
    hyperion: ["https://libre.eosusa.io"],
    lightapi: "libre",
    delphi: "",
    delphiPrec: 4,
    explorer: null,
    freeResources: true,
    contracts: ["stake.libre", "dao.libre", "farm.libre"],
  },
  jungle4: {
    key: "jungle4",
    chip: "Jungle 4",
    name: "Jungle 4",
    tagline: "Free testnet: practise with test tokens",
    color: "#22c55e",
    testnet: true,
    id: "73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d",
    sym: "EOS",
    prec: 4,
    rpc: ["https://jungle4.greymass.com"],
    atomic: [],
    hyperion: [],
    lightapi: "",
    delphi: "",
    delphiPrec: 4,
    explorer: { tx: "https://jungle4.eosq.eosnation.io/tx/", acct: "https://jungle4.eosq.eosnation.io/account/" },
    staking: true,
    ram: true,
    powerup: true,
    contracts: ["atomicassets", "atomicmarket", "atomictoolsx", "core.vaulta"],
    // Jungle 4's core.vaulta keeps EOS sent to it without returning A, so nothing converts there
    vaulta: { contract: "core.vaulta", sym: "A", prec: 4, delphi: "", delphiPrec: 4, converts: false },
  },
};
const WHCHAIN_ORDER = ["wax", "eos", "telos", "xpr", "libre", "jungle4"];

const WHCHAIN = (() => {
  let k = "wax";
  try {
    const v = JSON.parse(localStorage.getItem("waxhub.chain") || '"wax"');
    if (WHCHAINS[v]) k = v;
  } catch {}
  const c = WHCHAINS[k];
  const has = (contract) => contract === "eosio" || contract === "eosio.token" || contract === "eosio.msig" || c.contracts === "*" || c.contracts.includes(contract);
  return {
    ...c,
    symp: `${c.prec},${c.sym}`,
    walletSub: c.testnet
      ? `Balances, transfers, staking and RAM on the ${c.name} testnet. Test tokens have no value.`
      : c.freeResources
        ? `Balances and transfers on ${c.name}. CPU and NET are free here.`
        : `Balances, transfers, CPU/NET staking and RAM on ${c.name}.`,
    amt: (n) => `${Number(n).toFixed(c.prec)} ${c.sym}`,
    lightapiUrl: c.lightapi ? `https://lightapi.eosamsterdam.net/api/balances/${c.lightapi}` : "",
    tokensApi: c.hyperion.map((h) => `${h}/v2/state/get_tokens`),
    has,
    hasNfts: c.atomic.length > 0 && has("atomicassets"),
    isWax: k === "wax",
    switchTo(next) {
      if (!WHCHAINS[next] || next === k) return;
      try {
        localStorage.setItem("waxhub.chain", JSON.stringify(next));
        localStorage.setItem("waxhub.ux.tab", '"wallet"');
        localStorage.setItem("waxhub.ux.tool", "null");
      } catch {}
      location.reload();
    },
  };
})();
