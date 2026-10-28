package com.movviz.tv

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter

/** Only a device sleep, never a normal activity stop, requests the picker. */
class ScreenSleepTracker(private val context: Context) {
    private val prefs = context.getSharedPreferences("screen_sleep", Context.MODE_PRIVATE)
    private val receiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            if (intent.action == Intent.ACTION_SCREEN_OFF) prefs.edit().putBoolean("pending", true).commit()
        }
    }

    fun register() {
        context.registerReceiver(receiver, IntentFilter(Intent.ACTION_SCREEN_OFF))
    }

    fun hasPendingWake(): Boolean = prefs.getBoolean("pending", false)

    fun consumeWake(): Boolean {
        if (!hasPendingWake()) return false
        prefs.edit().remove("pending").commit()
        return true
    }
}
