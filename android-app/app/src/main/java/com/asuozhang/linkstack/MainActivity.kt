package com.asuozhang.linkstack

import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.Toast
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import java.net.URLEncoder

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webview)
        webView.webViewClient = WebViewClient()
        webView.webChromeClient = WebChromeClient()
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.cacheMode = WebSettings.LOAD_DEFAULT

        val forceRefreshBtn: Button = findViewById(R.id.btn_force_refresh)
        forceRefreshBtn.setOnClickListener {
            forceRefresh()
        }

        loadFromIntent(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        loadFromIntent(intent)
    }

    private fun loadFromIntent(intent: Intent) {
        val base = BuildConfig.WEB_APP_URL
        if (Intent.ACTION_SEND == intent.action && "text/plain" == intent.type) {
            val text = intent.getStringExtra(Intent.EXTRA_TEXT).orEmpty()
            val url = extractFirstUrl(text)
            val target = if (url.isNotBlank()) {
                "$base?url=${encode(url)}&text=${encode(text)}"
            } else {
                "$base?text=${encode(text)}"
            }
            webView.loadUrl(target)
        } else {
            webView.loadUrl(base)
        }
    }

    private fun extractFirstUrl(text: String): String {
        val regex = Regex("https?://[^\\s]+")
        return regex.find(text)?.value?.trim()?.trimEnd('.', ',', ';', ')') ?: ""
    }

    private fun encode(v: String): String = URLEncoder.encode(v, "UTF-8")

    private fun forceRefresh() {
        webView.clearCache(true)
        webView.clearHistory()
        webView.reload()
        Toast.makeText(this, "已强制刷新", Toast.LENGTH_SHORT).show()
    }
}
