package com.nishadi.pos; // 👈 මෙතන තියෙන ඔයාගේ package නම වෙනස් කරන්න එපා

import android.os.Bundle;
import android.os.Build;
import android.Manifest;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // 🟢 App එක ඕපන් වෙද්දීම Permissions Popup එක ගෙන්නන කෝඩ් එක
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            // Android 12 සහ ඊට අලුත් ෆෝන් වලට
            requestPermissions(new String[]{
                Manifest.permission.BLUETOOTH_CONNECT,
                Manifest.permission.BLUETOOTH_SCAN,
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
            }, 100);
        } else {
            // පරණ Android ෆෝන් වලට
            requestPermissions(new String[]{
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
            }, 100);
        }
    }
}