// human-like bot: 0.25s delayed view, ~65% aim accuracy, occasional lapses
(function(){
  var G = window.__spaceGame, hist = [], gt = 0, tgtX = null, nextDec = 0, lapse = 0, nextLapse = 4 + Math.random()*4, aimOff = 0, nextAim = 0;
  window.__sim = { speed: 4, bot: function(dt){
    gt += dt; var th = G.threats(); hist.push({t: gt, th: th});
    while (hist.length > 2 && hist[1].t <= gt - 0.25) hist.shift();
    var old = hist[0], s = G.ship(); if (!s) return; G.setFire(true);
    if (gt > nextLapse) { lapse = 0.35 + Math.random()*0.4; nextLapse = gt + 5 + Math.random()*6; }
    if (lapse > 0) { lapse -= dt; return; }
    if (gt >= nextDec) {
      nextDec = gt + 0.08; var T = old.th, lag = gt - old.t, W = T.W, sy = T.sy, best = null, bs = 1e9;
      if (gt > nextAim) { nextAim = gt + 0.6; aimOff = Math.random() < 0.65 ? 0 : (Math.random()<0.5?-1:1)*(40+Math.random()*60); }
      var aimX = null;
      if (T.boss) aimX = T.boss.x; else { var lo = null; T.list.forEach(function(o){ if (o.y < sy - 120 && (!lo || o.y > lo.y)) lo = o; }); if (lo) aimX = lo.x + lo.vx*0.3; }
      for (var i = 0; i <= 40; i++) {
        var cx = 30 + (W - 60) * i / 40, sc = Math.abs(cx - s.x) * 0.02;
        if (aimX !== null) sc += Math.abs(cx - (aimX + aimOff)) * 0.01;
        T.list.forEach(function(o){
          for (var k = 0; k <= 10; k++) { var tt = lag + k * 0.1, ox = o.x + o.vx*tt, oy = o.y + o.vy*tt;
            if (Math.abs(oy - sy) < o.r + 30 && Math.abs(ox - cx) < o.r + 28) { sc += 60 / (1 + k); break; } }
        });
        (T.holes||[]).forEach(function(h){ if (Math.abs(h.x - cx) < h.r && h.y < sy + 50) sc += 80; });
        (T.grid||[]).forEach(function(g){ if (sy - g.y < 400) sc += Math.abs(cx - g.gx) * 0.3; });
        if (T.flare) sc += Math.abs(cx - T.flare.gx) * 0.3;
        if (T.laser && cx > Math.min(T.laser.a,T.laser.b) - 40 && cx < Math.max(T.laser.a,T.laser.b) + 40) sc += 100;
        sc += (cx < 60 || cx > W - 60) ? 3 : 0;
        if (sc < bs) { bs = sc; best = cx; }
      }
      tgtX = best;
    }
    if (tgtX !== null) { var d = tgtX - s.x, mx = 1100 * dt; s.x += Math.max(-mx, Math.min(mx, d)); }
  }};
})();
