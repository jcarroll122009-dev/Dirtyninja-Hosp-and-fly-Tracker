# DirtyNinja War Tracker

A Tampermonkey userscript for Torn that displays an enemy faction's hospital and flight status.

It also shows whether each faction member is Online, Idle, or Offline based on Torn's latest activity status. An optional FFScouter integration displays estimated total battle stats beside each member's name.

## Install

1. Install Tampermonkey (or another compatible userscript manager).
2. Open the raw userscript link:
   `https://raw.githubusercontent.com/jcarroll122009-dev/Dirtyninja-Hosp-and-fly-Tracker/main/torn-war-tracker.user.js`
3. Choose **Install** in Tampermonkey.
4. Open Torn, click the tracker's gear button, and enter:
   - Your own Public-access Torn API key.
   - The enemy faction ID you want to track.
   - Optionally enable FFScouter battle-stat estimates. Your key must first be registered at `https://ffscouter.com`.

Every user supplies their own settings. No API key or faction ID is included in the shared script. Settings are kept separately in each user's userscript-manager storage.

## Updates

Tampermonkey checks the script's `@updateURL`. Publish a newer `@version` to the repository's `main` branch whenever you release an update.

For example, change:

```javascript
// @version      1.2.1
```

to:

```javascript
// @version      1.2.2
```

Users can also open the Tampermonkey dashboard and manually check for userscript updates.

## Privacy

The script normally sends the user's API key only to `https://api.torn.com`. If the user explicitly enables FFScouter estimates, it also sends the key and requested player IDs to `https://ffscouter.com`. Users should review FFScouter's terms, register their key there first, use the minimum permissions required by the services they enable, and never share their key with another person.
