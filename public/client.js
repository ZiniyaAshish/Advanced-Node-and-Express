$(document).ready(function () {
  let socket = io();

  socket.on('user', data => {
    // Update the number of users online
    $('#num-users').text(data.currentUsers + ' users online');

    // Construct the message based on the connection status
    let message =
      data.username +
      (data.connected ? ' has joined the chat.' : ' has left the chat.');

    // Append the message to the unordered list with id 'messages'
    $('#messages').append($('<li>').html('<b>' + message + '</b>'));
  });

  socket.on('chat message', data => {
    // Create a new list item with the message format: username: message
    let message = '<b>' + data.username + ':</b> ' + data.message;

    // Append the message to the list
    $('#messages').append($('<li>').html(message));
  });

  socket.on('user count', function (data) {
    console.log(data); // Log the current user count
  });
  // Form submittion with new message in field with id 'm'
  $('form').submit(function (event) {
    event.preventDefault();  // Prevent form from submitting the traditional way

    // Get the message entered by the user
    const messageToSend = $('#m').val();

    // Emit 'chat message' event with the message
    socket.emit('chat message', messageToSend);

    // Clear the input field after sending the message
    $('#m').val('');
  });
});
