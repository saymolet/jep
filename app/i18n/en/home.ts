/** English messages: home (game list, offline downloads, rooms in progress).
 * Keys start with "home.". */
export const home = {
  "home.noGames": "No games found",
  "home.noGamesForSearch": 'No games found for search "{search}"',
  "home.downloadedOffline": "Downloaded for offline play",
  "home.warning": "Warning",
  "home.removeDownload": "Remove download",
  "home.removeDownloadDescription":
    'Remove the offline download for "{title}"? You won\'t be able to play this game offline until you download it again.',
  "home.cancel": "Cancel",
  "home.playOffline": "Play offline",
  "home.downloadOffline": "Download for offline",
  "home.roomsInProgress": "Rooms in progress",
  "home.roomActivity": "{players} · active {ago}",
  "home.join": "Join",
  "home.timeAgo.justNow": "just now",
  "home.timeAgo.minutes": "{minutes} min ago",
  "home.timeAgo.hours": "{hours} h ago",
  "home.timeAgo.days": { one: "{count} day ago", other: "{count} days ago" },
  "home.yourGames": "Your games in progress",
  "home.yourScore": "Your score",
  "home.yourRank": "#{rank} of {total}",
  "home.yourRoomActivity": "Room {room} · active {ago}",
  "home.continue": "Continue",
} as const;
