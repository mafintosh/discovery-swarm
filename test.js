var test = require('tape')
var swarm = require('./')

test('swarm destroys immediately', function (t) {
  var s = swarm({dht: false, utp: false})
  s.destroy(function () {
    t.ok(true, 'destroyed ok')
    t.end()
  })
})

test('swarm destroys immediately (utp)', function (t) {
  var s = swarm({dht: false, tcp: false})
  s.destroy(function () {
    t.ok(true, 'destroyed ok')
    t.end()
  })
})

test('two swarms connect locally', function (t) {
  var pending = 0
  var swarms = []

  create()
  create()

  function create () {
    var s = swarm({dht: false, utp: false})
    swarms.push(s)
    pending++
    s.join('test')

    s.on('connection', function (connection, type) {
      t.ok(connection, 'got connection')
      if (--pending === 0) {
        cleanupSwarms(swarms, t)
      }
    })

    return s
  }
})

test('two swarms connect and exchange data (tcp)', function (t) {
  var a = swarm({dht: false, utp: false})
  var b = swarm({dht: false, utp: false})

  a.on('connection', function (connection, info) {
    t.ok(info.host && typeof info.host === 'string', 'got info.host')
    t.ok(info.port && typeof info.port === 'number', 'got info.port')
    connection.write('hello')
    connection.on('data', function (data) {
      t.same(data, Buffer.from('hello'))
      cleanupSwarms([a, b], t)
    })
  })

  b.on('connection', function (connection, info) {
    t.ok(info.host && typeof info.host === 'string', 'got info.host')
    t.ok(info.port && typeof info.port === 'number', 'got info.port')
    connection.pipe(connection)
  })

  a.join('test')
  b.join('test')
})

test('two swarms connect and exchange data (utp)', function (t) {
  var a = swarm({dht: false, tcp: false})
  var b = swarm({dht: false, tcp: false})

  a.on('connection', function (connection, info) {
    t.ok(info.host && typeof info.host === 'string', 'got info.host')
    t.ok(info.port && typeof info.port === 'number', 'got info.port')
    connection.write('hello')
    connection.on('data', function (data) {
      t.same(a._tcp, null, 'no tcp handler')
      t.same(b._tcp, null, 'no tcp handler')
      cleanupSwarms([a, b], t)
      t.same(data, Buffer.from('hello'))
    })
  })

  b.on('connection', function (connection, info) {
    t.ok(info.host && typeof info.host === 'string', 'got info.host')
    t.ok(info.port && typeof info.port === 'number', 'got info.port')
    connection.pipe(connection)
  })

  a.join('test')
  b.join('test')
})

test('two swarms connect and callback', function (t) {
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
    cleanupSwarms([a, b], t)
  }
})

test('connect many and send data', function (t) {
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

        cleanupSwarms(swarms, t)
      })
    })

    s.join('test')
  }
})

test('socket should get destroyed on a bad peer', function (t) {
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
    end()
  })
  s.on('connection', function (connection, type) {
    t.false(connection, 'should never get here')
    end()
  })
  s.addPeer('test', port) // should not connect

  function end () {
    s.destroy(function () {
      t.end()
    })
  }
})

test('swarm should not connect to self', function (t) {
  var s = swarm({dht: false, utp: false})

  s.on('connection', function (connection, type) {
    t.false(connection, 'should never get here')
    end()
  })

  setTimeout(function () {
    t.equal(s.totalConnections, 0, '0 connections')
    end()
  }, 250)

  s.join('test')

  function end () {
    s.destroy(function () {
      t.end()
    })
  }
})

test('swarm ignore whitelist', function (t) {
  var s = swarm({dht: false, utp: false, whitelist: ['9.9.9.9']})
  t.equals(s.addPeer('127.0.0.1', 9999), false)
  s.destroy(function () {
    t.end()
  })
})

function cleanupSwarms (swarms, t) {
  var count = 0
  swarms.forEach(function (swarm, i) {
    swarm.destroy(function () {
      t.pass('swarm #' + i + ' closed')
      if (++count === swarms.length) {
        t.end()
      }
    })
  })
}
