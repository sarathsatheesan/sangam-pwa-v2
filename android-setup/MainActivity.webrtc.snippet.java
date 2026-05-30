// ─────────────────────────────────────────────────────────────────────────────
// OPTIONAL BUT RECOMMENDED for reliable WebRTC calling.
//
// Capacitor's WebView will prompt/deny getUserMedia unless the WebChromeClient
// grants the request for the app's own origin. Overriding onPermissionRequest
// makes camera/mic "just work" inside your existing web WebRTC code, once the
// OS-level CAMERA/RECORD_AUDIO runtime permissions have been granted.
//
// File: android/app/src/main/java/enovo/app/MainActivity.java
// (package will be `enovo.app` because appId is `enovoapp.app` → Capacitor maps
//  the dotted id to the Java package; confirm the actual path Capacitor generated.)
// ─────────────────────────────────────────────────────────────────────────────

package enovo.app;

import android.os.Bundle;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Grant getUserMedia (camera/mic) requests coming from our own web content.
        this.bridge.getWebView().setWebChromeClient(new BridgeWebChromeClient(this.bridge) {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> request.grant(request.getResources()));
            }
        });
    }
}

// If `BridgeWebChromeClient` is not importable in your Capacitor version, instead
// extend android.webkit.WebChromeClient and re-attach Capacitor's client behavior,
// or use the community plugin approach documented in ANDROID_SETUP.md §6.
