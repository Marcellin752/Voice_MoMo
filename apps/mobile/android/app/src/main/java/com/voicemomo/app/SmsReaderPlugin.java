package com.voicemomo.app;

import android.Manifest;
import android.content.ContentResolver;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.provider.Telephony;
import android.util.Log;

import androidx.annotation.RequiresApi;
import androidx.core.app.ActivityCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONException;

import java.util.ArrayList;
import java.util.List;

@CapacitorPlugin(
    name = "SmsReader",
    permissions = {
        @Permission(
            alias = "sms",
            strings = { 
                Manifest.permission.READ_SMS,
                Manifest.permission.RECEIVE_SMS 
            }
        )
    }
)
public class SmsReaderPlugin extends Plugin {

    private static final String TAG = "SmsReaderPlugin";

    @RequiresApi(api = Build.VERSION_CODES.KITKAT)
    @PluginMethod
    public void getSmsHistory(PluginCall call) {
        Integer limit = call.getInt("limit", 50);
        
        if (ActivityCompat.checkSelfPermission(getContext(), Manifest.permission.READ_SMS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissionForAlias("sms", call, "smsPermissionCallback");
            return;
        }

        readSms(call, limit);
    }

    @PermissionCallback
    private void smsPermissionCallback(PluginCall call) {
        if (getPermissionState("sms") == com.getcapacitor.PermissionState.GRANTED) {
            Integer limit = call.getInt("limit", 50);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
                readSms(call, limit);
            } else {
                call.reject("API level too low for reading SMS");
            }
        } else {
            call.reject("SMS permissions denied");
        }
    }

    @RequiresApi(api = Build.VERSION_CODES.KITKAT)
    private void readSms(PluginCall call, int limit) {
        List<JSObject> smsList = new ArrayList<>();
        ContentResolver contentResolver = getContext().getContentResolver();
        
        try {
            Uri smsUri = Telephony.Sms.CONTENT_URI;
            String[] projection = new String[]{
                Telephony.Sms.ADDRESS,
                Telephony.Sms.BODY,
                Telephony.Sms.DATE,
                Telephony.Sms.TYPE
            };
            
            String sortOrder = Telephony.Sms.DATE + " DESC";

            Cursor cursor = contentResolver.query(smsUri, projection, null, null, sortOrder);

            if (cursor != null) {
                if (cursor.moveToFirst()) {
                    int addressIndex = cursor.getColumnIndex(Telephony.Sms.ADDRESS);
                    int bodyIndex = cursor.getColumnIndex(Telephony.Sms.BODY);
                    int dateIndex = cursor.getColumnIndex(Telephony.Sms.DATE);
                    int typeIndex = cursor.getColumnIndex(Telephony.Sms.TYPE);

                    int count = 0;
                    do {
                        if (count >= limit) break;
                        JSObject sms = new JSObject();
                        sms.put("address", cursor.getString(addressIndex));
                        sms.put("body", cursor.getString(bodyIndex));
                        sms.put("date", cursor.getLong(dateIndex));
                        sms.put("type", cursor.getInt(typeIndex));
                        smsList.add(sms);
                        count++;
                    } while (cursor.moveToNext());
                }
                cursor.close();
            }
            
            JSObject result = new JSObject();
            result.put("messages", new JSArray(smsList));
            result.put("count", smsList.size());
            
            Log.i(TAG, "📥 Read " + smsList.size() + " SMS messages");
            call.resolve(result);
            
        } catch (Exception e) {
            Log.e(TAG, "❌ Error reading SMS: " + e.getMessage(), e);
            call.reject("Error reading SMS: " + e.getMessage());
        }
    }
}
