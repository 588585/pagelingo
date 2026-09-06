# PageLingo: AMO reviewer build instructions

Repository: https://github.com/588585/pagelingo

Firefox add-on ID: `{385f9dfc-34cf-4f67-a6f6-14eee6678b5c}`.
Extension version: `0.0.41`. The npm package version is separate from the extension version.

## Environment

The submission is built on Windows x64 with Node.js 22.23.1 and npm 10.9.8.
Install Node.js from https://nodejs.org/en/download and verify the versions with
`node --version` and `npm --version`. No globally installed Gulp is needed.

Use the attached source ZIP for the submitted version; the repository's default
branch may contain subsequent changes. Extract the source ZIP and open a terminal
in the directory containing `package.json` and `gulpfile.js`.

## Build Firefox

```sh
npm ci
npm run firefox
```

`npm ci` installs the exact dependencies recorded in `package-lock.json` and needs
access to the npm registry. Do not update the lockfile or the Browserslist database.
The build itself is local and requires no API keys, account login, signing
credentials, or access to a translation provider.

Output:

- Unpacked extension: `dist/firefox/`.
- Unsigned submission package: `dist/pagelingo-firefox-0.0.41.zip`.

Compare the unpacked files to the submitted unsigned extension package. ZIP
container metadata, such as timestamps, may differ without changes to file content.
Mozilla adds signing metadata after review; the build does not generate signatures.

For a complete clean build of both browsers, use `npm run build` instead of
`npm run firefox`. The full build deletes and regenerates `dist/`.

## Source transformations

All build steps are defined in the included `gulpfile.js`:

1. Copy `src/` to `dist/firefox/`.
2. Transpile background JavaScript using `gulp-babel` and `@babel/preset-env`, with
   inline source maps from `gulp-sourcemaps`. Targets are set in `package.json`.
3. Replace the HTML version placeholder with the version in `src/manifest.json`.
4. Package the directory with `gulp-zip`.

The Chrome build uses a separate manifest and concatenates background scripts;
this concatenation is not part of the Firefox build. No obfuscation step is used.
All npm build dependencies are declared and locked in the supplied package files.

## Data transmission and provenance

PageLingo sends website content to the selected external translation service to
perform translations. The Firefox manifest declares required `websiteContent`
data transmission, with minimum versions 140 on desktop and 142 on Android.
See `PRIVACY` for the inherited translation-service information.

This is a renamed fork of
https://github.com/immersive-translate/old-immersive-translate with its own Firefox
ID. The original license and attribution are retained in `LICENSE` and
`docs/upstream-readme.md`.
