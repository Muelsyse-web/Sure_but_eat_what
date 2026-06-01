# Audio Slots

Put user-provided, licensed audio clips here:

- `wheel-spin.mp3` - oversized hand wheel spin cue; ignored from the code package and loaded from CloudBase by `getAssetUrls`
- `slot-spin.mp3` - local slot-machine spin cue, packaged with the mini program
- `tap.mp3` - local general button tap cue, packaged with the mini program
- `OnceSayMyNameITMXIASINI.mp3` - local one-shot cue when the home result bottom sheet appears
- `DontWantTable.mp3` - local "change restaurant" cue; playback finishes before the next spin starts
- `Suicide.mp3` - local back-to-choice cue
- `GetOut.mp3` - local add-to-blacklist cue
- `Luanshi.mp3` - local remove-from-blacklist cue
- `boot.mp3` - optional first-interaction/return-to-entry cue
- `manual.mp3` - optional manual candidate entry cue
- `nearby.mp3` - optional nearby search entry cue
- `result.mp3` - result reveal cue
- `bgm-guanyu.mp3` - large looping background music; ignored from the code package and loaded from CloudBase by `app.js`
- unreferenced collected clips should stay ignored in `project.config.json` until code uses them

Deploy `cloudfunctions/getAssetUrls` after changing the CloudBase file ID for an oversized interaction cue.

If a file is missing, the mini program silently continues without sound.
