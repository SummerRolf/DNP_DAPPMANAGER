import * as db from "../db";

/**
 * Marks notifications as view by deleting them from the db
 *
 * @param {array} ids Array of ids to be marked as read
 * ids = [ "notification-id1", "notification-id2" ]
 */
export default async function notificationsRemove({ ids }: { ids: string[] }) {
  if (!ids) throw Error("kwarg ids must be defined");

  for (const id of ids) {
    db.remove(`notification.${id}`);
  }

  return {
    message: `Removed notifications: ${ids.join(", ")}`
  };
}
