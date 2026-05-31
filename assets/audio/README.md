# Audio Slots

Put user-provided, licensed audio clips here:

- `wheel-spin.mp3` - local hand wheel spin cue, packaged with the mini program
- `slot-spin.mp3` - local slot-machine spin cue, packaged with the mini program
- `tap.mp3` - local general button tap cue, packaged with the mini program
- `OnceSayMyNameITMXIASINI.mp3` - local one-shot cue when the restaurant detail/list sub-page opens
- `boot.mp3` - optional first-interaction/return-to-entry cue
- `manual.mp3` - optional manual candidate entry cue
- `nearby.mp3` - optional nearby search entry cue
- `result.mp3` - result reveal cue
- `bgm-guanyu.mp3` - large looping background music; ignored from the code package and loaded from CloudBase by `app.js`
- unreferenced collected clips should stay ignored in `project.config.json` until code uses them

If a file is missing, the mini program silently continues without sound.
