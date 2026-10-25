/** English messages: report (report a game page). Keys start with
 * "report.". */
export const report = {
  "report.metaTitle": "Report a game",
  "report.title": "Report game",
  "report.intro":
    "Please report any game which violates the <guidelines>community guidelines</guidelines>.",
  "report.otherIssues":
    "For anything else, please submit an issue on the <github>GitHub</github> project.",
  "report.linkLabel": "Link to game",
  "report.linkPlaceholder": "{base}/room/... or {base}/game/...",
  "report.reasonLabel": "Reason",
  "report.reasonPlaceholder": "e.g. spam",
  "report.submit": "Report",
  "report.wrongOrigin": "URL must be from {base}",
  "report.badRoomName":
    "room name must be in the format of {roomId}-{roomName}",
  "report.roomNotFound": 'room "{room}" not found',
  "report.reportedRoom": "Reported game {gameId} in room {room}.",
  "report.gameNotFound": 'game "{gameId}" not found',
  "report.fetchError": "Error fetching game: {error}",
  "report.reportedGame": "Reported game {gameId}.",
  "report.noGameOrRoom": "Could not find /game/ or /room/ in URL.",
} as const;
