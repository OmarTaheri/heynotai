"""Free-tier audio deepfake inference endpoint for HeyNotAI.

Deploy with `modal deploy deploy/modal/audio_detector.py` after creating the
`heynotai-audio-api` Modal secret described in README.md. The model is baked
into the container image, so cold starts do not download weights.
"""

import os
import tempfile
from pathlib import Path

import modal

MODEL_ID = "MelodyMachine/Deepfake-audio-detection-V2"
MAX_UPLOAD_BYTES = 50 * 1024 * 1024


def download_model() -> None:
    from transformers import AutoModelForAudioClassification, AutoProcessor

    AutoProcessor.from_pretrained(MODEL_ID)
    AutoModelForAudioClassification.from_pretrained(MODEL_ID)


runtime_image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg", "libsndfile1")
    .pip_install(
        "fastapi[standard]==0.116.1",
        "librosa==0.11.0",
        "soundfile==0.13.1",
        "torch==2.7.1",
        "transformers==4.53.2",
    )
    .run_function(download_model)
)

app = modal.App("heynotai-audio-detector")


@app.function(
    image=runtime_image,
    cpu=2,
    memory=4096,
    timeout=150,
    scaledown_window=300,
    secrets=[modal.Secret.from_name("heynotai-audio-api")],
)
@modal.asgi_app()
def audio_api():
    from fastapi import FastAPI, HTTPException, Request, status
    from transformers import pipeline

    detector = pipeline("audio-classification", model=MODEL_ID, device=-1)
    web = FastAPI(title="HeyNotAI Audio Detector", docs_url=None, redoc_url=None)

    def authorize(request: Request) -> None:
        expected = os.environ.get("AUDIO_API_KEY", "")
        supplied = request.headers.get("authorization", "")
        if not expected or supplied != f"Bearer {expected}":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="invalid credential",
            )

    @web.get("/")
    async def health(request: Request):
        authorize(request)
        return {"ok": True, "model": MODEL_ID}

    @web.post("/")
    async def classify(request: Request):
        authorize(request)
        audio = await request.body()
        if not audio:
            raise HTTPException(status_code=400, detail="empty audio")
        if len(audio) > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail="audio exceeds 50 MiB")

        content_type = request.headers.get("content-type", "audio/wav").split(";", 1)[0]
        suffixes = {
            "audio/mpeg": ".mp3",
            "audio/mp3": ".mp3",
            "audio/mp4": ".m4a",
            "audio/x-m4a": ".m4a",
            "audio/ogg": ".ogg",
            "audio/webm": ".webm",
            "audio/wav": ".wav",
            "audio/x-wav": ".wav",
        }
        suffix = suffixes.get(content_type, ".bin")
        path = ""
        try:
            with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as handle:
                handle.write(audio)
                path = handle.name
            predictions = detector(path, top_k=None)
            return [
                {"label": str(item["label"]), "score": float(item["score"])}
                for item in predictions
            ]
        finally:
            if path:
                Path(path).unlink(missing_ok=True)

    return web
