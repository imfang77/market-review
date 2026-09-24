# -*- coding: utf-8 -*-
"""板块指数日K OHLC 落盘（生产用）：从本机 vipdoc 读全部 401 板块真实日K，
写出 window.BOARD_KLINE = {code: [[date,open,high,low,close], ...]}，供给 board_rps.html 的 K线图使用。

与 _gen_board_rps_auto.py 内嵌的 write_board_kline 逻辑一致；本脚本可独立运行，
不触发生成器的日期门禁，适合在非交易日/数据未更新时单独产出 K线数据文件。

用法：python gen_board_kline.py [N=260]
"""
import json, os, re, struct, sys

MR = "C:/Users/15921/WorkBuddy/2026-08-03-21-11-02/market-review"
N = int(sys.argv[1]) if len(sys.argv) > 1 else 260


def find_vipdoc():
    cands = ["C:/zd_zsone", "C:/new_tdx", "C:/zd_gszq"]
    for c in cands:
        p = os.path.join(c, "vipdoc", "sh", "lday")
        if os.path.isdir(p):
            return p
    return None


def main():
    # 板块清单取自已部署的 _board_rps_data.js（保证与 RPS 数据 1:1）
    raw = open(os.path.join(MR, "_board_rps_data.js"), encoding="utf-8").read()
    obj = json.loads(re.search(r"window\.BOARD_RPS\s*=\s*(\{.*\})\s*;", raw, re.S).group(1))
    codes = list(obj["boards"].keys())
    print("板块数:", len(codes))

    vip = find_vipdoc()
    if not vip:
        raise SystemExit("未找到 vipdoc/sh/lday 目录")
    print("vipdoc lday:", vip)

    out, miss = {}, []
    for code in codes:
        f = os.path.join(vip, "sh%s.day" % code)
        if not os.path.exists(f):
            miss.append(code)
            continue
        d = open(f, "rb").read()
        cnt = len(d) // 32
        if cnt == 0:
            miss.append(code)
            continue
        s = max(0, cnt - N)
        arr = []
        for i in range(s, cnt):
            dt, o, h, l, c, amt, vol, rsv = struct.unpack("<IIIIIfII", d[i * 32:(i + 1) * 32])
            arr.append([dt, round(o / 100.0, 2), round(h / 100.0, 2),
                        round(l / 100.0, 2), round(c / 100.0, 2)])
        out[code] = arr
    print("成功 %d / 缺失 %d" % (len(out), len(miss)))
    if miss:
        print("  缺失样例:", miss[:10])

    js = "window.BOARD_KLINE = " + json.dumps(out, separators=(",", ":")) + ";\n"
    outp = os.path.join(MR, "_board_kline.js")
    open(outp, "w", encoding="utf-8").write(js)
    print("写出", outp, "大小=%.2f MB" % (len(js.encode("utf-8")) / 1048576.0))


if __name__ == "__main__":
    main()
