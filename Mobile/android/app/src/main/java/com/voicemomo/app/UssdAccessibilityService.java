package com.voicemomo.app;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.AccessibilityServiceInfo;
import android.os.Bundle;
import android.util.Log;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;

public class UssdAccessibilityService extends AccessibilityService {
    private static final String TAG = "UssdAutoService";
    
    public static String pendingPIN = null;
    public static boolean transactionActive = false;
    private static UssdAccessibilityService instance;

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        instance = this;
        Log.d(TAG, "Voicemomo Accessibility Service Connected");
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (!transactionActive) return;

        AccessibilityNodeInfo nodeInfo = event.getSource();
        if (nodeInfo == null) return;

        String className = String.valueOf(event.getClassName());
        
        if (className.equals("android.app.AlertDialog") || 
            className.equals("android.widget.FrameLayout") || 
            className.equals("com.android.phone.UssdAlertActivity")) {
            
            processUssdDialog(nodeInfo);
        }
    }

    private void processUssdDialog(AccessibilityNodeInfo nodeInfo) {
        String ussdText = extractText(nodeInfo, new StringBuilder()).toString();
        Log.d(TAG, "USSD Text Intercepted: " + ussdText);

        if (ussdText.toLowerCase().contains("pin") || ussdText.toLowerCase().contains("secret") || ussdText.toLowerCase().contains("code") || ussdText.toLowerCase().contains("confirmer")) {
            if (pendingPIN != null) {
                AccessibilityNodeInfo inputNode = findNodeByClassName(nodeInfo, "android.widget.EditText");
                if (inputNode != null) {
                    Bundle arguments = new Bundle();
                    arguments.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, pendingPIN);
                    inputNode.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, arguments);
                    
                    AccessibilityNodeInfo sendButton = findNodeByText(nodeInfo, "Envoyer", "Send", "OK", "SENDEN", "Confirmer", "Confirm");
                    if (sendButton != null) {
                        sendButton.performAction(AccessibilityNodeInfo.ACTION_CLICK);
                        Log.d(TAG, "PIN injected and submitted.");
                        pendingPIN = null; 
                    } else {
                        Log.w(TAG, "Send button not found.");
                    }
                } else {
                    Log.w(TAG, "Input EditText not found.");
                }
            } else {
                UssdAccessibilityPlugin.emitEvent("awaiting_pin", ussdText);
            }
        } 
        else if (ussdText.toLowerCase().contains("succès") || ussdText.toLowerCase().contains("effectué") || ussdText.toLowerCase().contains("successful") || ussdText.toLowerCase().contains("reussie")) {
            UssdAccessibilityPlugin.emitEvent("success", ussdText);
            transactionActive = false;
            clickButton(nodeInfo, "OK", "Cancel", "Annuler", "Fermer", "Close", "Quitter");
        }
        else if (ussdText.toLowerCase().contains("insuffisant") || ussdText.toLowerCase().contains("échoué") || ussdText.toLowerCase().contains("failed") || ussdText.toLowerCase().contains("erreur") || ussdText.toLowerCase().contains("incorrect")) {
            UssdAccessibilityPlugin.emitEvent("error", ussdText);
            transactionActive = false;
            clickButton(nodeInfo, "OK", "Cancel", "Annuler", "Fermer");
        } else {
            UssdAccessibilityPlugin.emitEvent("info", ussdText);
        }
    }

    private StringBuilder extractText(AccessibilityNodeInfo nodeInfo, StringBuilder sb) {
        if (nodeInfo == null) return sb;
        if (nodeInfo.getText() != null) {
            sb.append(nodeInfo.getText()).append(" ");
        }
        for (int i = 0; i < nodeInfo.getChildCount(); i++) {
            extractText(nodeInfo.getChild(i), sb);
        }
        return sb;
    }

    private AccessibilityNodeInfo findNodeByClassName(AccessibilityNodeInfo nodeInfo, String className) {
        if (nodeInfo == null) return null;
        if (className.equals(nodeInfo.getClassName())) return nodeInfo;
        
        for (int i = 0; i < nodeInfo.getChildCount(); i++) {
            AccessibilityNodeInfo result = findNodeByClassName(nodeInfo.getChild(i), className);
            if (result != null) return result;
        }
        return null;
    }

    private AccessibilityNodeInfo findNodeByText(AccessibilityNodeInfo nodeInfo, String... texts) {
        if (nodeInfo == null) return null;
        if (nodeInfo.getText() != null) {
            String nodeText = nodeInfo.getText().toString().toLowerCase();
            for (String text : texts) {
                if (nodeText.contains(text.toLowerCase())) return nodeInfo;
            }
        }
        for (int i = 0; i < nodeInfo.getChildCount(); i++) {
            AccessibilityNodeInfo result = findNodeByText(nodeInfo.getChild(i), texts);
            if (result != null) return result;
        }
        return null;
    }

    private void clickButton(AccessibilityNodeInfo nodeInfo, String... buttonTexts) {
        AccessibilityNodeInfo button = findNodeByText(nodeInfo, buttonTexts);
        if (button != null) {
            button.performAction(AccessibilityNodeInfo.ACTION_CLICK);
        }
    }

    @Override
    public void onInterrupt() {
        Log.d(TAG, "Service interrupted");
    }
}
