<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://protocol.streetmesh.com/brand/dark/svg/streetmesh-mark-dark.svg">
  <img alt="StreetMesh" src="https://protocol.streetmesh.com/brand/svg/streetmesh-mark.svg" width="96">
</picture>

# StreetMesh Hub

**The authoritative half of a venue: rooms, and who is allowed in them.**

A game of chess needs somewhere the board actually lives — somewhere that
decides whose turn it is and refuses a move that is not legal, no matter what a
browser claims. That is this. It is the only part of StreetMesh that is
authoritative over what is happening *right now*.

It is not authoritative over what happened. That belongs to the venue, which
signs the record, and to the person whose records it goes into.

## What it knows, and what it deliberately does not

Hub knows nothing about federation. It cannot resolve a handle, has never heard
of a DID directory, and holds no permission over anybody's records.

What it receives is a **ticket**: a short-lived assertion, signed by the venue
with the key that venue already publishes, saying *this person may sit in this
seat in this room*. Hub fetches the venue's DID document, checks a signature,
and that is the whole of its security model.

So it holds **no credential**. No shared secret, no private key, nothing to
steal and nothing it could use to assert anything back to the venue. If this
process were entirely compromised, what an attacker would gain is the ability to
lie about a game in progress — not to forge a record, not to reach anybody's
domicile, and not to impersonate the venue.

```
venue  ──signs a ticket──▶  browser  ──presents it──▶  hub
                                                        │
venue  ◀──── asks what happened, when it wants to ──────┘
```

Trust runs one way. Hub never calls the venue, never pushes, never asserts.

## State, and what survives a restart

**Hub is authoritative over the moment. The venue is authoritative over the
record.**

A room is a fast, rebuildable view of state the venue owns. Restart Hub and
rooms reopen from the venue; a game nobody is playing has no room at all. Which
gives one rule an experience author has to think about:

> Anything that must survive a restart has to be in the venue before it is
> acknowledged to a player.

Blitz chess can acknowledge a move here and persist it a beat later — a crash
between the two loses one move, and that is survivable. Correspondence chess
cannot. The framework asks an author to say which, rather than choosing for them
and being wrong half the time.

## Checking it

```sh
./check-ticket
```

Mints a real ticket in PHP and verifies it here, which is the seam least likely
to be caught by either side's own tests. Between the two languages sit base58, a
multicodec prefix, a compressed curve point whose y coordinate has to be
recovered by solving the curve equation, base64url without padding, and an ECDSA
signature as a raw r‖s pair rather than the DER most libraries hand you. A test
written here that minted its own tickets would pass with every one of those
wrong.

It needs a StreetMesh server running locally — see
[`Server`](https://github.com/StreetMesh/Server).

**Node does not read the system keychain.** The script points it at Herd's
certificate authority, because without that every fetch of a `.test` DID
document fails and the failure looks exactly like a ticket that will not verify.
That cost the prototype time twice, which is why it is a script rather than a
command to remember.

## Where this fits

| | |
| --- | --- |
| [`Protocol`](https://github.com/StreetMesh/Protocol) | What StreetMesh is. Guides, decisions, conformance vectors. |
| [`Protocol-PHP`](https://github.com/StreetMesh/Protocol-PHP) | The framework-free implementation. |
| [`Protocol-Laravel`](https://github.com/StreetMesh/Protocol-Laravel) | The same, bound to Laravel — including minting the tickets this checks. |
| [`Server`](https://github.com/StreetMesh/Server) | Where to start if you want to run one. |
| **`Hub`** | This. The authoritative multiplayer host. |

## License

MIT.
