# Fonts

This folder is a placeholder. By default `styles/fonts.css` imports Inter + JetBrains Mono from Google Fonts.

To self-host (recommended for extensions — avoids external requests and review-team questions):

1. Download woff2 files for:
   - Inter 400, 500, 600, 700
   - JetBrains Mono 400, 500, 600
2. Name them `inter-400.woff2`, `inter-500.woff2`, etc.
3. Drop them in this folder.
4. Replace the `@import` in `../../styles/fonts.css` with `@font-face` rules.
