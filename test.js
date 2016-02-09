var test = require('tape')

var Swarm = require('./')

test('two swarms connect locally', function (t) {
  var pending = 2
  var swarmIds = [1, 2]

  swarmIds.forEach(function (id) {
    var s = Swarm({maxConnections: 2})

    s.listen(10000 + id)
    s.add(Buffer('test-key-1'))

    s.on('connection', function (connection, type) {
      t.ok(connection, 'got connection')
      if (--pending === 0) {
        s.destroy()
        t.end()
      }
    })
    
    setTimeout(function () {
      console.log(s, '\n\n\n')
    }, 1999)
  })
  
  setTimeout(function () {
    var handles = process._getActiveHandles()
    console.log('handles', handles.length)
    console.log(handles)
  }, 2000)
  
})