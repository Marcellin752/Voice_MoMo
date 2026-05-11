package com.voicemomo.app;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.telephony.TelephonyManager;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.annotation.RequiresApi;
import androidx.core.app.ActivityCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "UssdBackground",
    permissions = {
        @Permission(
            alias = "call",
            strings = { Manifest.permission.CALL_PHONE }
        )
    }
)
public class UssdBackgroundPlugin extends Plugin {

    private TelephonyManager telephonyManager;
    private Handler handler;

    @Override
    public void load() {
        telephonyManager = (TelephonyManager) getContext().getSystemService(Context.TELEPHONY_SERVICE);
        handler = new Handler(Looper.getMainLooper());
    }

    @RequiresApi(api = Build.VERSION_CODES.O)
    @PluginMethod
    public void executeUssd(PluginCall call) {
        String ussdCode = call.getString("code");
        if (ussdCode == null || ussdCode.isEmpty()) {
            call.reject("USSD code is missing");
            return;
        }

        if (ActivityCompat.checkSelfPermission(getContext(), Manifest.permission.CALL_PHONE) != PackageManager.PERMISSION_GRANTED) {
            requestPermissionForAlias("call", call, "usdPermissionCallback");
            return;
        }

        executeSilentUssd(call, ussdCode);
    }

    @PermissionCallback
    private void usdPermissionCallback(PluginCall call) {
        if (getPermissionState("call") == com.getcapacitor.PermissionState.GRANTED) {
            String ussdCode = call.getString("code");
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                executeSilentUssd(call, ussdCode);
            } else {
                call.reject("API level too low for silent USSD");
            }
        } else {
            call.reject("Call permission denied");
        }
    }

    @RequiresApi(api = Build.VERSION_CODES.O)
    private void executeSilentUssd(PluginCall call, String ussdCode) {
        Log.i("USSD", "🚀 [START] Executing silent USSD: " + ussdCode);
        try {
            TelephonyManager.UssdResponseCallback responseCallback = new TelephonyManager.UssdResponseCallback() {
                @Override
                public void onReceiveUssdResponse(TelephonyManager telephonyManager, String request, CharSequence response) {
                    Log.i("USSD", "✅ [SUCCESS] USSD Response: " + response);
                    JSObject ret = new JSObject();
                    ret.put("status", "success");
                    ret.put("message", response != null ? response.toString() : "");
                    
                    // On utilise notifyListeners pour les mises à jour asynchrones
                    notifyListeners("ussdUpdate", ret);
                    
                    // Si on n'a pas encore résolu le call, on le fait ici
                    if (!call.isReleased()) {
                        call.resolve(ret);
                    }
                }

                @Override
                public void onReceiveUssdResponseFailed(TelephonyManager telephonyManager, String request, int failureCode) {
                    Log.e("USSD", "❌ [FAILURE] USSD Failed with code: " + failureCode);
                    JSObject ret = new JSObject();
                    ret.put("status", "error");
                    ret.put("failureCode", failureCode);
                    ret.put("message", "USSD Failed with code: " + failureCode);
                    
                    notifyListeners("ussdUpdate", ret);
                    
                    if (!call.isReleased()) {
                        call.reject("USSD Failed: " + failureCode);
                    }
                }
            };
            
            // On ne résout pas le call immédiatement ici si on veut attendre la réponse
            // OU on le résout pour dire que c'est lancé, et on utilise les listeners pour la suite.
            // Vu le flow actuel, on va le garder ouvert (ne pas appeler resolve ici).
            
            telephonyManager.sendUssdRequest(ussdCode, responseCallback, handler);
            Log.d("USSD", "📡 [PENDING] USSD request sent to TelephonyManager");
            
        } catch (SecurityException e) {
            Log.e("USSD", "🔒 [SECURITY] Permission error: " + e.getMessage());
            call.reject("Security Exception: " + e.getMessage());
        } catch (Exception e) {
            Log.e("USSD", "🔥 [CRITICAL] Error: " + e.getMessage());
            call.reject("Execution error: " + e.getMessage());
        }
    }
}
