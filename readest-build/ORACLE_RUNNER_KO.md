# Oracle Ubuntu Readest Personal self-hosted APK runner

## 환경
- Oracle instance-20261015-1852: Ubuntu 24.04, AMD/x86_64, 8 CPU threads, ~23GiB RAM, ~42GiB free storage at initial inspection.
- Existing Tailscale, Docker and media services must remain running. No inbound GitHub runner port is necessary.
- The APK workflow uses a `readest-builder` dedicated runner label; GitHub Actions default self-hosted runner is **not** accepted.
- The workflow is manual-only (`workflow_dispatch`). `self-hosted` timeout: 240 minutes; `github-hosted`: 120 minutes.
- After the GitHub Free hosted minutes reset, use `github-hosted` to avoid keeping a local build server.

## Installation plan
1. Login as a normal sudo-enabled user (`ubuntu`) via SSH/Termius.
2. Execute the one-shot `readest-oracle-runner-setup.sh` installer prepared in the conversation, which checks x86_64, RAM and >=32GiB free storage before installing development libraries. Do not execute as root.
3. Get one-hour runner registration token at `https://github.com/fixitneo/localboard/settings/actions/runners/new`, Linux/x64. Paste only the token at the script's hidden prompt; never send it over chat.
4. The installer creates non-sudo `readestci` and `/srv/readest-builder/runner`, registers the GitHub runner with the custom label `readest-builder`, and installs a systemd service. The service is capped to 450% CPU, 18GiB memory (14GiB soft limit) and low priority IO.
5. Open `https://github.com/fixitneo/localboard/actions/workflows/readest-personal-apk.yml`. Run workflow on `readest-personal-v0.12.16`, input `self-hosted`.
6. Download the signed APK from `ReadestPersonal-Android-Update-arm64` artifact only after the run reports success.

## Resource checks
- `df -h /srv` — preserve disk space for media data. GitHub job refuses to start with <25GiB available at start.
- `free -h` — preserve RAM for existing Docker services.
- `sudo systemctl list-units 'actions.runner.fixitneo-localboard.*.service'` — runner service status.
- `sudo journalctl -u 'actions.runner.fixitneo-localboard.*.service' -n 100 --no-pager` — service logs (verify glob matching).
- The Ubuntu 24.04 image enforces PEP 668; icon image processing uses a disposable Python venv during CI.
- Do not install Android Studio, rerun all CI on every commit, or turn on hosted spending beyond the free limit.

## Migrating later to a local x86 home server
Do **not** treat a full Oracle boot-volume clone as a guaranteed bootable local-machine image. Ubuntu kernel, bootloader, cloud-init, networking, NIC names and fstab require reconciliation. Prefer migrating Docker Compose definitions, named volumes/bind mounts, databases and application data using planned snapshots, rsync or archives.

Before cloning any runner storage, remove the original registration and delete runner-specific `.runner` / `.credentials` identity **after** stopping and unregistering the runner; GitHub runner identities are not safely cloned. Re-register a new runner on the destination. Keep signing secrets in GitHub Actions Secrets, not in Docker volumes or disk snapshots.

The Readest-specific build directory may be removed after a final signed APK has been archived and the runner unregistered. This must not delete unrelated Docker or Tailscale state.

## Security
This self-hosted runner executes repository workflow code. It has no sudo or docker-group membership and must remain limited to the private repository. A custom label reduces accidental scheduling of unrelated builds; it is not a sandbox. Protect the GitHub repository against untrusted changes and do not expose SSH or Docker sockets to the runner.
