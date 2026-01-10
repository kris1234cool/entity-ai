#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TTS 合成脚本 - 用于生成视频时合成 MP3 音频
用法: python3 tts_worker.py "Text/Base64" "VoiceID" "OutputPath" ["Model"] [--base64]
Model 可选，默认 cosyvoice-v3-plus
支持 Base64 编码输入（--base64 参数）
"""
import sys
import os
import base64
import dashscope
from dashscope.audio.tts_v2 import SpeechSynthesizer

def main():
    if len(sys.argv) < 4:
        print("Error: Missing arguments")
        print("Usage: python3 tts_worker.py <Text/Base64> <VoiceID> <OutputPath> [Model] [--base64]")
        sys.exit(1)

    raw_text = sys.argv[1]
    voice_id = sys.argv[2]
    output_path = sys.argv[3]
    
    # 接收第 4 个参数 model，默认 cosyvoice-v3-plus
    model = sys.argv[4] if len(sys.argv) > 4 and not sys.argv[4].startswith('--') else "cosyvoice-v3-plus"
    
    # 检查是否使用 Base64 编码
    is_base64 = "--base64" in sys.argv
    
    # 解码文本
    if is_base64:
        try:
            text = base64.b64decode(raw_text).decode('utf-8')
            print(f"📦 Base64 decoded, length: {len(text)}")
        except Exception as e:
            print(f"ERROR: Base64 decode failed: {e}")
            sys.exit(1)
    else:
        text = raw_text
    
    api_key = os.getenv("DASHSCOPE_API_KEY")

    if not api_key:
        print("Error: DASHSCOPE_API_KEY not found in environment")
        sys.exit(1)

    dashscope.api_key = api_key

    try:
        # 打印调试信息
        print(f"🎙️ Model: {model}, Voice: {voice_id}")
        print(f"📝 Text preview: {text[:80]}..." if len(text) > 80 else f"📝 Text: {text}")
        
        # 创建合成器
        synthesizer = SpeechSynthesizer(
            model=model, 
            voice=voice_id
        )
        
        # 调用合成（纯文本模式，CosyVoice 不支持 SSML）
        audio = synthesizer.call(text)
        
        if audio is None:
            print("ERROR: TTS returned None")
            sys.exit(1)
        
        with open(output_path, 'wb') as f:
            f.write(audio)
        print(f"SUCCESS - {len(audio)} bytes")
    except Exception as e:
        print(f"ERROR:{str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()
