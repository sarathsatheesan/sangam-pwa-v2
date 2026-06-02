package enovoapp.app;

import android.Manifest;
import android.content.Context;
import android.media.AudioManager;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * Native call-audio routing for eNoVo calls.
 *
 * The WebView can't route call audio (setSinkId is unsupported in Android's
 * System WebView), so this plugin drives Android's AudioManager instead:
 *  - startCallAudio(): request BLUETOOTH_CONNECT (Android 12+) if needed, then
 *    switch to MODE_IN_COMMUNICATION and auto-route to a connected Bluetooth
 *    headset/car (SCO) if one is available.
 *  - setSpeaker({on}): toggle speakerphone (turns BT SCO off when speaker is on).
 *  - stopCallAudio(): undo everything and return to MODE_NORMAL on hang-up.
 *
 * Every AudioManager call is wrapped in try/catch and is best-effort — if a
 * device/permission rejects something, the call still works on the default route.
 */
@CapacitorPlugin(
    name = "CallAudio",
    permissions = {
        @Permission(strings = { Manifest.permission.BLUETOOTH_CONNECT }, alias = "bluetooth")
    }
)
public class CallAudioPlugin extends Plugin {

    private AudioManager am;

    @Override
    public void load() {
        try {
            am = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
        } catch (Exception e) {
            am = null;
        }
    }

    @PluginMethod
    public void startCallAudio(PluginCall call) {
        // On Android 12+ (S), routing to a Bluetooth device needs the runtime
        // BLUETOOTH_CONNECT permission. Request it the first time, then proceed.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
                && getPermissionState("bluetooth") != PermissionState.GRANTED) {
            requestPermissionForAlias("bluetooth", call, "bluetoothPermCallback");
            return;
        }
        applyCallAudio(call);
    }

    @PermissionCallback
    private void bluetoothPermCallback(PluginCall call) {
        // Proceed regardless of grant/deny — if denied, BT routing is simply
        // skipped and the call continues on earpiece/speaker.
        applyCallAudio(call);
    }

    private void applyCallAudio(PluginCall call) {
        try {
            if (am != null) {
                am.setMode(AudioManager.MODE_IN_COMMUNICATION);
                // Auto-route to a connected Bluetooth headset / car kit (HFP/SCO).
                if (am.isBluetoothScoAvailableOffCall()) {
                    am.startBluetoothSco();
                    am.setBluetoothScoOn(true);
                }
            }
        } catch (Exception e) {
            // best-effort — fall back to the default audio route
        }
        call.resolve();
    }

    @PluginMethod
    public void stopCallAudio(PluginCall call) {
        try {
            if (am != null) {
                am.setBluetoothScoOn(false);
                am.stopBluetoothSco();
                am.setSpeakerphoneOn(false);
                am.setMode(AudioManager.MODE_NORMAL);
            }
        } catch (Exception e) {
            // ignore
        }
        call.resolve();
    }

    @PluginMethod
    public void setSpeaker(PluginCall call) {
        boolean on = Boolean.TRUE.equals(call.getBoolean("on", false));
        try {
            if (am != null) {
                if (on) {
                    // Speaker on → take audio off Bluetooth.
                    am.setBluetoothScoOn(false);
                    am.stopBluetoothSco();
                    am.setSpeakerphoneOn(true);
                } else {
                    am.setSpeakerphoneOn(false);
                    // Restore Bluetooth route if a device is connected.
                    if (am.isBluetoothScoAvailableOffCall()) {
                        am.startBluetoothSco();
                        am.setBluetoothScoOn(true);
                    }
                }
            }
        } catch (Exception e) {
            // ignore
        }
        JSObject ret = new JSObject();
        ret.put("speaker", on);
        call.resolve(ret);
    }
}
