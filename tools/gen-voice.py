#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""《拆台》narrator voice generator.

Reads assets/narrator-lines.json, synthesizes every unique line id to
assets/voice/<id>.mp3 with the edge-tts CLI (offline script, online TTS
endpoint), then writes assets/voice.js (single-line window.NARRATOR_AUDIO map).

Idempotent: an existing mp3 larger than 2KB is skipped. Chinese text is only
ever passed as a subprocess argv element (never through a shell string).

Usage:
  <python> tools/gen-voice.py            # full run (skips already-done files)
  <python> tools/gen-voice.py --only <id>  # single line, for connectivity test
  <python> tools/gen-voice.py --no-voice-js  # skip writing voice.js

Only touches: tools/gen-voice.py, assets/voice/, assets/voice.js.
"""
import argparse
import json
import os
import subprocess
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # D:\2006L\chaitai
JSON_PATH = os.path.join(ROOT, "assets", "narrator-lines.json")
OUT_DIR = os.path.join(ROOT, "assets", "voice")
VOICE_JS = os.path.join(ROOT, "assets", "voice.js")

PY = r"D:\2006L\open-llm-vtuber\.venv\Scripts\python.exe"
DEFAULT_VOICE = "zh-CN-YunjianNeural"
MIN_SIZE = 2 * 1024  # >2KB counts as done
RETRIES = 3  # 原样重试最多 3 次
RETRY_DELAY = 3.0  # seconds between retries


def load_lines():
    """Return (voice, ordered {id: (text, tts_or_None)})."""
    with open(JSON_PATH, encoding="utf-8") as f:
        data = json.load(f)
    voice = ((data.get("meta") or {}).get("voice") or {}).get("suggest") or DEFAULT_VOICE
    items = {}
    for _key, entry in (data.get("lines") or {}).items():
        for tier in entry.get("tiers", []):
            for item in tier:
                iid = item["id"]
                text = item["text"]
                tts = item.get("tts")
                prev = items.get(iid)
                if prev is not None and (prev[0] != text or prev[1] != tts):
                    sys.exit("CONFLICT: id %s appears with differing text/tts" % iid)
                items[iid] = (text, tts)
    return voice, items


def run_tts(voice, text, tts, out_path, env=None):
    cmd = [PY, "-m", "edge_tts", "--voice=" + voice]
    if tts:
        rate = tts.get("rate")
        pitch = tts.get("pitch")
        if rate:
            cmd.append("--rate=" + str(rate))
        if pitch:
            cmd.append("--pitch=" + str(pitch))
    cmd += ["--text", text, "--write-media", out_path]
    return subprocess.run(cmd, capture_output=True, env=env, cwd=OUT_DIR)


def size_ok(path):
    return os.path.exists(path) and os.path.getsize(path) > MIN_SIZE


def show_err(tag, proc):
    err = (proc.stderr or b"").decode("utf-8", errors="replace").strip()
    print("[%s] rc=%s stderr: %s" % (tag, proc.returncode, err), flush=True)


def gen_one(voice, iid, text, tts, out_path):
    if size_ok(out_path):
        return ("skip", os.path.getsize(out_path))
    last = None
    for attempt in range(RETRIES + 1):  # initial + up to 3 as-is retries
        if os.path.exists(out_path):
            os.remove(out_path)  # drop any partial leftover
        proc = run_tts(voice, text, tts, out_path)
        if proc.returncode == 0 and size_ok(out_path):
            return ("ok", os.path.getsize(out_path))
        last = proc
        show_err("%s attempt %d/%d" % (iid, attempt + 1, RETRIES + 1), proc)
        if attempt < RETRIES:
            time.sleep(RETRY_DELAY)
    # Last resort: retry once with proxy disabled (no_proxy='*').
    env = dict(os.environ)
    env["no_proxy"] = "*"
    env["NO_PROXY"] = "*"
    proc = run_tts(voice, text, tts, out_path, env=env)
    if proc.returncode == 0 and size_ok(out_path):
        return ("ok-noproxy", os.path.getsize(out_path))
    show_err("%s no_proxy='*' attempt" % iid, proc)
    print("FAILED id=%s after %d attempts + no_proxy attempt" % (iid, RETRIES + 1), flush=True)
    sys.exit(2)


def write_voice_js(ids):
    missing = sorted(i for i in ids if not size_ok(os.path.join(OUT_DIR, i + ".mp3")))
    if missing:
        print("voice.js NOT written, %d mp3 missing/undersized: %s" % (len(missing), ",".join(missing)), flush=True)
        return 1
    mapping = {i: "assets/voice/%s.mp3" % i for i in sorted(ids)}
    line = "window.NARRATOR_AUDIO = " + json.dumps(mapping, ensure_ascii=False, separators=(",", ":")) + ";\n"
    with open(VOICE_JS, "w", encoding="utf-8", newline="\n") as f:
        f.write(line)
    print("wrote %s (%d keys, %d bytes)" % (VOICE_JS, len(mapping), len(line.encode("utf-8"))), flush=True)
    return 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", metavar="ID", help="generate just this one line id")
    ap.add_argument("--no-voice-js", action="store_true", help="skip writing assets/voice.js")
    args = ap.parse_args()

    voice, items = load_lines()
    print("json: %s" % JSON_PATH)
    print("voice: %s   unique ids: %d" % (voice, len(items)))
    os.makedirs(OUT_DIR, exist_ok=True)

    if args.only:
        if args.only not in items:
            sys.exit("unknown id: %s" % args.only)
        text, tts = items[args.only]
        out_path = os.path.join(OUT_DIR, args.only + ".mp3")
        status, size = gen_one(voice, args.only, text, tts, out_path)
        print("single: id=%s status=%s size=%d -> %s" % (args.only, status, size, out_path), flush=True)
        return 0

    done = skipped = 0
    for n, iid in enumerate(sorted(items), 1):
        text, tts = items[iid]
        out_path = os.path.join(OUT_DIR, iid + ".mp3")
        status, size = gen_one(voice, iid, text, tts, out_path)
        if status == "skip":
            skipped += 1
        else:
            done += 1
        print("[%d/%d] %s %s %dB" % (n, len(items), iid, status, size), flush=True)

    print("generated=%d skipped=%d total=%d" % (done, skipped, len(items)), flush=True)
    if args.no_voice_js:
        return 0
    return write_voice_js(items)


if __name__ == "__main__":
    sys.exit(main())
