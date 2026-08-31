package com.deskdrop.vendor

import android.content.Context

/**
 * Remembers recently resolved orders so a delayed new-order push cannot reopen
 * an alert after another vendor device has already accepted or rejected it.
 */
object OrderAlertStateStore {
  private const val PREFERENCES_NAME = "deskdrop_vendor_order_alerts"
  private const val RESOLVED_PREFIX = "resolved_at_"
  private const val MAX_RESOLVED_AGE_MS = 7L * 24L * 60L * 60L * 1000L

  fun markResolved(context: Context, orderId: String) {
    if (orderId.isBlank()) return

    val preferences = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
    val now = System.currentTimeMillis()
    val editor = preferences.edit().putLong(key(orderId), now)

    preferences.all.forEach { (entryKey, value) ->
      if (!entryKey.startsWith(RESOLVED_PREFIX)) return@forEach

      val resolvedAt = value as? Long ?: 0L
      if (resolvedAt <= 0L || now - resolvedAt > MAX_RESOLVED_AGE_MS) {
        editor.remove(entryKey)
      }
    }

    editor.apply()
  }

  fun wasRecentlyResolved(context: Context, orderId: String): Boolean {
    if (orderId.isBlank()) return false

    val preferences = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
    val resolvedAt = preferences.getLong(key(orderId), 0L)
    if (resolvedAt <= 0L) return false

    if (System.currentTimeMillis() - resolvedAt <= MAX_RESOLVED_AGE_MS) {
      return true
    }

    preferences.edit().remove(key(orderId)).apply()
    return false
  }

  private fun key(orderId: String): String = "$RESOLVED_PREFIX$orderId"
}
