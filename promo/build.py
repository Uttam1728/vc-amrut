# Assemble the promo: frames (ffconcat) trimmed at the start marker + each voice line at its slot → vachanamrut-promo.mp4
import json, subprocess
T = json.load(open("timing.json")); start = float(open("start.txt").read())
offs, t = [], 0
for s in T["slots"]: offs.append(t); t += s
total = t
ins, flt = [], []
for i in range(len(offs)):
    ins += ["-i", f"voice/{i+1}.mp3"]
    ms = int((offs[i] + 0.2) * 1000)
    flt.append(f"[{i+1}:a]adelay={ms}|{ms}[a{i}]")
mix = "".join(f"[a{i}]" for i in range(len(offs))) + f"amix=inputs={len(offs)}:normalize=0,apad,atrim=0:{total:.2f},afade=t=out:st={total-0.6:.2f}:d=0.6[aout]"
v = (f"[0:v]settb=1/1000,setpts=PTS-STARTPTS,fps=30,tpad=stop_mode=clone:stop_duration=5,trim=start={start:.3f}:duration={total:.2f},"
     "setpts=PTS-STARTPTS,scale=1080:1920:flags=lanczos,format=yuv420p,fade=t=in:st=0:d=0.3[vout]")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", "frames.txt", *ins, "-filter_complex", ";".join([v, *flt, mix]),
                "-map", "[vout]", "-map", "[aout]", "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-profile:v", "high",
                "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", "vachanamrut-promo.mp4"], check=True)
print(f"vachanamrut-promo.mp4 · {total:.1f}s")
