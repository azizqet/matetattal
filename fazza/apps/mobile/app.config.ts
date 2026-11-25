import type { ExpoConfig, ConfigContext } from "expo/config";

const IS_PROD = process.env.APP_VARIANT !== "development";
const BUNDLE_ID = IS_PROD ? "kw.fazza.app" : "kw.fazza.app.dev";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: IS_PROD ? "فزّاع FAZZA" : "FAZZA Dev",
  slug: "fazza",
  scheme: "fazza",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/brand/icon.png",
  userInterfaceStyle: "automatic",
  runtimeVersion: { policy: "appVersion" },
  updates: process.env.EAS_PROJECT_ID ? { url: `https://u.expo.dev/${process.env.EAS_PROJECT_ID}` } : undefined,
  ios: {
    bundleIdentifier: BUNDLE_ID,
    buildNumber: "1",
    supportsTablet: false,
    icon: "./assets/brand/icon.png",
    config: { usesNonExemptEncryption: false },
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        "يستخدم فزّاع موقعك لتحديد موقع الاستلام والتسليم، ولعرض الطلبات القريبة للمندوب، ولمشاركة موقع المندوب مع العميل أثناء الطلب النشط فقط. FAZZA uses your location to set pickup/drop-off points, show nearby requests to drivers, and share the driver's location with the customer during an active order only.",
      NSCameraUsageDescription:
        "يستخدم فزّاع الكاميرا لتصوير الطلب والمستندات وإثبات الاستلام والتسليم وإيصالات الدفع. FAZZA uses the camera to photograph items, documents, delivery proof and payment receipts.",
      NSPhotoLibraryUsageDescription:
        "يستخدم فزّاع الصور لإرفاق صور الطلب والمستندات وإيصالات الدفع. FAZZA uses your photos to attach item photos, documents and payment receipts.",
      CFBundleAllowMixedLocalizations: true,
      CFBundleLocalizations: ["ar", "en"],
      CFBundleDevelopmentRegion: "ar",
    },
    privacyManifests: {
      NSPrivacyTracking: false,
      NSPrivacyTrackingDomains: [],
      NSPrivacyAccessedAPITypes: [
        { NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryUserDefaults", NSPrivacyAccessedAPITypeReasons: ["CA92.1"] },
        { NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryFileTimestamp", NSPrivacyAccessedAPITypeReasons: ["C617.1"] },
        { NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategorySystemBootTime", NSPrivacyAccessedAPITypeReasons: ["35F9.1"] },
        { NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryDiskSpace", NSPrivacyAccessedAPITypeReasons: ["E174.1"] },
      ],
      NSPrivacyCollectedDataTypes: [
        { NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeName", NSPrivacyCollectedDataTypeLinked: true, NSPrivacyCollectedDataTypeTracking: false, NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"] },
        { NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypePhoneNumber", NSPrivacyCollectedDataTypeLinked: true, NSPrivacyCollectedDataTypeTracking: false, NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"] },
        { NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypePreciseLocation", NSPrivacyCollectedDataTypeLinked: true, NSPrivacyCollectedDataTypeTracking: false, NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"] },
        { NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypePhotosorVideos", NSPrivacyCollectedDataTypeLinked: true, NSPrivacyCollectedDataTypeTracking: false, NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"] },
        { NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeOtherUserContent", NSPrivacyCollectedDataTypeLinked: true, NSPrivacyCollectedDataTypeTracking: false, NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"] },
        { NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeSensitiveInfo", NSPrivacyCollectedDataTypeLinked: true, NSPrivacyCollectedDataTypeTracking: false, NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"] },
      ],
    },
  },
  android: {
    package: BUNDLE_ID,
    versionCode: 1,
    adaptiveIcon: {
      foregroundImage: "./assets/brand/adaptive-foreground.png",
      monochromeImage: "./assets/brand/adaptive-monochrome.png",
      backgroundColor: "#1E46D8",
    },
    permissions: ["ACCESS_COARSE_LOCATION", "ACCESS_FINE_LOCATION", "CAMERA", "POST_NOTIFICATIONS"],
    blockedPermissions: [
      "android.permission.ACCESS_BACKGROUND_LOCATION",
      "android.permission.RECORD_AUDIO",
      "android.permission.READ_CONTACTS",
      "android.permission.SYSTEM_ALERT_WINDOW",
    ],
    predictiveBackGestureEnabled: false,
    config: process.env.GOOGLE_MAPS_ANDROID_API_KEY ? { googleMaps: { apiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY } } : undefined,
  },
  web: { favicon: "./assets/brand/favicon.png", bundler: "metro", output: "single" },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-font",
    "expo-image",
    "expo-web-browser",
    ["expo-localization", { supportsRTL: true, forcesRTL: false, supportedLocales: ["ar", "en"] }],
    ["expo-splash-screen", {
      image: "./assets/brand/splash-icon.png",
      imageWidth: 180,
      resizeMode: "contain",
      backgroundColor: "#FFFFFF",
      dark: { image: "./assets/brand/splash-icon-dark.png", backgroundColor: "#070D24" },
    }],
    ["expo-location", {
      locationWhenInUsePermission:
        "يستخدم فزّاع موقعك لتحديد موقع الاستلام والتسليم وعرض الطلبات القريبة، وتتبع الطلب النشط فقط. FAZZA uses your location for pickup/drop-off, nearby requests and active-order tracking only.",
      isIosBackgroundLocationEnabled: false,
      isAndroidBackgroundLocationEnabled: false,
    }],
    ["expo-image-picker", {
      photosPermission: "يستخدم فزّاع الصور لإرفاق صور الطلب والمستندات والإيصالات. FAZZA uses photos to attach item photos, documents and receipts.",
      cameraPermission: "يستخدم فزّاع الكاميرا لتصوير الطلب والمستندات وإثبات التسليم. FAZZA uses the camera for item photos, documents and delivery proof.",
      microphonePermission: false,
    }],
    ["expo-notifications", { icon: "./assets/brand/notification-icon.png", color: "#1E46D8", defaultChannel: "default" }],
    ["react-native-maps", {
      androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY ?? "",
    }],
  ],
  experiments: { typedRoutes: true },
  extra: {
    eas: process.env.EAS_PROJECT_ID ? { projectId: process.env.EAS_PROJECT_ID } : undefined,
    supportUrl: "https://fazza.kw/support",
  },
});
