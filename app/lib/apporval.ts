export type PendingAction = {
  action: string;
  description: string;
  data?: any;
};

let pendingAction: PendingAction | null = null;

export function setPendingAction(
  action: PendingAction
) {
  pendingAction = action;
}

export function getPendingAction() {
  return pendingAction;
}

export function clearPendingAction() {
  pendingAction = null;
}