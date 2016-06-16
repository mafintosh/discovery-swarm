var swarm = require('./')

var ids = [1, 2, 3, 4, 5]

ids.forEach(function (id) {
  var s = swarm({maxConnections: 2})

  s.listen(10000 + id)
  s.add(Buffer('hello'))

  s.on('connection', function (connection, info) {
    console.log(id, 'connect', info)
  })
})
