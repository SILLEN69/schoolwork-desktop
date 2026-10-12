# SchoolWork 0.10.1-beta.5 — task notifications

Windows now shows a notification, with sound when allowed by system settings, when a task finishes or stops with an error. Clicking it brings SchoolWork forward. Temporary tool failures and automatic retries stay quiet; resumed tasks can notify again when they reach a new outcome. Notification delivery cannot change task progress.

This small update stays on `beta`; no Google scopes or agent write permissions changed. Download the Windows installer or portable executable. Finish or pause tasks and close SchoolWork normally before installing. The application ID and local chats/settings/credentials are retained. Binaries are unsigned.

Only the fast notification-specific checks were run for this update. The wider application suite, clean-machine installation and live model workflows were intentionally not rerun. Windows notification and Do Not Disturb settings can suppress banners or sound.
