# Google verification status

Last checked: 11 October 2026 (Europe/Stockholm).

## Completed

- Dedicated SchoolWork Desktop Google Cloud project, external audience, and Desktop OAuth client.
- Calendar API and optional Drive API enabled.
- Publisher client configured for release builds; users do not create their own OAuth client.
- Public homepage and privacy policy deployed over HTTPS.
- Homepage ownership verified in Google Search Console using its HTML meta tag.
- Google OAuth app moved from Testing to Production with owner approval.

## Google review is pending

The first branding verification attempt reported:

> The website of your home page URL "https://sillen69.github.io/schoolwork-desktop/" is not registered to you. Verify ownership of your home page, then wait 24 hours before retrying to allow our systems to update.

Ownership verification has succeeded in Search Console. Wait at least 24 hours after that verification (12 October 2026, after approximately 21:17 Stockholm time) before retrying branding verification. Keep the verification meta tag in the homepage.

After branding passes, continue Google's Verification Center application for Calendar event access and optional Drive read access. Sensitive/restricted scope review is not submitted or approved yet. Prepare a truthful working-flow demonstration and confirm the school AI endpoint's Google-data processing terms before making compliance representations. A Google-required security assessment, if applicable, is a separate external prerequisite; no assessment has been purchased.

Production publication does not equal Google approval. Google currently shows a 100-user lifetime cap for the unverified app. Warnings and organization policies may still block users.

## Implementation checks

- Full automated suite: 161 passing tests.
- Full TypeScript check and publisher-configured production build pass.
- Electron workflow: 12 passing checks, including direct Google sign-in without per-user OAuth setup. External OAuth responses are simulated in these checks.
- Local Windows v0.10.1 installer and portable packages built; installer/update manifest verification passes. Packages are unsigned.
- Real user authorization, two-account access, and clean-machine installation are not yet verified. The v0.10.1 packages have not been published as a public release.
