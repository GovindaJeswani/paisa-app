package com.paisa.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.telephony.SmsMessage;
import android.util.Log;

/**
 * Receives incoming SMS in real-time.
 * Filters for bank transaction messages and forwards them to the React Native layer.
 *
 * This runs even when the app is in the background.
 */
public class SMSReceiver extends BroadcastReceiver {
    private static final String TAG = "PaisaSMS";

    // Bank sender IDs and patterns
    private static final String[] BANK_PATTERNS = {
        "HDFCBK", "SBIBNK", "ICICIB", "AXISBK", "KOTAKB", "BOBTXN",
        "PNBSMS", "YESBK", "IDBIBK", "CANBNK", "UNIONB", "INDBNK",
        "FEDBK", "CENTBK", "PAYTM", "PhonePe", "GPay", "CRED",
        "JioPay", "AMZN", "hdfcbank", "saboroj", "icicib",
    };

    private static final String[] TRANSACTION_KEYWORDS = {
        "debited", "credited", "spent", "received", "withdrawn",
        "deposited", "INR", "Rs.", "transferred", "paid",
        "UPI", "NEFT", "IMPS", "purchase",
    };

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!"android.provider.Telephony.SMS_RECEIVED".equals(intent.getAction())) {
            return;
        }

        Bundle bundle = intent.getExtras();
        if (bundle == null) return;

        Object[] pdus = (Object[]) bundle.get("pdus");
        if (pdus == null) return;

        String format = bundle.getString("format");

        for (Object pdu : pdus) {
            SmsMessage smsMessage = SmsMessage.createFromPdu((byte[]) pdu, format);
            String sender = smsMessage.getDisplayOriginatingAddress();
            String body = smsMessage.getDisplayMessageBody();

            if (body == null || body.length() < 20) continue;

            // Check if it looks like a bank SMS
            if (isBankSMS(sender, body)) {
                Log.d(TAG, "Bank SMS detected from: " + sender);
                Log.d(TAG, "Body: " + body.substring(0, Math.min(body.length(), 80)) + "...");

                // Send to React Native via a broadcast that the app can receive
                Intent smsIntent = new Intent("com.paisa.app.BANK_SMS");
                smsIntent.putExtra("sender", sender);
                smsIntent.putExtra("body", body);
                smsIntent.putExtra("timestamp", smsMessage.getTimestampMillis());
                smsIntent.setPackage(context.getPackageName());
                context.sendBroadcast(smsIntent);
            }
        }
    }

    private boolean isBankSMS(String sender, String body) {
        // Check sender ID
        if (sender != null) {
            String upperSender = sender.toUpperCase();
            for (String pattern : BANK_PATTERNS) {
                if (upperSender.contains(pattern.toUpperCase())) return true;
            }
        }

        // Check body for transaction keywords
        String upperBody = body.toUpperCase();
        int matchCount = 0;
        for (String keyword : TRANSACTION_KEYWORDS) {
            if (upperBody.contains(keyword.toUpperCase())) {
                matchCount++;
                if (matchCount >= 2) return true; // At least 2 keywords
            }
        }

        return false;
    }
}
