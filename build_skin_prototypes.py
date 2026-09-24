# -*- coding: utf-8 -*-
import io

SRC = "board_rps.html.orig_rpskline"
ENH = "skin_enhanced_block.js"
# 生产版：直接产出真实 board_rps.html（样式 A）。CDN echarts（线上有网，不本地化）。
OUT = ["board_rps.html"]
SKINS = ["A"]

html0 = io.open(SRC, encoding="utf-8").read()
newjs = io.open(ENH, encoding="utf-8").read()

# ---- 1) 替换弹窗 HTML（点击板块名弹出的 RPS 趋势图所在弹窗）----
i = html0.index('  <div id="rpsModal"')
j = html0.index('  <div id="drillModal"')
NEW_MODAL = '''  <div id="rpsModal" class="skin-X" style="display:none;position:fixed;left:0;top:0;right:0;bottom:0;background:rgba(0,0,0,.45);z-index:9999;align-items:center;justify-content:center">
    <div class="rps-card" style="border-radius:12px;padding:18px 20px;width:min(900px,95vw);height:620px;max-height:92vh;overflow:auto;box-shadow:0 8px 32px rgba(0,0,0,.18)">
      <div class="rps-head" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;gap:10px">
        <div style="display:flex;align-items:center;gap:14px">
          <div id="rpsTitle" style="font-size:16px;font-weight:700"></div>
          <div class="rps-toggle" id="rpsToggle">
            <button data-mode="rps" class="on">RPS</button>
            <button data-mode="kline">K线</button>
          </div>
        </div>
        <button onclick="closeBoardRps()" class="rps-x" style="border:none;font-size:19px;line-height:1;width:30px;height:30px;border-radius:6px;cursor:pointer">×</button>
      </div>
      <div class="rps-toolbar">
        <div class="rps-shared-range">
          <span class="rps-lbl">周期</span>
          <div id="rpsRange" class="rps-seg"></div>
        </div>
        <div class="rps-kline-period rps-hidden" id="rpsKlinePeriod">
          <span class="rps-lbl">K线</span>
          <select id="klinePeriodSel" class="rps-sel"></select>
        </div>
      </div>
      <div id="rpsCtl" class="rps-ctl"></div>
      <div id="rpsMaBar" class="rps-ma-bar rps-hidden"></div>
      <div id="rpsChart" style="width:100%;height:380px"></div>
      <div id="rpsNow" class="rps-now"></div>
      <div id="rpsNote" class="rps-note"></div>
    </div>
  </div>
'''
html1 = html0[:i] + NEW_MODAL + "\n" + html0[j:]

# ---- 2) 替换 JS 区（openBoardRps ... drawBoardChart ... closeBoardRps）----
i2 = html1.index('  function openBoardRps(code, name) {')
j2 = html1.index('  /* ===== 龙头个股 / 相关ETF 下钻弹窗')
html2 = html1[:i2] + newjs + "\n" + html1[j2:]

# ---- 3) 移除旧的 data-d 分支（周期按钮已自带 onclick）----
old_datad = '''    if (t && t.getAttribute && t.getAttribute("data-d")) {
      boardRpsDays = parseInt(t.getAttribute("data-d"), 10);
      var bs = document.querySelectorAll("#rpsRange button");
      for (var i = 0; i < bs.length; i++) {
        var on = (bs[i] === t);
        bs[i].style.background = on ? "#4263eb" : "#fff";
        bs[i].style.color = on ? "#fff" : "#1a1a2e";
        bs[i].style.borderColor = on ? "#4263eb" : "#ced4da";
      }
      drawBoardChart();
    }
'''
html3 = html2.replace(old_datad, '    /* 周期按钮已自带 onclick，无需此分支 */\n', 1)

# ---- 4) 引入真实板块 K线 数据（生产文件名 _board_kline.js）----
html4 = html3.replace('<script src="_board_rps_data.js?v=20260923b"></script>',
                       '<script src="_board_rps_data.js?v=20260923b"></script>\n  <script src="_board_kline.js?v=20260923a"></script>', 1)

