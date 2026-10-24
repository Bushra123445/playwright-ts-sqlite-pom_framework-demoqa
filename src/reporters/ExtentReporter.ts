import type { Reporter, FullConfig, Suite, TestCase, TestResult, TestStep, FullResult } from '@playwright/test/reporter';
import fs from 'fs';
import path from 'path';

interface Options { outputFile?: string; title?: string }
interface DbInfo { source: string; query: string; record: Record<string, unknown> }
interface Row {
  title: string; status: string; duration: number; retry: number;
  steps: { title: string; ok: boolean; duration: number; error?: string; depth: number }[];
  shots: { name: string; data: string }[];
  videos: string[];
  db?: DbInfo;
  error?: string;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const strip = (s: string) => s.replace(/\u001b\[[0-9;]*m/g, '');

/** Extent-Report style HTML reporter (dashboard + DB data + steps + screenshots + video). */
export default class ExtentReporter implements Reporter {
  private rows: Row[] = [];
  private start = Date.now();
  private env: Record<string, string> = {};
  private outFile: string;
  private outDir: string;
  private videoCount = 0;

  constructor(private opts: Options = {}) {
    this.outFile = path.resolve(opts.outputFile ?? 'extent-report/index.html');
    this.outDir = path.dirname(this.outFile);
  }

  onBegin(config: FullConfig, _suite: Suite) {
    this.start = Date.now();
    fs.rmSync(path.join(this.outDir, 'videos'), { recursive: true, force: true });
    this.env = { Browser: config.projects.map(p => p.name).join(', '), 'Base URL': String(config.projects[0]?.use?.baseURL ?? ''), Node: process.version, OS: process.platform };
  }

  onTestEnd(test: TestCase, result: TestResult) {
    // keep only the final attempt of each test
    this.rows = this.rows.filter(r => r.title !== test.titlePath().slice(1).join(' > '));
    const steps: Row['steps'] = [];
    const walk = (list: TestStep[], depth: number) => {
      for (const s of list) {
        if (s.category === 'test.step') {
          steps.push({ title: s.title, ok: !s.error, duration: s.duration, error: s.error?.message ? strip(s.error.message) : undefined, depth });
          walk(s.steps, depth + 1);
        } else walk(s.steps, depth);
      }
    };
    walk(result.steps, 0);

    const shots: Row['shots'] = [];
    const videos: string[] = [];
    let db: DbInfo | undefined;
    for (const a of result.attachments) {
      if (a.name === 'db-data' && a.body) {
        try { db = JSON.parse(a.body.toString('utf8')); } catch { /* ignore */ }
      } else if (a.contentType.startsWith('image/')) {
        const buf = a.body ?? (a.path ? fs.readFileSync(a.path) : undefined);
        if (buf) shots.push({ name: a.name, data: `data:${a.contentType};base64,${buf.toString('base64')}` });
      } else if (a.contentType.startsWith('video/') && a.path && fs.existsSync(a.path)) {
        fs.mkdirSync(path.join(this.outDir, 'videos'), { recursive: true });
        const name = `video-${++this.videoCount}${path.extname(a.path) || '.webm'}`;
        fs.copyFileSync(a.path, path.join(this.outDir, 'videos', name));
        videos.push(`videos/${name}`);
      }
    }
    this.rows.push({
      title: test.titlePath().slice(1).join(' > '),
      status: result.status, duration: result.duration, retry: result.retry,
      steps, shots, videos, db, error: result.error?.message ? strip(result.error.message) : undefined,
    });
  }

  onEnd(result: FullResult) {
    fs.mkdirSync(this.outDir, { recursive: true });
    const total = this.rows.length;
    const passed = this.rows.filter(r => r.status === 'passed').length;
    const skipped = this.rows.filter(r => r.status === 'skipped').length;
    const failed = total - passed - skipped;
    const pct = total ? Math.round((passed / total) * 100) : 0;
    const dur = ((Date.now() - this.start) / 1000).toFixed(1);
    const badge = (s: string) => `<span class="b ${s === 'passed' ? 'p' : s === 'skipped' ? 's' : 'f'}">${s.toUpperCase()}</span>`;

    const dbBlock = (d?: DbInfo) => !d ? '' : `
      <div class="db">
        <h4>🗄️ Test data picked from database</h4>
        <div class="meta"><b>File:</b> ${esc(String(d.source))}<br><b>Query:</b> <code>${esc(String(d.query))}</code></div>
        <table><tr><th>Column</th><th>Value from DB</th></tr>
        ${Object.entries(d.record).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(String(v))}</td></tr>`).join('')}
        </table>
      </div>`;

    const tests = this.rows.map(r => `
      <details class="t ${r.status === 'passed' ? 'tp' : r.status === 'skipped' ? 'ts' : 'tf'}" ${r.status !== 'passed' ? 'open' : ''}>
        <summary>${badge(r.status)} <b>${esc(r.title)}</b> <i>${(r.duration / 1000).toFixed(2)}s${r.retry ? ` · retry #${r.retry}` : ''}</i></summary>
        <div class="body">
          ${dbBlock(r.db)}
          <h4>Steps</h4>
          <ol class="steps">${r.steps.map(s => `<li style="margin-left:${s.depth * 18}px" class="${s.ok ? 'ok' : 'bad'}">${s.ok ? '✔' : '✘'} ${esc(s.title)} <i>(${s.duration}ms)</i>${s.error ? `<pre>${esc(s.error)}</pre>` : ''}</li>`).join('')}</ol>
          ${r.error ? `<pre class="err">${esc(r.error)}</pre>` : ''}
          ${r.videos.length ? `<h4>🎥 Video recording</h4>${r.videos.map(v => `<video controls preload="metadata" src="${v}" width="560"></video>`).join('')}` : ''}
          ${r.shots.length ? `<h4>Screenshots</h4><div class="shots">${r.shots.map(s => `<figure><img src="${s.data}" loading="lazy"><figcaption>${esc(s.name)}</figcaption></figure>`).join('')}</div>` : ''}
        </div>
      </details>`).join('');

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(this.opts.title ?? 'Test Report')}</title>
<style>
*{box-sizing:border-box}body{font-family:Segoe UI,Arial,sans-serif;margin:0;background:#f1f3f6;color:#222}
header{background:#1f2a44;color:#fff;padding:18px 28px}header h1{margin:0;font-size:22px}header small{opacity:.7}
main{padding:24px 28px;max-width:1200px;margin:auto}
.cards{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:20px}
.card{background:#fff;border-radius:8px;padding:16px 22px;min-width:150px;box-shadow:0 1px 3px #0002}
.card h2{margin:0;font-size:30px}.card span{color:#666;font-size:13px}
.green{color:#2e9e4f}.red{color:#d93a3a}.grey{color:#888}
.bar{height:10px;background:#e3e6ea;border-radius:6px;overflow:hidden;margin:6px 0 20px}.bar div{height:100%;background:#2e9e4f}
.env{background:#fff;border-radius:8px;padding:12px 18px;margin-bottom:20px;box-shadow:0 1px 3px #0002;font-size:13px}.env b{margin-right:4px}.env span{margin-right:22px}
.t{background:#fff;border-radius:8px;margin-bottom:10px;border-left:5px solid #2e9e4f;box-shadow:0 1px 3px #0002}
.t.tf{border-color:#d93a3a}.t.ts{border-color:#999}
summary{cursor:pointer;padding:12px 16px}summary i{color:#777;margin-left:10px;font-size:12px}
.b{display:inline-block;color:#fff;border-radius:4px;padding:2px 8px;font-size:11px;margin-right:8px}.b.p{background:#2e9e4f}.b.f{background:#d93a3a}.b.s{background:#999}
.body{padding:4px 18px 16px}.body h4{margin:16px 0 6px;font-size:14px;color:#1f2a44}
.steps{list-style:none;padding:0;margin:0 0 10px}.steps li{padding:3px 0;font-size:14px}.steps li i{color:#888;font-size:12px}
.ok{color:#1d7a3b}.bad{color:#c62828}pre{background:#fbeaea;padding:10px;border-radius:6px;white-space:pre-wrap;font-size:12px}
.db{background:#eef5ff;border:1px solid #c9dcf7;border-radius:8px;padding:6px 14px 12px}.db .meta{font-size:12px;color:#444;margin-bottom:8px;word-break:break-all}
.db table{border-collapse:collapse;font-size:13px}.db td,.db th{border:1px solid #c9dcf7;padding:4px 10px;text-align:left}.db th{background:#dbe8fb}
video{display:block;margin:6px 0;border-radius:6px;background:#000}
.shots{display:flex;gap:14px;flex-wrap:wrap}figure{margin:0}figure img{max-width:380px;border:1px solid #ddd;border-radius:6px}figcaption{font-size:12px;color:#666}
</style></head><body>
<header><h1>${esc(this.opts.title ?? 'Test Report')}</h1><small>Generated ${new Date().toLocaleString()} · Run status: ${result.status}</small></header>
<main>
<div class="cards">
 <div class="card"><h2>${total}</h2><span>Total tests</span></div>
 <div class="card"><h2 class="green">${passed}</h2><span>Passed</span></div>
 <div class="card"><h2 class="red">${failed}</h2><span>Failed</span></div>
 <div class="card"><h2 class="grey">${skipped}</h2><span>Skipped</span></div>
 <div class="card"><h2>${pct}%</h2><span>Pass rate</span></div>
 <div class="card"><h2>${dur}s</h2><span>Duration</span></div>
</div>
<div class="bar"><div style="width:${pct}%"></div></div>
<div class="env">${Object.entries(this.env).map(([k, v]) => `<span><b>${esc(k)}:</b>${esc(v)}</span>`).join('')}</div>
${tests}
</main></body></html>`;
    fs.writeFileSync(this.outFile, html);
    console.log(`\nExtent-style report: ${this.outFile}`);
  }
}