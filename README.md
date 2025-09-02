# Button Masher Universe — Split Edition

## Run locally
1. Put all files in a single folder:
   - index.html
   - styles.css
   - app.js
   - physics.worker.js
   - (optional) README.md

2. Open the folder in VS Code and install Live Server extension (or use any static file server).

3. Right-click `index.html` -> Open with Live Server (or open the file in your browser).

## Notes
- Physics runs inside `physics.worker.js` to keep rendering smooth.
- The main thread renders the snapshot the worker sends periodically.
- You can convert `app.js` and `physics.worker.js` to TypeScript by renaming and adding types; the architecture supports modularization.
