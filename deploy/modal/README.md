# Modal audio provider

This deploys `MelodyMachine/Deepfake-audio-detection-V2` as a private HTTP
provider for HeyNotAI. The model is Apache-2.0 licensed and Modal's Starter
plan currently includes $30/month in compute credit.

## Deploy

1. Create a free account at <https://modal.com>.
2. Install and authenticate the CLI:

   ```powershell
   py -m pip install modal
   py -m modal setup
   ```

3. Generate a long random bearer token and save it as a Modal secret:

   ```powershell
   py -m modal secret create heynotai-audio-api AUDIO_API_KEY="paste-a-long-random-value"
   ```

4. Deploy from the repository root:

   ```powershell
   py -m modal deploy deploy/modal/audio_detector.py
   ```

5. In `/app/admin/providers`, edit **Modal Audio Detector**:
   - Base URL: the URL printed by `modal deploy`
   - Credential: the same `AUDIO_API_KEY`
   - Enable the provider
6. In `/app/admin/models`, enable **MelodyMachine Audio Deepfake Detector**.
   It is seeded on the highest paid (`team`) tier and remains disabled until
   this step, so free and regular paid users cannot access it.
7. Use the provider test, then run a real audio scan. The first request after
   an idle period can take longer while the serverless container starts.

Do not commit the bearer token or paste it into a public issue/chat.
