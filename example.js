var swarm = require('./')

var a = swarm({dht: false, utp: false})
var b = swarm({dht: false, utp: false})

a.on('connection', function (connection) {
  connection.write('Hello, World!')
  connection.on('data', function (data) {
    console.log(data.toString());
    a.destroy()
    b.destroy()
  })
})

b.on('connection', function (connection) {
  connection.pipe(connection)
})

a.join('test')
b.join('test')
