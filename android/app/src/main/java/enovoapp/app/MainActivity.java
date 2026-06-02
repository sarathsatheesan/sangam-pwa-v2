package enovoapp.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Must register custom plugins BEFORE super.onCreate().
        registerPlugin(CallAudioPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
