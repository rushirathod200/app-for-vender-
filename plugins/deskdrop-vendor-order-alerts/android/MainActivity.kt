package com.deskdrop.vendor

import android.app.AlertDialog
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.WindowManager

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

import expo.modules.ReactActivityDelegateWrapper

class MainActivity : ReactActivity() {
  private var overlayPermissionDialog: AlertDialog? = null

  override fun onCreate(savedInstanceState: Bundle?) {
    // Set the theme to AppTheme BEFORE onCreate to support
    // coloring the background, status bar, and navigation bar.
    // This is required for expo-splash-screen.
    setTheme(R.style.AppTheme);
    applyOrderNotificationWindowFlags(intent)
    super.onCreate(null)
  }

  override fun onStart() {
    super.onStart()
    window.decorView.post {
      maybeShowOverlayPermissionIntro()
    }
  }

  override fun onStop() {
    overlayPermissionDialog?.dismiss()
    overlayPermissionDialog = null
    super.onStop()
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    applyOrderNotificationWindowFlags(intent)
  }

  private fun applyOrderNotificationWindowFlags(intent: Intent?) {
    val isOrderNotification = intent?.getBooleanExtra("full_screen_order", false) == true
      || intent?.data?.scheme == "deskdropvendor"

    if (!isOrderNotification) {
      return
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true)
      setTurnScreenOn(true)
    } else {
      @Suppress("DEPRECATION")
      window.addFlags(
        WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
          WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
      )
    }
  }

  private fun maybeShowOverlayPermissionIntro() {
    if (Settings.canDrawOverlays(this) || overlayPermissionDialog?.isShowing == true) {
      return
    }

    val dialog = AlertDialog.Builder(this)
      .setTitle("Enable DeskDrop Vendor order pop-ups")
      .setMessage(
        "Allow DeskDrop Vendor to display over other apps so new-order alerts can appear while you are using another app. " +
          "Tap Open Settings, select DeskDrop Vendor, then enable Display over other apps. " +
          "This reminder will continue until the permission is enabled."
      )
      .setNegativeButton("Not now", null)
      .setPositiveButton("Open Settings") { _, _ ->
        openDeskDropOverlaySettings()
      }
      .setCancelable(false)
      .create()

    dialog.setOnDismissListener {
      if (overlayPermissionDialog === dialog) {
        overlayPermissionDialog = null
      }
    }
    overlayPermissionDialog = dialog
    dialog.show()
  }

  private fun openDeskDropOverlaySettings() {
    val packageUri = Uri.parse("package:$packageName")
    try {
      val settingsIntent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, packageUri)
      startActivity(settingsIntent)
    } catch (_: Throwable) {
      val fallbackIntent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, packageUri)
      startActivity(fallbackIntent)
    }
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "main"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate {
    return ReactActivityDelegateWrapper(
          this,
          BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
          object : DefaultReactActivityDelegate(
              this,
              mainComponentName,
              fabricEnabled
          ){})
  }

  /**
    * Align the back button behavior with Android S
    * where moving root activities to background instead of finishing activities.
    * @see <a href="https://developer.android.com/reference/android/app/Activity#onBackPressed()">onBackPressed</a>
    */
  override fun invokeDefaultOnBackPressed() {
      if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
          if (!moveTaskToBack(false)) {
              // For non-root activities, use the default implementation to finish them.
              super.invokeDefaultOnBackPressed()
          }
          return
      }

      // Use the default back button implementation on Android S
      // because it's doing more than [Activity.moveTaskToBack] in fact.
      super.invokeDefaultOnBackPressed()
  }
}
