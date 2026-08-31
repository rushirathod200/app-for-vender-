package com.deskdrop.vendor

import android.content.Context
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class DeskDropNativeAuthModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "DeskDropNativeAuth"

  @ReactMethod
  fun save(token: String, apiBaseUrl: String, role: String, promise: Promise) {
    val normalizedRole = if (role.trim().lowercase() == "delivery") "delivery" else "vendor"

    reactContext
      .getSharedPreferences("deskdrop_vendor_native_auth", Context.MODE_PRIVATE)
      .edit()
      .putString("auth_token", token)
      .putString("api_base_url", apiBaseUrl.trimEnd('/'))
      .putString("auth_role", normalizedRole)
      .apply()

    promise.resolve(null)
  }

  @ReactMethod
  fun clear(promise: Promise) {
    reactContext
      .getSharedPreferences("deskdrop_vendor_native_auth", Context.MODE_PRIVATE)
      .edit()
      .clear()
      .apply()

    promise.resolve(null)
  }
}
