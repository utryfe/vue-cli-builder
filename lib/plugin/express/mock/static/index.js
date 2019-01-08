;(function() {
  var networkAddress = '<%= address %>'
  var context = '<%= context %>'
  var server = '<%= server %>'
  var socket = null

  function createSocketClient() {
    //
    var socket = new SockJS('http://' + networkAddress + context, {
      transports: ['websocket', 'xhr-polling'],
    })
    //
    socket.onopen = function() {
      console.log('Socket has been opened!')
      send({
        type: 'init',
      })
    }
    //
    socket.onmessage = function(message) {
      console.log('msg:', message)
    }
    //
    socket.onclose = function() {
      console.log('Socket has been closed!')
    }
    //
    return socket
  }

  function send(data) {
    if (socket) {
      socket.send(JSON.stringify(data))
    }
  }

  socket = createSocketClient()

  window.socket = socket
})()
