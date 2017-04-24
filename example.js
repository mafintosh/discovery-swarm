var swarm = require('./')

var ids = [1, 2, 3, 4, 5]

ids.forEach(function (id) {
  var s = swarm({maxConnections: 2})
  s.join('channel')
  s.listen(10000 + id)

  s.on('connection', function (connection, info) {
    connection.write('hello')

    connection.on('data', function (data) {
      console.log('connections length:', s.connections.length)
      console.log(id, 'connect', info)
    })
  })
})
