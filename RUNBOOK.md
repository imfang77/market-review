# A股复盘选股自动化运行手册 (RUNBOOK)

> 本文件是自动化任务的执行指南。每次自动化运行时，请完整阅读本文件并按步骤执行。

## 概述

每个交易日收盘后生成四类内容：1) A股收盘复盘报告 2) 条件选股结果 3) 5-20日主线分析 4) 基金新进/增持/减持卡片。通过两个固定云端链接访问（共享同一部署，改一处两处同步生效）：
- **综合入口链接**：进入后看到三个入口卡片，分别查看复盘报告（按日期）、选股结果（按日期）和主线分析（按日期）。
- **独立复盘链接**：直接进入复盘报告日期列表，仅显示日期链接，无汇总文字，无选股入口。

两类报告各自有独立的日期列表页和每日独立文件。

- **固定云端链接（综合入口）**: `https://a370eac17bf645659375782958b12fb9.app.workbuddy.link`
- **固定云端链接（仅复盘报告）**: `https://a370eac17bf645659375782958b12fb9.app.workbuddy.link/review-only.html`
- **本地目录**: `C:\Users\15921\WorkBuddy\2026-08-03-21-11-02\market-review\`
- **核心文件**:
  - `index.html` — 中心入口页（静态，三个卡片，不需修改）
  - `review-only.html` — 独立复盘入口页（静态，仅日期链接无汇总文字，读manifest.js渲染，不需修改）
  - `reviews.html` — 复盘报告日期列表页（静态，读manifest.js渲染，不需修改）
  - `screening.html` — 选股双入口导航页（读 `screening_meta.json` 取最新日期；静态，不需修改）
  - `mainlines.html` — 主线分析日期列表页（静态，读manifest.js渲染，不需修改）
  - `manifest.js` — 报告清单（由add-report.js自动更新，不要手动编辑）
  - `add-report.js` — 清单更新脚本（支持review、screening和mainline三种类型）
  - `review-20260803.html` — 首份复盘报告（兼作HTML结构模板参考）
  - `screening-20260803.html` — 首份选股结果（兼作HTML结构模板参考）
- **生成时间**: 每个交易日 15:10

## 架构说明

```
两个固定链接共享同一部署 (CloudStudio)
    ↓
链接1: / (index.html) — 三个入口卡片
    ├── 📊 每日复盘报告 → reviews.html → 点击日期 → 直接打开 review-YYYYMMDD.html
    ├── 🔍 条件选股 → screening.html（双入口 hub）→ screening_tech.html（技术面）/ screening_fund.html（基本面）
    ├── 🎯 5-20日主线分析 → mainlines.html → 点击日期 → 直接打开 mainline-YYYYMMDD.html
    └── 基金新进/增持/减持 → fund_new.html?v=YYYYMMDD

链接2: /review-only.html — 仅复盘报告日期列表（无汇总文字，无选股入口）
    └── 点击日期 → 直接打开 review-YYYYMMDD.html
