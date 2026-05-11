package com.voicemomo.app;

import android.content.Context;
import android.provider.Settings;
import android.text.TextUtils;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AccessibilityPlugin")
public class UssdAccessibilityPlugin extends Plugin {

    private static UssdAccessibilityPlugin instance;

    @Override
    public void load() {
        instance = this;
    }

    public static void emitEvent(String status, String message) {
        if (instance != null) {
            JSObject ret = new JSObject();
            ret.put("status", status);
            ret.put("message", message);
            instance.notifyListeners("ussdAutoEvent", ret);
        } else {
            Log.w("UssdAccessibilityPlugin", "Cannot emit, instance is null");
        }
    }

    @PluginMethod
    public void isEnabled(PluginCall call) {
        Context context = getContext();
        int accessibilityEnabled = 0;
        final String service = context.getPackageName() + "/" + UssdAccessibilityService.class.getCanonicalName();
        try {
            accessibilityEnabled = Settings.Secure.getInt(
                context.getApplicationContext().getContentResolver(),
                android.provider.Settings.Secure.ACCESSIBILITY_ENABLED);
        } catch (Settings.SettingNotFoundException e) {
            Log.e("UssdAuto", "Error found accessing accessibility : " + e.getMessage());
        }
        
        TextUtils.SimpleStringSplitter mStringColonSplitter = new TextUtils.SimpleStringSplitter(':');

        if (accessibilityEnabled == 1) {
            String settingValue = Settings.Secure.getString(
                context.getApplicationContext().getContentResolver(),
                Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES);
            if (settingValue != null) {
                mStringColonSplitter.setString(settingValue);
                while (mStringColonSplitter.hasNext()) {
                    String accessibilityService = mStringColonSplitter.next();
                    if (accessibilityService.equalsIgnoreCase(service)) {
                        JSObject ret = new JSObject();
                        ret.put("enabled", true);
                        call.resolve(ret);
                        return;
                    }
                }
            }
        }
        
        JSObject ret = new JSObject();
        ret.put("enabled", false);
        call.resolve(ret);
    }

    @PluginMethod
    public void setTransactionActive(PluginCall call) {
        boolean active = call.getBoolean("active", false);
        UssdAccessibilityService.transactionActive = active;
        call.resolve();
    }

    @PluginMethod
    public void cachePinSecurely(PluginCall call) {
        String pin = call.getString("pin");
        UssdAccessibilityService.pendingPIN = pin;
        call.resolve();
    }
}
