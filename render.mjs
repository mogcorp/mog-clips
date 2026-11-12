// Renders every clip in job file (default work/job.json) to out/<id>.mp4
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import fs from 'fs'; import path from 'path';
const jobFile = process.argv[2] || 'work/job.json';
const job = JSON.parse(fs.readFileSync(jobFile, 'utf8'));
fs.mkdirSync('out', { recursive: true });
const browserExecutable = process.env.CHROME_PATH || null;
const serveUrl = await bundle({ entryPoint: path.resolve('src/index.jsx'), publicDir: path.resolve('public') });
for (const c of job.clips) {
  if (!c.file || !fs.existsSync(path.join('public', c.file))) { console.log('skip', c.id, 'no cut file'); continue; }
  const inputProps = { src: c.file, hook: c.hook || '', words: c.words || [], credit: c.credit || '', duration: c.duration, layout: c.layout || 'fit' };
  const composition = await selectComposition({ serveUrl, id: 'Clip', inputProps, browserExecutable });
  const out = `out/${c.id}.mp4`;
  await renderMedia({ composition, serveUrl, codec: 'h264', outputLocation: out, inputProps, crf: 20, x264Preset: 'veryfast', concurrency: null, browserExecutable });
  console.log('rendered', out);
}
