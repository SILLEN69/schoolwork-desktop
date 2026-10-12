# Google sign-in in SchoolWork

Users click **Sign in with Google**, choose an account in their default browser,
and approve the requested permissions. They do not create a Cloud project, paste
client credentials, or install a browser extension. SchoolWork uses a publisher-owned
Desktop OAuth client with PKCE and a short-lived loopback callback. User refresh
tokens remain encrypted in their own local profile; the shared client does not
contain anyone's user token. Existing custom client connections are preserved.

Calendar event permission is requested at connection time. Drive read permission
is optional and off by default. Google may block connections because of organization
policy, declined permissions, testing restrictions, or pending app verification.
Cancel sign-in closes the callback and aborts an in-flight token exchange. Closing
the settings dialog does not revoke a connected account. Disconnect removes the
local refresh token and attempts to revoke the Google grant.

## Publisher setup (one time, not per user)

1. Own a Google Cloud project, enable Calendar API and, for optional Drive, Drive API.
2. Configure the SchoolWork consent screen with external audience, truthful support,
   home page and privacy information. Register a **Desktop app** OAuth client and
   designate it for AI-powered agent use, as required by Google's client guidance.
3. Supply `SCHOOLWORK_GOOGLE_CLIENT_ID` and `SCHOOLWORK_GOOGLE_CLIENT_SECRET` to the
   build. GitHub release CI reads the ID from an Actions variable and the desktop
   client secret from an Actions secret with those names. Do not commit downloaded
   credential JSON, user tokens, or `.env`. This is a public installed-app client:
   its client identifier/secret are necessarily extractable from the desktop binary,
   as Google's native-app documentation explains. A web/server client secret must
   never be embedded instead. PKCE protects individual authorization exchanges.
4. For use beyond test users, configure production publication and complete Google's
   required brand/scope verification. A working developer login does not prove
   unrestricted public availability. Drive read-all-files permission is restricted;
   Calendar event access is sensitive. Do not label the integration ready for everyone
   until those restrictions and organization policies have been tested.
5. Verify two different accounts, restart/refresh, declined permissions, cancellation,
   disconnect, one reviewed Calendar write and optional Drive read. Never perform
   a real Calendar write just to test login without the user's explicit instruction.

Builds without publisher credentials show an honest unavailable state and keep custom
connections behind **Advanced: custom Google app**. They never launch a made-up client.
Ordinary build/test runs can omit Google configuration. Packaged public releases must
use real provisioned publisher values; synthetic fixture values are never released.

## Data handling to disclose in the consent/privacy information

The application stores authorized tokens locally using Electron safeStorage. Calendar
events and explicitly requested Drive document excerpts can be returned by assistant
tools and sent to the selected TeachGPT endpoint as context for the user's request.
No user token is sent to TeachGPT. The publisher must confirm the school endpoint's
data-processing terms and disclose this transfer before production verification.
Disconnecting Google does not delete prior local conversations, lesson transcripts,
or already-created events. Local history deletion and Google event deletion are separate.
This file describes behavior; it is not a claim that Google has verified the application.

References: [Desktop OAuth](https://developers.google.com/identity/protocols/oauth2/native-app),
[production requirements](https://developers.google.com/identity/protocols/oauth2/production-readiness/policy-compliance),
[app states](https://developers.google.com/identity/protocols/oauth2/production-readiness/overview).
