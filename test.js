var test = require('tap').test
var swarm = require('./')

test('swarm destroys immediately', t => new Promise(resolve => {
  var s = swarm({dht: false, utp: false})
  s.destroy(function () {
    t.ok(true, 'destroyed ok')
    resolve()
  })
}))

test('swarm destroys immediately (utp)', t => new Promise(resolve => {
  var s = swarm({dht: false, tcp: false})
  s.destroy(function () {
    t.ok(true, 'destroyed ok')
    resolve()
  })
}))

test('two swarms connect locally', t => new Promise(resolve => {
  var pending = 0
  var swarms = []

  create()
  create()

  function create () {
    var s = swarm({dht: false, utp: false})
    swarms.push(s)
    pending++
    s.join('test')

    s.on('connection', function (connection) {
      t.ok(connection, 'got connection')
      if (--pending === 0) {
        resolve(swarms)
      }
    })

    return s
  }
}).then(cleanupSwarms))

test('two swarms connect and exchange data (tcp)', t => new Promise(resolve => {
  var a = swarm({dht: false, utp: false})
  var b = swarm({dht: false, utp: false})

  a.on('connection', function (connection, info) {
    t.ok(info.host && typeof info.host === 'string', 'got info.host')
    t.ok(info.port && typeof info.port === 'number', 'got info.port')
    connection.write('hello')
    connection.on('data', function (data) {
      t.equals(Buffer.compare(data, Buffer.from('hello')), 0, 'received correct data')
      resolve([a, b])
    })
  })

  b.on('connection', function (connection, info) {
    t.ok(info.host && typeof info.host === 'string', 'got info.host')
    t.ok(info.port && typeof info.port === 'number', 'got info.port')
    connection.pipe(connection)
  })

  a.join('test')
  b.join('test')
}).then(cleanupSwarms))

test('two swarms connect and exchange data (utp)', t => new Promise(resolve => {
  var a = swarm({dht: false, tcp: false})
  var b = swarm({dht: false, tcp: false})

  a.on('connection', function (connection, info) {
    t.ok(info.host && typeof info.host === 'string', 'got info.host')
    t.ok(info.port && typeof info.port === 'number', 'got info.port')
    connection.write('hello')
    connection.on('data', function (data) {
      t.equals(a._tcp, null, 'no tcp handler')
      t.equals(b._tcp, null, 'no tcp handler')
      t.equals(Buffer.compare(data, Buffer.from('hello')), 0, 'received correct data')
      resolve([a, b])
    })
  })

  b.on('connection', function (connection, info) {
    t.ok(info.host && typeof info.host === 'string', 'got info.host')
    t.ok(info.port && typeof info.port === 'number', 'got info.port')
    connection.pipe(connection)
  })

  a.join('test')
  b.join('test')
}).then(cleanupSwarms))

test('two swarms connect and callback', t => new Promise(resolve => {
  var a = swarm({dht: false, utp: false})
  var b = swarm({dht: false, utp: false})
  var pending = 2

  a.join('test', function () {
    t.pass('connected')
    if (!--pending) done()
  })
  b.join('test', function () {
    t.pass('connected')
    if (!--pending) done()
  })

  function done () {
    resolve([a, b])
  }
}).then(cleanupSwarms))

test('connect many and send data', t => new Promise(resolve => {
  var runs = 10
  var outer = 0
  var swarms = []

  for (var i = 0; i < runs; i++) create(i)

  function create (i) {
    var s = swarm({dht: false, utp: false})
    swarms.push(s)

    var seen = {}
    var cnt = 0

    s.on('connection', function (connection) {
      connection.write('' + i)
      connection.on('data', function (data) {
        if (seen[data]) return
        seen[data] = true
        t.pass('swarm #' + i + ' received ' + data)
        if (++cnt < runs - 1) return
        if (++outer < runs) return

        resolve(swarms)
      })
    })

    s.join('test')
  }
}).then(cleanupSwarms))

test('socket should get destroyed on a bad peer', t => 
  new Promise(function (resolve, reject) {
    var s = swarm({dht: false, utp: false})
    var connectingCalled = false
    var port = 10003

    s.on('connecting', function (conn) {
      connectingCalled = true
      t.equals(conn.port, port, 'port')
    })
    s.on('connect-failed', function (peer) {
      t.ok(connectingCalled, 'connecting event was called')
      t.equals(peer.port, port, 'connecting to the peer failed')
      t.equal(s.totalConnections, 0, '0 connections')
      resolve([s])
    })
    s.on('close', () => reject(new Error('Premature close!')))
    s.on('error', reject)
    s.on('connection', () => reject(new Error('unexpected connection')))
    s.addPeer('test', port) // should not connect
  }).then(cleanupSwarms)
)

test('swarm should not connect to self', t => new Promise(resolve => {
  var s = swarm({dht: false, utp: false})

  s.on('connection', function (connection) {
    t.false(connection, 'should never get here')
    end()
  })

  setTimeout(function () {
    t.equal(s.totalConnections, 0, '0 connections')
    end()
  }, 250)

  s.join('test')

  function end () {
    resolve([s])
  }
}).then(cleanupSwarms))

test('swarm ignore whitelist', t => new Promise(resolve => {
  var s = swarm({dht: false, utp: false, whitelist: ['9.9.9.9']})
  t.equals(s.addPeer('127.0.0.1', 9999), false)
  resolve([s])
}).then(cleanupSwarms))

function cleanupSwarms (swarms) {
  return new Promise((resolve, reject) => {
    var count = 0
    swarms.forEach(function (swarm, i) {
      swarm.removeAllListeners('close')
      swarm.on('error', reject)
      swarm.destroy(function () {
        if (++count === swarms.length) {
          resolve()
        }
      })
    })
  })
}
