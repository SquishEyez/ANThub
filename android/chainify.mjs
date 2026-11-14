// Rewrites the WAX-specific literals in the app's own code (not the bundled
// libraries) so they follow the active chain from src/chain.js:
//   "WAX"        -> WHCHAIN.sym      (core token symbol)
//   "8,WAX"      -> WHCHAIN.symp     (precision,symbol)
//   "waxpusd"    -> WHCHAIN.delphi   (USD price pair)
//   8, "WAX"     -> WHCHAIN.prec, WHCHAIN.sym (precision passed with the symbol)
//   text "10.00000000 WAX"  -> amount in the chain's precision and symbol
//   text "WAX mainnet"      -> chain name
//   text "... WAX ..."      -> core token symbol
// "WAXDAO", "WAX Cloud Wallet" and "WAX Hub" are left alone.
// Edits are applied by source offset, so everything else stays byte-identical.
import { parse } from "@babel/parser";

const KEEP_AFTER = /^(DAO| Cloud| Hub| HUB|-)/;

function rewriteText(text, escapeForTemplate) {
  let changed = false;
  let out = escapeForTemplate ? text.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${") : text;
  out = out.replace(/(\d+)\.0{8} WAX\b/g, (_, n) => {
    changed = true;
    return `\${WHCHAIN.amt("${n}")}`;
  });
  out = out.replace(/\bWAX (mainnet|blockchain|chain|network)\b/g, (_, w) => {
    changed = true;
    return `\${WHCHAIN.name} ${w}`;
  });
  // phrases about the chain itself rather than its token
  out = out.replace(/\b(All|Sign in to|on|new) WAX\b(?= RPCs| account|\.|$)/g, (_, w) => {
    changed = true;
    return `${w} \${WHCHAIN.name}`;
  });
  out = out.replace(/\bWAX\b/g, (m, off, s) => {
    if (KEEP_AFTER.test(s.slice(off + 3))) return m;
    changed = true;
    return "${WHCHAIN.sym}";
  });
  return changed ? out : null;
}

export function chainify(js, ranges) {
  const ast = parse(js, { sourceType: "module", errorRecovery: false });
  const inRange = (n) => ranges.some(([a, b]) => n.start >= a && n.end <= b);
  const edits = [];
  const stats = { sym: 0, symp: 0, delphi: 0, prec: 0, text: 0 };

  function visit(node, parent, key) {
    if (!node || typeof node.type !== "string") return;
    if (inRange(node)) {
      if (node.type === "StringLiteral" && !(parent && (parent.type === "ObjectProperty" || parent.type === "ObjectMethod") && key === "key" && !parent.computed)) {
        const v = node.value;
        if (v === "WAX") {
          edits.push([node.start, node.end, "WHCHAIN.sym"]);
          stats.sym++;
        } else if (v === "8,WAX") {
          edits.push([node.start, node.end, "WHCHAIN.symp"]);
          stats.symp++;
        } else if (v === "waxpusd") {
          edits.push([node.start, node.end, "WHCHAIN.delphi"]);
          stats.delphi++;
        } else if (/\bWAX\b/.test(v)) {
          const t = rewriteText(v, true);
          if (t) {
            edits.push([node.start, node.end, "`" + t + "`"]);
            stats.text++;
          }
        }
      } else if (node.type === "TemplateElement") {
        const raw = node.value.raw;
        if (/\bWAX\b/.test(raw)) {
          const t = rewriteText(raw, false);
          if (t) {
            edits.push([node.start, node.end, t]);
            stats.text++;
          }
        }
      } else if (node.type === "CallExpression") {
        node.arguments.forEach((a, i) => {
          const next = node.arguments[i + 1];
          if (a.type === "NumericLiteral" && a.value === 8 && next && next.type === "StringLiteral" && next.value === "WAX") {
            edits.push([a.start, a.end, "WHCHAIN.prec"]);
            stats.prec++;
          }
        });
      } else if (node.type === "ObjectExpression") {
        const src = js.slice(node.start, node.end);
        if (/"WAX"/.test(src))
          for (const p of node.properties)
            if (p.type === "ObjectProperty" && p.key && /^(decimals|precision)$/.test(p.key.name || p.key.value) && p.value.type === "NumericLiteral" && p.value.value === 8) {
              edits.push([p.value.start, p.value.end, "WHCHAIN.prec"]);
              stats.prec++;
            }
      }
    }
    for (const k of Object.keys(node)) {
      if (k === "loc" || k === "start" || k === "end" || k === "extra" || k.endsWith("Comments")) continue;
      const v = node[k];
      if (Array.isArray(v)) v.forEach((c) => c && typeof c.type === "string" && visit(c, node, k));
      else if (v && typeof v.type === "string") visit(v, node, k);
    }
  }
  visit(ast.program, null, null);

  // apply innermost-last: sort by start desc; drop edits nested inside another edit
  edits.sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  let out = js;
  let lastStart = Infinity;
  for (const [s, e, t] of edits) {
    if (e > lastStart) continue;
    out = out.slice(0, s) + t + out.slice(e);
    lastStart = s;
  }
  return { js: out, stats };
}
