# SchoolWork 0.10.1-beta.1 — Google sign-in preview

This is an opt-in beta, published from the `beta` branch. It is not a stable automatic update and has not been merged as a stable release.

- Click **Sign in with Google** to open your browser, choose your account, and approve Calendar access. No personal Google Cloud project or OAuth client setup is needed.
- Optional Drive read access remains off by default. The connection dialog explains when requested Google data is sent to the selected school TeachGPT service.
- Cancel a pending sign-in safely; late callbacks cannot replace a newer login attempt. Existing custom Google connections remain supported.
- Existing application ID and local chats, settings, and credentials are retained. Do not run the portable app and installer together against the same profile.

## Installation

Download `SchoolWork-0.10.1-beta.1-x64-setup.exe` for a per-user Windows x64 installation, or the portable executable. Verify the download against `SHA256SUMS-v0.10.1-beta.1.txt`. Finish or pause active tasks and close SchoolWork normally before updating. These binaries are unsigned; do not disable Windows protections.

Each tester needs their own locally configured TeachGPT API key and school API access. Keys and user Google tokens are not included in the download.

## Verification boundary

- Automated suite: 161 passing tests; full TypeScript/build checks passed.
- Electron workflow: 12 passing checks, including direct Google sign-in without custom-client setup; external Google authorization is simulated in these tests.
- Real Google user authorization, multiple-account access, clean-machine installation, and upgrade behavior have not yet been verified.
- Google app is in Production but **not Google-approved**. Branding verification awaits website-ownership propagation; sensitive Calendar and restricted Drive scope review is still pending. Warnings, the unverified-app user cap, and school administrator restrictions may prevent access. See [current verification status](https://sillen69.github.io/schoolwork-desktop/google-verification-status.md).

Keep this version on beta until live authorization and Google's required review are complete. Publication of this installer does not itself establish that Google sign-in works for everyone.
