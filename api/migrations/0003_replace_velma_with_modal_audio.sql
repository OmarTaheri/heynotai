-- Velma is a paid service. Keep its historical rows for scan/audit integrity,
-- but remove it from the active provider and model catalogs.
UPDATE detection_models
SET enabled = false,
    is_default = false,
    archived_at = COALESCE(archived_at, now()),
    updated_at = now()
WHERE slug = 'modulate-velma';

UPDATE providers
SET enabled = false,
    deleted_at = COALESCE(deleted_at, now()),
    updated_at = now()
WHERE key = 'velma';

-- The endpoint is deployed from deploy/modal/audio_detector.py. It remains
-- disabled until its Modal URL and bearer credential are entered by an admin.
INSERT INTO providers (
  key, name, driver, base_url, auth_scheme, enabled, is_local, config
)
VALUES (
  'modal-audio',
  'Modal Audio Detector',
  'http',
  '',
  'bearer',
  false,
  false,
  '{"platform":"modal","freeAllowance":"$30/month Starter compute credit","credentialEnv":"MODAL_AUDIO_API_KEY","timeoutMs":150000,"maxRetries":1,"requestsPerMinute":30,"concurrencyLimit":4}'::jsonb
)
ON CONFLICT (key) DO NOTHING;

WITH modal_audio AS (
  SELECT id FROM providers WHERE key = 'modal-audio' AND deleted_at IS NULL
)
INSERT INTO detection_models (
  slug, name, type, provider_id, external_model_id, description, accuracy,
  enabled, tier, token_cost, cost_unit, is_default, request_spec,
  response_spec, input_limits, execution_limits, runtime_config
)
VALUES (
  'melody-audio-deepfake',
  'MelodyMachine Audio Deepfake Detector',
  'aud',
  (SELECT id FROM modal_audio),
  'MelodyMachine/Deepfake-audio-detection-V2',
  'Apache-2.0 Wav2Vec2 audio deepfake classifier deployed on Modal serverless CPU.',
  99.7,
  false,
  'team',
  3,
  'per_minute',
  true,
  '{"method":"POST","bodyMode":"binary","contentType":"{{input.mime}}"}'::jsonb,
  '{"preset":"classification-list","itemsPath":"$","labelPath":"label","scorePath":"score","aiLabels":["fake","spoof","ai","generated","synthetic","label_0","0"],"humanLabels":["real","human","bonafide","authentic","label_1","1"]}'::jsonb,
  '{"maxBytes":52428800,"allowedMimePrefixes":["audio/"]}'::jsonb,
  '{"timeoutMs":150000,"maxAttempts":2,"maxConcurrency":4,"requestsPerMinute":30}'::jsonb,
  '{"deployment":"deploy/modal/audio_detector.py","status":"setup-required","license":"apache-2.0"}'::jsonb
)
ON CONFLICT (slug) DO NOTHING;
