# discovery-swarm

A network swarm that uses [discovery-channel](https://github.com/maxogden/discovery-channel) to find and connect to peers.

This module implements peer connection state and builds on discovery-channel which implements peer discovery. This uses TCP sockets by default and has experimental support for UTP.

```
npm install discovery-swarm
```

[![build status](http://img.shields.io/travis/mafintosh/discovery-swarm.svg?style=flat)](http://travis-ci.org/mafintosh/discovery-swarm)

## Usage

``` js
var swarm = require('discovery-swarm')

var sw = swarm()

sw.listen(1000)
sw.join('ubuntu-14.04') // can be any id/name/hash

sw.on('connection', function (connection) {
  console.log('found + connected to peer')
})
```

## API

#### `var sw = swarm(opts)`

Create a new swarm. Options include:
```js
{
  id: crypto.randomBytes(32), // peer-id for user
  stream: stream, // stream to replicate across peers
  connect: fn, // connect local and remote streams yourself
  utp: true, // use utp for discovery
  tcp: true, // use tcp for discovery
  maxConnections: 0, // max number of connections.
  whitelist: [] // array of ip addresses to restrict connections to
}
```

For full list of `opts` take a look at [discovery-channel](https://github.com/maxogden/discovery-channel)

#### `sw.join(key, [opts], [cb])`

Join a channel specified by `key` (usually a name, hash or id, must be a **Buffer** or a **string**). After joining will immediately search for peers advertising this key, and re-announce on a timer.

If you pass `opts.announce` as a falsy value you don't announce your port (e.g. you will be in discover-only mode)

If you specify cb, it will be called *when the first round* of discovery has completed. But only on the first round.

#### `sw.leave(key)`

Leave the channel specified `key`

#### `sw.connecting`

Number of peers we are trying to connect to

#### `sw.queued`

Number of peers discovered but not connected to yet

#### `sw.connected`

Number of peers connected to

#### `sw.on('peer', function(peer) { ... })`

Emitted when a peer has been discovered. Peer is an object that contains info about the peer.

```js
{
  channel: Buffer('...'), // the channel this connection was initiated on.
  host: '127.0.0.1', // the remote address of the peer.
  port: 8080, // the remote port of the peer.
  id: '192.168.0.5:64374@74657374', // the remote peer's peer-id.
  retries: 0 // the number of times tried to connect to this peer.
}
```


#### `sw.on('peer-banned', function(peerAddress, details) { ... })`

Emitted when a peer has been banned as a connection candidate. peerAddress is an object that contains info about the peer. Details is an object that describes the rejection.

```js
{
  reason: 'detected-self' // may be 'application' (removePeer() was called) or 'detected-self'
}
```

#### `sw.on('peer-rejected', function(peerAddress, details) { ... })`

Emitted when a peer has been rejected as a connection candidate. peerAddress is an object that contains info about the peer. Details is an object that describes the rejection

```js
{
  reason: 'duplicate' // may be 'duplicate', 'banned', or 'whitelist'
}
```

#### `sw.on('drop', function(peer) { ... })`

Emitted when a peer has been dropped from tracking, typically because it failed too many times to connect. Peer is an object that contains info about the peer.

#### `sw.on('connecting', function(peer) { ... })`

Emitted when a connection is being attempted. Peer is an object that contains info about the peer.

#### `sw.on('connect-failed', function(peer, details) { ... })`

Emitted when a connection attempt fails. Peer is an object that contains info about the peer. Details is an object that describes the failure

```js
{
  timedout: true // was the failure a timeout?
}
```

#### `sw.on('handshaking', function(connection, info) { ... })`

Emitted when you've connected to a peer and are now initializing the connection's session. Info is an object that contains info about the connection.

``` js
{
  type: 'tcp', // the type, tcp or utp.
  initiator: true, // whether we initiated the connection or someone else did.
  channel: Buffer('...'), // the channel this connection was initiated on. only set if initiator === true.
  host: '127.0.0.1', // the remote address of the peer.
  port: 8080, // the remote port of the peer.
  id: Buffer('...') // the remote peer's peer-id.
}
```

#### `sw.on('handshake-timeout', function(connection, info) { ... })`

Emitted when the handshake fails to complete in a timely fashion. Info is an object that contains info about the connection.

#### `sw.on('connection', function(connection, info) { ... })`

Emitted when you have fully connected to another peer. Info is an object that contains info about the connection.

#### `sw.on('connection-closed', function(connection, info) { ... })`

Emitted when you've disconnected from a peer. Info is an object that contains info about the connection.

#### `sw.on('redundant-connection', function(connection, info) { ... })`

Emitted when multiple connections are detected with a peer, and so one is going to be dropped (the `connection` given). Info is an object that contains info about the connection.

#### `sw.listen(port)`

Listen on a specific port. Should be called before join

## License

MIT
