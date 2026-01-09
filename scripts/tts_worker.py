#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TTS 合成脚本 - 用于生成视频时合成 MP3 音频
用法: python3 tts_worker.py "Text" "VoiceID" "OutputPath" ["Model"]
Model 可选，默认 cosyvoice-v3-plus
"""
import sys
import os
import dashscope
from dashscope.audio.tts_v2 import SpeechSynthesizer

def main():
    if len(sys.argv) < 4:
        print("Error: Missing arguments")
        print("Usage: python3 tts_worker.py <Text> <VoiceID> <OutputPath> [Model]")
        sys.exit(1)

    text = sys.argv[1]
    voice_id = sys.argv[2]
    output_path = sys.argv[3]
    # 接收第 4 个参数 model，默认 cosyvoice-v3-plus
    model = sys.argv[4] if len(sys.argv) > 4 else "cosyvoice-v3-plus"
    
    api_key = os.getenv("DASHSCOPE_API_KEY")

    if not api_key:
        print("Error: DASHSCOPE_API_KEY not found in environment")
        sys.exit(1)

    dashscope.api_key = api_key

    try:
        # 打印正在使用的模型，方便调试
        print(f"🎙️ Generating with Model: {model}, Voice: {voice_id}")
        synthesizer = SpeechSynthesizer(model=model, voice=voice_id)
        audio = synthesizer.call(text)
        with open(output_path, 'wb') as f:
            f.write(audio)
        print("SUCCESS")
    except Exception as e:
        print(f"ERROR:{str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()