# ---- 5) 注入皮肤 CSS ----
SKIN_CSS = '''
/* ===== 升级：RPS趋势 ↔ K线 切换（在原有点击弹窗基础上）===== */
.rps-hidden{display:none!important}
.rps-card{background:#fff;color:#1a1a2e;transition:background .2s,color .2s}
.rps-x{background:#f1f3f5;color:#495057;border:none}
.rps-toolbar{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:10px}
.rps-lbl{font-size:12px;color:#868e96;margin-right:2px;white-space:nowrap}
.rps-toggle{display:inline-flex;border:1px solid #dee2e6;border-radius:8px;overflow:hidden}
.rps-toggle button{border:none;background:#fff;color:#495057;padding:6px 16px;font-size:13px;cursor:pointer;font-weight:600}
.rps-toggle button.on{background:#4263eb;color:#fff}
.rps-seg{display:inline-flex;gap:4px;flex-wrap:wrap}
.rps-range-btn{border:1px solid #ced4da;background:#fff;color:#1a1a2e;padding:5px 12px;border-radius:6px;font-size:13px;cursor:pointer}
.rps-range-btn.on{background:#4263eb;color:#fff;border-color:#4263eb}
.rps-ctl{display:flex;gap:14px;flex-wrap:wrap;font-size:13px;margin-bottom:8px}
.rps-ctl-lab{display:inline-flex;align-items:center;gap:4px;cursor:pointer}
.rps-ctl-lab input{width:14px;height:14px;accent-color:#4263eb}
.rps-ma-bar{display:flex;gap:10px;flex-wrap:wrap;align-items:center;font-size:12px;margin:-4px 0 8px;font-variant-numeric:tabular-nums}
.rps-ma-lbl{color:#868e96;font-weight:600}
.rps-ma-val{font-weight:600}
.rps-ma-num{font-size:11px;color:#000;font-weight:500;margin-right:8px}
.rps-date-blue{font-weight:600;color:#4263eb}
.rps-sel{border:1px solid #ced4da;background:#fff;color:#1a1a2e;padding:5px 10px;border-radius:6px;font-size:13px;cursor:pointer}
.rps-now{margin-top:12px;font-size:13px;line-height:1.5}
.rps-note{margin-top:8px;font-size:12px;color:#868e96;line-height:1.6}
.rps-up{color:#d63031;font-weight:600}
.rps-down{color:#00b894;font-weight:600}
/* Skin A 专业交易终端（浅色紧凑，与现有页面一致）*/
.skin-A .rps-card{background:#fff;color:#1a1a2e}
.skin-A .rps-x{background:#f1f3f5;color:#495057}
.skin-A .rps-toggle{border-color:#dee2e6}
.skin-A .rps-toggle button{background:#fff;color:#495057}
.skin-A .rps-toggle button.on{background:#4263eb;color:#fff}
.skin-A .rps-range-btn.on{background:#4263eb;color:#fff;border-color:#4263eb}
/* Skin B 暗色霓虹（TradingView 暗夜）*/
.skin-B .rps-card{background:#131722;color:#e6e9ef;box-shadow:0 8px 32px rgba(0,0,0,.5)}
.skin-B .rps-x{background:#232838;color:#c5cad3}
.skin-B .rps-lbl{color:#7d8694}
.skin-B .rps-toggle{border-color:#2b3242}
.skin-B .rps-toggle button{background:#131722;color:#9aa4b2}
.skin-B .rps-toggle button.on{background:linear-gradient(90deg,#4dabf7,#3bc9db);color:#06121f;box-shadow:0 0 10px rgba(77,171,247,.5)}
.skin-B .rps-range-btn{background:#1b2030;color:#c5cad3;border-color:#2b3242}
.skin-B .rps-range-btn.on{background:#4dabf7;color:#06121f;border-color:#4dabf7;box-shadow:0 0 8px rgba(77,171,247,.5)}
.skin-B .rps-ctl-lab{color:#c5cad3}
.skin-B .rps-ctl-lab input{accent-color:#4dabf7}
.skin-B .rps-ma-bar,.skin-B .rps-note{color:#7d8694}
.skin-B .rps-date-blue{color:#4dabf7}
.skin-B .rps-ma-num{color:#c5cad3}
.skin-B .rps-sel{background:#1b2030;color:#c5cad3;border-color:#2b3242}
.skin-B .rps-up{color:#ff6b6b}.skin-B .rps-down{color:#51cf66}
/* Skin C 极简留白（细线、克制）*/
.skin-C .rps-card{background:#ffffff;color:#495057;box-shadow:0 4px 24px rgba(0,0,0,.08)}
.skin-C .rps-x{background:#f8f9fa;color:#adb5bd}
.skin-C .rps-lbl{color:#ced4da}
.skin-C .rps-toggle{border-color:#e9ecef}
.skin-C .rps-toggle button{background:#fff;color:#adb5bd;font-weight:500}
.skin-C .rps-toggle button.on{background:#495057;color:#fff}
.skin-C .rps-range-btn{background:#fff;color:#868e96;border-color:#e9ecef}
.skin-C .rps-range-btn.on{background:#495057;color:#fff;border-color:#495057}
.skin-C .rps-ctl-lab{color:#adb5bd}
.skin-C .rps-ctl-lab input{accent-color:#495057}
.skin-C .rps-date-blue{color:#1971c2}
.skin-C .rps-ma-num{color:#1a1a2e}
.skin-C .rps-sel{background:#fff;color:#868e96;border-color:#e9ecef}
.skin-C .rps-up{color:#e03131}.skin-C .rps-down{color:#2f9e44}
'''
k = html4.index('</style>')
html5 = html4[:k] + SKIN_CSS + "\n" + html4[k:]

# ---- 6) 写出 3 个皮肤文件 ----
for out, sk in zip(OUT, SKINS):
    content = html5.replace('class="skin-X"', 'class="skin-%s"' % sk, 1)
    io.open(out, "w", encoding="utf-8").write(content)
    print("written", out, "skin", sk, "bytes", len(content))
print("DONE")
