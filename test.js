var test = require('tape')

var Swarm = require('./')

test('two swarms connect locally', function (t) {
  var pending = 2
  var swarmIds = [1, 2]
  var swarms = []

  swarmIds.forEach(function (id) {
    var s = Swarm({dht: false})
    swarms.push(s)

    s.listen(10000 + id)
    s.add(Buffer('test-key-1'))

    s.on('connection', function (connection, type) {
      t.ok(connection, 'got connection')
      if (--pending === 0) {
        for (var i = 0; i < swarms.length; i++) swarms[i].destroy()
        t.end()
      }
    })
  })
})

test('socket should get destroyed on a bad peer', function (t) {
  var s = Swarm({dht: false})

  s.addPeer({host: 'localhost', port: 10003}) // should not connect

  process.nextTick(function () {
    t.equal(s.allConnections.sockets.length, 1, '1 socket')
  })

  s.on('connection', function (connection, type) {
    t.false(connection, 'should never get here')
    s.destroy()
    t.end()
  })

  setTimeout(function () {
    t.equal(s.allConnections.sockets.length, 0, '0 sockets')
    s.destroy()
    t.end()
  }, 250)
})
