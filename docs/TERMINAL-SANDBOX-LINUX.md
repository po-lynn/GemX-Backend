# Terminal sandbox error on Linux (AppArmor)

If you see:

**"Terminal sandbox could not start. This may be caused by an AppArmor configuration on your Linux system (kernel 6.2+)."**

the integrated terminal (and agent-run commands) can fail. This is a known issue on Ubuntu 24.04 and similar setups with kernel 6.2+ and AppArmor.

## Workarounds (try in order)

### 1. Use Legacy Terminal (Cursor setting)

Use the older terminal path so Cursor doesn’t rely on the failing sandbox:

- **Cursor Settings** → **Chat** or **Agents** → **Terminal**
- Enable **"Legacy Terminal Tool"**

Reload the window (`Ctrl+Shift+P` → "Developer: Reload Window") and try the terminal again.

### 2. Relax AppArmor’s user-namespace restriction (system-wide)

If the sandbox still won’t start, the only fix that works for many users is to allow unprivileged user namespaces (required by the sandbox):

```bash
echo 'kernel.apparmor_restrict_unprivileged_userns=0' | sudo tee /etc/sysctl.d/99-userns.conf
sudo sysctl --system
```

Then restart Cursor. No reboot needed.

**Note:** This weakens a system-wide hardening (unprivileged user namespaces). Use only if you need the integrated terminal and accept the trade-off.

### 3. Stale or restrictive AppArmor profile

If Cursor previously had an AppArmor profile that’s now wrong or stale:

```bash
sudo aa-status | grep -i cursor
```

If you see something like `cursor_sandbox`, you can try unloading it:

```bash
sudo apparmor_parser -R /etc/apparmor.d/cursor_sandbox
sudo rm /etc/apparmor.d/cursor_sandbox
sudo systemctl restart apparmor
```

Then restart Cursor.

### 4. If sysctl didn’t help: force Legacy Terminal

The sandbox can still fail even with `kernel.apparmor_restrict_unprivileged_userns=0` (e.g. other AppArmor rules or the `cursorsandbox` binary). To get a working terminal inside Cursor without the sandbox:

1. Open **Cursor Settings** (gear icon or `Ctrl+,`).
2. Search for **“Legacy Terminal”** or go to **Chat** / **Agents** → **Terminal**.
3. Turn **on** **“Legacy Terminal Tool”**.
4. Reload the window: `Ctrl+Shift+P` → **Developer: Reload Window**.

After that, the integrated terminal and agent commands use the legacy path and no longer depend on the sandbox.

### 5. Cursor sysctl file (optional)

If Cursor installed its own sysctl file, it might conflict. In a **system** terminal (outside Cursor), check:

```bash
cat /etc/sysctl.d/99-cursor-sandbox-userns.conf
```

If it contains `kernel.apparmor_restrict_unprivileged_userns=1`, you can remove the file or change to `=0` so your `99-userns.conf` (or this file) allows userns. Then run `sudo sysctl --system` and restart Cursor.

### 6. Sandbox binary permissions (optional)

Some setups need the setuid bit on the sandbox helper:

```bash
sudo chmod 4755 /usr/share/cursor/resources/app/resources/helpers/cursorsandbox
```

If Cursor is installed elsewhere (e.g. under `~/.local` or Snap), the path may differ; check your Cursor install location first.

### 7. Run commands outside Cursor

Use your system terminal (e.g. outside Cursor) for `npm run test`, `git`, and other commands until the issue is fixed.

---

## Other solutions

### A. AppArmor “complain” mode for Cursor

Tell AppArmor to log but not deny Cursor’s sandbox (may allow it to start):

```bash
sudo aa-complain /etc/apparmor.d/cursor_sandbox
# or whatever profile name appears in: sudo aa-status | grep -i cursor
```

To revert to enforcing later: `sudo aa-enforce /etc/apparmor.d/cursor_sandbox`

### B. Unconfined AppArmor profile (forum suggestion)

Create a profile that allows Cursor to run without the default sandbox restrictions. Create `/etc/apparmor.d/cursor-system`:

```
abi <abi/4.0>,
include <tunables/global>
profile cursor-system "/usr/share/cursor/cursor" flags=(unconfined) {
  userns,
  include if exists <local/cursor>
}
```

Then load it:

```bash
sudo apparmor_parser -r /etc/apparmor.d/cursor-system
```

Restart Cursor. (Adjust the path if Cursor is installed elsewhere.)

### C. Temporarily disable AppArmor (to confirm it’s the cause)

Only to test; re-enable after:

```bash
sudo systemctl stop apparmor
# … use Cursor, see if terminal works …
sudo systemctl start apparmor
```

If the terminal works with AppArmor stopped, the issue is definitely AppArmor; you can then rely on Legacy Terminal + external terminal or try A/B above instead of leaving AppArmor off.

### D. Use VS Code for the terminal only

Use Cursor for editing/agents and VS Code (or any other editor) only for the integrated terminal. Same keybindings; no Cursor sandbox.

### E. Dismiss the message and use Legacy + external terminal

If the integrated terminal already works with Legacy Terminal on, you can ignore the “Terminal sandbox could not start” banner and use Cursor as usual. For heavy terminal use, open an external terminal (`Ctrl+Shift+C` or your system terminal) alongside Cursor.

## References

- [Cursor forum: Terminal Sandbox Issue Linux](https://forum.cursor.com/t/terminal-sandbox-issue-linux/152979)
- [Cursor forum: How do I disable sandbox when agent wants to run commands?](https://forum.cursor.com/t/how-do-i-disable-sandbox-when-agent-wants-to-run-commands/137621) (Legacy Terminal Tool)