```

**关键设计**：
- 两个链接共享同一份 manifest.js 和 review-*.html 文件，改一处两处同步生效
- 报告文件是独立HTML，通过直接 `<a href>` 链接打开（手机兼容，不用Blob URL）
- manifest.js 存metadata：每条记录包含 reviewFile/reviewSummary、screeningFile/screeningSummary 和 mainlineFile/mainlineSummary
- 复盘报告、选股结果和主线分析各有独立的日期列表页和每日文件

## 数据后端与取数层（2026-08-12 重构 · 解决"取数取不到 / 自动化跑崩"）

> 本节是 2026-08-12 针对"每次自动复盘没结果、每次取数取不到"的根因修复。**所有取数收口到脚本，不再依赖已失效的 westock 内置技能。**

### 真实可用数据源（已逐一核对端点）
| 数据 | 主源 | 兜底 | 模块/脚本 |
|---|---|---|---|
| 全A当日报价/成交额/市值 | 东财 push2delay `clist` | 磁盘缓存 | `fetch_core.getAllAQuotes` → `_em_quotes_<DATE>.json` |
| ETF 名单/规模 | 东财 push2delay `clist` | 磁盘缓存 | `fetch_core.getEtfList` |
| 个股/ETF/指数 成交额·规模·价 | 东财 push2delay `stock/get` | 磁盘缓存 | `fetch_core.getStockGet` |
| 净利润同比 | 东财 datacenter `RPT_LICO_FN_CPD` | 磁盘缓存 | `fetch_core.getEarnings` |
| 前复权日K线(MA480/720/960) | 腾讯 gtimg(三窗拼接≥961) | 新浪 K线 | `klib.js`（已自带回退+缓存） |
| 指数 OHLC | 新浪 K线 | push2delay | `fetch_core.getIndices` |

### 新增模块（项目根目录）
- **`fetch_core.js`** — 统一取数层：`req()`（超时+退避重试）、`_fetch_cache/` 磁盘缓存、`liveOrCache()`（live 失败回退缓存，**取不到也能出报告**）。
- **`prefetch.mjs`** — 收盘预取快照：把当日脆弱源抓全落盘 `_raw_<DATE>/` + 标准中间文件。
- **`norm.js` + `norm.test.js`** — 口径归一化（元/亿、分→元、百分数防×100、新浪 amount×1000/volume×100），带单测（已 18/18 通过）。
- **`deploy_check.mjs`** — 部署后自检：拉 `manifest.js` 校验当日上线 + 写 `_automation_status.json`（已对线上链接实测 `status=ok`）。
- **`run_pipeline.mjs` + `pipeline.config.json`** — 断点续跑编排：预取→各生成脚本，每步写 `.ck_<DATE>/` checkpoint，打断后可 resume。

### 5-20日主线分析子系统（2026-08-13 东财重建 · 彻底退役 westock 主线后端）

> 此前主线子系统 100% 依赖 `westock-data`/`westock-tool` 的 `sector list` / `WSD` / `WST` 命令行（2026-08 应用重打包后已删除），是「自动复盘没结果」的根因之一。现已整体重建在统一取数层之上（见 `_ml_helpers.js`）。

| 数据 | 东财端点 / 模块 | 说明 |
|---|---|---|
| 行业板块列表(496)/概念板块(504) | `ecList('m:90+t:2' / 'm:90+t:3')` | 替代申万 `sector list`（东财为扁平 496，无 sw1/sw2 层级） |
| 板块成分股 | `ecList('b:<BKcode>')` | 替代 `WSD` 成分股 |
| 板块 5/10/20日涨跌幅 | `clist f104/f105/f106 ÷100` | **关键：东财涨跌幅字段 = 值/100（实测 茅台 f170=-26 ↔ -0.26%），曾误用 ÷10 出 +48.2% 错值** |
| 个股 5/10/20日涨跌幅 | `klib.kline`（腾讯前复权） | 替代 `WST` |
| 指数/ETF 当日涨跌·成交额 | `stock/get`（f170/100, f48） | 替代 `quote` |
| 一级行业归属 | `_ml_l1dict.js` 关键词字典 → `_ml_l2l1.json` | 替代 `_ml_fetch_l1map.js`（原拉申万31成分股，已废弃） |
| 相关ETF匹配行情 | `etfQuote()`（东财 stock/get + klib） | 替代 westock-data `quote <etf>` |

脚本链：`_ml_helpers.js`(统一helper) → `_ml_fetch_sw.js`(生成 sw1/sw2/l2l1) → `_ml_select_boards.js`(动态选 TOP-K) → `_ml_board_loop.js`(逐板 `_ml_board.js`，带重试) → `_ml_fetch_flow.js`(指数/涨跌家数) → `_ml_etf_match.js {DATE}`(东财 ETF 行情) → `_ml_assemble.js {DATE}` + `_ml_assemble_concept.js {DATE}`。

⚠️ **分类口径说明**：东财行业板块为扁平 496 个，无申万 sw1(31)/sw2(124) 层级。现用关键词字典将 496 板块归并为 **21 个一级组**（如 机械/电子/医药/化工/电力…），报告沿用「申万一级/二级」版式但数据为东财口径。若后续接入 iFinD/申万官方分类可再升级。

### 自动化执行顺序（推荐，单入口）
1. `node run_pipeline.mjs <YYYYMMDD>` —— 跑（或续跑）预取+全部生成，包含基金股东数据重建、行情补全和 `fund_new.html` 生成；写完 `.ck_<DATE>/READY` 才进下一步；任一步失败退出 1，便于判错后重跑续跑。
2. `market-review/add-report.js` ×3（review/screening/mainline）写 manifest；基金卡片为固定入口文件，由生成脚本同步更新 `index.html` 的版本参数。
3. `workbuddy_cloudstudio_deploy`（部署 market-review/）。
4. `node deploy_check.mjs <YYYYMMDD> --base "https://a370eac17bf645659375782958b12fb9.app.workbuddy.link"` —— 同时校验 manifest、四个入口卡片和基金卡片披露期/复盘日期；非 0 则重试部署后再检。

### 口径铁律（渲染代码一律走 norm.js，禁止散落手算）
- 价格字段(f2/f43)单位「分」→ `norm.fenToYuan`；成交额/市值(元)→ `norm.yuanToYi`(亿)。
- 涨跌幅若 |v|<1 视为小数→`norm.ensurePercent`×100，已是百分数原样保留（**严禁再×100**，曾出 +2267%）。
- ETF 严禁用 `qt_chg_interval` 数值（整列反号），只用 `quote`/`stock/get` 权威值。
- 新浪 `amount`×1000、`volume`×100 才是真实值。

## 执行步骤

### Step 0: 收盘预取快照（A+B · 防"取数取不到"）

> 在生成之前，先把当日脆弱数据源（东财 push2delay 全A报价/ETF/指数、东财 datacenter 净利润同比）一次性抓全落盘到 `_raw_<DATE>/` 与标准中间文件（`_em_quotes_<DATE>.json` 等）。生成阶段只读缓存，**彻底脱离实时出站依赖**。任一源失败也不致命——`fetch_core.js` 会回退磁盘缓存，并在 `fetch_health_<DATE>.json` 记录各源状态。

```bash
NODE="C:/Users/15921/.workbuddy/binaries/node/versions/22.22.2/node.exe"
"$NODE" prefetch.mjs <YYYYMMDD>        # 默认关 K线预缓存；要 G1 完全离线加 PRECACHE_KLINES=1
```

### Step 1: 加载技能（2026-08-12 起已废弃 westock 内置技能依赖）

> ⚠️ **重要变更**：`wb-finance-skill` 技能**已从本机移除**（目录不存在）；`westock-data`/`westock-tool` 内置技能底层后端亦在 2026-08 应用重打包时被移除，**不可再作为取数主路径**（这正是此前自动化"跑崩/取不到数"的根因之一）。所有行情/选股数据现统一走项目脚本管线（见下文「数据后端与取数层」一节），**本步无需加载任何 Skill**，直接跳到 Step 4 即可。

### Step 2: 读取方法论参考

读取以下文件（路径前缀: `C:\Users\15921\AppData\Local\Programs\WorkBuddy\resources\app.asar.unpacked\resources\builtin-skills\wb-finance-skill\references\`）：
- `market-state.md` — 盘面状态分析框架
- `market-mainline.md` — 主线研判框架
- `daily-briefing.md` — 日报撰写框架
- `html-report-style.md` — HTML样式规范

### Step 3: 获取当前日期

用 Bash 执行 `date +%Y%m%d` 和 `date +%Y-%m-%d` 获取今日日期。
用 `date +"%A"` 或计算获取星期（周一至周五）。

### Step 4: 获取市场数据（结构性数据已在 Step 0 预取，本步仅补新闻）

> 指数/全A报价/ETF/净利润同比等**结构性数据已在 Step 0 由 `prefetch.mjs` 抓取并落盘**，生成脚本直接读 `_em_quotes_<DATE>.json` / `_idx_<DATE>.json` / `_etf_list_<DATE>.json`，**本步不再调用任何 westock 命令行**。唯一仍需实时补充的是**当日市场新闻**。

#### 4d. 搜索市场新闻
使用 WebSearch 工具搜索当日A股市场新闻（盘面主线、政策、外围市场）。

### Step 5: 分析与研判

基于获取的数据和新闻，进行盘面整体评估、主线研判、资金流向分析、消息面梳理、后市策略。

### Step 6: 生成复盘HTML报告

**参考模板**: 读取已有的 `review-20260803.html` 作为结构和样式参考。

报告必须包含：报告标题、盘面概览（指数表格+ECharts图）、板块涨跌排行、主线研判、资金流向、消息面、后市策略。

**板块涨跌排行口径（全局约定，三份报告统一）**：必须使用**申万宏源2021版行业分类**——一级（industry_list_sw1，31个，作概览）+ 二级（industry_list_sw2，数据源返回约124个，作明细）。**禁止**使用 `sector ranking` / `hot board` 的概念与行业混合口径，也禁止出现"电网设备+电力+工业金属"之类的手工拼凑板块（曾导致紫金矿业误入电网板块）。

**技术要求**：
- ECharts CDN: `https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js`
- 中国股市配色: **涨=红色(#d63031)，跌=绿色(#00b894)**
- 浅色主题，白底深字，响应式布局
- **手机端适配（必须）**：
  - 指数涨跌图用**横向柱状图**（yAxis=category, xAxis=value），不用竖向柱状图
  - 指数表格用 `.table-wrap` 包裹（`overflow-x:auto`），手机可横向滚动
  - summary-grid 在手机上改为 2×2（`@media max-width:600px { grid-template-columns: repeat(2,1fr) }`）
  - 添加 `@media (max-width:600px)` 媒体查询：缩小字体、padding、图表高度

### Step 7: 保存复盘报告

保存到：`C:\Users\15921\WorkBuddy\2026-08-03-21-11-02\market-review\review-YYYYMMDD.html`

### Step 8: 条件选股

> **数据来源已统一**：本步所有行情/净利润/K线均来自 `fetch_core.js` + `klib.js`（腾讯 gtimg 前复权 + 新浪兜底 + 东财 push2delay/datacenter），**不再调用 westock-tool / westock-data 命令行**（其内置技能后端已移除）。下方「条件映射」口径定义完全保持不变，仅取数实现改为脚本管线。实际生成由 `run_pipeline.mjs` 调度的 `_gen_g1_20260807.js` / `_gen_screening_data.js` / `_gen_etf_g3.mjs` 完成。

#### 第一组（5条件同时满足）

**条件映射**：
| 用户条件 | 工具实现 | 精确度 |
|---------|---------|--------|
| 年线之上 | `ClosePrice > MA_250` | 精确 |
| 创半年新高 | `ClosePrice >= MA_120 * 0.95` | 按用户公式精确 |
| 突破2/3/4年线 | K线手动计算MA480/720/960，判断今日上穿 | 精确 |
| RPS5/10/20≥90 | `TecScore >= 80` | 近似（工具无RPS字段） |
| 当日成交额>5亿 | `TurnoverValue > 500000000` | 精确 |

**执行步骤**：

1. 查询条件1+2+5的交集（年线之上 + 创半年新高 + 成交额>5亿）：
```bash
NODE_PATH="C:/Users/15921/.workbuddy/binaries/node/versions/22.22.2" \
"C:/Users/15921/.workbuddy/binaries/node/versions/22.22.2/node.exe" \
"C:/Users/15921/AppData/Local/Programs/WorkBuddy/resources/app.asar.unpacked/resources/builtin-skills/westock-tool/scripts/index.js" \
filter "intersect([ClosePrice > MA_250, ClosePrice >= MA_120 * 0.95, TurnoverValue > 500000000])" \
--limit 500 --raw
```

2. 查询TecScore≥80的股票：
```bash
# 同上路径，参数改为: ranking TecScore --min-TecScore 80 --limit 5000 --raw
```

3. 交叉匹配：取步骤1结果中同时出现在步骤2排行中的股票（按代码匹配），得到条件1+2+4的交集候选。

4. 对每个交集候选股，获取961日前复权K线数据，手动计算MA480/MA720/MA960并判断今日是否上穿：
```bash
# 获取K线（--limit 961 --fq qfq，数据最新在前，收盘价字段名为 last）
"C:/Users/15921/.workbuddy/binaries/node/versions/22.22.2/node.exe" \
"C:/Users/15921/AppData/Local/Programs/WorkBuddy/resources/app.asar.unpacked/resources/builtin-skills/westock-data/scripts/index.js" \
kline <代码> --period day --limit 961 --fq qfq --raw
```

5. MA计算与上穿判断逻辑：
   - MA480 = 最近480个交易日（含今日）收盘价均值（2年线）
   - MA720 = 最近720个交易日收盘价均值（3年线）
   - MA960 = 最近960个交易日收盘价均值（4年线）
   - 今日MA = closes[offset : offset+period] 的均值（offset=0为今日）
   - 昨日MA = closes[1 : 1+period] 的均值
   - 上穿条件：今日收盘 > MA 且 昨日收盘 <= MA
   - K线数据最新在前：closes[0]=今日, closes[1]=昨日

6. 筛选结果：只保留今日上穿MA480或MA720或MA960中任一的股票。

**注意**：此步骤需要对30-40只候选股逐一查询K线数据，建议编写Node.js脚本批量执行。

#### 第三组（跳空缺口，前端实时筛选）

**条件映射**：
| 用户条件 | 工具实现 | 精确度 |
|---------|---------|--------|
| 跳空缺口20日未回补 | rise_big_up策略 + K线验证 | 精确 |
| 创半年新高 | `ClosePrice >= MA_120 * 0.95` | 按用户公式精确 |
| 年线之上 | `ClosePrice > MA_250` | 精确 |
| 当日成交额>5亿 | `TurnoverValue > 500000000` | 精确 |
| 站上10日线且10日线向上 | 收盘价 &gt; MA10 且 MA10(今日) &gt; MA10(昨日)，取最新10日收盘价算 MA10 | 精确 |

**执行步骤（前端实时筛选，勿手写HTML）**：本组（跳空缺口）与第二组（净利润断层）**共用** `_gen_screening_data.js <DATE>` 生成的 `screening_data_<DATE>.json` 候选池（候选池每条含 `gapVol`=跳空当日成交额/近20日平均成交额），由 `_gen_screening_20260807.js <DATE>` 输出两张结构相同的「动态筛选表」（第二组 id=g4-table、第三组 id=g2-table）。两组表头最前均为「收藏★」红星列（点击在空心☆/实心★间切换，localStorage 本地保存），其余10列：个股 / 成交金额(亿) / 当日涨跌幅 / 5日涨跌幅 / 10日涨跌幅 / 20日涨跌幅 / 市值(亿) / 净利润同比% / 缺口日期 / **概念题材（最后列）**；首两列（红星+个股）冻结。**默认差异**：第二组（净利润断层）默认同时启用「跳空日放量≥1.5倍」（经典净利润断层特征），第三组（跳空缺口）默认放开放量条件（放量筛选框为0=不限）；其余默认（净利润同比≥30%、缺口窗口30日、站上10日线且向上、成交额≥5亿）两组一致。筛选条件完全可实时调整（题材筛选置于末位）。

1. 查询跳空向上策略股票：
```bash
NODE_PATH="C:/Users/15921/.workbuddy/binaries/node/versions/22.22.2" \
"C:/Users/15921/.workbuddy/binaries/node/versions/22.22.2/node.exe" \
"C:/Users/15921/AppData/Local/Programs/WorkBuddy/resources/app.asar.unpacked/resources/builtin-skills/westock-tool/scripts/index.js" \
strategy rise_big_up --limit 200 --raw
```

2. 查询条件2+3+4的交集（年线之上 + 创半年新高 + 成交额>5亿）：
```bash
# 同上路径，参数改为:
filter "intersect([ClosePrice > MA_250, ClosePrice >= MA_120 * 0.95, TurnoverValue > 500000000])" --limit 500 --raw
```

3. 交叉匹配：取步骤1结果中同时出现在步骤2结果中的股票。

4. 对每个交叉匹配结果，获取20日K线数据验证跳空缺口未回补：
```bash
# 获取20日K线
kline <代码> --period day --limit 21 --fq qfq --raw
```

5. 缺口验证逻辑：
   - 遍历最近20个交易日，找到 open > 前日close 的跳空日
   - 检查跳空日之后所有交易日的最低价是否都 > 跳空日前一日收盘价
   - 若存在未回补的跳空缺口，则该股票通过条件1

6. 对步骤2未返回MA数据的股票（NaN），通过K线数据手动计算MA120和MA250验证。

7. **条件5（站上10日线且10日线向上）验证**：对通过条件1-4的股票，取其 K 线（已有20日K线足够），用收盘价计算 MA10：
   - `MA10_今日 = 最近10个交易日收盘价均值`；`MA10_昨日 = 前推1日的10日收盘价均值`
   - 判定：收盘价 &gt; MA10_今日 **且** MA10_今日 &gt; MA10_昨日（方向向上）才通过；否则剔除。
   - 在表格中新增「MA10」列展示该值。

#### 第二组（净利润断层，4条件同时满足）

> 净利润断层（Earnings Gap）：业绩披露后股价向上跳空且缺口不回补，叠加净利润高增长，是经典动量策略（Minervini / Dan Zanger 体系）。本组为第三组（跳空缺口）的「业绩增强版」，独立于年线/半年新高/成交额门槛。

**条件映射**：
| 用户条件 | 工具实现 | 精确度 |
|---------|---------|--------|
| 近30日向上跳空未回补 | 复用基础池 K 线缓存（`_gen_cache/g2kline_<code>.json`），遍历近30日找 `open > 前日high` 且其后最低价未跌破前日high | 精确（K线验证） |
| 净利润同比增长 > 30% | 东方财富业绩报表 `RPT_LICO_FN_CPD`，取最新报告期 `SJLTZ`（归母净利润同比）> 30 | 精确 |
| 跳空日放量 | 跳空当日 `amount` > 近20日平均 `amount` × 1.5 | 精确 |
| 站上10日线且10日线向上 | 收盘价 > MA10 且 MA10(今日) > MA10(昨日)（同第二组条件5算法） | 精确 |

**执行步骤（动态筛选表，勿手写HTML，勿做题材chip联动）**：
1. 候选池由 `_gen_screening_data.js <DATE>` 生成 `screening_data_<DATE>.json`（与第二组/第三组同源，见下方「第三组」步骤）。
2. 市值映射：`_fetch_cap_screening.js <DATE>` 读 `_g1_breakthrough_<DATE>.json` 与 `screening_data_<DATE>.json` 取代码并集，用 westock `quote` 的 `total_market_cap` 生成 `_cap_map_<DATE>.json`（带缓存）。
3. 页面生成：`_gen_screening_20260807.js <DATE>` 读 `screening_data_<DATE>.json`（含 `gapVol`）+ `_cap_map_<DATE>.json` + `_g1_*` + `_etf_g3_out.json`，输出 `screening-<DATE>.html`。第二组（净利润断层）为**动态筛选表**（id=g4-table），与第三组共享同一候选池与11列表头（最前「收藏★」红星列 + 个股 / 成交金额(亿) / 当日涨跌幅 / 5日涨跌幅 / 10日涨跌幅 / 20日涨跌幅 / 市值(亿) / 净利润同比% / 缺口日期 / **概念题材（最后列）**）；首两列（红星+个股）冻结。第二组页面**默认严格筛选**即其4个条件：缺口窗口30日、净利润同比≥30%、站上10日线且向上、**跳空日放量≥1.5倍**（放量筛选框默认1.5）、成交额≥5亿；上方筛选面板（无「主要/次要条件」分组标题，题材置于末位）：第一行=缺口窗口(5/10/20/30/60默认30)、净利润同比≥%(默认30)、站上N日线且向上；第二行=缺口日期、成交金额≥亿(默认5)、**跳空日放量≥倍(默认第二组1.5/第三组0)**、题材(28主线)。第三组默认放开放量条件（0=不限），仅作参考。

#### 第四组（ETF 5日最强）

> ⚠️ **ETF 数据准确性硬性要求（务必遵守，否则会产出错误数据）**：
> ETF 的**当日 / 5日 / 10日 / 20日 / 年初至今 涨跌幅**以及**当日成交额**，**严禁**使用 `westock-tool ranking qt_chg_interval` 返回的 `ChgPct / ChgPct5D / ChgPct20D / ChgPctYtd` 数值——该命令对 ETF 返回的是**错误值**（实测案例：159256 的 ChgPct 显示 +2.69%，真实当日为 -0.68%；整列正负相反、期间值偏离 0.3~5 个百分点）。
> ETF 的所有涨跌幅与成交额**必须**用 westock-data 的 `quote <代码>` 命令取值（字段见下表），否则条件选股第四组会系统性失真。

**条件映射**：
| 用户条件 | 工具实现 | 精确度 | 数据来源 / 字段 |
|---------|---------|--------|---------|
| ETF 5日最强20只（取**代码名单**） | `ranking qt_chg_interval --asset etf --orderby ChgPct5D --limit 20` | 仅用于取前20只代码名单 | 名单可用；但其 `ChgPct*` 数值**不可信，禁止作为展示值** |
| 当日涨跌幅 | `quote <代码> --raw` | 精确（权威） | `change_percent` |
| 5日涨跌幅 | `quote <代码> --raw` | 精确（权威） | `chg_5d` |
| 10日涨跌幅 | `quote <代码> --raw` | 精确（权威） | `chg_10d`（**无需再用K线计算**） |
| 20日涨跌幅 | `quote <代码> --raw` | 精确（权威） | `chg_20d` |
| 年初至今 | `quote <代码> --raw` | 精确（权威） | `chg_ytd` |
| 当日成交额 | `quote <代码> --raw` | 精确（权威） | `amount`（元；展示时 `amount/1e8` 转"亿"） |
| ETF总规模 | `ranking size --asset etf` 的 `TotalAsset` | 精确 | 可靠，保留 |
| 十大持仓 | `etf holdings <代码>` | 精确 | 可靠，保留 |

**执行步骤**：

1. 查询ETF按5日涨幅排名前20（**仅提取代码名单**，数值不可信）：
```bash
NODE_PATH="C:/Users/15921/.workbuddy/binaries/node/versions/22.22.2" \
"C:/Users/15921/.workbuddy/binaries/node/versions/22.22.2/node.exe" \
"C:/Users/15921/AppData/Local/Programs/WorkBuddy/resources/app.asar.unpacked/resources/builtin-skills/westock-tool/scripts/index.js" \
ranking qt_chg_interval --asset etf --orderby ChgPct5D --limit 20 --raw
```
   - ⚠️ 只取前20只 ETF 的**代码**，切勿直接使用其 `ChgPct / ChgPct5D / ChgPct20D / ChgPctYtd` 数值。

2. **对选出的每只 ETF 调用 `quote` 取权威涨跌幅与成交额**（关键步骤，决定数据正确性）：
```bash
# 用 westock-data quote 批量或逐只取数（含 change_percent/chg_5d/chg_10d/chg_20d/chg_ytd/amount）
NODE_PATH="C:/Users/15921/.workbuddy/binaries/node/versions/22.22.2" \
"C:/Users/15921/.workbuddy/binaries/node/versions/22.22.2/node.exe" \
"C:/Users/15921/AppData/Local/Programs/WorkBuddy/resources/app.asar.unpacked/resources/builtin-skills/westock-data/scripts/index.js" \
quote <代码1>,<代码2>,... --raw
```
   - 当日涨跌幅 = `change_percent`；5日 = `chg_5d`；10日 = `chg_10d`；20日 = `chg_20d`；年初至今 = `chg_ytd`；当日成交额 = `amount`（元 → 展示"亿"：`amount/1e8`，保留两位小数）。

3. 查询ETF总规模（TotalAsset，可靠保留）：
```bash
# 同上 westock-tool 路径，参数改为: ranking size --asset etf --limit 2000 --raw
```

4. 对每只ETF获取十大持仓股（可靠保留）：
```bash
"C:/Users/15921/.workbuddy/binaries/node/versions/22.22.2/node.exe" \
"C:/Users/15921/AppData/Local/Programs/WorkBuddy/resources/app.asar.unpacked/resources/builtin-skills/westock-data/scripts/index.js" \
etf holdings <代码> --raw
```
   - 取前10条持仓记录，格式化为"名称(比例%) 名称(比例%) ..."
   - 部分小型ETF可能返回null，显示"暂无持仓数据"

5. **合并与排序**：以 `quote` 的 `chg_5d` 降序排列最终名次 1–20；展示列（首列为「收藏★」红星列）：**收藏★** / 排名 / 代码 / 名称 / 当日成交额 / 总规模 / 当日涨跌幅 / 5日涨跌幅 / 10日涨跌幅 / 20日涨跌幅 / 年初至今 / 十大持仓股。
   - 第四组（ETF）表头第一列「收藏★」下方带 **全选 / 全不选 / 反选** 三个操作链接（点击对当页/全部ETF批量切换收藏），与各组收藏星共用同一 `localStorage`（`ashare_screening_fav_v1`），跨组共享自选股。
   - 🚫 **禁止**把 `qt_chg_interval` 的 `ChgPct*` 当作任何展示值；所有涨跌幅必须来自第2步的 `quote`。
   - ✅ **推荐做法（省心、已测试）**：直接运行项目根目录脚本 `_gen_etf_g3.mjs` 生成正确的第三组数据 JSON（`node _gen_etf_g3.mjs`，默认自动取前20名单并用 `quote` 取权威涨跌幅/成交额；也可加 `--codes-file <codes.json>` 指定名单）。输出 `_etf_g3_out.json` 后据此渲染表格即可，无需手工拼装。

### Step 9: 生成选股结果页面

**⚠️ 2026-08-12 起：条件选股改为「技术面 / 基本面」双入口，不再生成单页 `screening-<DATE>.html`（旧模板 `_gen_screening_20260807.js` 已废弃）。详见 `复盘中心_重要要求与思路汇总.md` 第四节-B。**

**生成方式（勿手写HTML模板）**：选股页面由项目根目录脚本统一生成，分两步——

1. **数据准备（与旧流程共用）**：`node _gen_g1_20260807.js <DATE>` → `_g1_base_<DATE>.json` 等；`node _gen_screening_data.js <DATE>` → `screening_data_<DATE>.json` 候选池（供技术面页 G2/G3 动态筛选）；`node _fetch_cap_screening.js <DATE>` → `_cap_map_<DATE>.json`；`node _gen_etf_g3.mjs` → `_etf_g3_out.json`（ETF）。
2. **双入口渲染（每日必跑）**：
   - `node _gen_tech.js <YYYYMMDD>` —— 把当日 merge 进 `screening_tech_all.json` 并重渲染 `screening_tech.html`（技术面：趋势突破G1 / 净利润断层G2 / ETF五日均强G4，累计全交易日、样式冻结只更新内容），并把 `screening_meta.json` 的 `techDate` 更新为当日。
   - `node _gen_fund.js` —— 重渲染 `screening_fund.html`（基本面：高盈利/高成长/高股息三维度，季度数据驱动，价格不需每日刷新）。
   - `cp screening_meta.json market-review/screening_meta.json` —— **必须同步**，否则导航 hub `screening.html` 取不到最新日期。
3. **入口**：`index.html` 条件选股卡片 → `screening.html`（双入口 hub）→ `screening_tech.html` / `screening_fund.html`。`manifest.js` 的 `screeningFile` 指向 `screening.html`。

下方「第一组~第四组」的**口径定义仍然有效**，但自 2026-08-12 起它们渲染在 `screening_tech.html`（技术面），基本面维度在 `screening_fund.html`；不再有单页 `screening-<DATE>.html`。

**文件名**: `screening.html`（导航 hub，保存到 market-review 目录）+ `screening_tech.html`（技术面）/ `screening_fund.html`（基本面）

选股页面必须包含：
- 页面标题（含日期）+ 返回链接到 screening.html
  - ⚠️ **顶部 header 布局硬性约束（防回归）**：`.header` 必须用 `display:flex` 且预留左右 gutter（`padding: 18px 96px`），`<h1>`+`.subtitle` 必须包进 `.h-center`（`flex:1; text-align:center`）；返回箭头（`.header a.back`，绝对定位 `left:16px`）与右上角 `.sync-box`（绝对定位 `right:16px`）落在 gutter 内，**绝不可让居中标题文字延伸到箭头下方**（此前多次出现箭头盖住标题的回归）。移动端 `@media(max-width:600px)` 改 `.header{display:block; padding:16px 60px 12px}` 并令 `a.back{top:16px;transform:none}`。该约束写在 `_gen_screening_20260807.js` 的生成器里，每日重生成不会丢失。
  - ⚠️ **各组数量展示位置（防回归）**：四组的「命中数量」一律放在各组 `.section-title` 内、靠右（`margin-left:auto` 的 `.count-inline` 药丸），**不要**再做成独立一行（`count-tag` 旧式）。第一组/第四组为静态数量直接写入标题；第二组/第三组为动态数量，JS 在渲染时同步写入 `id="g4-count-inline"`（第二组）与 `id="g2-count-inline"`（第三组），与筛选面板内 `fp-count` 一致。
- 第一组结果：条件说明（5条件）+ 股票表格（代码/名称/涨跌幅/收盘价/MA250/MA120/成交额/突破年线/技术评分/综合评分）
  - 突破年线列用彩色标签显示：2年线(绿)/3年线(蓝)/4年线(红)
- 第二组（净利润断层）：**动态筛选表**（id=g4-table，勿手写HTML、勿做题材chip联动），由 `_gen_screening_20260807.js <DATE>` 生成，与第三组共用候选池与列序（**首列「个股」冻结**：个股/成交金额(亿)/当日涨跌幅/5日/10日/20日涨跌幅/市值(亿)/净利润同比%/净利润报告期/缺口日期/概念题材；净利润报告期取自东财 RPT_LICO_FN_CPD 的 REPORTDATE，与净利润同比同源）。上方筛选面板无「主要/次要条件」分组标题，题材置于末位；默认 净利润同比≥30% 体现净利润断层特征。
- 第三组（跳空缺口）：动态筛选表，由 `_gen_screening_20260807.js <DATE>` 生成，与第二组共用候选池与列序（**首列「个股」冻结**：个股/成交金额(亿)/当日涨跌幅/5日/10日/20日涨跌幅/市值(亿)/净利润同比%/净利润报告期/缺口日期/概念题材）。上方筛选面板**不写「主要条件/次要条件」分组标题**：第一行为 缺口窗口(5/10/20/30/60默认30)、净利润同比≥%(默认30)、站上N日线且向上；第二行为 缺口日期、成交金额≥亿(默认5)、题材(28主线，置于末位)。浏览器内实时筛选，调整即更新结果（每页20条）。
  - 若筛选结果为空，显示"无符合条件的股票"提示。
- 第四组结果（ETF）：ETF排名表格（**首列「收藏★」红星列**，表头点击可全选/全不选（toggle，无文字） / 排名 / 代码 / 名称 / 当日成交额 / 总规模 / 当日涨跌幅 / 5日涨跌幅 / 10日涨跌幅 / 20日涨跌幅 / 年初至今 / 十大持仓股）
  - 十大持仓股列：格式为"名称(比例%) 名称(比例%) ..."，无数据显示"暂无持仓数据"
  - 页面右上角「一键同步至通达信」按钮：将当前 `localStorage` 中全部收藏（★）自选股（含各组 ETF/个股）导出为通达信板块文件 `_tdx_自选股.blk`（格式：`1`/`0`+6位代码，CRLF 换行；`sh`→`1`、`sz/bj`→`0`），点击即下载，方便导入通达信自选板块。其下方提示语「自选股用★表示，点击导出」点击后导出 `自选股_代码名称.txt`（仅 6位代码 + 名称，tab 分隔），供其它用途。
- 所有表格的表头必须支持点击排序（升序/降序切换）：
  - `<th>` 添加 `class="sortable"`，点击时切换 asc/desc
  - CSS: `.sortable` 有 cursor:pointer，`::after` 显示排序箭头
  - JS: `makeSortable(tableId)` 函数处理排序逻辑，自动识别数值列和文本列
  - 十大持仓股列不加 sortable（纯文本，排序无意义）
- 技术评分TecScore说明
- 条件实现映射表（标注精确/近似）
- 涨=红色(#d63031)，跌=绿色(#00b894)

### Step 9b: 生成5-20日主线分析

**参考模板**: 读取已有的 `mainline-20260806.html` 作为结构和样式参考（该模板结构为：第一部分「全市场数据」(指数合并分组柱状图 + 涨跌家数3张饼图) / 第二部分「主线汇总」(申万二级 TOP10 跨周期合并表) / 第三部分「主线分析」(5日/10日/20日 三个子部分，每部分 = 申万一级图 → 申万二级 TOP10 图 → 主线/候选研判 → 综合龙头表) / 附录「完整数据依据」；每个板块一张「综合龙头表(9列)」、明确的「主线/候选主线」研判、申万一级↔二级 层级对应、表头小箭头排序，必须严格沿用其结构与样式，不可退化为旧格式）。

**文件名**: `mainline-YYYYMMDD.html`（保存到 market-review 目录）

主线分析页面分为三大部分（涨跌幅均含当日）：

**第一部分：全市场数据**（一张图看全市场）
- 用 `makeMarketOverviewCombined()` 渲染：
  - **指数合并分组柱状图**（一张图）：同一指数在 5日 / 10日 / 20日 三个周期的涨跌幅横向分组对比（蓝=5日、橙=10日、红=20日），横轴为涨跌幅(%)，负值向左延伸，一目了然看清各周期强弱。
  - **涨跌家数 3 张饼图**：5日 / 10日 / 20日 个股涨跌家数各一张（上涨 vs 下跌）。
  - 综合文字描述三周期市场环境（上涨/下跌家数、涨跌比、中证全指涨跌幅）。

**第二部分：主线汇总**（一张合并表）
- 用 `makeSummaryTable()` 渲染一张表：
  - **行** = 申万二级行业在 5日 / 10日 / 20日 各自涨跌幅 TOP10 的并集；同一行业在多个周期上榜时**合并为一行**，未上榜周期显示「-」。
  - **列**（从左到右）：申万二级行业、所属一级行业、**5日排名 + 5日涨跌幅**、**10日排名 + 10日涨跌幅**、**20日排名 + 20日涨跌幅**（三个「排名+涨跌幅」组，组间用 CSS `.grp` 左分隔线区分）。
  - 表头可排序（小箭头，见下方）。

**第三部分：主线分析**（含 3 个子部分）
- 子部分标题：`1、5日主线分析` / `2、10日主线分析` / `3、20日主线分析`。
- **每个子部分内部顺序（必须严格遵守）**：
  1. 先展示**申万一级 {N}日 涨跌幅**柱状图（全部31个）—— 由 `makeSwCharts` 渲染 L1 图；
  2. 再展示**申万二级行业涨跌幅 TOP10** 柱状图（标注所属一级）—— `makeSwCharts` 渲染 L2 图；
  3. 再是**主线/候选主线研判**（明确梳理，关键）—— 用 `makeMainLine(d, main, cand)` 数据驱动产出两块：
     - **研判样本池必须与「二级 TOP10 图」同源（2026-08-07 修复）**：`getMainLines(d)` 在动态板块并集（`themes`，含各周期 TOP12）内按该周期涨跌幅排序取前几名；因并集已覆盖各周期 TOP12，故「主线(前3)」必然等于该周期真实 TOP3，与二级 TOP10 图完全一致，不会再出现「图上没有、研判却标主线」的矛盾。
     - **主线（确定方向）**：该周期涨幅 top、且更长周期（5日看10日 / 10日看20日）同步为正的板块 top3；
     - **候选主线（轮动/观察方向）**：其余正收益板块 top4（⚠️ **必须去重**：候选不得包含已列入主线的板块，`getMainLines` 内用 `else if (!main.includes(x))` 保证，旧版曾漏去重导致「小金属」同时出现在主线和候选）；
     - 每条列出板块名 + 所属申万一级 + {N}日/10日/20日涨跌幅 + 一句话逻辑。
  4. 再是**相关股票整理** —— 仅 `scopeOf(d)`（= 该子部分「主线」∪「候选主线」涉及的板块）范围内板块的「综合龙头表(9列)」，由 `makeThemeCards` 渲染；范围外的板块不出表。
- 情绪周期判断、持续性评估融入上述文字。

**附录：完整数据依据**（保留供核查）：申万一级概览全31、申万二级明细TOP40、一级↔二级层级对应、主力资金TOP20。

**每个主题卡片 = 一张「综合龙头表」（单一表，9列，不再拆三块），行业一律采用申万二级（industry_list_sw2），并标注所属申万一级：**
列序（{N}=5/10/20 随部分变化；⚠️ **总排名固定在第一列**）：
① 总排名 ② 股票名称 ③ 股票代码 ④ 当日总市值排名 ⑤ 当日总市值(亿) ⑥ {N}日涨跌幅(含当日)排名 ⑦ {N}日涨跌幅(%) ⑧ {N}日成交总金额(含当日)排名 ⑨ {N}日成交总金额(亿)。
- 分组：列4-5 为「总市值」组、列6-7 为「涨跌幅」组、列8-9 为「成交总金额」组（每组含排名+数值，用 CSS `.grp` 左分隔线区分）。
- **总排名(列1)规则**：capRank(列4) / gainRank(列6) / turnRank(列8) 三者取均值（权重各 1/3），数值最小者排第1。
- **移动端适配（必须，用户明确要求）**：表用 `table-layout: fixed` + `<colgroup>` 固定列宽（排名类约8%、名称15%、代码11%、总市值13%、涨幅12%、成交额17% 等），表头允许换行（如「市值<br>排名」「涨幅<br>排名」），手机字号降到 ~9.5px、**一屏看清全表、不横向滚动**。
- **表头可排序（必须，且统一为小箭头）**：每个 `<th>` 加 `sortable`，点击在升/降序间切换；排序指示符与条件选股完全一致——**默认显示双向小箭头 ⇅（CSS `content:" \u21C5"`），升序显示 ↑（`\u2191`），降序显示 ↓（`\u2193`）**（注意：JS 模板字面量里写 `\u21C5`/`\u2191`/`\u2193`，不能用 `\21C5` 八进制转义，否则语法报错）。数值列按数值排序、名称/代码列按字符串排序。脚本用 `attachSort` 对所有含 `th.sortable` 的表（含综合龙头表、主线汇总表、数据依据各表）统一绑定。
- **仅主线/候选主线范围内的板块才出详细表（必须，用户明确要求）**：每个部分只渲染 `scopeOf(d)`（= 该部分「主线」∪「候选主线」涉及的板块）；不在范围内的板块不出详细表。数据依据区的「申万一级↔二级 层级对应」仍列出全部分析板块作参考。
- **卡片左侧竖线配色（必须，用户明确要求）**：主题卡片 `border-left` 按角色着色——主线板块用主线色 `#c62828`（背景 `#fff6f5`）、候选主线用候选色 `#1565c0`（背景 `#f5f9ff`）；卡片标题加 `主线`/`候选` 角标（class `type-role-main` / `type-role-cand`）。
- 涨跌幅：个股 `chg_{N}d` 是百分数，直接加 `%`；成交总金额：接口无字段，对候选成分股 `kline <代码> --limit 21` 后对其 `amount` 累加（5日近5根/10日近10根/20日近20根）再 ÷1e8 得亿元。
- 候选龙头池 = 市值 top12 ∪ 各周期涨幅 top12 的并集（去重，上限约22只），对池内每只算三排名与总排名，取总排名前12展示。

