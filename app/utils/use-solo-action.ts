import * as React from "react";
import type { Fetcher } from "react-router";

import type { Action } from "~/engine";

import { noteServerTime } from "./server-clock";

/** useSoloAction dispatches an action if we get data from the fetcher response.
 * This handles local play because only solo POST requests get an Action as a
 * response.
 */
export default function useSoloAction(
  fetcher: Fetcher<Action>,
  dispatch: React.Dispatch<Action>,
) {
  React.useEffect(() => {
    const action = fetcher.data;
    if (action) {
      // Solo actions are stamped by the server just now (answer timer).
      noteServerTime(action.ts);
      dispatch(action);
    }
  }, [fetcher.data, dispatch]);
}
