package com.rishukumarcodes.ktlocationtrackingapp;

import android.content.Intent;
import android.os.Build;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

public class RingtoneModule extends ReactContextBaseJavaModule {
    private final ReactApplicationContext reactContext;

    public RingtoneModule(ReactApplicationContext context) {
        super(context);
        this.reactContext = context;
    }

    @Override
    public String getName() {
        return "RingtoneModule";
    }

    @ReactMethod
    public void startRingtoneService(Promise promise) {
        try {
            Intent serviceIntent = new Intent(reactContext, RingtoneService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                reactContext.startForegroundService(serviceIntent);
            } else {
                reactContext.startService(serviceIntent);
            }
            promise.resolve("started");
        } catch (Exception e) {
            promise.reject("ERR", e.getMessage());
        }
    }

    @ReactMethod
    public void stopRingtoneService(Promise promise) {
        try {
            Intent serviceIntent = new Intent(reactContext, RingtoneService.class);
            reactContext.stopService(serviceIntent);
            promise.resolve("stopped");
        } catch (Exception e) {
            promise.reject("ERR", e.getMessage());
        }
    }
}