**相关ETF**：列出匹配该板块的ETF，**每只一行**，格式为 `代码 中文名（含…龙头）`。ETF 中文名与当日/5/10/20日涨跌幅·成交额由 `_ml_etf_match.js` 经东财 `etfQuote()`（stock/get + klib）填充，**不再调用 westock-data `quote`**。

**申万一级↔二级 关系（必须展示）**：东财板块无父级字段。现由 `_ml_l1dict.js` 关键词字典将 496 板块归并为 21 个一级组，预生成 `_ml_l2l1.json`（boardCode→一级名）；每个主题卡片标「所属一级」，并在数据依据区新增「一级↔二级 层级对应（本次分析板块）」把分析的板块按一级归组。**原 `_ml_fetch_l1map.js`（拉申万31成分股多数投票）已废弃，不再使用。**

**数据获取（行业分类口径见上文「5-20日主线分析子系统」说明，现为东财扁平496→21一级组）**：
- **推荐实现（2026-08-13 东财重建）**：直接复用项目根目录拆分脚本管线（已验证）：`_ml_fetch_sw.js` → **`_ml_select_boards.js`**（按周期动态选板块，见下）→ `_ml_board_loop.js`（逐个 spawn `_ml_board.js <code>`，带重试，隔离单板失败）→ `_ml_fetch_flow.js` → `_ml_etf_match.js {DATE}` → `_ml_assemble.js {DATE}` + `_ml_assemble_concept.js {DATE}`，输出 `mainline-YYYYMMDD.html` / `mainline_concept-YYYYMMDD.html`。下方命令为取数原语，供需要时手工核查。
- **⚠️ 板块选取必须「按周期动态取 TOP-K」，禁止再用固定12板块（2026-08-07 修复）**：`_ml_select_boards.js` 从**全市场行业板块**（与「二级 TOP10 图 / 主线汇总表」同一数据源 `_ml_sw.json` 的 sw2）按 5日/10日/20日 各自涨跌幅各取 TOP12（c_d>0），合并去重后输出 `_ml_board_codes.json`（约 19~32 个）。再对其中每个 code 跑 `_ml_board.js` 计算龙头。**原因**：旧版固定12板块是当初按5日强弱选的，导致 20日 研判时把「IT服务Ⅱ」(20日全市场仅排71、+2.34%) 误判为20日主线，而真正的20日龙头(贵金属+22.6%等)根本不在12板块里——「主线研判」与「二级 TOP10 图」用了不同样本池，互相矛盾。动态选取后两者同源，不再矛盾。
- **板块清单（东财口径）**：`ecList('m:90+t:2')` 行业板块（扁平 496 个，作明细）+ `ecList('m:90+t:3')` 概念板块（504 个）。一级组由 `_ml_l1dict.js` 关键词字典派生（21 个）。**禁止**再用 `sector ranking` / `hot board` 的概念/行业混合口径。
- **一级归属映射**：`_ml_fetch_l1map.js` 拉 31 个一级（`sector constituent <l1code>`）构建 `stockToL1`（新板块成分股多数投票得一级）。
- 板块周期涨跌幅：对 sw1/sw2 的每个 `code` 调 `quote <codes> --raw`，取 `chg_5d`/`chg_10d`/`chg_20d`（**板块级返回的是百分数**，如 `22.67` 即 22.67%，与个股级一致）。`_ml_sw.json` 中 `c5/c10/c20` 已是百分数，展示时**直接加 `%`，切勿再 ×100**（否则 22.67% 会变成 2267%）。
  ⚠️ **单位坑（2026-08-07 实证 + 复盘报告 +1000% 错误根因）**：早前笔记载「板块级返回小数需 ×100」是**错误的**。实测 `quote <sw_code>` 的 `chg_5d` 等返回的是百分数（`_ml_sw.json` 存的就是 22.67 而非 0.2267）。复盘报告「二、板块涨跌」曾因对 `_ml_sw.json` 的百分数再 ×100，导致申万行业涨跌幅显示成 +1422% / +1290% 等上千数值。修正：`_patch_review.js` 的 `pct` 与 `chartData` 一律 **不再 ×100**，与 `_ml_assemble.js` / `_ml_assemble_concept.js` 的 `fmtPct`（直接加 %）保持一致。后续任何渲染板块涨跌幅的代码，凡数据源是 `_ml_sw.json`，都按「已是百分数、直接加 %」处理。
