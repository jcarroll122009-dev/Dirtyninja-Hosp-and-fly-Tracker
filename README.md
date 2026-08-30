# DirtyNinja War Tracker

A Tampermonkey userscript for Torn that displays an enemy faction's hospital and flight status.

It also shows whether each faction member is Online, Idle, or Offline based on Torn's latest activity status.

The Activity sort places Online members first, Idle members next, and Offline members last. The sort button can switch between Activity, Condition, and Name.

## Install

1. Install Tampermonkey (or another compatible userscript manager).
2. Open the raw userscript link:
   `https://raw.githubusercontent.com/jcarroll122009-dev/Dirtyninja-Hosp-and-fly-Tracker./main/torn-war-tracker.user.js`
3. Choose **Install** in Tampermonkey.
4. Open Torn, click the tracker's gear button, and enter:
   - Your own Public-access Torn API key.
   - The enemy faction ID you want to track.

Every user supplies their own settings. No API key or faction ID is included in the shared script. Settings are kept separately in each user's userscript-manager storage.

## Updates

Tampermonkey checks the script's `@updateURL`. Publish a newer `@version` to the repository's `main` branch whenever you release an update.

For example, change:

```javascript
// @version      1.1.4
```

to:

```javascript
// @version      1.1.5
```

Users can also open the Tampermonkey dashboard and manually check for userscript updates.

## Privacy

The script sends the user's API key only to `https://api.torn.com`. Users should create a Public-access key when possible and should never share their API key with another person.
