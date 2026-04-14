# Human Exchange Protocol

A cryptographic protocol for recording cooperative acts between people.

## What this is

Human Exchange Protocol (HEP) is a system that lets two people create a signed, verifiable record of a cooperative act. Each participant maintains a personal chain of these records on their own device. The chain is hash-linked and digitally signed. Nothing is uploaded. Nothing is stored on someone else's computer unless you choose to request witness attestation.

The protocol is built on a simple premise: cooperation preceded money by 150,000 years. If two people do something good together, there should be a way to record that fact without asking permission from a platform, a company, or a government.

## How it works

Each record in a participant's chain contains:

- A hash of the previous record (hash-linked integrity)
- Dual hashing (SHA-256 + SHA3-256) for verification
- ECDSA P-256 digital signatures from both participants
- A description, category, and valuation of the cooperative act
- Device sensor data and timestamps
- Optional witness server attestation (independent timestamp from a server neither party controls)

Both participants sign the record. Both receive a copy. Each copy is appended to that person's personal chain. The chains are independent. There is no shared ledger, no consensus mechanism, no central authority.

## Proof of human, not proof of work

This protocol does not mine anything. It does not stake anything. It does not speculate on anything. Honest participants pay nothing. Fabricators must simulate physical reality across many locations over extended time. The chain is a revelation engine: its purpose is to make dishonesty visible, not to prevent it.

## Architecture

**The app** is a Progressive Web App (PWA) served as static files. It runs entirely in the browser. After first load, it works offline via service worker caching.

**Witness servers** provide independent timestamp attestation. They sign a statement: "I saw this hash at this time." They never see exchange content. They never validate chains. They never score, rank, or block anyone.

**This repository** contains the app source files and is deployed via GitHub Pages.

## Repository structure

- `index.html` - App shell, all UI markup and CSS
- `hep-core.js` - Protocol engine (cryptography, chain operations, serialization)
- `hep-app.js` - Application layer (UI logic, exchange flow, witness client)
- `sw.js` - Service worker (caching, offline support, PWA install)
- `manifest.json` - PWA manifest (install metadata, icons)
- `version.json` - Current version info (used by app update checker)
- `vendor/qrcode.js` - QR code generation library
- `icon-192.png`, `icon-512.png` - App icons
- `build.sh` - Merges source files into single-file build (hep.html) for offline distribution

## Deployment

The app is deployed automatically via GitHub Pages on every push to main. The live app is at:

- `https://app.humanexchangeprotocol.org/` (custom domain)
- `https://humanexchangeprotocol.github.io/human-exchange-protocol/` (GitHub Pages direct)

The witness server runs separately at `witness.thesitefit.com` on dedicated infrastructure.

## Local development

```
cd /path/to/this/repo
npx serve -p 8080
```

Open `http://localhost:8080` (not the network IP; crypto.subtle requires localhost or HTTPS).

## Design principles

- **Offline first.** Works without internet on a basic smartphone.
- **Sovereign identity.** Your chain lives on your device. You control what others see.
- **No accounts.** No usernames, no passwords, no email verification.
- **No money.** The protocol is not a currency, a token, or a financial instrument.
- **No algorithmic judgment.** The system records behavior. It never scores, ranks, or blocks.
- **The cooperative act is the only mint event.** The symbol cannot precede the thing.

## Current version

Check `version.json` for the current deployed version.

## Getting involved

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to participate.

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for community standards.

## License

This project is licensed under the [GNU Affero General Public License v3.0](LICENSE). The protocol belongs to the people who use it.

## Contact

hello@humanexchangeprotocol.org
