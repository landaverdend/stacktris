

The Problem: Room and gamesession architecture is a little jumbled at best- room.ts handles socket inputs and passes them down into gamesession.ts.

- the state of the room and what it manages is not well defined. The room (really it's a session, and each game is a "round") should be in charge of the following:
  - pregame state (readying up, invoice payment/cancellation/settlement)
  - handling when players join/leave
  - transitioning between different states (waiting -> countdown -> playing -> intermission -> finished)
    - waiting (players ready up and pay invoices)
    - countdown (prior to match start, 5 seconds?)
    - playing 
    - intermission (in between playing/countdown)
    - finished (somebody won 3 rounds and the session is over.)
      - it should be noted that countdown -> playing -> intermission will loop until somebody wins 3 consecutive rounds...
  - handling termination (settling invoices and payouts and whatnot)
  - setting and broadcasting state as dictated from the gamesession (who won the last round, etc.)
    - we should really just have one authoritative source of truth (RoomState) that gets broadcast to the client and then the client manages what to do when something changes.
    - 
