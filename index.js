var DC = require('discovery-channel')
var net = require('net')
try {
  var utp = require('utp-native')
} catch (err) {}
var connections = require('connections')
var lpmessage = require('length-prefixed-message')
var crypto = require('crypto')
var events = require('events')
var util = require('util')
var pump = require('pump')

var CONNECT_TIMEOUT = 3000

module.exports = Swarm

function addHandshake (self, connection) {
  // momentarily hijacks the transport to send the id so that all sockets can
  // be associated with peer ids. only sends id then normal socket data flows
  lpmessage.write(connection, self.id)
  lpmessage.read(connection, function (remoteId) {
    connection.remoteId = remoteId
    connection.emit('handshake')
  })
}

function Swarm (opts) {
  if (!(this instanceof Swarm)) return new Swarm(opts)
  if (!opts) opts = {}

  events.EventEmitter.call(this)

  var self = this

  this._discovery = opts.discovery || DC(opts)
  this._discovery.on('peer', function (hash, peer) {
    self.addPeer(peer)
  })

  this._peersQueued = []
  this._peersSeen = {}

  this._tcpServer = net.createServer(onconnection)
  this._utpServer = utp && opts.utp && utp.createServer(onconnection)
  this._outboundConnections = {}
  this._inboundConnections = {}
  this._banned = {}
  this._port = 0
  this._destroyed = false

  this.maxConnections = opts.maxConnections || 100
  this._tcpServer.maxConnections = this.maxConnections
  if (this._utpServer) this._utpServer.maxConnections = this.maxConnections

  this.id = opts.id || crypto.randomBytes(32)
  var servers = this._utpServer ? [this._tcpServer, this._utpServer] : [this._tcpServer]

  this.allConnections = connections(servers)
  this._connections = connections([])

  this.allConnections.on('close', connectPeer)

  this._connections.on('close', function (connection) {
    if (connection.remoteId) {
      delete self._outboundConnections[connection.remoteId.toString('hex')]
      delete self._inboundConnections[connection.remoteId.toString('hex')]
    }
    connectPeer()
  })

  this._connections.on('connection', function (connection) {
    var type = self._utpServer && (connection._utp === self._utpServer ? 'utp' : 'tcp')
    self.emit('connection', connection, type)
  })

  this.connections = this._connections.sockets
  this._connectPeer = connectPeer

  if (this._utpServer) this._utpServer.on('error', onerror)
  if (this._tcpServer) this._tcpServer.on('error', onerror)

  function onerror (err) {
    self.emit('error', err)
  }

  function connectPeer () {
    if (self._destroyed) return
    if (self.connections.length >= self.maxConnections) return
    if (self.allConnections.length >= self.maxConnections) return

    var peer = self._peersQueued.shift()
    if (!peer) return

    var tcpSocket = net.connect(peer.port, peer.host)
    var utpSocket = self._utpServer && self._utpServer.connect(peer.port, peer.host)
    var timeout = setTimeout(ontimeout, CONNECT_TIMEOUT)

    if (utpSocket) {
      self.allConnections.add(utpSocket)
      utpSocket.on('connect', onconnect)
      utpSocket.on('error', onerror)
    }

    self.allConnections.add(tcpSocket)
    tcpSocket.on('connect', onconnect)
    tcpSocket.on('error', onerror)

    function onconnect () {
      clearTimeout(timeout)
      var other = this === tcpSocket ? utpSocket : tcpSocket
      if (other) other.destroy()
      self.allConnections.add(this)
      onconnection(this, peer)
    }

    function onerror () {
      this.destroy()
    }

    function ontimeout () {
      tcpSocket.destroy()
      if (utpSocket) utpSocket.destroy()
    }
  }

  function onconnection (connection, peer) {
    connection.on('error', function () {
      connection.destroy()
    })

    if (opts.stream) {
      var stream = opts.stream()
      pump(connection, stream, connection)
      connection = stream
    } else {
      addHandshake(self, connection)
    }

    connection.on('handshake', function () {
      var remoteId = connection.remoteId
      var idHex = self.id.toString('hex')
      var remoteIdHex = remoteId.toString('hex')

      if (idHex === remoteIdHex) {
        if (peer) self.banPeer(peer)
        connection.destroy()
        return
      }

      if (self._inboundConnections[remoteIdHex] || self._outboundConnections[remoteIdHex]) {
        // TODO: maybe destroy the old one?
        connection.destroy()
        return
      }

      if (peer) {
        self._outboundConnections[remoteIdHex] = true
      } else {
        self._inboundConnections[remoteIdHex] = true
      }

      connection.peer = peer
      connection.remoteId = remoteId
      self._connections.add(connection)
    })
  }
}

util.inherits(Swarm, events.EventEmitter)

Swarm.prototype.__defineGetter__('peersQueued', function () {
  return this._peersQueued.length
})

Swarm.prototype.__defineGetter__('peersConnected', function () {
  return this.connections.length
})

Swarm.prototype.__defineGetter__('peersConnecting', function () {
  return this.allConnections.length - this.connections.length
})

Swarm.prototype.banPeer = function (peer) {
  this._banned[peer.host + ':' + peer.port] = true
}

Swarm.prototype.addPeer = function (peer) {
  var peerId = peer.host + ':' + peer.port
  if (this._peersSeen[peerId]) return
  this._peersSeen[peerId] = true
  this._peersQueued.push(peer)
  this._connectPeer()
}

Swarm.prototype.add = function (hash) {
  this._discovery.add(hash, this._port)
}

Swarm.prototype.remove = function (hash) {
  this._discovery.remove(hash, this._port)
}

Swarm.prototype.listen = function (port) {
  this._port = port
  this._tcpServer.listen(port)
  if (this._utpServer) this._utpServer.listen(port)
}

Swarm.prototype.destroy = function () {
  if (this._destroyed) return
  this._destroyed = true
  this._discovery.destroy()
  this.allConnections.destroy()
  this._connections.destroy()
  if (this._port) {
    if (this._utpServer) this._utpServer.close()
    this._tcpServer.close()
  }
}
