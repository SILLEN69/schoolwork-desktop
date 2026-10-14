# SchoolWork 0.11.0-beta.9

Fix board capture incorrectly saying no cast is running while a YeetCast presentation is visible.

The real receiver uses Livewire 4 Eloquent model references, not inline sender names/sending fields. Its fresh HTML has active=false, connections=true and a valid view URI. Beta.8's test fixture incorrectly supplied inline sending fields.

SchoolWork now treats a validated connected view as a candidate, opens it read-only and confirms a decoded video frame before capture. It retains that observed readiness across metadata refreshes and clears it on stream change, network failure or viewer closure. The UI distinguishes a stream candidate from an observed active picture. Diagnostics count model references without recording model keys, stream URLs, codes or identities.

Verification includes the actual currently selected classroom receiver: HTTP 200, one Eloquent sender reference, one view stream, decoded live frame and successful screenshot. The captured presentation was visually inspected locally. Classroom images, identifiers and raw receiver pages are excluded from Git and release assets. A deterministic regression fixture now matches that real Livewire format.

First-time code lookup can still briefly reload the physical receiver; this release does not modify YeetCast's server. Existing capture timestamps/audio alignment, credentials, chats and application ID are preserved. Beta diagnostics must be removed before main promotion.
