-- Idempotent provider and model seed. Runtime configuration is declarative so
-- operators can clone/edit these rows from the admin page without recompiling.

INSERT INTO providers (key, name, driver, base_url, auth_scheme, enabled, is_local, config)
VALUES
  (
    'huggingface',
    'Hugging Face Inference',
    'huggingface',
    'https://router.huggingface.co/hf-inference/models',
    'bearer',
    true,
    false,
    '{"credentialEnv":"HUGGINGFACE_TOKEN"}'::jsonb
  ),
  (
    'velma',
    'Modulate Velma',
    'velma',
    'https://modulate-developer-apis.com',
    'x-api-key',
    true,
    false,
    '{"credentialEnv":"VELMA_API_KEY","apiKeyHeader":"X-API-Key"}'::jsonb
  )
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  driver = EXCLUDED.driver,
  base_url = EXCLUDED.base_url,
  auth_scheme = EXCLUDED.auth_scheme,
  config = providers.config || EXCLUDED.config,
  updated_at = now();

WITH hf AS (SELECT id FROM providers WHERE key = 'huggingface')
INSERT INTO detection_models (
  slug, name, type, provider_id, external_model_id, description, accuracy,
  enabled, tier, token_cost, cost_unit, is_default, request_spec,
  response_spec, input_limits, execution_limits, runtime_config
)
SELECT * FROM (
  VALUES
    (
      'fakespot-roberta', 'Fakespot AI Detector', 'txt', (SELECT id FROM hf),
      'fakespot-ai/roberta-base-ai-text-detection-v1',
      'RoBERTa-based detector trained on a broad mix of human and AI text.',
      91::numeric, true, 'check', 1::numeric, 'per_scan', true,
      '{"method":"POST","bodyMode":"json","body":{"inputs":"{{input.text}}"}}'::jsonb,
      '{"preset":"classification-list","itemsPath":"$","labelPath":"label","scorePath":"score","aiLabels":["fake","ai","generated","synthetic","label_1","1"],"humanLabels":["real","human","authentic","label_0","0"]}'::jsonb,
      '{"maxChars":1000000}'::jsonb,
      '{"timeoutMs":45000,"maxAttempts":2,"maxConcurrency":8,"requestsPerMinute":120}'::jsonb,
      '{}'::jsonb
    ),
    (
      'openai-roberta', 'OpenAI RoBERTa Detector', 'txt', (SELECT id FROM hf),
      'openai-community/roberta-base-openai-detector',
      'OpenAI classic RoBERTa GPT-2 detector.',
      84::numeric, true, 'certify', 4::numeric, 'per_scan', false,
      '{"method":"POST","bodyMode":"json","body":{"inputs":"{{input.text}}"}}'::jsonb,
      '{"preset":"classification-list","itemsPath":"$","labelPath":"label","scorePath":"score","aiLabels":["fake","ai","generated","synthetic","label_1","1"],"humanLabels":["real","human","authentic","label_0","0"]}'::jsonb,
      '{"maxChars":1000000}'::jsonb,
      '{"timeoutMs":45000,"maxAttempts":2,"maxConcurrency":8,"requestsPerMinute":120}'::jsonb,
      '{}'::jsonb
    ),
    (
      'simpleai-chatgpt', 'SimpleAI ChatGPT Detector', 'txt', (SELECT id FROM hf),
      'Hello-SimpleAI/chatgpt-detector-roberta',
      'Tuned specifically against ChatGPT outputs.',
      89::numeric, true, 'verify', 2::numeric, 'per_scan', false,
      '{"method":"POST","bodyMode":"json","body":{"inputs":"{{input.text}}"}}'::jsonb,
      '{"preset":"classification-list","itemsPath":"$","labelPath":"label","scorePath":"score","aiLabels":["fake","ai","generated","synthetic","chatgpt","gpt","label_1","1"],"humanLabels":["real","human","authentic","label_0","0"]}'::jsonb,
      '{"maxChars":1000000}'::jsonb,
      '{"timeoutMs":45000,"maxAttempts":2,"maxConcurrency":8,"requestsPerMinute":120}'::jsonb,
      '{}'::jsonb
    ),
    (
      'deepfake-v2', 'Deep-Fake Detector v2', 'img', (SELECT id FROM hf),
      'prithivMLmods/Deep-Fake-Detector-v2-Model',
      'ViT-based deepfake detector.',
      92::numeric, true, 'check', 2::numeric, 'per_scan', true,
      '{"method":"POST","bodyMode":"binary","contentType":"{{input.mime}}"}'::jsonb,
      '{"preset":"classification-list","itemsPath":"$","labelPath":"label","scorePath":"score","aiLabels":["fake","ai","generated","synthetic","label_1","1"],"humanLabels":["real","human","authentic","label_0","0"]}'::jsonb,
      '{"maxBytes":268435456,"allowedMimePrefixes":["image/"]}'::jsonb,
      '{"timeoutMs":60000,"maxAttempts":2,"maxConcurrency":4,"requestsPerMinute":60}'::jsonb,
      '{}'::jsonb
    ),
    (
      'deepfake-v2-onnx', 'Deep-Fake Detector v2 (ONNX)', 'img', (SELECT id FROM hf),
      'onnx-community/Deep-Fake-Detector-v2-Model-ONNX',
      'ONNX variant; disabled until hosted by a compatible endpoint.',
      91::numeric, false, 'check', 2::numeric, 'per_scan', false,
      '{"method":"POST","bodyMode":"binary","contentType":"{{input.mime}}"}'::jsonb,
      '{"preset":"classification-list","itemsPath":"$","labelPath":"label","scorePath":"score"}'::jsonb,
      '{"maxBytes":268435456,"allowedMimePrefixes":["image/"]}'::jsonb,
      '{"timeoutMs":60000,"maxAttempts":1,"maxConcurrency":2,"requestsPerMinute":30}'::jsonb,
      '{}'::jsonb
    ),
    (
      'vit-deepfake', 'ViT Deepfake Detection', 'img', (SELECT id FROM hf),
      'Wvolf/ViT_Deepfake_Detection',
      'Vision Transformer fine-tuned for deepfake detection.',
      98::numeric, true, 'certify', 8::numeric, 'per_scan', false,
      '{"method":"POST","bodyMode":"binary","contentType":"{{input.mime}}"}'::jsonb,
      '{"preset":"classification-list","itemsPath":"$","labelPath":"label","scorePath":"score","aiLabels":["fake","ai","generated","synthetic","label_1","1"],"humanLabels":["real","human","authentic","label_0","0"]}'::jsonb,
      '{"maxBytes":268435456,"allowedMimePrefixes":["image/"]}'::jsonb,
      '{"timeoutMs":60000,"maxAttempts":2,"maxConcurrency":4,"requestsPerMinute":60}'::jsonb,
      '{}'::jsonb
    ),
    (
      'siglip2-deepfake', 'Deepfake Detect SigLIP2', 'img', (SELECT id FROM hf),
      'prithivMLmods/Deepfake-Detect-Siglip2',
      'SigLIP2-backbone deepfake detector.',
      94::numeric, true, 'verify', 4::numeric, 'per_scan', false,
      '{"method":"POST","bodyMode":"binary","contentType":"{{input.mime}}"}'::jsonb,
      '{"preset":"classification-list","itemsPath":"$","labelPath":"label","scorePath":"score","aiLabels":["fake","ai","generated","synthetic","label_1","1"],"humanLabels":["real","human","authentic","label_0","0"]}'::jsonb,
      '{"maxBytes":268435456,"allowedMimePrefixes":["image/"]}'::jsonb,
      '{"timeoutMs":60000,"maxAttempts":2,"maxConcurrency":4,"requestsPerMinute":60}'::jsonb,
      '{}'::jsonb
    )
) AS seed(
  slug, name, type, provider_id, external_model_id, description, accuracy,
  enabled, tier, token_cost, cost_unit, is_default, request_spec,
  response_spec, input_limits, execution_limits, runtime_config
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  type = EXCLUDED.type,
  provider_id = EXCLUDED.provider_id,
  external_model_id = EXCLUDED.external_model_id,
  description = EXCLUDED.description,
  accuracy = EXCLUDED.accuracy,
  request_spec = EXCLUDED.request_spec,
  response_spec = EXCLUDED.response_spec,
  input_limits = EXCLUDED.input_limits,
  execution_limits = EXCLUDED.execution_limits,
  runtime_config = detection_models.runtime_config || EXCLUDED.runtime_config,
  updated_at = now();

WITH velma AS (SELECT id FROM providers WHERE key = 'velma')
INSERT INTO detection_models (
  slug, name, type, provider_id, external_model_id, description, accuracy,
  enabled, tier, token_cost, cost_unit, is_default, request_spec,
  response_spec, input_limits, execution_limits, runtime_config
)
VALUES (
  'modulate-velma', 'Modulate Velma Deepfake', 'aud', (SELECT id FROM velma), '',
  'Modulate Velma per-segment synthetic voice detector.',
  99, true, 'check', 12, 'per_scan', true,
  '{"method":"POST","path":"/api/velma-2-synthetic-voice-detection-batch","bodyMode":"multipart","fileField":"upload_file","fileName":"audio.bin"}'::jsonb,
  '{"preset":"segments","itemsPath":"frames","verdictPath":"verdict","confidencePath":"confidence","ignoreVerdicts":["no-content","no_content","silence","no-speech"],"verdictMap":{"fake":"ai","synthetic":"ai","deepfake":"ai","real":"human","authentic":"human"},"aggregation":"max-ai"}'::jsonb,
  '{"maxBytes":268435456,"allowedMimePrefixes":["audio/","video/"]}'::jsonb,
  '{"timeoutMs":120000,"maxAttempts":2,"maxConcurrency":4,"requestsPerMinute":30}'::jsonb,
  '{}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  provider_id = EXCLUDED.provider_id,
  request_spec = EXCLUDED.request_spec,
  response_spec = EXCLUDED.response_spec,
  input_limits = EXCLUDED.input_limits,
  execution_limits = EXCLUDED.execution_limits,
  updated_at = now();

-- Video rows describe a built-in frame sampling pipeline. The provider is HF,
-- while runtime_config points at the image model used for each frame.
WITH hf AS (SELECT id FROM providers WHERE key = 'huggingface')
INSERT INTO detection_models (
  slug, name, type, provider_id, description, accuracy, enabled, tier,
  token_cost, cost_unit, is_default, request_spec, response_spec,
  input_limits, execution_limits, runtime_config
)
SELECT * FROM (
  VALUES
    (
      'frames-deepfake-v2', 'Frame-by-frame Deep-Fake v2', 'vid', (SELECT id FROM hf),
      'Samples frames and runs Deep-Fake Detector v2 on each.',
      88::numeric, true, 'check', 8::numeric, 'per_minute', true,
      '{}'::jsonb, '{"preset":"generic"}'::jsonb,
      '{"maxBytes":268435456,"allowedMimePrefixes":["video/"]}'::jsonb,
      '{"timeoutMs":300000,"maxAttempts":2,"maxConcurrency":2,"requestsPerMinute":20}'::jsonb,
      '{"pipeline":"video-frames","frameModelSlug":"deepfake-v2","frameCount":16}'::jsonb
    ),
    (
      'frames-vit-deepfake', 'Frame-by-frame ViT Deepfake', 'vid', (SELECT id FROM hf),
      'Samples frames and runs ViT Deepfake Detection on each.',
      92::numeric, true, 'team', 12::numeric, 'per_minute', false,
      '{}'::jsonb, '{"preset":"generic"}'::jsonb,
      '{"maxBytes":268435456,"allowedMimePrefixes":["video/"]}'::jsonb,
      '{"timeoutMs":300000,"maxAttempts":2,"maxConcurrency":2,"requestsPerMinute":20}'::jsonb,
      '{"pipeline":"video-frames","frameModelSlug":"vit-deepfake","frameCount":16}'::jsonb
    )
) AS seed(
  slug, name, type, provider_id, description, accuracy, enabled, tier,
  token_cost, cost_unit, is_default, request_spec, response_spec,
  input_limits, execution_limits, runtime_config
)
ON CONFLICT (slug) DO UPDATE SET
  provider_id = EXCLUDED.provider_id,
  request_spec = EXCLUDED.request_spec,
  response_spec = EXCLUDED.response_spec,
  input_limits = EXCLUDED.input_limits,
  execution_limits = EXCLUDED.execution_limits,
  runtime_config = EXCLUDED.runtime_config,
  updated_at = now();