- 各周期主力资金流入：`ranking cap_main_5d / cap_main_10d / cap_main_20d --limit 20 --raw`
- 市场概览：`market-overview --raw`（14维度评分）
- 涨跌分布：`changedist --raw`
- 重点个股多周期涨跌与总市值：`quote <代码> --raw`（含 `chg_5d`/`chg_10d`/`chg_20d` 及 `total_market_cap`）。
  ⚠️ **单位坑（关键，2026-08-06 曾踩）**：**个股级** `chg_5d`/`chg_10d`/`chg_20d` 返回的是**百分数**（如 `38.69` 表示 38.69%），与板块级的小数不同；`total_market_cap` 用于行业龙头按市值排名。展示个股涨幅时直接保留百分数原值加 `%`（**勿再 ×100**，否则会变成 3869%）。
- 区间成交总额：接口无字段，对候选成分股取 `kline <代码> --limit {N+1}` 后累加其 `amount`（5日近5根、10日近10根、20日近20根）。
- ETF 中文名：`quote <etf代码> --raw` 取 `name` 字段
- 当日新闻：使用 WebSearch 搜索当日A股市场新闻

**稳健性要求（重要，防止步骤卡死）**：调用 westock-data / westock-tool 等接口时，若某次查询超时或返回异常，**必须重试（最多 3 次，间隔 2 秒）；并将每次成功的返回结果写入本地缓存文件 `_gen_cache/<标识>.json`，下次优先读缓存、失败再回退**。务必保证单点网络故障不能让整个主线步骤挂死（2026-08-06 主线步骤即因无兜底而超时崩溃，需人工补跑，教训在前）。所有展示的涨跌幅必须来自可靠源：`sector ranking`（5日/20日）+ `quote`（10日及个股）。

