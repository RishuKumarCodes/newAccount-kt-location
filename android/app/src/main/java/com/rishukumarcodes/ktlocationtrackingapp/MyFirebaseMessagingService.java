package com.rishukumarcodes.ktlocationtrackingapp;

import android.content.Intent;
import android.os.Build;
import androidx.annotation.NonNull;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

public class MyFirebaseMessagingService extends FirebaseMessagingService {
    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        // If message contains data payload
        if (remoteMessage.getData() != null) {
            String type = remoteMessage.getData().get("type");
            if (type != null && type.toUpperCase().contains("ORDER")) {
                Intent svc = new Intent(this, RingtoneService.class);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    startForegroundService(svc);
                } else {
                    startService(svc);
                }
                // You should also post a notification so user sees it in status bar (optional)
            }
        }
    }
}
