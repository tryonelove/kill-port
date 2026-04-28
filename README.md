# Kill Port (Raycast Extension)

Kill process listening on port, straight from Raycast.

## What it does

- Type port (`1-65535`)
- Shows process name, PID, full command
- Run kill action (`kill -9 <pid>`)
- Handles no-process + invalid-port states

## Commands

- `Kill Port` (`kill-port`)
- `Kill Port` (`killport`)

Both commands open same view.

## Install

### From Raycast Store

Install from store when published.

### Local development

```bash
npm install
npm run dev
```

Then open Raycast, run `Kill Port`.

## Usage

1. Open `Kill Port`
2. Enter port number in search bar
3. Pick process from list
4. Press Enter to kill

## Notes

- macOS only
- If permission denied, run command with enough privileges (ex: process owned by root)
- Uses `lsof` to discover listeners

## License

MIT
