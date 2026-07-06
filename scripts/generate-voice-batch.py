import json
import subprocess
import sys

import torchaudio as ta
from chatterbox.mtl_tts import ChatterboxMultilingualTTS

REF_AUDIO = "scripts/_voice_sample/ref_clean.wav"
TEMPO = "0.85"


def main():
    if len(sys.argv) != 2:
        print("usage: generate-voice-batch.py <batch-json-path>")
        sys.exit(1)

    batch_path = sys.argv[1]
    with open(batch_path, encoding="utf-8") as f:
        items = json.load(f)

    print(f"loading model... ({len(items)} items in {batch_path})")
    model = ChatterboxMultilingualTTS.from_pretrained(device="cpu")

    for i, item in enumerate(items):
        qid = item["id"]
        text = item["ttsText"]
        print(f"[{i + 1}/{len(items)}] generating {qid}...")
        wav = model.generate(
            text,
            language_id="ko",
            audio_prompt_path=REF_AUDIO,
            exaggeration=0.3,
            cfg_weight=0.65,
            temperature=0.6,
            repetition_penalty=1.5,
        )
        wav_path = f"scripts/_voice_sample/{qid}.wav"
        ta.save(wav_path, wav, model.sr)

        mp3_path = f"app/voice/{qid}.mp3"
        subprocess.run(
            [
                "ffmpeg", "-y", "-i", wav_path,
                "-filter:a", f"atempo={TEMPO}",
                "-codec:a", "libmp3lame", "-qscale:a", "4",
                mp3_path,
            ],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        print(f"  -> {mp3_path}")

    print("batch done")


if __name__ == "__main__":
    main()