**分析框架**（参考 market-mainline.md）：
- 区分四种热度：真主线（连续性强）、次级热点（持续性待验证）、脉冲题材（一日游）、跟风分支
- 梯队识别：龙头/中军/补涨/后排
- 情绪周期：冰点/修复/主升/高位震荡/退潮
- 持续性评估：弱/一般/较强/强

### Step 10: 更新清单文件 (manifest.js)

使用 add-report.js 脚本分别添加复盘、选股和主线分析记录：

```bash
# 添加复盘报告记录
"C:/Users/15921/.workbuddy/binaries/node/versions/22.22.2/node.exe" \
"C:/Users/15921/WorkBuddy/2026-08-03-21-11-02/market-review/add-report.js" \
review \
"review-YYYYMMDD.html" \
"YYYY-MM-DD" \
"周X" \
"一句话总结（如：沪指-0.59% 核电板块领涨 主力净流入26亿）"

# 添加选股结果记录
"C:/Users/15921/.workbuddy/binaries/node/versions/22.22.2/node.exe" \
"C:/Users/15921/WorkBuddy/2026-08-03-21-11-02/market-review/add-report.js" \
screening \
"screening.html" \
"YYYY-MM-DD" \
"周X" \
"双入口:技术面(趋势突破G1-N只/净利润断层G2-M只/ETF五日均强20只) + 基本面(高盈利/高成长/高股息三维度)"

# 添加主线分析记录
"C:/Users/15921/.workbuddy/binaries/node/versions/22.22.2/node.exe" \
"C:/Users/15921/WorkBuddy/2026-08-03-21-11-02/market-review/add-report.js" \
mainline \
"mainline-YYYYMMDD.html" \
"YYYY-MM-DD" \
"周X" \
"5日主线:XX 候选:XX 10日主线:XX"
```

