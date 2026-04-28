import type { ScanDetection } from './types';

// Deterministic stub detector — same video ID produces the same verdict.
// Real detector will come from the `api` service in the monorepo.
export function simulateDetection(videoId: string): ScanDetection {
  let hash = 0;
  for (let i = 0; i < videoId.length; i++) {
    hash = ((hash << 5) - hash) + videoId.charCodeAt(i);
    hash |= 0;
  }
  const rand = Math.abs(hash % 100);

  if (rand < 55) {
    return {
      state: 'authentic',
      trustScore: 85 + (rand % 15),
      label: 'Likely Authentic',
      sublabel: 'No significant AI manipulation detected.',
      detectionType: 'None detected',
      faceAnalysis: 'Consistent',
      audioSync: 'Matched',
      frameConsistency: 'Stable',
      scanTime: (0.8 + Math.random() * 0.7).toFixed(1),
    };
  }
  if (rand < 80) {
    return {
      state: 'suspicious',
      trustScore: 40 + (rand % 25),
      label: 'Uncertain – Review Advised',
      sublabel: 'Some indicators suggest possible AI involvement.',
      detectionType: 'Partial artifacts',
      faceAnalysis: 'Minor anomalies',
      audioSync: 'Slight mismatch',
      frameConsistency: 'Minor flicker',
      scanTime: (1.0 + Math.random() * 0.6).toFixed(1),
    };
  }
  return {
    state: 'ai-generated',
    trustScore: 5 + (rand % 25),
    label: 'AI-Generated Content',
    sublabel: 'High confidence this media is synthetically produced.',
    detectionType: 'Deepfake / GAN',
    faceAnalysis: 'Anomalous',
    audioSync: 'Desynchronized',
    frameConsistency: 'Artifacts found',
    scanTime: (1.2 + Math.random() * 0.5).toFixed(1),
  };
}
