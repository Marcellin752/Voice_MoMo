        try {
            List<SubscriptionInfo> list = sm.getActiveSubscriptionInfoList();
            if (list != null) {
                for (SubscriptionInfo info : list) {
                    String carrierName = info.getCarrierName() != null ? info.getCarrierName().toString().toLowerCase() : "";
                    if (carrierName.contains("mtn")) {
                        subId = info.getSubscriptionId();
                        Log.i(TAG, "Found MTN SIM card! using subscriptionId=" + subId);
                        break;
                    }
                }
            }
            if (subId == SubscriptionManager.INVALID_SUBSCRIPTION_ID) {
                // fallback to old logic
