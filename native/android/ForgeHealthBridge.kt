package com.example.forge

import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.activity.ComponentActivity
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.aggregate.AggregateRequest
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.time.TimeRangeFilter
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDate
import java.time.ZoneId

/** Read-only Health Connect bridge for a WebView hosting Forge. */
class ForgeHealthBridge(
    private val activity: ComponentActivity,
    private val webView: WebView,
) {
    private val client = HealthConnectClient.getOrCreate(activity)
    private val readStepsPermission = HealthPermission.getReadPermission(StepsRecord::class)
    private var pending: StepRequest? = null

    private val permissionLauncher = activity.registerForActivityResult(
        PermissionController.createRequestPermissionResultContract()
    ) { granted ->
        val request = pending.also { pending = null } ?: return@registerForActivityResult
        if (readStepsPermission in granted) readSteps(request)
        else reply(request.requestId, failure("Step permission was not granted."))
    }

    @JavascriptInterface
    fun postMessage(json: String) {
        val body = runCatching { JSONObject(json) }.getOrNull() ?: return
        if (body.optString("action") != "readSteps") return
        val request = StepRequest(
            requestId = body.optString("requestId"),
            date = runCatching { LocalDate.parse(body.optString("date")) }.getOrNull(),
        )
        if (request.requestId.isBlank() || request.date == null) return

        activity.lifecycleScope.launch {
            val granted = client.permissionController.getGrantedPermissions()
            if (readStepsPermission in granted) readSteps(request)
            else {
                pending = request
                permissionLauncher.launch(setOf(readStepsPermission))
            }
        }
    }

    private fun readSteps(request: StepRequest) {
        activity.lifecycleScope.launch {
            val zone = ZoneId.systemDefault()
            val start = request.date!!.atStartOfDay(zone).toInstant()
            val end = request.date.plusDays(1).atStartOfDay(zone).toInstant()
            runCatching {
                client.aggregate(
                    AggregateRequest(
                        metrics = setOf(StepsRecord.COUNT_TOTAL),
                        timeRangeFilter = TimeRangeFilter.between(start, end),
                    )
                )[StepsRecord.COUNT_TOTAL] ?: 0L
            }.onSuccess { steps ->
                reply(request.requestId, JSONObject()
                    .put("ok", true)
                    .put("steps", steps)
                    .put("source", "health-connect"))
            }.onFailure { error ->
                reply(request.requestId, failure(error.message ?: "Steps could not be read."))
            }
        }
    }

    private fun failure(message: String) = JSONObject().put("ok", false).put("error", message)

    private fun reply(requestId: String, result: JSONObject) {
        val arguments = JSONArray().put(requestId).put(result).toString()
        activity.runOnUiThread {
            webView.evaluateJavascript(
                "window.ForgeHealthBridge.resolve.apply(null, $arguments)",
                null,
            )
        }
    }

    private data class StepRequest(val requestId: String, val date: LocalDate?)
}
