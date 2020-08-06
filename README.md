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

### With thanks to:

- WebTorrent Creators
- Bram Cohen
- Bitping Team
- Hyperswarm Team
