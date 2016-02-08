# discovery-swarm

A network swarm that uses discovery-channel to find peers

```
npm install discovery-swarm
```

## Usage

``` js
var swarm = require('discovery-swarm')

var sw = swarm()

sw.listen(1000)
sw.add('hello') // a name

sw.on('connection', function (connection) {
  console.log('found peer')
})
```

## API

#### `var sw = swarm()`

Create a new swarm

#### `sw.add(name)`

Join a swarm

#### `sw.remove(name)`

Leave a swarm

#### `sw.peersQueued`

Number of peers discovered but not connected to yet

#### `sw.peersConnecting`

Number of peers we are trying to connect to

#### `sw.peersConnected`

Number of peers we are actively connected to. Same as `sw.connections.length`.

#### `sw.connections`

List of active connections to other peers

#### `sw.on('connection', connection)`

Emitted when you connect to another peer

#### `sw.listen(port)`

Listen on a specific port. Should be called before add

## License

MIT
