# Human Exchange Protocol

A cryptographic protocol for recording cooperative acts between two people.

No servers. No accounts. No money.

## What this is

Human Exchange Protocol (HEP) is a system that lets two people standing in front of each other create a signed, verifiable record of a cooperative act. Each participant maintains a personal chain of these records on their own device. Nothing is uploaded. Nothing is stored on someone else's computer.

The protocol is built on a simple premise: if two people do something good together, there should be a way to record that fact without asking permission from a platform, a company, or a government.

## How it works

Each record in a participant's chain contains:

- A hash of the previous record in the chain (hash-linked)
- Dual hashing for integrity verification
- An ECDSA P-256 digital signature from each participant
- A description of the cooperative act
- A timestamp

Both participants sign the record. Both receive a copy. Each copy is appended to that person's personal chain. The chains are independent — there is no shared ledger, no consensus mechanism, no network required.

## Proof of human, not proof of work

This protocol does not mine anything. It does not stake anything. It does not speculate on anything. It verifies that two real people chose to stand together and record a cooperative act. That is the only thing it proves, and it is enough.

## Design principles

- **Offline first.** Works without an internet connection on a basic smartphone.
- **No servers.** Your chain lives on your device. Period.
- **No accounts.** No usernames, no passwords, no email verification.
- **No money.** The protocol is not a currency, a token, or a financial instrument.
- **No commercialization.** This is not a product. It will never be a product.
- **Portable.** Built with Tauri for cross-platform desktop support. Mobile support is a goal.

## Current status

This project is in early development. The protocol specification is being finalized and the reference implementation is being built as a Tauri Android and desktop application.

## Getting involved

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to participate, whether that means forking the project or collaborating on the core.

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for community standards.

## License

This project is licensed under the [GNU Affero General Public License v3.0](LICENSE). The protocol belongs to the people who use it.

## Contact

hello@humanexchangeprotocol.org
