#!/usr/bin/env node
/**
 * add-report.js - 向 manifest.js 添加或更新复盘报告/选股/主线分析记录
 *
 * 用法:
 *   node add-report.js <类型> <文件名> <日期YYYY-MM-DD> <星期几> <摘要>
 *
 * 类型: review, screening 或 mainline
 *
 * 示例:
 *   node add-report.js review review-20260804.html 2026-08-04 周二 "沪指+0.5% 核电继续领涨"
 *   node add-report.js screening screening-20260804.html 2026-08-04 周二 "第一组8只 第二组3只"
 *   node add-report.js mainline mainline-20260804.html 2026-08-04 周二 "5日主线:算力 10日主线:传媒"
 */

const fs = require('fs');
const path = require('path');

const manifestPath = path.join(__dirname, 'manifest.js');

var TYPE_MAP = {
  review:    { fileKey: 'reviewFile',    summaryKey: 'reviewSummary',    label: '复盘报告' },
  screening: { fileKey: 'screeningFile', summaryKey: 'screeningSummary', label: '选股' },
  mainline:  { fileKey: 'mainlineFile',  summaryKey: 'mainlineSummary',  label: '主线分析' }
};

const args = process.argv.slice(2);
if (args.length < 5) {
  console.error('用法: node add-report.js <review|screening|mainline> <文件名> <日期> <星期> <摘要>');
  process.exit(1);
}

var type = args[0];
var file = args[1];
var date = args[2];
var weekday = args[3];
var summary = args[4];

var typeInfo = TYPE_MAP[type];
if (!typeInfo) {
  console.error('类型必须是 review, screening 或 mainline');
  process.exit(1);
}

// 读取现有 manifest.js
var content = fs.readFileSync(manifestPath, 'utf-8');

// 解析现有 REPORTS 数组
var reports;
try {
  var match = content.match(/window\.REPORTS\s*=\s*(\[[\s\S]*\]);/);
  if (match) {
    reports = JSON.parse(match[1]);
  } else {
    reports = [];
  }
} catch (e) {
  reports = [];
}

// 检查是否已有该日期的记录
var existingIdx = reports.findIndex(function(r) { return r.date === date; });

if (existingIdx >= 0) {
  // 更新现有记录
  reports[existingIdx][typeInfo.fileKey] = file;
  reports[existingIdx][typeInfo.summaryKey] = summary;
  // 确保 weekday 存在
  if (!reports[existingIdx].weekday) {
    reports[existingIdx].weekday = weekday;
  }
  console.log('已更新 ' + date + ' 的' + typeInfo.label + '记录');
} else {
  // 新增记录
  var newEntry = { date: date, weekday: weekday };
  Object.keys(TYPE_MAP).forEach(function(t) {
    var info = TYPE_MAP[t];
    if (t === type) {
      newEntry[info.fileKey] = file;
      newEntry[info.summaryKey] = summary;
    } else {
      newEntry[info.fileKey] = '';
      newEntry[info.summaryKey] = '';
    }
  });
  reports.push(newEntry);
  console.log('已添加 ' + date + ' 的' + typeInfo.label + '记录');
}

// 按日期降序排序
reports.sort(function(a, b) { return b.date.localeCompare(a.date); });

// 写入新的 manifest.js
var newContent = '/**\n' +
  ' * A股每日复盘+选股+主线分析清单\n' +
  ' * 每条记录: { date, weekday, reviewFile, reviewSummary, screeningFile, screeningSummary, mainlineFile, mainlineSummary }\n' +
  ' * reviews.html 读取 reviewFile/reviewSummary 渲染日期列表\n' +
  ' * screening.html 读取 screeningFile/screeningSummary 渲染日期列表\n' +
  ' * mainlines.html 读取 mainlineFile/mainlineSummary 渲染日期列表\n' +
  ' */\n' +
  'window.REPORTS = ' + JSON.stringify(reports, null, 2) + ';\n';

fs.writeFileSync(manifestPath, newContent, 'utf-8');
console.log('manifest.js 已更新，共 ' + reports.length + ' 条记录');

// 主线摘要防漂移：add-report 的摘要为手写，可能带入"候选"或错标。
// 主线(行业/概念)条目写入后，自动调用 _gen_ml_summary.mjs 从真实 periods 重写
// conceptSummary / mainlineSummary（只列主线、无候选），覆盖手写摘要。
if (type === 'mainline') {
  try {
    const { execSync } = require('child_process');
    const root = path.resolve(__dirname, '..');
    const compact = date.replace(/-/g, '');
    execSync('"' + process.execPath + '" _gen_ml_summary.mjs ' + compact, { cwd: root, stdio: 'inherit' });
  } catch (e) {
    console.error('[add-report] 摘要自动生成失败(非致命):', e.message);
  }
}
