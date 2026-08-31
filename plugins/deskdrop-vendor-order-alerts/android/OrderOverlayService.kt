package com.deskdrop.vendor

import android.app.Service
import android.app.ActivityOptions
import android.content.Context
import android.app.Dialog
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.provider.Settings
import android.text.InputType
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import org.json.JSONArray
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.util.Locale

class OrderOverlayService : Service() {
  companion object {
    const val ACTION_SHOW_ORDER = "com.deskdrop.vendor.action.SHOW_ORDER"
    const val ACTION_RESOLVE_ORDER = "com.deskdrop.vendor.action.RESOLVE_ORDER"
    const val EXTRA_ORDER_ID = "order_id"
  }

  private var windowManager: WindowManager? = null
  private var overlayView: View? = null
  private var mediaPlayer: MediaPlayer? = null
  private var reasonDialog: Dialog? = null
  private var actionFeedback: TextView? = null
  private var activeOrderId: String? = null
  private val handler = Handler(Looper.getMainLooper())

  private data class AlertOrderItem(
    val title: String,
    val variantName: String?,
    val quantity: Int,
    val unitPrice: Double,
    val lineTotal: Double,
  )

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_RESOLVE_ORDER) {
      resolveOrder(intent.getStringExtra(EXTRA_ORDER_ID), startId)
      return START_NOT_STICKY
    }

    if (!Settings.canDrawOverlays(this)) {
      stopSelf()
      return START_NOT_STICKY
    }

    showOverlay(intent)
    return START_NOT_STICKY
  }

  override fun onDestroy() {
    dismissOverlay()
    super.onDestroy()
  }

  private fun showOverlay(intent: Intent?) {
    dismissOverlay()

    val orderId = intent?.getStringExtra(EXTRA_ORDER_ID) ?: return
    if (OrderAlertStateStore.wasRecentlyResolved(this, orderId)) {
      stopSelf()
      return
    }

    activeOrderId = orderId
    val orderNo = intent.getStringExtra("order_no") ?: "New order"
    val orderChannel = intent.getStringExtra("order_channel").orEmpty()
    val isQuickRequest = orderChannel == "office_quick_request"
    val quickRequestType = intent.getStringExtra("quick_request_type").orEmpty()
    val quickRequestLabel = intent.getStringExtra("quick_request_label")
      ?.takeIf { it.isNotBlank() }
      ?: "Tea / Coffee"
    val quickRequestTeaPrice = intent.getStringExtra("quick_request_tea_price").orEmpty()
    val quickRequestCoffeePrice = intent.getStringExtra("quick_request_coffee_price").orEmpty()
    val quickRequestPaymentPending = intent.getBooleanExtra("quick_request_payment_pending", false)
    val subtotal = intent.getStringExtra("subtotal").orEmpty()
    val deliveryFee = intent.getStringExtra("delivery_fee").orEmpty()
    val total = intent.getStringExtra("total") ?: ""
    val paymentMethod = intent.getStringExtra("payment_method").orEmpty()
    val location = intent.getStringExtra("location") ?: ""
    val legacyItems = intent.getStringExtra("items") ?: ""
    val items = parseOrderItems(intent.getStringExtra("items_json"))
    val remainingItems = intent.getStringExtra("remaining_items")?.toIntOrNull()?.coerceAtLeast(0) ?: 0
    val customerName = intent.getStringExtra("customer_name")?.takeIf { it.isNotBlank() } ?: "Customer"
    val customerMobile = intent.getStringExtra("customer_mobile").orEmpty()
    val notes = intent.getStringExtra("notes").orEmpty()
    val canCancelOrder = intent.getBooleanExtra("can_cancel_order", true)

    startLoopingSound()

    windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager

    val container = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(dp(18), dp(16), dp(18), dp(18))
      background = roundedBackground(Color.WHITE, dp(28).toFloat())
      elevation = dp(12).toFloat()
    }

    val header = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
    }

    val titleColumn = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
    }

    val titleLine = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
    }
    titleLine.addView(text(if (isQuickRequest) "Quick Request" else "New Order", if (isQuickRequest) 23f else 26f, Color.rgb(15, 23, 42), Typeface.BOLD).apply {
      layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT)
    })
    titleLine.addView(text(if (isQuickRequest) "  INSTANT  " else "  NEW  ", 10f, Color.rgb(194, 65, 12), Typeface.BOLD).apply {
      gravity = Gravity.CENTER
      background = roundedBackground(Color.rgb(255, 237, 213), dp(12).toFloat())
      layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, dp(25)).apply {
        setMargins(dp(9), 0, 0, 0)
      }
    })
    titleColumn.addView(titleLine)
    titleColumn.addView(text(if (isQuickRequest) "$orderNo  •  $quickRequestLabel" else orderNo, 12f, Color.rgb(107, 114, 128), Typeface.BOLD).apply {
      setPadding(0, dp(2), 0, 0)
    })

    val closeButton = text("×", 30f, Color.rgb(107, 114, 128), Typeface.BOLD).apply {
      gravity = Gravity.CENTER
      background = roundedBackground(Color.rgb(244, 245, 249), dp(22).toFloat())
      layoutParams = LinearLayout.LayoutParams(dp(44), dp(44))
      setOnClickListener {
        dismissOverlay()
        stopSelf()
      }
    }

    header.addView(titleColumn)
    header.addView(closeButton)
    container.addView(header)

    val destinationCard = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(dp(13), dp(11), dp(13), dp(11))
      background = roundedBackground(Color.rgb(255, 247, 240), dp(15).toFloat()).apply {
        setStroke(dp(1), Color.rgb(255, 217, 188))
      }
      layoutParams = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        LinearLayout.LayoutParams.WRAP_CONTENT,
      ).apply {
        setMargins(0, dp(12), 0, 0)
      }
    }
    destinationCard.addView(text("DELIVER TO", 10f, Color.rgb(167, 91, 32), Typeface.BOLD).apply {
      letterSpacing = 0.08f
    })
    destinationCard.addView(text(location.ifBlank { "Delivery address unavailable" }, 16f, Color.rgb(39, 39, 45), Typeface.BOLD).apply {
      setPadding(0, dp(3), 0, 0)
    })
    val customerDetails = buildString {
      append(customerName)
      if (customerMobile.isNotBlank()) {
        append("  •  ")
        append(customerMobile)
      }
    }
    destinationCard.addView(text(customerDetails, 12f, Color.rgb(107, 114, 128), Typeface.NORMAL).apply {
      setPadding(0, dp(4), 0, 0)
    })
    container.addView(destinationCard)

    val details = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(0, dp(7), 0, dp(10))
    }

    details.addView(text(if (isQuickRequest) "REQUEST DETAILS" else "ORDER ITEMS", 11f, Color.rgb(107, 114, 128), Typeface.BOLD).apply {
      setPadding(dp(2), dp(4), 0, dp(7))
      letterSpacing = 0.08f
    })

    val itemsCard = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(dp(12), dp(2), dp(12), dp(2))
      background = roundedBackground(Color.rgb(248, 249, 252), dp(15).toFloat()).apply {
        setStroke(dp(1), Color.rgb(231, 233, 239))
      }
    }

    if (items.isNotEmpty()) {
      items.forEachIndexed { index, item ->
        val itemRow = LinearLayout(this).apply {
          orientation = LinearLayout.HORIZONTAL
          gravity = Gravity.CENTER_VERTICAL
          setPadding(0, dp(9), 0, dp(9))
        }
        val itemCopy = LinearLayout(this).apply {
          orientation = LinearLayout.VERTICAL
          layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        }
        itemCopy.addView(text(item.title, 14f, Color.rgb(31, 41, 55), Typeface.BOLD))
        if (!item.variantName.isNullOrBlank()) {
          itemCopy.addView(text(item.variantName, 11f, Color.rgb(234, 88, 12), Typeface.BOLD).apply {
            setPadding(0, dp(1), 0, 0)
          })
        }
        itemCopy.addView(text("${item.quantity} × ${money(item.unitPrice)}", 12f, Color.rgb(107, 114, 128), Typeface.NORMAL).apply {
          setPadding(0, dp(2), 0, 0)
        })
        itemRow.addView(itemCopy)
        itemRow.addView(text(money(item.lineTotal), 14f, Color.rgb(17, 24, 39), Typeface.BOLD).apply {
          gravity = Gravity.END
        })
        itemsCard.addView(itemRow)

        if (index < items.lastIndex) {
          itemsCard.addView(View(this).apply {
            setBackgroundColor(Color.rgb(229, 231, 235))
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(1))
          })
        }
      }
    } else if (isQuickRequest) {
      itemsCard.setPadding(dp(13), dp(11), dp(13), dp(11))
      itemsCard.addView(text(quickRequestLabel, 16f, Color.rgb(31, 41, 55), Typeface.BOLD))

      val priceParts = mutableListOf<String>()
      if (quickRequestType != "coffee" && quickRequestTeaPrice.isNotBlank()) {
        priceParts.add("Tea ${money(quickRequestTeaPrice)}")
      }
      if (quickRequestType != "tea" && quickRequestCoffeePrice.isNotBlank()) {
        priceParts.add("Coffee ${money(quickRequestCoffeePrice)}")
      }
      if (priceParts.isNotEmpty()) {
        itemsCard.addView(text(priceParts.joinToString("  •  "), 12f, Color.rgb(234, 88, 12), Typeface.BOLD).apply {
          setPadding(0, dp(5), 0, 0)
        })
      }
      itemsCard.addView(text("Accept the request, then confirm served quantities and payment from Orders.", 12f, Color.rgb(107, 114, 128), Typeface.NORMAL).apply {
        setPadding(0, dp(7), 0, 0)
      })
    } else {
      itemsCard.addView(text(legacyItems.ifBlank { "$customerName placed this order" }, 14f, Color.rgb(31, 41, 55), Typeface.BOLD).apply {
        setPadding(0, dp(12), 0, dp(12))
      })
    }

    if (remainingItems > 0) {
      itemsCard.addView(text("+$remainingItems more item${if (remainingItems == 1) "" else "s"}", 12f, Color.rgb(234, 88, 12), Typeface.BOLD).apply {
        setPadding(0, dp(8), 0, dp(9))
      })
    }
    details.addView(itemsCard)

    if (isQuickRequest && quickRequestPaymentPending) {
      val summary = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(dp(13), dp(11), dp(13), dp(11))
        background = roundedBackground(Color.rgb(255, 248, 242), dp(15).toFloat()).apply {
          setStroke(dp(1), Color.rgb(255, 216, 184))
        }
        layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
          setMargins(0, dp(11), 0, 0)
        }
      }
      val pendingRow = LinearLayout(this).apply {
        orientation = LinearLayout.HORIZONTAL
        gravity = Gravity.CENTER_VERTICAL
      }
      pendingRow.addView(text("Final amount", 15f, Color.rgb(17, 24, 39), Typeface.BOLD).apply {
        layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
      })
      pendingRow.addView(text("Pending", 15f, Color.rgb(234, 88, 12), Typeface.BOLD))
      summary.addView(pendingRow)
      summary.addView(text("Calculated when Tea/Coffee quantities and payment are confirmed.", 11f, Color.rgb(107, 114, 128), Typeface.NORMAL).apply {
        setPadding(0, dp(6), 0, 0)
      })
      details.addView(summary)
    } else if (subtotal.isNotBlank() || deliveryFee.isNotBlank() || total.isNotBlank()) {
      val summary = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(dp(13), dp(11), dp(13), dp(11))
        background = roundedBackground(Color.rgb(255, 248, 242), dp(15).toFloat()).apply {
          setStroke(dp(1), Color.rgb(255, 216, 184))
        }
        layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
          setMargins(0, dp(11), 0, 0)
        }
      }

      if (subtotal.isNotBlank()) {
        summary.addView(priceRow("Items subtotal", money(subtotal)))
      }
      if (deliveryFee.isNotBlank()) {
        val deliveryAmount = deliveryFee.toDoubleOrNull() ?: 0.0
        summary.addView(priceRow("Delivery fee", if (deliveryAmount > 0) money(deliveryAmount) else "Free").apply {
          setPadding(0, dp(5), 0, 0)
        })
      }
      summary.addView(View(this).apply {
        setBackgroundColor(Color.rgb(235, 226, 219))
        layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(1)).apply {
          setMargins(0, dp(8), 0, dp(8))
        }
      })
      val totalRow = LinearLayout(this).apply {
        orientation = LinearLayout.HORIZONTAL
        gravity = Gravity.CENTER_VERTICAL
      }
      totalRow.addView(text("Total", 16f, Color.rgb(17, 24, 39), Typeface.BOLD).apply {
        layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
      })
      totalRow.addView(text(money(total), 22f, Color.rgb(17, 24, 39), Typeface.BOLD).apply {
        gravity = Gravity.END
      })
      summary.addView(totalRow)
      if (paymentMethod.isNotBlank()) {
        summary.addView(text("Payment: ${paymentLabel(paymentMethod)}", 11f, Color.rgb(107, 114, 128), Typeface.BOLD).apply {
          setPadding(0, dp(6), 0, 0)
        })
      }
      details.addView(summary)
    }

    if (notes.isNotBlank()) {
      val noteBox = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(dp(12), dp(10), dp(12), dp(10))
        background = roundedBackground(Color.rgb(255, 248, 232), dp(14).toFloat()).apply {
          setStroke(dp(1), Color.rgb(255, 225, 170))
        }
        layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
          setMargins(0, dp(10), 0, 0)
        }
      }
      noteBox.addView(text("CUSTOMER NOTE", 10f, Color.rgb(180, 83, 9), Typeface.BOLD))
      noteBox.addView(text(notes, 12f, Color.rgb(121, 86, 40), Typeface.NORMAL).apply {
        setPadding(0, dp(3), 0, 0)
      })
      details.addView(noteBox)
    }

    val estimatedDetailsHeight = dp(175 + (if (isQuickRequest) 105 else items.size.coerceAtMost(4) * 64) + if (notes.isNotBlank()) 70 else 0)
    val maximumDetailsHeight = (resources.displayMetrics.heightPixels * 0.48f).toInt()
    val detailsScroll = ScrollView(this).apply {
      isFillViewport = false
      addView(details)
      layoutParams = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        estimatedDetailsHeight.coerceAtMost(maximumDetailsHeight),
      )
    }
    container.addView(detailsScroll)

    val actions = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER
    }

    val reject = actionButton("Reject", Color.WHITE, Color.rgb(220, 53, 69), true).apply {
      setOnClickListener {
        showRejectReasonDialog(orderId)
      }
    }

    val accept = actionButton("Accept", Color.rgb(72, 187, 120), Color.WHITE, false).apply {
      setOnClickListener {
        respondToOrder(orderId, "accepted")
      }
    }

    if (canCancelOrder) {
      actions.addView(reject)
    }
    actions.addView(accept)
    container.addView(actions)

    actionFeedback = text("", 13f, Color.rgb(220, 53, 69), Typeface.BOLD).apply {
      gravity = Gravity.CENTER
      setPadding(0, dp(10), 0, 0)
      visibility = View.GONE
    }
    container.addView(actionFeedback)

    val params = WindowManager.LayoutParams(
      WindowManager.LayoutParams.MATCH_PARENT,
      WindowManager.LayoutParams.WRAP_CONTENT,
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
      } else {
        @Suppress("DEPRECATION")
        WindowManager.LayoutParams.TYPE_PHONE
      },
      WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
        WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
        WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED,
      android.graphics.PixelFormat.TRANSLUCENT
    ).apply {
      gravity = Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL
      width = resources.displayMetrics.widthPixels - dp(28)
      y = dp(22)
    }

    overlayView = container
    windowManager?.addView(container, params)
  }

  private fun dismissOverlay() {
    handler.removeCallbacksAndMessages(null)
    dismissReasonDialog()
    stopLoopingSound()
    val view = overlayView
    if (view != null) {
      try {
        windowManager?.removeView(view)
      } catch (_: Throwable) {
        // The view may already be removed.
      }
    }
    overlayView = null
    actionFeedback = null
    activeOrderId = null
  }

  private fun resolveOrder(orderId: String?, startId: Int) {
    if (orderId.isNullOrBlank()) {
      if (activeOrderId == null) stopSelfResult(startId)
      return
    }

    OrderAlertStateStore.markResolved(this, orderId)
    if (activeOrderId == orderId) {
      dismissOverlay()
      stopSelfResult(startId)
      return
    }

    // A different newer order may currently be ringing. Do not close it just
    // because an older order was resolved on another device.
    if (activeOrderId == null) {
      stopSelfResult(startId)
    }
  }

  private fun startLoopingSound() {
    stopLoopingSound()
    try {
      val afd = resources.openRawResourceFd(R.raw.deskdrop_notification)
      mediaPlayer = MediaPlayer().apply {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
          setAudioAttributes(
            AudioAttributes.Builder()
              .setUsage(AudioAttributes.USAGE_ALARM)
              .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
              .build()
          )
        }
        setDataSource(afd.fileDescriptor, afd.startOffset, afd.length)
        afd.close()
        isLooping = true
        setVolume(1f, 1f)
        prepare()
        start()
      }
    } catch (_: Throwable) {
      mediaPlayer = MediaPlayer.create(this, R.raw.deskdrop_notification)?.apply {
        isLooping = true
        start()
      }
    }
  }

  private fun stopLoopingSound() {
    try {
      mediaPlayer?.stop()
      mediaPlayer?.release()
    } catch (_: Throwable) {
      // Ignore audio cleanup failures.
    }
    mediaPlayer = null
  }

  private fun showRejectReasonDialog(orderId: String) {
    dismissReasonDialog()

    val dialog = Dialog(this)
    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(dp(18), dp(18), dp(18), dp(18))
      background = roundedBackground(Color.WHITE, dp(24).toFloat())
    }

    root.addView(text("Reject order", 24f, Color.rgb(15, 23, 42), Typeface.BOLD))
    root.addView(text("Please enter reject reason.", 14f, Color.rgb(107, 114, 128), Typeface.BOLD).apply {
      setPadding(0, dp(4), 0, dp(12))
    })

    val reasonInput = EditText(this).apply {
      hint = "Reason, e.g. Item unavailable"
      textSize = 16f
      minLines = 2
      maxLines = 4
      inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_SENTENCES or InputType.TYPE_TEXT_FLAG_MULTI_LINE
      setPadding(dp(14), dp(10), dp(14), dp(10))
      background = roundedBackground(Color.rgb(248, 249, 252), dp(14).toFloat()).apply {
        setStroke(dp(1), Color.rgb(229, 231, 235))
      }
    }
    root.addView(reasonInput, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))

    val errorText = text("", 13f, Color.rgb(220, 53, 69), Typeface.BOLD).apply {
      setPadding(0, dp(8), 0, 0)
      visibility = View.GONE
    }
    root.addView(errorText)

    val actions = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER
      setPadding(0, dp(16), 0, 0)
    }

    val cancel = actionButton("Cancel", Color.WHITE, Color.rgb(107, 114, 128), true).apply {
      setOnClickListener {
        dismissReasonDialog()
      }
    }
    val reject = actionButton("Reject", Color.rgb(220, 53, 69), Color.WHITE, false).apply {
      setOnClickListener {
        val reason = reasonInput.text?.toString()?.trim().orEmpty()
        if (reason.isBlank()) {
          errorText.text = "Reject reason is required."
          errorText.visibility = View.VISIBLE
          return@setOnClickListener
        }
        dismissReasonDialog()
        respondToOrder(orderId, "rejected", reason)
      }
    }

    actions.addView(cancel)
    actions.addView(reject)
    root.addView(actions)

    dialog.setContentView(root)
    dialog.setCanceledOnTouchOutside(false)
    dialog.window?.setBackgroundDrawableResource(android.R.color.transparent)
    dialog.setOnShowListener {
      dialog.window?.let { window ->
        window.setLayout(resources.displayMetrics.widthPixels - dp(36), WindowManager.LayoutParams.WRAP_CONTENT)
        window.setGravity(Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL)
        val attributes = window.attributes
        attributes.y = dp(34)
        window.attributes = attributes
      }
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      dialog.window?.setType(WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY)
    } else {
      @Suppress("DEPRECATION")
      dialog.window?.setType(WindowManager.LayoutParams.TYPE_PHONE)
    }

    reasonDialog = dialog
    dialog.show()
  }

  private fun dismissReasonDialog() {
    try {
      reasonDialog?.dismiss()
    } catch (_: Throwable) {
      // The dialog may already be gone.
    }
    reasonDialog = null
  }

  private fun respondToOrder(orderId: String, status: String, cancelReason: String? = null) {
    setActionsEnabled(false)
    actionFeedback?.visibility = View.GONE

    Thread {
      val result = updateOrderStatus(orderId, status, cancelReason)
      handler.post {
        if (result.outcome == OrderUpdateOutcome.SUCCESS || result.outcome == OrderUpdateOutcome.ALREADY_HANDLED) {
          OrderAlertStateStore.markResolved(this, orderId)
          // Launch while the user-visible overlay still exists. Removing the
          // overlay first can make Android treat this as a blocked background
          // activity start.
          openOrderInApp(orderId, status, cancelReason)
          val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
          notificationManager.cancel(orderId.toIntOrNull() ?: orderId.hashCode())
          dismissOverlay()
          stopSelf()
        } else {
          setActionsEnabled(true)
          actionFeedback?.apply {
            text = result.message ?: "Could not update the order. Please try again."
            visibility = View.VISIBLE
          }
        }
      }
    }.start()
  }

  private fun openOrderInApp(orderId: String, status: String, cancelReason: String?) {
    val deepLink = Uri.Builder()
      .scheme("deskdropvendor")
      .authority("orders")
      .appendQueryParameter("order_id", orderId)
      .appendQueryParameter("action", status)
      .appendQueryParameter("handled", "1")
      .apply {
        if (!cancelReason.isNullOrBlank()) {
          appendQueryParameter("reason", cancelReason)
        }
      }
      .build()

    val intent = Intent(this, MainActivity::class.java).apply {
      action = Intent.ACTION_VIEW
      data = deepLink
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
      putExtra("order_id", orderId)
    }

    val requestCode = orderId.toIntOrNull() ?: orderId.hashCode()
    val pendingIntentFlags = PendingIntent.FLAG_UPDATE_CURRENT or (
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0
    )
    val launchIntent = PendingIntent.getActivity(this, requestCode, intent, pendingIntentFlags)

    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        val options = ActivityOptions.makeBasic()
          .setPendingIntentBackgroundActivityStartMode(ActivityOptions.MODE_BACKGROUND_ACTIVITY_START_ALLOWED)
          .toBundle()
        launchIntent.send(this, 0, null, null, null, null, options)
      } else {
        launchIntent.send()
      }
    } catch (_: Throwable) {
      try {
        startActivity(intent)
      } catch (_: Throwable) {
        // The order is already updated even if an OEM blocks both launch paths.
      }
    }
  }

  private enum class OrderUpdateOutcome {
    SUCCESS,
    ALREADY_HANDLED,
    FAILURE,
  }

  private data class OrderUpdateResult(
    val outcome: OrderUpdateOutcome,
    val message: String? = null,
  )

  private fun updateOrderStatus(orderId: String, status: String, cancelReason: String?): OrderUpdateResult {
    val preferences = getSharedPreferences("deskdrop_vendor_native_auth", Context.MODE_PRIVATE)
    val token = preferences.getString("auth_token", null)?.takeIf { it.isNotBlank() }
      ?: return OrderUpdateResult(OrderUpdateOutcome.FAILURE, "Session expired. Open DeskDrop and login again.")
    val apiBaseUrl = preferences.getString("api_base_url", null)?.trimEnd('/')?.takeIf { it.isNotBlank() }
      ?: return OrderUpdateResult(OrderUpdateOutcome.FAILURE, "DeskDrop server is not configured. Open the app and login again.")
    val role = if (preferences.getString("auth_role", "vendor") == "delivery") "delivery" else "vendor"
    var connection: HttpURLConnection? = null

    return try {
      val activeConnection = URL("$apiBaseUrl/$role/orders/$orderId/status").openConnection() as HttpURLConnection
      connection = activeConnection
      val body = if (status == "rejected") {
        """{"status":"rejected","cancel_reason":"${escapeJson(cancelReason.orEmpty())}"}"""
      } else {
        """{"status":"accepted"}"""
      }

      activeConnection.requestMethod = "PATCH"
      activeConnection.connectTimeout = 10_000
      activeConnection.readTimeout = 10_000
      activeConnection.doOutput = true
      activeConnection.setRequestProperty("Accept", "application/json")
      activeConnection.setRequestProperty("Content-Type", "application/json")
      activeConnection.setRequestProperty("Authorization", "Bearer $token")

      OutputStreamWriter(activeConnection.outputStream).use { writer ->
        writer.write(body)
      }

      val responseCode = activeConnection.responseCode
      val responseBody = try {
        if (responseCode in 200..299) {
          activeConnection.inputStream.bufferedReader().use { it.readText() }
        } else {
          activeConnection.errorStream?.bufferedReader()?.use { it.readText() }.orEmpty()
        }
      } catch (_: Throwable) {
        ""
      }

      when {
        responseCode in 200..299 -> OrderUpdateResult(OrderUpdateOutcome.SUCCESS)
        responseCode == 409 || (responseCode == 422 && responseBody.contains("status transition", ignoreCase = true)) -> {
          OrderUpdateResult(OrderUpdateOutcome.ALREADY_HANDLED)
        }
        responseCode == 401 -> OrderUpdateResult(
          OrderUpdateOutcome.FAILURE,
          "Session expired. Open DeskDrop and login again.",
        )
        else -> OrderUpdateResult(
          OrderUpdateOutcome.FAILURE,
          responseMessage(responseBody) ?: "Could not update this order. Please try again.",
        )
      }
    } catch (_: Throwable) {
      OrderUpdateResult(OrderUpdateOutcome.FAILURE, "Could not reach DeskDrop. Check internet and try again.")
    } finally {
      connection?.disconnect()
    }
  }

  private fun responseMessage(responseBody: String): String? {
    if (responseBody.isBlank()) return null

    return try {
      JSONObject(responseBody).optString("message").trim().takeIf { it.isNotBlank() }
    } catch (_: Throwable) {
      null
    }
  }

  private fun escapeJson(value: String): String {
    return value
      .replace("\\", "\\\\")
      .replace("\"", "\\\"")
      .replace("\n", "\\n")
      .replace("\r", "\\r")
      .replace("\t", "\\t")
  }

  private fun setActionsEnabled(enabled: Boolean) {
    val view = overlayView as? LinearLayout ?: return
    setViewTreeEnabled(view, enabled)
  }

  private fun setViewTreeEnabled(view: View, enabled: Boolean) {
    view.isEnabled = enabled
    view.alpha = if (enabled) 1f else 0.72f

    if (view is LinearLayout) {
      for (index in 0 until view.childCount) {
        setViewTreeEnabled(view.getChildAt(index), enabled)
      }
    }
  }

  private fun text(value: String, size: Float, color: Int, style: Int): TextView {
    return TextView(this).apply {
      text = value
      textSize = size
      setTextColor(color)
      typeface = Typeface.DEFAULT_BOLD.takeIf { style == Typeface.BOLD } ?: Typeface.DEFAULT
      includeFontPadding = true
    }
  }

  private fun parseOrderItems(itemsJson: String?): List<AlertOrderItem> {
    if (itemsJson.isNullOrBlank()) return emptyList()

    return try {
      val json = JSONArray(itemsJson)
      buildList {
        for (index in 0 until json.length()) {
          val item = json.optJSONObject(index) ?: continue
          val title = item.optString("title").trim()
          if (title.isBlank()) continue
          add(
            AlertOrderItem(
              title = title,
              variantName = item.optString("variant_name").trim().takeIf { it.isNotBlank() && it != "null" },
              quantity = item.optInt("qty", 1).coerceAtLeast(1),
              unitPrice = item.optDouble("unit_price", 0.0),
              lineTotal = item.optDouble("line_total", 0.0),
            )
          )
        }
      }
    } catch (_: Throwable) {
      emptyList()
    }
  }

  private fun priceRow(label: String, value: String): LinearLayout {
    return LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
      addView(text(label, 12f, Color.rgb(107, 114, 128), Typeface.NORMAL).apply {
        layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
      })
      addView(text(value, 13f, Color.rgb(75, 85, 99), Typeface.BOLD))
    }
  }

  private fun money(value: String): String = money(value.toDoubleOrNull() ?: 0.0)

  private fun money(value: Double): String = "Rs " + String.format(Locale.US, "%.2f", value)

  private fun paymentLabel(value: String): String {
    return when (value.trim().lowercase(Locale.US)) {
      "cod", "cash_on_delivery" -> "Cash on delivery"
      "office_wallet" -> "Office Wallet"
      "wallet" -> "Customer Wallet"
      "online" -> "Online"
      else -> value.split("_").joinToString(" ") { part ->
        part.replaceFirstChar { character ->
          if (character.isLowerCase()) character.titlecase(Locale.US) else character.toString()
        }
      }
    }
  }

  private fun actionButton(label: String, bgColor: Int, textColor: Int, outlined: Boolean): TextView {
    val background = roundedBackground(bgColor, dp(18).toFloat())
    if (outlined) {
      background.setStroke(dp(2), textColor)
    }

    return text(label, 18f, textColor, Typeface.BOLD).apply {
      gravity = Gravity.CENTER
      this.background = background
      layoutParams = LinearLayout.LayoutParams(0, dp(58), 1f).apply {
        setMargins(dp(4), 0, dp(4), 0)
      }
    }
  }

  private fun roundedBackground(color: Int, radius: Float): GradientDrawable {
    return GradientDrawable().apply {
      setColor(color)
      cornerRadius = radius
    }
  }

  private fun dp(value: Int): Int {
    return (value * resources.displayMetrics.density).toInt()
  }
}
