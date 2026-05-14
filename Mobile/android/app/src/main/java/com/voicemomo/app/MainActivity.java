package com.voicemomo.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Enregistrement manuel forcé de tous les plugins locaux
        registerPlugin(UssdBackgroundNativePlugin.class);
        registerPlugin(UssdAccessibilityPlugin.class);
        registerPlugin(SmsReaderPlugin.class);
    }
}
