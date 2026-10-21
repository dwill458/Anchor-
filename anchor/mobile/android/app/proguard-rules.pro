# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# Add any project specific keep options here:

# @shopify/react-native-skia
-keep class com.shopify.reactnative.skia.** { *; }

# react-native-svg
-keep class com.horcrux.svg.** { *; }

# expo-blur
-keep class expo.modules.blur.** { *; }

# expo-secure-store
-keep class expo.modules.securestore.** { *; }

# @sentry/react-native
-keep class io.sentry.** { *; }
-keep class io.sentry.react.** { *; }

# react-native-purchases
-keep class com.revenuecat.purchases.** { *; }
-keep class com.revenuecat.reactnative.** { *; }

# @react-native-firebase/*
-keep class io.invertase.firebase.** { *; }
-keep class com.google.firebase.** { *; }

# react-native-view-shot
-keep class fr.greweb.reactnativeviewshot.** { *; }

# react-native-webview
-keep class com.reactnativecommunity.webview.** { *; }

# Expo SDK 58 Android modules bridge these enums to JavaScript without the v2
# Enumerable marker. Preserve the enum entries and String values when R8 shrinks.
-keep enum expo.modules.sqlite.SQLAction { *; }
-keep enum expo.modules.crypto.DigestAlgorithm { *; }
-keep enum expo.modules.crypto.DigestOptions$Encoding { *; }
-keep enum expo.modules.haptics.arguments.HapticType { *; }
-keep enum expo.modules.haptics.arguments.ImpactStyle { *; }
-keep enum expo.modules.haptics.arguments.NotificationType { *; }

# expo-audio
-keep class expo.modules.audio.** { *; }
-dontwarn expo.modules.audio.**

# AndroidX Media3 (ExoPlayer) - required for expo-audio in R8 full mode
-keep class androidx.media3.** { *; }
-dontwarn androidx.media3.**
-keep class androidx.media3.session.** { *; }
-keep class androidx.media3.exoplayer.** { *; }
-keep class androidx.media3.common.** { *; }
-keepclassmembers class androidx.media3.** {
    *;
}
