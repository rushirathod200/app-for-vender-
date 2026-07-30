import InAppUpdates, {
  AndroidInstallStatus,
  AndroidNeedsUpdateResponse,
  IAUUpdateKind,
  StatusUpdateEvent,
} from 'sp-react-native-in-app-updates';

const playUpdates = new InAppUpdates(__DEV__);

let updateFlowStarting = false;
let statusListenerRegistered = false;

function installWhenDownloaded(status: StatusUpdateEvent): void {
  if (status.status !== AndroidInstallStatus.DOWNLOADED) return;

  playUpdates.removeStatusUpdateListener(installWhenDownloaded);
  statusListenerRegistered = false;
  playUpdates.installUpdate();
}

export async function checkForPlayStoreUpdate(): Promise<void> {
  if (updateFlowStarting) return;

  updateFlowStarting = true;

  try {
    const result = await playUpdates.checkNeedsUpdate() as AndroidNeedsUpdateResponse;

    if (!result.shouldUpdate || !result.other.isFlexibleUpdateAllowed) return;

    if (!statusListenerRegistered) {
      playUpdates.addStatusUpdateListener(installWhenDownloaded);
      statusListenerRegistered = true;
    }

    await playUpdates.startUpdate({ updateType: IAUUpdateKind.FLEXIBLE });
  } catch {
    // Google Play in-app updates are unavailable for local/sideloaded builds.
  } finally {
    updateFlowStarting = false;
  }
}
