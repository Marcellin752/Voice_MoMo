package com.voicemomo.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Enregistrement manuel des plugins locaux AVANT super.onCreate()
        registerPlugin(UssdBackgroundNativePlugin.class);
        registerPlugin(UssdAccessibilityPlugin.class);
        registerPlugin(SmsReaderPlugin.class);
        
        super.onCreate(savedInstanceState);
    }
}
