package com.voicemomo.app;

import android.content.Context;
import android.os.Build;
import android.telephony.SubscriptionInfo;
import android.telephony.SubscriptionManager;
import android.telephony.TelephonyManager;
import android.util.Log;

import androidx.annotation.RequiresApi;

import java.util.List;

/**
 * Sélectionne le TelephonyManager lié à la carte SIM utilisée pour les données / voix,
 * car sendUssdRequest sur le TM par défaut peut échouer sur téléphones dual-SIM.
 */
public final class TelephonyUssdHelper {
    private static final String TAG = "TelephonyUssdHelper";

    private TelephonyUssdHelper() {}

    @RequiresApi(api = Build.VERSION_CODES.N)
    public static TelephonyManager getTelephonyManagerForCellular(Context ctx) {
        TelephonyManager tm = (TelephonyManager) ctx.getSystemService(Context.TELEPHONY_SERVICE);
        if (tm == null) {
            return null;
        }
        SubscriptionManager sm = (SubscriptionManager) ctx.getSystemService(Context.TELEPHONY_SUBSCRIPTION_SERVICE);
        if (sm == null) {
            return tm;
        }

        int subId = SubscriptionManager.INVALID_SUBSCRIPTION_ID;
        try {
            List<SubscriptionInfo> list = sm.getActiveSubscriptionInfoList();
            if (list != null) {
                // 1. Chercher prioritairement une carte SIM MTN
                for (SubscriptionInfo info : list) {
                    String carrierName = info.getCarrierName() != null ? info.getCarrierName().toString().toLowerCase() : "";
                    if (carrierName.contains("mtn")) {
                        subId = info.getSubscriptionId();
                        Log.i(TAG, "Carte SIM MTN détectée. Utilisation de subscriptionId=" + subId);
                        break;
                    }
                }
            }

            // 2. Si aucune SIM MTN trouvée, on retombe sur la logique par défaut
            if (subId == SubscriptionManager.INVALID_SUBSCRIPTION_ID) {
                subId = SubscriptionManager.getDefaultDataSubscriptionId();
                if (subId == SubscriptionManager.INVALID_SUBSCRIPTION_ID) {
                    subId = SubscriptionManager.getDefaultVoiceSubscriptionId();
                }
                if (subId == SubscriptionManager.INVALID_SUBSCRIPTION_ID && list != null && !list.isEmpty()) {
                    subId = list.get(0).getSubscriptionId();
                }
            }
        } catch (SecurityException e) {
            Log.w(TAG, "Subscription list unavailable: " + e.getMessage());
            return tm;
        }

        if (subId != SubscriptionManager.INVALID_SUBSCRIPTION_ID) {
            try {
                TelephonyManager subTm = tm.createForSubscriptionId(subId);
                Log.i(TAG, "Using TelephonyManager for subscriptionId=" + subId);
                return subTm;
            } catch (Exception e) {
                Log.w(TAG, "createForSubscriptionId failed, using default TM: " + e.getMessage());
            }
        }
        return tm;
    }

    public static String describeUssdFailure(int failureCode) {
        switch (failureCode) {
            case -1:
                return "réponse USSD refusée par le réseau (code -1)";
            case -2:
                return "requête USSD annulée ou modem occupé (code -2)";
            case -3:
                return "requête USSD invalide ou non prise en charge (code -3)";
            case -4:
                return "autre requête USSD en cours (code -4)";
            default:
                return "erreur réseau USSD (code " + failureCode + ")";
        }
    }
}
