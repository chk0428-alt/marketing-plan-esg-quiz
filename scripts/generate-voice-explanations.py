import sys
import torchaudio as ta
from chatterbox.mtl_tts import ChatterboxMultilingualTTS

REF_AUDIO = "scripts/_voice_sample/ref_clean.wav"
TEMPO = 0.85

QUESTIONS = {
    "q001": "애터미의 4대 수당은 후원수당, 직급수당, 승급 유지 프로모션, 교육수당입니다. 리더십수당은 존재하지 않는 명칭입니다.",
    "q002": "후원수당은 좌 우 소실적을 기반으로 매일 정산되는 점수제 수당입니다.",
    "q003": "직급수당은 7개 직급 체계를 기준으로 월 2회, 7일과 22일에 지급됩니다.",
    "q004": "교육수당은 센터 소속회원이 일으킨 PV 총합에 육 퍼센트를 곱해 원화로 산정합니다.",
    "q005": "법적 지급 한도는 총 매출액의 삼십오 퍼센트입니다.",
}


def main():
    model = ChatterboxMultilingualTTS.from_pretrained(device="cpu")
    for qid, text in QUESTIONS.items():
        print(f"generating {qid}...")
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
        print(f"  -> {wav_path} (run ffmpeg -filter:a atempo={TEMPO} to slow down + convert to app/voice/{qid}.mp3)")


if __name__ == "__main__":
    main()
