/** RoomBroadcast sends and receives ephemeral messages (e.g. soundboard
 * sounds) on the room's Realtime channel. Messages are Realtime broadcasts:
 * not stored, not room events, never part of the game state or its replay.
 * The sender does not receive its own messages. */
export interface RoomBroadcast {
  /** False when there is no room channel (solo play). */
  available: boolean;
  /** Sends a message to everyone else on the channel. Returns false if the
   * channel is not connected (the message is dropped, not queued). */
  send: (payload: unknown) => boolean;
  /** Listens to messages from others. Payloads are untrusted: validate
   * them. Returns a function that stops listening. */
  subscribe: (listener: (payload: unknown) => void) => () => void;
}

/** NO_BROADCAST is the broadcast of solo play: nothing is sent or heard. */
export const NO_BROADCAST: RoomBroadcast = {
  available: false,
  send: () => false,
  subscribe: () => () => {},
};

/** createListenerSet keeps the listeners of a broadcast event. A listener
 * that throws never breaks the others (or the channel). */
export function createListenerSet<T>() {
  const listeners = new Set<(payload: T) => void>();
  return {
    add(listener: (payload: T) => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    emit(payload: T) {
      for (const listener of [...listeners]) {
        try {
          listener(payload);
        } catch (err) {
          console.error("Room broadcast listener failed:", err);
        }
      }
    },
    get size() {
      return listeners.size;
    },
  };
}
