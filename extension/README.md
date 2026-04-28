# heynotai — AI Content Detector

A Chrome extension that detects AI-generated media on YouTube in real time, displaying a color-coded border around the video player.

## MVP Features

- **Glowing Detection Border** – A subtle, animated border wraps the YouTube video player. Colors indicate the detection state:
  - 🟢 **Green** = Likely Authentic
  - 🟡 **Yellow** = Uncertain – Review Advised
  - 🔴 **Red** = AI-Generated Content Detected
- **Smart Badge** – A small badge in the top-left corner of the video shows the verdict at a glance.
- **Detail Panel** – Click the badge to see a breakdown: trust score, face analysis, audio sync, frame consistency.
- **Scan Dashboard** – The extension popup shows scan history, stats, and a re-scan button.
- **Onboarding** – First-time users see a 3-step welcome screen.

## Installation (Developer Mode)

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **"Load unpacked"**
4. Select the `heynotai-extension` folder
5. The heynotai icon appears in your toolbar – you're protected!

## Usage

1. Navigate to any YouTube video
2. heynotai automatically scans the video (1–2 second delay)
3. The border glows with the detection result
4. Click the badge for detailed analysis
5. Click the extension icon for your scan dashboard

## File Structure

```
heynotai-extension/
├── manifest.json       # Chrome extension manifest (V3)
├── background.js       # Service worker for badge updates
├── content.js          # Injected into YouTube – border, badge, panel
├── content.css         # Styles for all injected UI elements
├── popup.html          # Extension popup dashboard
├── popup.js            # Dashboard logic & scan history
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

## Note

This is an **MVP for UI/flow validation**. Detection results are simulated (deterministic per video ID) to demonstrate the user experience. The AI detection engine will be integrated in a future release.
