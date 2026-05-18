package com.voicemomo.app;

import android.content.Context;
import android.telephony.SubscriptionInfo;
import android.telephony.SubscriptionManager;
import java.util.List;
import android.provider.Settings;
import android.text.TextUtils;
import android.util.Log;

import android.telephony.TelephonyManager;
import android.os.Handler;
import android.os.Looper;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import android.Manifest;

@CapacitorPlugin(
    name = "AccessibilityPlugin",
    permissions = {
        @Permission(
            alias = "phone",
            strings = {Manifest.permission.CALL_PHONE}
        )
    }
)
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

    @PluginMethod
    public void executeUssd(PluginCall call) {
        String code = call.getString("code");
        Integer simIndex = call.getInt("simIndex"); // 0 for SIM1, 1 for SIM2
        
        if (code == null) {
            call.reject("Code USSD manquant");
            return;
        }

        Context context = getContext();
        UssdAccessibilityService.transactionActive = true;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                TelephonyManager telephonyManager;
                if (simIndex != null) {
                    telephonyManager = (TelephonyManager) context.getSystemService(Context.TELEPHONY_SERVICE);
                    SubscriptionManager subManager = (SubscriptionManager) context.getSystemService(Context.TELEPHONY_SUBSCRIPTION_SERVICE);
                    List<SubscriptionInfo> subInfoList = subManager.getActiveSubscriptionInfoList();
                    if (subInfoList != null && simIndex < subInfoList.size()) {
                        int subId = subInfoList.get(simIndex).getSubscriptionId();
                        telephonyManager = telephonyManager.createForSubscriptionId(subId);
                    }
                } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    telephonyManager = TelephonyUssdHelper.getTelephonyManagerForCellular(context);
                } else {
                    telephonyManager = (TelephonyManager) context.getSystemService(Context.TELEPHONY_SERVICE);
                }

                Handler handler = new Handler(Looper.getMainLooper());
                Log.i("UssdAccessibilityPlugin", "📡 [DEBUG] Envoi du code USSD: " + code);
                Log.i("UssdAccessibilityPlugin", "📡 [DEBUG] Longueur du code: " + code.length());
                for (int i = 0; i < code.length(); i++) {
                    char c = code.charAt(i);
                    Log.i("UssdAccessibilityPlugin", "    [" + i + "] = '" + c + "' (ASCII: " + (int)c + ")");
                }
                telephonyManager.sendUssdRequest(code, new TelephonyManager.UssdResponseCallback() {
                    @Override
                    public void onReceiveUssdResponse(TelephonyManager telephonyManager, String request, CharSequence response) {
                        super.onReceiveUssdResponse(telephonyManager, request, response);
                        String ussdResponse = response.toString();
                        Log.d("UssdPlugin", "USSD Response: " + ussdResponse);
                        emitEvent("info", ussdResponse);
                        
                        // Si le message contient "succès", on peut considérer que c'est fini
                        if (ussdResponse.toLowerCase().contains("succès") || ussdResponse.toLowerCase().contains("effectué")) {
                            emitEvent("success", ussdResponse);
                        }
                    }

                    @Override
                    public void onReceiveUssdResponseFailed(TelephonyManager telephonyManager, String request, int failureCode) {
                        super.onReceiveUssdResponseFailed(telephonyManager, request, failureCode);
                        Log.e("UssdPlugin", "USSD Failed with code: " + failureCode);
                        emitEvent("error", "Échec USSD (Code: " + failureCode + ")");
                    }
                }, handler);
                
                call.resolve();
            } catch (SecurityException e) {
                call.reject("Permission CALL_PHONE manquante");
            } catch (Exception e) {
                Log.e("UssdAccessibilityPlugin", "sendUssdRequest failed", e);
                call.reject("Échec USSD in-app: " + e.getMessage());
            }
        } else {
            call.reject("Android 8+ requis pour l'exécution USSD sans quitter l'application.");
        }
    }
}
