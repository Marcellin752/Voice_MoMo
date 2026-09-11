package com.voicemomo.app;

import android.content.Context;
import android.os.Build;
import android.telecom.PhoneAccountHandle;
import android.telecom.TelecomManager;
import android.telephony.SubscriptionInfo;
import android.telephony.SubscriptionManager;
import android.telephony.TelephonyManager;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.annotation.RequiresApi;

import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Sélectionne le TelephonyManager / subscriptionId de la SIM MTN
 * (dual-SIM : priorise MTN par nom opérateur puis préfixe numéro Bénin).
 */
public final class TelephonyUssdHelper {
    private static final String TAG = "TelephonyUssdHelper";

    /** Préfixes après 01 pour MTN Bénin */
    private static final Set<String> MTN_SUB_PREFIXES = new HashSet<>(Arrays.asList(
            "42", "46", "50", "51", "52", "53", "54", "56", "57", "59",
            "61", "62", "66", "67", "69", "90", "91", "96", "97"
    ));

    private TelephonyUssdHelper() {}

    public static final class SimChoice {
        public final int subscriptionId;
        public final int simSlotIndex;
        public final String label;

        public SimChoice(int subscriptionId, int simSlotIndex, String label) {
            this.subscriptionId = subscriptionId;
            this.simSlotIndex = simSlotIndex;
            this.label = label;
        }
    }

    @Nullable
    @RequiresApi(api = Build.VERSION_CODES.LOLLIPOP_MR1)
    public static SimChoice findPreferredMtnSim(Context ctx) {
        SubscriptionManager sm = (SubscriptionManager) ctx.getSystemService(Context.TELEPHONY_SUBSCRIPTION_SERVICE);
        if (sm == null) return null;
        try {
            List<SubscriptionInfo> list = sm.getActiveSubscriptionInfoList();
            if (list == null || list.isEmpty()) return null;

            // 1) Nom opérateur contient MTN
            for (SubscriptionInfo info : list) {
                CharSequence carrier = info.getCarrierName();
                CharSequence display = info.getDisplayName();
                String carrierName = carrier != null ? carrier.toString().toLowerCase() : "";
                String displayName = display != null ? display.toString().toLowerCase() : "";
                if (carrierName.contains("mtn") || displayName.contains("mtn") || displayName.contains("yello")) {
                    int slot = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                            ? info.getSimSlotIndex()
                            : info.getSimSlotIndex();
                    Log.i(TAG, "SIM MTN par nom: subId=" + info.getSubscriptionId() + " slot=" + slot);
                    return new SimChoice(info.getSubscriptionId(), slot, "MTN");
                }
            }

            // 2) Numéro MSISDN préfixe MTN Bénin (01xx…)
            for (SubscriptionInfo info : list) {
                String number = info.getNumber();
                if (number == null) continue;
                String digits = number.replaceAll("\\D", "");
                if (digits.startsWith("229") && digits.length() >= 11) {
                    digits = "0" + digits.substring(3);
                }
                if (digits.length() == 10 && digits.startsWith("01")) {
                    String sub = digits.substring(2, 4);
                    if (MTN_SUB_PREFIXES.contains(sub)) {
                        int slot = info.getSimSlotIndex();
                        Log.i(TAG, "SIM MTN par préfixe " + sub + ": subId=" + info.getSubscriptionId());
                        return new SimChoice(info.getSubscriptionId(), slot, "MTN");
                    }
                }
            }
        } catch (SecurityException e) {
            Log.w(TAG, "Subscription list unavailable: " + e.getMessage());
        }
        return null;
    }

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
            SimChoice mtn = findPreferredMtnSim(ctx);
            if (mtn != null) {
                subId = mtn.subscriptionId;
            }

            if (subId == SubscriptionManager.INVALID_SUBSCRIPTION_ID) {
                List<SubscriptionInfo> list = sm.getActiveSubscriptionInfoList();
                subId = SubscriptionManager.getDefaultDataSubscriptionId();
                if (subId == SubscriptionManager.INVALID_SUBSCRIPTION_ID) {
                    subId = SubscriptionManager.getDefaultVoiceSubscriptionId();
                }
                if (subId == SubscriptionManager.INVALID_SUBSCRIPTION_ID && list != null && !list.isEmpty()) {
                    subId = list.get(0).getSubscriptionId();
                }
                Log.i(TAG, "Fallback subscriptionId=" + subId);
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

    /** PhoneAccountHandle pour forcer l'appel USSD sur la SIM MTN (Android M+). */
    @Nullable
    @RequiresApi(api = Build.VERSION_CODES.M)
    public static PhoneAccountHandle getMtnPhoneAccountHandle(Context ctx) {
        SimChoice mtn = findPreferredMtnSim(ctx);
        if (mtn == null) return null;
        try {
            TelecomManager telecom = (TelecomManager) ctx.getSystemService(Context.TELECOM_SERVICE);
            if (telecom == null) return null;
            List<PhoneAccountHandle> accounts = telecom.getCallCapablePhoneAccounts();
            if (accounts == null) return null;
            String subStr = String.valueOf(mtn.subscriptionId);
            for (PhoneAccountHandle handle : accounts) {
                String id = handle.getId();
                if (id != null && (id.equals(subStr) || id.contains(subStr))) {
                    Log.i(TAG, "PhoneAccountHandle MTN trouvé: " + id);
                    return handle;
                }
            }
            // Certains OEM : ordre = slot
            if (mtn.simSlotIndex >= 0 && mtn.simSlotIndex < accounts.size()) {
                return accounts.get(mtn.simSlotIndex);
            }
        } catch (SecurityException e) {
            Log.w(TAG, "getCallCapablePhoneAccounts: " + e.getMessage());
        } catch (Exception e) {
            Log.w(TAG, "getMtnPhoneAccountHandle: " + e.getMessage());
        }
        return null;
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
