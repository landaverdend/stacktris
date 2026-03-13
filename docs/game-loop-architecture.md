


Client-predictive model:

idea: read in client inputs, check them on the server, send correction if not in line with server version?


Lock-State checking/verification:
- the problem: players can just keep their piece suspended in the middle of the board
- another problem: players can just lie and say they pulled off a complex move

client-predictive:
- assume the client is honest, but double check server side.
  - we would need to send each client input over the wire
    - would we want to send tick/frame data as well?
    - how would we verify lock delay? When the piece touches the bottom, should a message be sent out to the server indicating that ?
    - are locks confirmed client side and then sent to the server for approval?
      - what if the client says a lock happened at X time but then the server checks and finds it wrong. How is state reconciled in this case?




Events that need server checking
- piece locking
- piece holds 
- location/inputs
- when we touch bottom
  - maybe send over the timestamp...