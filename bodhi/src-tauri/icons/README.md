# Icons (M6)

Release icons are generated from a single source PNG with:

```bash
npx tauri icon path/to/source.png
```

That produces `32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.icns`, `icon.ico`
referenced by `tauri.conf.json`. Not needed for `cargo check` or `tauri dev`.
