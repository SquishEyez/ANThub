# Dry-run testing

`dry.mjs` runs any transaction against a chain's **current state** with `/v1/chain/compute_transaction`, without signing or broadcasting it. The node executes the real contract code and returns either the action trace or the exact error the contract would raise.

Antelope Hub 4.3.1 was tested this way: every major screen was driven in a test build whose wallet session hands the transaction to `dry()` instead of signing. The test build is never published.

```
npm install @wharfkit/antelope@1.0.13
node -e 'import("./dry.mjs").then(async ({ dry }) => console.log(await dry("https://jungle4.greymass.com", [{ account: "eosio.token", name: "transfer", data: { from: "eosio.stake", to: "eosio", quantity: "0.0001 EOS", memo: "" } }], "eosio.stake")))'
```

Notes:
- The account you run as must have the CPU, NET and RAM the transaction needs; otherwise the node answers with a resource error, not a contract error.
- Supported by the public greymass and eosusa nodes for WAX, EOS, Telos, XPR Network, Libre and Jungle 4.
- Behind an HTTP proxy, run Node with `NODE_USE_ENV_PROXY=1`.
