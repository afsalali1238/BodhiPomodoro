// Flat ESLint config (ESLint 9+). Two source contexts exist in this codebase:
//   1. Main-process / Node CommonJS modules (state machine, storage, IPC, tray, watcher…)
//   2. Renderer scripts loaded via <script src> tags in the *.html windows — these run
//      in the browser context with no bundler, so they're plain scripts (not ES modules)
//      that share globals across files within the same HTML page (e.g. figures.js exposes
//      `window.BodhiArt`, which pet.js then reads as a global).
const js = require('@eslint/js');
const globals = require('globals');

const NODE_MAIN_FILES = [
  'src/main.js',
  'src/storage.js',
  'src/state.js',
  'src/windows.js',
  'src/tray.js',
  'src/ipc.js',
  'src/watcher.js',
  'src/preload.js',
  'src/distraction.js'
];

// report.js is an isomorphic UMD-style module: required directly by the main
// process (storage.js/state.js) AND loaded via <script> into report.html as
// `window.BodhiReport`. It needs both Node and browser globals.
const ISOMORPHIC_FILES = ['src/report.js'];

const RENDERER_FILES = [
  'src/figures.js',
  'src/laser.js',
  'src/launcher.js',
  'src/pet.js',
  'src/reportView.js',
  'src/settings.js',
  'src/tasks.js'
];

module.exports = [
  js.configs.recommended,
  {
    ignores: ['node_modules/**', 'dist/**', 'build/**', 'tests/**']
  },
  {
    files: NODE_MAIN_FILES,
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.node }
    },
    rules: {
      'no-unused-vars': ['warn', { args: 'none', varsIgnorePattern: '^_' }],
      'no-empty': ['warn', { allowEmptyCatch: true }]
    }
  },
  {
    files: ISOMORPHIC_FILES,
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: { ...globals.node, ...globals.browser }
    },
    rules: {
      'no-unused-vars': ['warn', { args: 'none', varsIgnorePattern: '^_' }],
      'no-empty': ['warn', { allowEmptyCatch: true }]
    }
  },
  {
    files: RENDERER_FILES,
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        // Exposed by preload.js's contextBridge, and by sibling <script> tags
        // loaded into the same HTML page (figures.js -> window.BodhiArt, etc.).
        bodhi: 'readonly',
        BodhiArt: 'readonly',
        BodhiReport: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': ['warn', { args: 'none', varsIgnorePattern: '^_' }],
      'no-empty': ['warn', { allowEmptyCatch: true }]
    }
  }
];
