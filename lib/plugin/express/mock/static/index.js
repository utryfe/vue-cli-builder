;(function() {
  var address = MOCK_SETUP.address
  var context = MOCK_SETUP.context
  var client = MOCK_SETUP.client

  function createSocketClient() {
    //
    var socket = io('http://' + address, {
      transports: ['websocket'],
      path: context,
    })

    socket.on('reconnect_attempt', () => {
      socket.io.opts.transports = ['polling', 'websocket']
    })

    socket.on('connect', () => {
      console.log('Socket has been connected!')
    })

    socket.on('message', (message) => {
      console.log('msg:', message)
    })

    //
    socket.on('disconnect', () => {
      console.log('Socket has been disconnected!')
    })

    //
    return socket
  }

  window.socket = createSocketClient()
})()
