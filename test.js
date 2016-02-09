var test = require('tape')

var Swarm = require('./')

test('two swarms connect locally', function (t) {
  var pending = 2
  var swarmIds = [1, 2]
  var swarms = []

  swarmIds.forEach(function (id) {
    var s = Swarm()
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
