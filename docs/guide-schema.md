# Guide schema (v1)

Each guide is one JSON file in `data/guides/<slug>.json`. Every factual claim carries an `evidence` object.

```jsonc
{
  "slug": "gmail",
  "name": "Gmail",
  "provider": "Google",
  "website": "https://mail.google.com",
  "developer_portal": "https://console.cloud.google.com/apis/credentials",
  "category": "Email",
  "composio": {
    "toolkit": "gmail",
    "managed_oauth": true,            // true if on docs.composio.dev/toolkits/managed-auth "managed" list
    "note": "You can build on Composio's managed app while your own app is in verification."
  },
  "verdict": {
    "difficulty": "easy | medium | hard",
    "headline": "One plain sentence a developer can act on.",
    "hands_on_time": "30-60 min",     // your active work to get a first connection
    "first_connection": "same day",   // when YOU can connect your own account
    "public_launch": "4-8 weeks",     // when ANY user can connect (incl. review wait)
    "approval": "none | automatic | manual review | partner program",
    "evidence": { "type": "tested | sourced | uncertain", "sources": ["s1"], "note": "" }
  },
  "stages": [
    {
      "id": "register | self_test | limited | public",
      "title": "Register the OAuth app",
      "who_can_connect": "Only you / up to 100 test users / anyone",
      "limits": "e.g. 100 test users, refresh tokens expire after 7 days in Testing mode",
      "approval": "none | automatic | manual review | partner program",
      "wait": "none | minutes | days | weeks",
      "steps": [
        { "text": "Create a project in Google Cloud Console", "owner": "agent | you | provider",
          "url": "https://...", "evidence": { "type": "tested", "sources": ["s1"], "note": "" } }
      ]
    }
  ],
  "requirements": [
    { "text": "Verified domain + public privacy policy URL", "applies_when": "Going public with sensitive scopes",
      "evidence": { "type": "sourced", "sources": ["s2"] } }
  ],
  "blockers": [
    { "title": "CASA security assessment", "when": "Restricted scopes (e.g. gmail.readonly) for public apps",
      "impact": "Annual third-party assessment; weeks and can cost money", "workaround": "Use non-restricted scopes, or stay internal (Workspace org-only)",
      "evidence": { "type": "sourced", "sources": ["s3"] } }
  ],
  "scopes": [ { "scope": "https://www.googleapis.com/auth/gmail.readonly", "tier": "restricted", "note": "" } ],
  "agent_can": [ "Look up current requirements", "Fill the app registration form", "Paste the redirect URI" ],
  "you_must": [ "Sign in to the provider", "Verify your domain", "Submit for review and answer reviewer emails" ],
  "redirect_uri": "https://backend.composio.dev/api/v3/toolkits/auth/callback",
  "uncertain": [ "Things we could not confirm, stated plainly" ],
  "sources": [ { "id": "s1", "title": "Google: Setting up OAuth consent", "url": "https://...", "accessed": "2026-10-20" } ],
  "verification_log": [ { "date": "2026-10-20", "method": "setup attempt | doc check", "what": "Created OAuth client in test project", "result": "Worked; client created instantly" } ],
  "generated_by": "curated | agent",
  "updated_at": "2026-10-20"
}
```

Evidence types:
- **tested**: an agent (or we) actually performed the step and saw the result.
- **sourced**: stated in a linked, current source (provider docs preferred over blogs).
- **uncertain**: inferred or conflicting sources; say why.