### Step 11: JS语法检查

提取报告HTML中的JS代码做 `node --check` 验证。

### Step 12: 部署到云端（关键步骤）

使用 `workbuddy_cloudstudio_deploy` 工具：
- **directory**: `C:\Users\15921\WorkBuddy\2026-08-03-21-11-02\market-review`
- **port**: `3000`

一次部署即可，两个链接共享同一部署：
- **综合入口**: `https://55482ea31c934db48ab8c3c81ad5cbac.sh3.agentos-app.net` (→ index.html)
- **独立复盘**: `https://55482ea31c934db48ab8c3c81ad5cbac.sh3.agentos-app.net/review-only.html` (→ review-only.html，仅日期列表无汇总文字)

> 两个链接共享同一份 manifest.js 和 review-*.html，改一处两处同步生效，无需单独部署。

### Step 12b: 部署后自检（D · 防"静默没结果"）

> 部署完成后**必须**自检：向云端拉 `manifest.js`，确认当日日期已上线、index 三卡片齐全；否则部署可能未生效/被缓存遮挡。结果写入 `_automation_status.json`，供失败告警。

```bash
NODE="C:/Users/15921/.workbuddy/binaries/node/versions/22.22.2/node.exe"
"$NODE" deploy_check.mjs <YYYYMMDD>      # 退出码 0=当日已上线 / 2=manifest缺当日 / 3=云端不可达
```

