package com.deskdrop.vendor

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Notification
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.RemoteMessage
import expo.modules.notifications.service.ExpoFirebaseMessagingService

class DeskDropFirebaseMessagingService : ExpoFirebaseMessagingService() {
  override fun onMessageReceived(remoteMessage: RemoteMessage) {
    val data = remoteMessage.data
    if (isResolvedOrder(data) || shouldSuppressVendorStatusPush(remoteMessage, data)) {
      resolveOrderAlert(data)
      return
    }

    if (isFullScreenOrder(data)) {
      showOrderNotification(data)
      return
    }

    super.onMessageReceived(remoteMessage)
  }

  private fun shouldSuppressVendorStatusPush(remoteMessage: RemoteMessage, data: Map<String, String>): Boolean {
    val title = listOfNotNull(
      data["title"],
      data["notification_title"],
      remoteMessage.notification?.title,
    ).joinToString(" ").lowercase()

    val body = listOfNotNull(
      data["body"],
      data["message"],
      remoteMessage.notification?.body,
    ).joinToString(" ").lowercase()

    val combined = "$title $body"
    return combined.contains("order already handled")
  }

  private fun isFullScreenOrder(data: Map<String, String>): Boolean {
    val fullScreenOrder = data["full_screen_order"]
    val type = data["type"]

    return fullScreenOrder == "1"
      || fullScreenOrder == "true"
      || type == "order_placed"
  }

  private fun isResolvedOrder(data: Map<String, String>): Boolean {
    val resolvedOrder = data["resolved_order"]
    val type = data["type"]

    return resolvedOrder == "1"
      || resolvedOrder == "true"
      || type == "vendor_order_resolved"
      || type == "delivery_order_resolved"
  }

  private fun resolveOrderAlert(payload: Map<String, String>) {
    val orderId = payload["order_id"] ?: return
    OrderAlertStateStore.markResolved(this, orderId)

    val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    notificationManager.cancel(notificationId(orderId))

    val resolveIntent = Intent(this, OrderOverlayService::class.java).apply {
      action = OrderOverlayService.ACTION_RESOLVE_ORDER
      putExtra(OrderOverlayService.EXTRA_ORDER_ID, orderId)
    }

    try {
      startService(resolveIntent)
    } catch (_: Throwable) {
      // The notification is still cancelled. React polling closes any in-app
      // popup if an OEM blocks the background service command.
    }
  }

  private fun showOrderNotification(payload: Map<String, String>) {
    val orderId = payload["order_id"] ?: return
    if (OrderAlertStateStore.wasRecentlyResolved(this, orderId)) {
      val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      notificationManager.cancel(notificationId(orderId))
      return
    }

    val title = payload["title"]?.takeIf { it.isNotBlank() } ?: "New order received"
    val body = payload["body"]?.takeIf { it.isNotBlank() } ?: "Tap to respond to this order."
    val channelId = "deskdrop-orders-fullscreen-v2"

    createOrderChannel(channelId)

    val deepLink = Uri.parse("deskdropvendor://orders?order_id=$orderId")
    val intent = Intent(this, MainActivity::class.java).apply {
      action = Intent.ACTION_VIEW
      setData(deepLink)
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
      putExtra("order_id", orderId)
      putExtra("full_screen_order", true)
    }

    val overlayStarted = showOrderOverlayIfAllowed(payload)

    val flags = PendingIntent.FLAG_UPDATE_CURRENT or (
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0
    )
    val pendingIntent = PendingIntent.getActivity(this, notificationId(orderId), intent, flags)

    val notification = NotificationCompat.Builder(this, channelId)
      .setSmallIcon(R.drawable.notification_icon)
      .setContentTitle(title)
      .setContentText(body)
      .setStyle(NotificationCompat.BigTextStyle().bigText(body))
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .setCategory(NotificationCompat.CATEGORY_CALL)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setAutoCancel(true)
      .setOngoing(false)
      .setDefaults(Notification.DEFAULT_ALL)
      .setVibrate(longArrayOf(0, 350, 180, 350))
      .setContentIntent(pendingIntent)
      .apply {
        // When the native overlay is already visible, launching MainActivity as
        // well would leave a second React order popup underneath it.
        if (!overlayStarted) {
          setFullScreenIntent(pendingIntent, true)
        }
      }
      .build()

    val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    notificationManager.notify(notificationId(orderId), notification)
  }

  private fun showOrderOverlayIfAllowed(payload: Map<String, String>): Boolean {
    if (!Settings.canDrawOverlays(this)) {
      return false
    }

    return try {
      val overlayIntent = Intent(this, OrderOverlayService::class.java).apply {
        action = OrderOverlayService.ACTION_SHOW_ORDER
        putExtra(OrderOverlayService.EXTRA_ORDER_ID, payload["order_id"])
        putExtra("order_no", payload["order_no"])
        putExtra("order_channel", payload["order_channel"])
        putExtra("subtotal", payload["subtotal"])
        putExtra("delivery_fee", payload["delivery_fee"])
        putExtra("total", payload["total"])
        putExtra("payment_method", payload["payment_method"])
        putExtra("location", payload["location"])
        putExtra("customer_name", payload["customer_name"])
        putExtra("customer_mobile", payload["customer_mobile"])
        putExtra("notes", payload["notes"])
        putExtra("item_count", payload["item_count"])
        putExtra("remaining_items", payload["remaining_items"])
        putExtra("items_json", payload["items_json"])
        putExtra("items", payload["items"])
        putExtra("quick_request_type", payload["quick_request_type"])
        putExtra("quick_request_label", payload["quick_request_label"])
        putExtra("quick_request_tea_price", payload["quick_request_tea_price"])
        putExtra("quick_request_coffee_price", payload["quick_request_coffee_price"])
        putExtra("quick_request_payment_pending", payloadBoolean(payload["quick_request_payment_pending"], false))
        putExtra("can_cancel_order", payloadBoolean(payload["can_cancel_order"], true))
      }
      startService(overlayIntent)
      true
    } catch (_: Throwable) {
      // Android can still block background starts on some OEM builds.
      // The full-screen notification remains the fallback.
      false
    }
  }

  private fun notificationId(orderId: String): Int = orderId.toIntOrNull() ?: orderId.hashCode()

  private fun payloadBoolean(value: String?, defaultValue: Boolean): Boolean {
    return when (value?.trim()?.lowercase()) {
      "1", "true", "yes" -> true
      "0", "false", "no" -> false
      else -> defaultValue
    }
  }

  private fun createOrderChannel(channelId: String) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      return
    }

    val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val existing = notificationManager.getNotificationChannel(channelId)
    if (existing != null) {
      return
    }

    val channel = NotificationChannel(channelId, "Orders", NotificationManager.IMPORTANCE_HIGH).apply {
      description = "New order alerts"
      enableVibration(true)
      vibrationPattern = longArrayOf(0, 350, 180, 350)
      lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
      setBypassDnd(true)
      val soundUri = Uri.parse("android.resource://$packageName/raw/deskdrop_notification")
      val audioAttributes = AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
        .build()
      setSound(soundUri, audioAttributes)
      enableLights(true)
      lightColor = Color.rgb(255, 112, 24)
    }

    notificationManager.createNotificationChannel(channel)
  }
}
