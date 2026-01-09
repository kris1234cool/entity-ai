#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
声音复刻脚本 - 用于首次上传音频时生成 Voice ID
用法: python3 enroll_voice.py "AudioURL" "Prefix"
"""
import sys
import os
import dashscope
from dashscope.audio.tts_v2 import VoiceEnrollmentService

def main():
    if len(sys.argv) < 3:
        print("Error: Missing arguments")
        print("Usage: python3 enroll_voice.py <AudioURL> <Prefix>")
        sys.exit(1)

    audio_url = sys.argv[1]
    prefix = sys.argv[2]
    api_key = os.getenv("DASHSCOPE_API_KEY")

    if not api_key:
        print("Error: DASHSCOPE_API_KEY not found in environment")
        sys.exit(1)

    dashscope.api_key = api_key
    target_model = "cosyvoice-v3-plus"

    try:
        service = VoiceEnrollmentService()
        voice_id = service.create_voice(
            target_model=target_model,
            prefix=prefix,
            url=audio_url,
            language_hints=['zh']
        )
        # 必须输出 SUCCESS 前缀供 Node.js 捕获
        print(f"SUCCESS:{voice_id}")
    except Exception as e:
        print(f"ERROR:{str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()