若 `deploy_check` 返回非 0：重试 Step 12 部署一次，再次 `deploy_check`；仍失败则记录到自动化 memory 并告警（不要静默结束）。

### Step 13: 完成确认

确认以下事项：
1. 复盘报告已保存: `review-YYYYMMDD.html`
2. 选股结果已保存: `screening.html`（+ `screening_tech.html` / `screening_fund.html`），`screening_meta.json` 已同步至 market-review/
3. 5-20日主线分析已保存: `mainline-YYYYMMDD.html`
4. add-report.js 执行三次（review + screening + mainline），manifest.js 已更新
5. JS语法检查通过
6. 已部署到云端（一次部署，三个入口共享，固定链接不变）

## 注意事项

- 所有文本使用简体中文
- 数据必须来自实际查询结果，不得编造
- 中国股市配色: 涨=红色，跌=绿色
- HTML报告是独立文件，不依赖外部CSS/JS（除ECharts CDN外）
- **必须执行Step 12部署到云端**
- **不要手动编辑 manifest.js**，始终使用 add-report.js 脚本更新
- **add-report.js 需执行三次**：一次 review 类型，一次 screening 类型，一次 mainline 类型
- 部署后URL固定不变，用户无需更新书签
- 主线分析中5日、10日、20日结论可能不同：5日侧重短期资金与 momentum，10日侧重持续性与全周期正收益验证，20日侧重中长期趋势与主线沉淀

