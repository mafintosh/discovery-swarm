var DC = require('discovery-channel')
var net = require('net')
try {
  var utp = require('utp-native')
} catch (err) {
  var utp = null
}
var connections = require('connections')
var lpmessage = require('length-prefixed-message')
var crypto = require('crypto')
var events = require('events')
var util = require('util')

var CONNECT_TIMEOUT = 3000

module.exports = Swarm

function Swarm (opts) {
  if (!(this instanceof Swarm)) return new Swarm(opts)
  if (!opts) opts = {}

  events.EventEmitter.call(this)

  var self = this

  this._discovery = opts.discovery || DC(opts)
  this._discovery.on('peer', function (hash, peer) {
    var peerId = peer.host + ':' + peer.port

    if (self._peersSeen[peerId]) return
    self._peersSeen[peerId] = true
    self._peersQueued.push(peer)
    connectPeer()
  })

  this._peersQueued = []
  this._peersSeen = {}

  this._tcpServer = net.createServer(onconnection)
  this._utpServer = utp && opts.utp && utp.createServer(onconnection)
  this._outboundConnections = {}
  this._inboundConnections = {}
  this._banned = {}
  this._port = 0

  this.maxConnections = opts.maxConnections || 100
  this._tcpServer.maxConnections = this.maxConnections
  if (this._utpServer) this._utpServer.maxConnections = this.maxConnections

  this.id = opts.id || crypto.randomBytes(32)
  var servers = this._utpServer ? [this._tcpServer, this._utpServer] : [this._tcpServer]

  this.allConnections = connections(servers)
  this._connections = connections([])

  this.allConnections.on('close', connectPeer)

  this._connections.on('close', function (connection) {
    delete self._outboundConnections[connection.remoteId]
    delete self._inboundConnections[connection.remoteId]
    connectPeer()
  })

  this._connections.on('connection', function (connection) {
    var type = self._utpServer && (connection._utp === self._utpServer ? 'utp' : 'tcp')
    self.emit('connection', connection, type)
  })

  this.connections = this._connections.sockets

  function connectPeer () {
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

    function onerror (err) {
      this.destroy()
    }

    function ontimeout () {
      tcpSocket.destroy()
      utpSocket.destroy()
    }
  }

  function onconnection (connection, peer) {
    connection.on('error', function () {
      connection.destroy()
    })

    lpmessage.write(connection, self.id)
    lpmessage.read(connection, function (remoteId) {
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
  this._peersQueued.push(peer)
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
