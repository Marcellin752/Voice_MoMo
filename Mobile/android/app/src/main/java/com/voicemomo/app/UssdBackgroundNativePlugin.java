package com.voicemomo.app;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.telephony.TelephonyManager;
import android.util.Log;

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
            alias = "phone",
            strings = { 
                Manifest.permission.CALL_PHONE,
                Manifest.permission.READ_PHONE_STATE 
            }
        )
    }
)
public class UssdBackgroundNativePlugin extends Plugin {

    private Handler handler;

    @Override
    public void load() {
        handler = new Handler(Looper.getMainLooper());
        Log.i("UssdBackground", "🚀 Plugin UssdBackground chargé");
    }

    @PluginMethod
    public void executeUssd(PluginCall call) {
        String ussdCode = call.getString("code");
        Log.i("UssdBackground", "📥 Appel executeUssd avec: " + ussdCode);
        Log.i("UssdBackground", "📥 Code length: " + (ussdCode != null ? ussdCode.length() : "null"));
        Log.i("UssdBackground", "📥 Code bytes: " + (ussdCode != null ? ussdCode.getBytes().length : "null"));
        
        if (ussdCode == null || ussdCode.isEmpty()) {
            call.reject("USSD code is missing");
            return;
        }

        if (ActivityCompat.checkSelfPermission(getContext(), Manifest.permission.CALL_PHONE) != PackageManager.PERMISSION_GRANTED ||
            ActivityCompat.checkSelfPermission(getContext(), Manifest.permission.READ_PHONE_STATE) != PackageManager.PERMISSION_GRANTED) {
            Log.i("UssdBackground", "🔐 Demande de permissions...");
            requestPermissionForAlias("phone", call, "ussdPermissionCallback");
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            executeSilentUssd(call, ussdCode);
        } else {
            call.reject("API level too low for silent USSD (Oreo required)");
        }
    }

    @PluginMethod
    public void executeDirectCall(PluginCall call) {
        String ussdCode = call.getString("code");
        if (ussdCode == null || ussdCode.isEmpty()) {
            call.reject("USSD code is missing");
            return;
        }

        if (ActivityCompat.checkSelfPermission(getContext(), Manifest.permission.CALL_PHONE) != PackageManager.PERMISSION_GRANTED) {
            requestPermissionForAlias("phone", call, "ussdPermissionCallback");
            return;
        }

        try {
            Log.i("UssdBackground", "📞 Lancement appel direct ACTION_CALL: " + ussdCode);
            Intent intent = new Intent(Intent.ACTION_CALL);
            // On encode le # en %23 pour l'URL tel:
            String encodedUssd = ussdCode.replace("#", Uri.encode("#"));
            intent.setData(Uri.parse("tel:" + encodedUssd));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            Log.e("UssdBackground", "❌ Erreur ACTION_CALL: " + e.getMessage());
            call.reject(e.getMessage());
        }
    }

    @PermissionCallback
    public void ussdPermissionCallback(PluginCall call) {
        Log.i("UssdBackground", "🔄 Retour de permission");
        if (getPermissionState("phone") == com.getcapacitor.PermissionState.GRANTED) {
            String ussdCode = call.getString("code");
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                executeSilentUssd(call, ussdCode);
            } else {
                call.reject("API level too low for silent USSD");
            }
        } else {
            call.reject("Phone permissions denied");
        }
    }

    @RequiresApi(api = Build.VERSION_CODES.O)
    private void executeSilentUssd(PluginCall call, String ussdCode) {
        if (ussdCode == null) {
            call.reject("USSD code is null");
            return;
        }
        String cleanCode = ussdCode.trim();
        Log.i("UssdBackground", "📡 [START] Envoi USSD silencieux: " + cleanCode);
        
        TelephonyManager tm = TelephonyUssdHelper.getTelephonyManagerForCellular(getContext());
        if (tm == null) {
            tm = (TelephonyManager) getContext().getSystemService(Context.TELEPHONY_SERVICE);
        }
        
        if (tm == null) {
            call.reject("TelephonyManager indisponible");
            return;
        }

        try {
            TelephonyManager.UssdResponseCallback responseCallback = new TelephonyManager.UssdResponseCallback() {
                @Override
                public void onReceiveUssdResponse(TelephonyManager telephonyManager, String request, CharSequence response) {
                    Log.i("UssdBackground", "✅ Réponse reçue: " + response);
                    JSObject ret = new JSObject();
                    ret.put("status", "success");
                    ret.put("type", "response");
                    ret.put("message", response != null ? response.toString() : "");
                    ret.put("isFinal", true);
                    
                    notifyListeners("ussdEvent", ret);
                    
                    if (!call.isReleased()) {
                        call.resolve(ret);
                    }
                }

                @Override
                public void onReceiveUssdResponseFailed(TelephonyManager telephonyManager, String request, int failureCode) {
                    Log.e("UssdBackground", "❌ Échec USSD code: " + failureCode);
                    String detail = TelephonyUssdHelper.describeUssdFailure(failureCode);
                    JSObject ret = new JSObject();
                    ret.put("status", "error");
                    ret.put("type", "error");
                    ret.put("failureCode", failureCode);
                    ret.put("message", detail);
                    ret.put("isFinal", true);
                    
                    notifyListeners("ussdEvent", ret);
                    
                    if (!call.isReleased()) {
                        call.reject(detail, String.valueOf(failureCode));
                    }
                }
            };
            
            Log.i("UssdBackground", "📡 [DEBUG] Envoi du code USSD: " + cleanCode);
            Log.i("UssdBackground", "📡 [DEBUG] Longueur du code: " + cleanCode.length());
            for (int i = 0; i < cleanCode.length(); i++) {
                char c = cleanCode.charAt(i);
                Log.i("UssdBackground", "    [" + i + "] = '" + c + "' (ASCII: " + (int)c + ")");
            }
            tm.sendUssdRequest(cleanCode, responseCallback, handler);
            Log.d("UssdBackground", "📨 Requête envoyée au système Android");
            
        } catch (SecurityException e) {
            Log.e("UssdBackground", "🔒 Erreur sécurité: " + e.getMessage());
            call.reject("Erreur permission: " + e.getMessage());
        } catch (Exception e) {
            Log.e("UssdBackground", "🔥 Erreur critique: " + e.getMessage());
            call.reject("Erreur execution: " + e.getMessage());
        }
    }
}