## 永久规则（每次必守，优先级最高）

1. **恐贪指数（自建代理）每次必更新**：
   - 数据源为沪深300日K线；`_fg_raw.json` 的 kline 字符串格式为 `日期,开,收,高,低,成交量(股)`（第6字段是**成交量**不是成交额，与历史口径一致；sina 取到的 volume 即该值）。`push2his` 从沙箱出站被 RESET 不可用，补齐当日K线用 sina API（`sh000300`）；成交额类用 eastmoney `push2delay`。
   - 先确保 `_fg_raw.json` 含当日K线（缺失则用 sina 取 `sh000300` 末根当日 OHLC + 成交量，按 `日期,开,收,高,低,成交量(股)` 追加），再 `node _fear_greed_build.mjs` **同次**重建 `fear_greed.html` 与 `fear_greed_index.js`（二者必须一致，禁止只改其一）。
   - 收盘复盘报告（review-YYYYMMDD.html）日期标签后**必须**显示当日恐贪徽标（「恐贪指数 <值> · <贪婪/中性/恐惧>」），由生成器读取 `fear_greed_index.js` 按当日日期取值自动注入（已实现于 `gen_review_0810.js`，新日期生成器须沿用同样逻辑，不得遗漏）。
   - `reviews.html` 的「代理恐贪指数（自建）」卡片**不要新建导航**，保持原有卡片即可；其最新日期/数值由 `fear_greed_index.js` 自动取最新。点击进入的 `fear_greed.html` 内容须为当日（随构建更新）。

2. **T-1 定稿版式铁律**：T 日报告必须以「T-1 交易日已打磨定稿的版本」为**格式与结构模板**，覆盖：每日复盘报告、5-20日主线分析（行业+题材）、条件选股 三者。新需求（如恐贪指数）作为**增量叠加**，不改变既有版式。若 T 为周一，则 T-1 为上周五（最近一个已定稿交易日）。**严禁每次"重新发明"格式**——此前曾因自创格式被用户驳回。

3. **关机纪律**：本自动化（含 blk 生成与云端部署）必须**完整跑完后再结束**。若系统设有「16:00 自动关闭 WorkBuddy」，务必等本任务（四份报告 + manifest + blk + 部署）全部完成后才关机；**切勿在生成中途（即便已超过 16:00）强制关闭而中断任务**。宁可延后关机，也不要中断。

4. **评分列不得为 N/A（技术评分 / 综合评分 · 条件选股第一组）**：
   - 根因：原评分来自腾讯自选股 westock 内置 `score` 命令，该内置技能在 2026-08 应用重打包后被移除，导致 8/10 起数据缺失、页面显示 `N/A`。
   - **现状替代方案（已实现，透明可复现）**：`g1_score.js` 基于真实行情数据（kline 新浪 / 今日报价 东方财富 push2delay / 净利润同比 东方财富 RPT）计算 `技术评分`(0-100) 与 `综合评分`(0-100)，经 `build_screening_data.js` 写入 `_g1_breakthrough_*.json`(字段 `tecScore`/`compScore`) 与 `_g1_tecscore_*.json`(字段 `代码/名称/技术评分/综合评分`)，再由 `_gen_screening_*.js` 渲染。
   - **禁止在任何生成器中把评分硬编码为 `'N/A'` 占位**；若某股票数据不足（kline < 61 根）确实算不出，才可回退 `'N/A'` 并注明原因。
   - **若用户已连接 `westock-mcp`（腾讯自选股 MCP）**：其 `data_score` 可恢复官方评分，届时优先取官方值、用自算值兜底，并在报告注明数据来源。
