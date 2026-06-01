# Planory Home-Screen Widgets Configuration Guide

Planory supports interactive home screen widgets for **logging water (+250ml)** and **checking/launching the Pomodoro timer** instantly.

Since Expo runs in a managed environment, shipping native home-screen widgets in production requires configuring **Expo Config Plugins** or using a library like `expo-widgets` to compile native layouts during the EAS prebuild phase.

---

## 📱 iOS Widget Setup (WidgetKit in Swift)

For iOS, you will create a Widget Extension. We target a small widget for quick water logging and a medium widget for the Pomodoro timer.

### 1. Structure (`ios/PlanoryWidgets/PlanoryWidgets.swift`)

Create the Swift widget structure defining the entry point:

```swift
import WidgetKit
import SwiftUI

struct WaterLoggingEntry: TimelineEntry {
    let date: Date
    let waterAmount: Int
}

struct WaterLoggingWidgetEntryView : View {
    var entry: WaterLoggingEntry

    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: "drop.fill")
                .font(.system(size: 28))
                .foregroundColor(.blue)
            
            Text("\(entry.waterAmount) ml")
                .font(.system(.title2, design: .rounded))
                .bold()
                .foregroundColor(.white)
            
            Button(intent: AddWaterIntent()) {
                Text("+250ml")
                    .font(.caption)
                    .bold()
                    .padding(6)
                    .background(Color.blue)
                    .cornerRadius(8)
            }
        }
        .padding()
        .containerBackground(Color(hex: "#0F1115"), for: .widget)
    }
}
```

### 2. iOS App Group Configuration
To share data between the main React Native app and the WidgetKit extension (e.g., sharing the current water total from `AsyncStorage`), you must enable **App Groups** in `app.json`:

```json
{
  "expo": {
    "ios": {
      "entitlements": {
        "com.apple.security.application-groups": ["group.com.yourname.planory"]
      }
    }
  }
}
```

Write to the shared UserDefaults group using React Native:
```javascript
import SharedGroupPreferences from 'react-native-shared-group-preferences';
await SharedGroupPreferences.setItem("hydration_data", { water: 750 }, "group.com.yourname.planory");
```

---

## 🤖 Android Widget Setup (AppWidgetProvider in Kotlin)

For Android, you will define an `AppWidgetProvider` in Kotlin and configure it via Expo Config Plugins to inject configurations into `AndroidManifest.xml` during compilation.

### 1. Layout Template (`android/app/src/main/res/layout/water_widget.xml`)
Define a clean, rounded UI with action buttons:

```xml
<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="#171B22"
    android:orientation="vertical"
    android:padding="16dp"
    android:gravity="center">

    <ImageView
        android:layout_width="32dp"
        android:layout_height="32dp"
        android:src="@drawable/ic_water"
        android:tint="#4B6BFB" />

    <TextView
        android:id="@+id/widget_water_text"
        android:layout_width="wrap_next"
        android:layout_height="wrap_next"
        android:text="1250 / 2000 ml"
        android:textColor="#F3F1EC"
        android:textSize="16sp"
        android:textStyle="bold"
        android:layout_marginTop="8dp" />

    <Button
        android:id="@+id/btn_add_water"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="+250ml"
        android:backgroundTint="#4B6BFB"
        android:textColor="#0F1115"
        android:layout_marginTop="12dp" />
</LinearLayout>
```

### 2. Widget Provider (`android/app/src/main/java/com/planory/WaterWidgetProvider.kt`)

Write the Kotlin class that handles clicks, launches intents, and updates the text:

```kotlin
package com.planory

import android.app.PendingIntent
import android.app.widget.AppWidgetManager
import android.app.widget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews

class WaterWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        for (appWidgetId in appWidgetIds) {
            val views = RemoteViews(context.packageName, R.layout.water_widget)
            
            // Broadcast intent on tap
            val intent = Intent(context, WaterWidgetProvider::class.java).apply {
                action = "ADD_WATER_ACTION"
            }
            val pendingIntent = PendingIntent.getBroadcast(
                context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.btn_add_water, pendingIntent)
            
            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }
}
```

---

## 🛠️ Expo Config Plugin (`widget-plugin.js`)

To automate widget injection into native directories during EAS builds:

1. Create a `plugins/withWidgets.js` plugin in your root workspace.
2. Link it in `app.json`:

```json
{
  "expo": {
    "plugins": [
      ["./plugins/withWidgets", {
        "iosWidgetFolder": "ios/PlanoryWidgets",
        "androidWidgetLayout": "android/app/src/main/res/layout/water_widget.xml"
      }]
    ]
  }
}
```

This ensures a fully automated build flow, making Planory ready to publish with beautiful native widgets!
