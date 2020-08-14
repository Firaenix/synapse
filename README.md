# Knot

## A bittorrent inspired, highly modular p2p data transfer system.

## Notable Changes

- Metainfo pieces list is actually a list, not a concatenated hex string, because we can select specific hashing algorithms to calculate the piece hashes.

## Notes:

### WebRTC Support

- Although this client does support WebRTC in both the browser and the server, a WS proxy server and Discovery server must be specified. (No data will flow through these servers, it is purely used to allow peers to discover eachother)
- Discovery Server: https://github.com/geut/discovery-swarm-webrtc
- Proxy Server: https://github.com/RangerMauve/hyperswarm-web#setting-up-a-proxy-server

### Bittorrent DHT

- When saving data to a DHT it is SHA1 hashed as a limitation of bittorrent-dht. So when we use an infosig, it becomes SHA1(YOUR_SIG(YOUR_HASH(METAINFO))) or for infohash its SHA1(YOUR_HASH(METAINFO))

### To Do:

- [ ] Figure out a nice way to handle streaming chunks in order for consumers

- [ ] Reduce memory pressure by having the piece buffer be backed by disk

- [ ] Smart piece management

- [ ] Rarest Piece first?

- [ ] Retry logic

- [ ] Multiple Peer handling

- [x] WebRTC

- [x] TCP

- [x] UDP

- [x] Browser compatibility

- [x] Node JS Server

- [x] New Metainfo Spec

- [x] DHT compatibility (Using Hyperswarm)

- [x] Signatures in Metainfo

- [ ] Merkel Tree for file pieces hash

- [ ] Nice API for accessing torrents on the fly Torrent.stream, yield Torrent.nextPiece()

### Thoughts:

Mutable Torrents:

- In the standard Mutable Torrent spec, it specifies that you should use 1 priv/pub key per torrent (seemingly).  
  However, the issue with that in regards to this service is that users would need to store many many private/public keys per each file uploaded.  
  This is a pain in the ass and although it should be possible, it should not be required.

- Instead of 1 keypair per torrent, I propose using a signature of the infohash of the original torrent.  
  eg. HASH(OriginalInfoSig) -> { NewInfoHash, SIG(NewInfoHash), PublicKey, OriginalInfoSig, seq }
  1. This would allow someone to look up the newest infohash from the original infosig.
  2. Validate that the NewInfoHash + SIG(NewInfoHash) is valid with the public key.
  3. Validate that the PublicKey published in the update is the same PublicKey associated with the OriginalInfoSig.
  4. Use seq to identify what iteration of the torrent we are looking at.

Application Structure:

- Each added Torrent exists within its own scope/lifecycle. (TorrentManager.addTorrent)
- Each Torrent remembers a list of peers (PeerManager) and which pieces it has along with the InfoHash associated
- Observer Pattern, Torrent Manager sits in the middle and recieves events.
  1. For example, when a new peer is found, the Peer Manager alerts the TorrentManager, to which the torrent manager will ask what pieces they have.
  2. Or another example, when the UpdateScanner notices there is a new update for a given InfoSig, it will call back to the TorrentManager to get the latest metainfo file and validate which pieces have changed.
- What do you need to seed a torrent?
  1. Metainfo
  2. Pieces
- What do you need to leech a torrent?
  1. InfoHash/InfoSig
- Search for Metainfo from InfoIdentifier (InfoID)
  1. Search DHT for Peers with the given InfoID
  2. Use ut_metadata extension to retrieve metainfo
  3. Start standard TorrentManager with no pieces
- InfoID vs InfoHash vs InfoSig  
  InfoID is the generic name for either the InfoHash or the InfoSig.  
  If an InfoSig exists, use that instead of InfoHash.  
  InfoSig implies a pseudonymous user has uploaded data that may be mutated in the future.  
  InfoHash is an immutable store of a value.

### With thanks to:

- WebTorrent Creators
- Bram Cohen
- Bitping Team
- Hyperswarm Team
