import * as React from "react";

import { type Avatar, normalizeAvatar } from "~/models/avatar";
import { useGameDefaults } from "~/utils/user-settings";

const AVATAR_STORAGE_KEY = "jep-avatar";

/** loadStoredAvatar reads the avatar remembered on this device. */
export function loadStoredAvatar(): Avatar | undefined {
  try {
    return normalizeAvatar(localStorage.getItem(AVATAR_STORAGE_KEY));
  } catch {
    return undefined;
  }
}

/** storeAvatar remembers (or, with undefined, forgets) the avatar on this
 * device. */
export function storeAvatar(avatar: Avatar | undefined) {
  try {
    if (avatar) {
      localStorage.setItem(AVATAR_STORAGE_KEY, avatar);
    } else {
      localStorage.removeItem(AVATAR_STORAGE_KEY);
    }
  } catch {
    // Storage may be full or disabled (private mode); the avatar just isn't
    // remembered.
  }
}

/** useJoinAvatar is the avatar to join a game with: the account default for
 * logged-in players who set one on their profile, otherwise the avatar last
 * picked on this device. Picking one remembers it on this device. */
export function useJoinAvatar() {
  const { playerAvatar } = useGameDefaults();
  const [avatar, setAvatarState] = React.useState<Avatar | undefined>(
    playerAvatar,
  );
  // localStorage only exists in the browser, so read it after hydration.
  React.useEffect(() => {
    if (!playerAvatar) {
      const stored = loadStoredAvatar();
      if (stored) {
        setAvatarState(stored);
      }
    }
  }, [playerAvatar]);

  const setAvatar = React.useCallback((next: Avatar | undefined) => {
    setAvatarState(next);
    storeAvatar(next);
  }, []);

  return [avatar, setAvatar] as const;
}
