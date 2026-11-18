// NFT images and videos. AtomicAssets NFTs store media as an IPFS hash (or, less
// often, a full link), so showing it needs an IPFS gateway, and gateways come and go.
// By late 2026 the ones WAX Hub shipped with were gone: ipfs.atomichub.io and
// atomichub-ipfs.com have no DNS, cloudflare-ipfs.com no longer resolves,
// ipfs.neftyblocks.io is parked, and ipfs.io / dweb.link answer 429.
// (Same findings as github.com/Zigm4/crucible, src/ui/media.ts.)
//
// What still serves WAX NFT media: the block-producer gateways ipfs.eosdac.io and
// ipfs.alienworlds.io, and AtomicHub's image service resizer.atomichub.io. A dead
// gateway usually hangs instead of failing, so trying them strictly in turn leaves
// a blank card. Instead each one gets a short head start, then the next joins in;
// the first that loads wins. Nothing is fetched until the card is on screen.
const WHIPFS = (() => {
  const THUMB = 370;
  const GATEWAYS = [
    (cid) => `https://ipfs.eosdac.io/ipfs/${cid}`,
    (cid) => `https://resizer.atomichub.io/images/v1/preview?ipfs=${encodeURIComponent(cid)}&size=${THUMB}`,
    (cid) => `https://ipfs.alienworlds.io/ipfs/${cid}`,
    // older gateways, last in case they come back
    (cid) => `https://ipfs.atomicassets.io/ipfs/${cid}`,
    (cid) => `https://ipfs.io/ipfs/${cid}`,
  ];
  const DEAD = /(^|\.)(ipfs\.atomichub\.io|atomichub-ipfs\.com|cloudflare-ipfs\.com|ipfs\.neftyblocks\.io|gateway\.ipfs\.io)$/i;
  // CIDv0 (Qm…) or CIDv1 (b…), optionally followed by a path inside it
  const CID = /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{20,})(\/[^?#]*)?$/;

  // The IPFS address inside a reference: a bare hash, ipfs://hash, /ipfs/hash,
  // a gateway link (https://host/ipfs/hash/…) or a subdomain gateway (https://hash.ipfs.host/…).
  function cidOf(ref) {
    const s = String(ref || "").trim();
    const bare = s.replace(/^ipfs:\/\//i, "").replace(/^\/?ipfs\//i, "");
    if (CID.test(bare)) return bare;
    try {
      const u = new URL(s);
      const m = u.pathname.match(/\/ipfs\/(.+)$/);
      if (m && CID.test(m[1])) return m[1];
      const sub = u.hostname.match(/^(b[a-z2-7]{20,})\.ipfs\./);
      if (sub) return sub[1] + (u.pathname !== "/" ? u.pathname : "");
    } catch {}
    return null;
  }

  // Every URL worth trying for a reference, best first.
  function candidates(ref) {
    const s = String(ref || "").trim();
    if (!s || s === "null") return [];
    if (s.startsWith("data:image/")) return [s];
    const cid = cidOf(s);
    const viaGateways = cid ? GATEWAYS.map((g) => g(cid)) : [];
    let host = "";
    try {
      host = /^https:\/\//i.test(s) ? new URL(s).hostname : "";
    } catch {}
    // a working https link first, unless it points at a gateway known to be dead
    const own = host && !DEAD.test(host) ? [s] : [];
    return [...new Set([...own, ...viaGateways])];
  }

  const isVideo = (ref) => /\.(mp4|webm|mov)(\?|$)/i.test(String(ref || ""));
  return { candidates, cidOf, isVideo };
})();

const WH_MEDIA_HEAD_START = 1200; // ms before the next gateway joins in
const WH_MEDIA_GIVE_UP = 25000; // ms after the last one started

function WH_Media({ src, alt, className, style }) {
  const cands = De.useMemo(() => WHIPFS.candidates(src), [src]);
  const video = WHIPFS.isVideo(src);
  const [visible, setVisible] = De.useState(false);
  const [url, setUrl] = De.useState(null);
  const [failed, setFailed] = De.useState(false);
  // Some NFTs only have a video. When no gateway returns a decodable image,
  // play the same file as a video instead (the image service only makes stills).
  const [asVideo, setAsVideo] = De.useState(false);
  const vids = De.useMemo(() => cands.filter((u) => !u.includes("resizer.atomichub.io")), [cands]);
  const [vi, setVi] = De.useState(0); // which video candidate is playing
  const holder = De.useRef(null);

  // load only once the card scrolls into view
  De.useEffect(() => {
    if (visible || !holder.current) return;
    if (typeof IntersectionObserver === "undefined") return setVisible(true);
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && setVisible(true), { rootMargin: "200px" });
    io.observe(holder.current);
    return () => io.disconnect();
  }, [visible, url]);

  // hedged race between gateways; the first image that decodes wins
  De.useEffect(() => {
    setUrl(null);
    setFailed(false);
    setAsVideo(false);
    setVi(0);
    if (!cands.length) return setFailed(true);
    if (!visible || video) return;
    let done = false;
    let started = 0;
    let errors = 0;
    const timers = [];
    const probes = [];
    const start = () => {
      if (done || started >= cands.length) return;
      const u = cands[started++];
      const im = new Image();
      im.referrerPolicy = "no-referrer";
      im.onload = () => {
        if (done) return;
        done = true;
        setUrl(u);
      };
      im.onerror = () => {
        if (done) return;
        if (++errors === cands.length) {
          done = true;
          setAsVideo(true); // every gateway answered, none with an image
        } else start(); // a fast failure lets the next gateway in straight away
      };
      im.src = u;
      probes.push(im);
      if (started < cands.length) timers.push(setTimeout(start, WH_MEDIA_HEAD_START));
      else timers.push(setTimeout(() => !done && ((done = true), setFailed(true)), WH_MEDIA_GIVE_UP));
    };
    start();
    return () => {
      done = true;
      timers.forEach(clearTimeout);
      probes.forEach((im) => {
        im.onload = im.onerror = null;
      });
    };
  }, [cands, visible, video]);

  const playVideo = (video || asVideo) && visible;
  if (failed || (playVideo && vi >= vids.length)) return <div className={`nft-ph ${className || ""}`} style={style}>No preview</div>;
  if (playVideo)
    return <video className={className} style={style} src={vids[vi]} muted playsInline loop autoPlay onError={() => setVi((i) => i + 1)} />;
  if (!url) return <div ref={holder} className={`nft-ph skeleton ${className || ""}`} style={style} />;
  return <img className={className} style={style} src={url} alt={alt || ""} referrerPolicy="no-referrer" />;
}
