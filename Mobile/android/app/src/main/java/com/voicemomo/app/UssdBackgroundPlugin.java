package com.voicemomo.app;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.telephony.TelephonyManager;

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
        try {
            TelephonyManager.UssdResponseCallback responseCallback = new TelephonyManager.UssdResponseCallback() {
                @Override
                public void onReceiveUssdResponse(TelephonyManager telephonyManager, String request, CharSequence response) {
                    JSObject ret = new JSObject();
                    ret.put("type", "response");
                    ret.put("message", response != null ? response.toString() : "");
                    ret.put("isFinal", false);
                    notifyListeners("ussdEvent", ret);
                    call.resolve(ret);
                }

                @Override
                public void onReceiveUssdResponseFailed(TelephonyManager telephonyManager, String request, int failureCode) {
                    JSObject ret = new JSObject();
                    ret.put("type", "error");
                    ret.put("failureCode", failureCode);
                    notifyListeners("ussdEvent", ret);
                    call.reject("USSD Failed with code: " + failureCode);
                }
            };
            
            telephonyManager.sendUssdRequest(ussdCode, responseCallback, handler);
            
            // Initial Notification
            JSObject initRet = new JSObject();
            initRet.put("status", "pending");
            call.resolve(initRet);
            
        } catch (SecurityException e) {
            call.reject("Security Exception: " + e.getMessage());
        }
    }
}
