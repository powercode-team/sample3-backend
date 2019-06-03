
// Events list implementation
module.exports = ( socket ) => {

  socket.on('typing', (data) => {

  });

  socket.on('disconnect', (e) => {
    console.error(e)
  })

};
