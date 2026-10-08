/* Privacy-friendly page-view beacon: no cookies, no identifiers. Loaded after idle by the site layout. */
(function (w, d, n) {
  if (w.__siteBeacon) return; // idempotent if the script is injected twice
  w.__siteBeacon = 1;
  var last = '';
  function send() {
    var p = location.pathname;
    if (p === last) return;
    var r = last ? '' : d.referrer;
    last = p;
    var body = JSON.stringify({ p: p, r: r || undefined });
    if (n.sendBeacon) n.sendBeacon('/api/collect', new Blob([body], { type: 'text/plain' }));
    else fetch('/api/collect', { method: 'POST', body: body, keepalive: true });
  }
  var push = history.pushState;
  history.pushState = function () {
    push.apply(this, arguments);
    setTimeout(send, 0);
  };
  w.addEventListener('popstate', send);
  send();
})(window, document, navigator);
