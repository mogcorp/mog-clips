"""MOG clip factory. Two modes, driven by work/job.json:
scan:   download the source, transcribe it, write out/transcript.json (n8n asks Claude to pick moments from it)
render: download the source, cut each moment, transcribe it word by word, render with Remotion to out/<id>.mp4
"""
import json, os, re, subprocess, sys, glob, shutil

def sh(cmd):
    print('+', ' '.join(cmd), flush=True)
    subprocess.run(cmd, check=True)

def fetch(src, dest='work/source.mp4'):
    os.makedirs('work', exist_ok=True)
    if os.path.exists(dest):
        return dest
    if 'drive.google.com' in src:
        import gdown
        if '/folders/' in src:
            gdown.download_folder(url=src, output='work/drive', quiet=True)
            vids = sorted(glob.glob('work/drive/**/*.mp4', recursive=True) + glob.glob('work/drive/**/*.mov', recursive=True), key=os.path.getsize, reverse=True)
            if not vids: raise SystemExit('no video in drive folder')
            shutil.move(vids[0], dest)
        else:
            m = re.search(r'/d/([A-Za-z0-9_-]+)', src) or re.search(r'[?&]id=([A-Za-z0-9_-]+)', src)
            if not m: raise SystemExit('cannot read drive file id')
            out = gdown.download(id=m.group(1), output=dest, quiet=True)
            if not out or not os.path.exists(dest): raise SystemExit('drive download failed (is the file shared publicly?)')
        print('downloaded', os.path.getsize(dest), 'bytes', flush=True)
    elif re.search(r'\.(mp4|mov|m4v|webm)(\?|$)', src):
        sh(['curl', '-L', '--fail', '-o', dest, src])
    else:
        # live and VOD sources (Twitch, Kick): only the newest video, and only a window of it so long streams fit the run
        cmd = ['yt-dlp', '-f', 'bv*[height<=1080]+ba/b[height<=1080]/b', '--merge-output-format', 'mp4', '--playlist-items', '1', '-o', dest]
        sec = JOB.get('section')
        if not sec and re.search(r'twitch\.tv|kick\.com', src):
            sec = [0, 5400]
        if sec:
            cmd += ['--download-sections', '*%d-%d' % (int(sec[0]), int(sec[1])), '--force-keyframes-at-cuts']
        sh(cmd + [src])
    return dest

def model(size):
    from faster_whisper import WhisperModel
    return WhisperModel(size, device='cpu', compute_type='int8')

def scan(job):
    src = fetch(job['source'])
    m = model(job.get('model', 'base'))
    segs, info = m.transcribe(src, vad_filter=True, beam_size=1)
    out = [[round(s.start, 1), round(s.end, 1), s.text.strip()] for s in segs]
    dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', src], capture_output=True, text=True).stdout.strip() or 0)
    os.makedirs('out', exist_ok=True)
    json.dump({'source': job['source'], 'duration': dur, 'language': info.language, 'segments': out}, open('out/transcript.json', 'w'))
    print('segments', len(out))

def render(job):
    src = fetch(job['source'])
    os.makedirs('public', exist_ok=True)
    m = model(job.get('model', 'small'))
    clips = []
    for c in job['clips']:
        cid = re.sub(r'[^a-z0-9-]', '', c['id'].lower())[:60]
        s, e = float(c['start']), float(c['end'])
        f = f'public/{cid}.mp4'
        sh(['ffmpeg', '-y', '-loglevel', 'error', '-ss', str(s), '-i', src, '-t', str(e - s), '-vf', 'scale=-2:min(1080\\,ih),fps=30', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-c:a', 'aac', '-b:a', '160k', f])
        segs, _ = m.transcribe(f, word_timestamps=True, vad_filter=False, beam_size=1)
        words = [{'w': w.word.strip(), 's': round(w.start, 2), 'e': round(w.end, 2)} for sg in segs for w in (sg.words or []) if w.word.strip()]
        clips.append({'id': cid, 'file': f'{cid}.mp4', 'duration': round(e - s, 2), 'hook': c.get('hook', ''), 'credit': c.get('credit', ''), 'layout': c.get('layout', 'fit'), 'words': words})
    json.dump({'clips': clips}, open('work/render.json', 'w'))
    sh(['node', 'render.mjs', 'work/render.json'])
    json.dump([{k: v for k, v in c.items() if k != 'words'} for c in clips], open('out/clips.json', 'w'))

JOB = {}

if __name__ == '__main__':
    job = json.load(open(sys.argv[1] if len(sys.argv) > 1 else 'work/job.json'))
    JOB.update(job)
    (scan if job.get('mode') == 'scan' else render)(job)
