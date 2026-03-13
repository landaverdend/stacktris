

https://meseta.medium.com/netcode-concepts-part-3-lockstep-and-rollback-f70e9297271

Idea:
- Lockstep execution between server and client:
  - the client should send out batched inputs every set interval (300 frames?)
  - server will independently compute what the state **should** be from your inputs
  - if the two don't match; we have desynced
  - gravity needs to be calculated based on the frame over time rather than what we currently have.